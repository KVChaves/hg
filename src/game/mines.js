import * as THREE from 'three';
import { CAR_MAX_HP } from '../config.js';
import { damagePlayer } from './car.js';
import { damageOpponent } from './opponents.js';
import { MINE_CONE, MINE_DAMAGE, MINE_FLIGHT_MAX, MINE_FUSE, MINE_RANGE, MINE_SPEED } from './trapTypes.js';

// Mina teleguiada: sai da frente do carro, persegue o carro mais bem alinhado à frente (até MINE_RANGE), gruda nele
// e explode depois de MINE_FUSE segundos. Quem simula a mina é o navegador de quem a lançou; os outros navegadores
// recebem só uma cópia "fantasma" ao grudar (aviso e explosão, sem dano). O pulso EMP de quem está com a mina a desarma.
const NOSE_FORWARD = 2.3, LAUNCH_HEIGHT = 0.8, HIT_RADIUS = 1.6, STICK_HEIGHT = 1.0, STICK_FORWARD = 0.6;
const TARGET_HEIGHT = 0.8;
const MINE_LOCK_CONE = 0.5, MINE_TURN = 6;   // cosseno do cone de trava (~60°) e quão rápido ela curva (1/s)
const HIT_SPEED_LOSS = 0.65, HIT_SPIN = 2.5, BOT_HIT_KNOCK = 8;

// `onExplode(x, y, z)`: desenha a explosão. `onAttach(mine)`: avisa a rede. `onKill(vítima, dono)`: derrubou um carro.
export function createMines({ scene, race, car, onSound, onExplode, onAttach = () => {}, onKill = () => {} }) {
  const mines = [];
  const bodyGeometry = new THREE.SphereGeometry(0.28, 10, 8), lightGeometry = new THREE.SphereGeometry(0.11, 8, 6);
  const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x2a2c32, fog: false });
  const offMaterial = new THREE.MeshBasicMaterial({ color: 0x501010, fog: false }), onMaterial = new THREE.MeshBasicMaterial({ color: 0xff3020, fog: false });

  function makeMesh() {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(bodyGeometry, bodyMaterial));
    const light = new THREE.Mesh(lightGeometry, offMaterial);
    light.position.y = 0.28;
    group.add(light);
    scene.add(group);
    return { group, light };
  }

  const aimed = (owner, racer) => {
    const dx = racer.x - owner.x, dz = racer.z - owner.z, distance = Math.hypot(dx, dz) || 1;
    const forward = -Math.sin(owner.yaw) * dx - Math.cos(owner.yaw) * dz;
    return forward > 3 && distance <= MINE_RANGE && forward / distance >= MINE_CONE ? distance : null;
  };

  // O carro mais perto, dentro do cone à frente de quem lança.
  function findTarget(owner) {
    let best = null, bestDistance = Infinity;
    for (const racer of race.field) {
      if (racer === owner || racer.dead > 0 || racer.protectedFor > 0) continue;
      const distance = aimed(owner, racer);
      if (distance !== null && distance < bestDistance) { best = racer; bestDistance = distance; }
    }
    return best;
  }

  const api = {
    hasTarget: owner => Boolean(findTarget(owner)),

    launch(owner) {
      const target = findTarget(owner);
      if (!target) return false;
      const { group, light } = makeMesh();
      mines.push({
        owner, target, group, light, ghost: false, phase: 'flying', age: 0, fuse: MINE_FUSE, beep: 0, lit: 0, id: Math.random().toString(36).slice(2, 8),
        x: owner.wx - Math.sin(owner.yaw) * NOSE_FORWARD, y: owner.wy + LAUNCH_HEIGHT, z: owner.wz - Math.cos(owner.yaw) * NOSE_FORWARD,
      });
      onSound('mineLaunch', owner.x, owner.z);
      return true;
    },

    // Arremesso do jogador: a mina sai para onde ele mira (`yaw`), trava o carro mais perto do cone e o persegue; sem alvo, segue reta.
    throwStraight(owner, yaw) {
      const { group, light } = makeMesh();
      const dirX = -Math.sin(yaw), dirZ = -Math.cos(yaw);
      mines.push({
        owner, target: null, dirX, dirZ, group, light, ghost: false, phase: 'flying', age: 0, fuse: MINE_FUSE, beep: 0, lit: 0, travelled: 0, id: Math.random().toString(36).slice(2, 8),
        x: owner.wx + dirX * NOSE_FORWARD, y: owner.wy + LAUNCH_HEIGHT, z: owner.wz + dirZ * NOSE_FORWARD,
      });
      onSound('mineLaunch', owner.x, owner.z);
    },

    // Mina de outro navegador que acabou de grudar: só aviso e explosão aqui.
    addGhost(owner, target, fuse) {
      const { group, light } = makeMesh();
      mines.push({ owner, target, group, light, ghost: true, phase: 'stuck', age: 0, fuse, beep: 0, lit: 0, x: 0, y: 0, z: 0 });
    },

    // Segundos até explodir da mina que está grudada em `racer` (0 se não há).
    fuseOn(racer) {
      let left = 0;
      for (const mine of mines) if (mine.target === racer && mine.phase === 'stuck') left = left ? Math.min(left, mine.fuse) : mine.fuse;
      return left;
    },

    // O EMP de quem está com mina grudada a desarma. Devolve quantas.
    defuse(racer) {
      let count = 0;
      for (let i = mines.length - 1; i >= 0; i--) {
        if (mines[i].target !== racer) continue;
        remove(i);
        count++;
      }
      return count;
    },

    reset() { for (let i = mines.length - 1; i >= 0; i--) remove(i); },

    update(dt) {
      for (let i = mines.length - 1; i >= 0; i--) {
        const mine = mines[i];
        mine.age += dt;
        const { target } = mine;
        if ((target && target.dead > 0) || (mine.phase === 'flying' && mine.owner.dead > 0)) { remove(i); continue; }
        if (mine.phase === 'flying') (mine.target ? flyMine : flyStraight)(mine, dt, i);
        else stuckMine(mine, dt, i);
        if (mines[i] !== mine) continue;
        mine.group.position.set(mine.x, mine.y, mine.z);
      }
    },
  };

  function remove(index) {
    scene.remove(mines[index].group);
    mines.splice(index, 1);
  }

  function flyMine(mine, dt, index) {
    const { target, owner } = mine;
    const tx = target.wx, ty = target.wy + TARGET_HEIGHT, tz = target.wz;
    const dx = tx - mine.x, dy = ty - mine.y, dz = tz - mine.z, distance = Math.hypot(dx, dy, dz) || 1;
    const step = (MINE_SPEED + Math.max(0, owner.v)) * dt;
    if (mine.age > MINE_FLIGHT_MAX) { remove(index); return; }
    if (distance <= step + HIT_RADIUS) {
      mine.phase = 'stuck';
      onSound('mineStick', target.x, target.z);
      onAttach(mine);
      return;
    }
    mine.x += dx / distance * step;
    mine.y += dy / distance * step;
    mine.z += dz / distance * step;
    mine.light.material = onMaterial;
  }

  // Teleguiada: trava o carro mais perto dentro do cone da direção atual e curva a mina até ele (3D). Sem alvo, segue reta.
  function steer(mine, dt) {
    const { owner } = mine;
    const len = Math.hypot(mine.dirX, mine.dirY ?? 0, mine.dirZ) || 1;
    const dir = [mine.dirX / len, (mine.dirY ?? 0) / len, mine.dirZ / len];
    const alive = racer => racer && racer.dead <= 0 && racer.protectedFor <= 0;
    if (!alive(mine.lock)) {
      mine.lock = null;
      let best = Infinity;
      for (const racer of race.field) {
        if (racer === owner || !alive(racer)) continue;
        const dx = racer.wx - mine.x, dy = racer.wy + TARGET_HEIGHT - mine.y, dz = racer.wz - mine.z, d = Math.hypot(dx, dy, dz) || 1;
        if (d > MINE_RANGE || (dx * dir[0] + dy * dir[1] + dz * dir[2]) / d < MINE_LOCK_CONE || d >= best) continue;
        best = d;
        mine.lock = racer;
      }
    }
    if (!mine.lock) return;
    const dx = mine.lock.wx - mine.x, dy = mine.lock.wy + TARGET_HEIGHT - mine.y, dz = mine.lock.wz - mine.z, d = Math.hypot(dx, dy, dz) || 1;
    const k = Math.min(1, MINE_TURN * dt);
    const nx = dir[0] + (dx / d - dir[0]) * k, ny = dir[1] + (dy / d - dir[1]) * k, nz = dir[2] + (dz / d - dir[2]) * k, n = Math.hypot(nx, ny, nz) || 1;
    mine.dirX = nx / n; mine.dirY = ny / n; mine.dirZ = nz / n;
  }

  // Voa em passos curtos (não atravessa carro); gruda no primeiro que encostar.
  function flyStraight(mine, dt, index) {
    const { owner } = mine;
    let travel = (MINE_SPEED + Math.max(0, owner.v)) * dt;
    mine.light.material = onMaterial;
    steer(mine, dt);
    while (travel > 0) {
      const step = Math.min(0.5, travel);
      travel -= step;
      mine.x += mine.dirX * step;
      mine.y += (mine.dirY ?? 0) * step;
      mine.z += mine.dirZ * step;
      mine.travelled += step;
      for (const racer of race.field) {
        if (racer === owner || racer.dead > 0 || racer.protectedFor > 0) continue;
        if (Math.hypot(racer.wx - mine.x, racer.wy + TARGET_HEIGHT - mine.y, racer.wz - mine.z) > HIT_RADIUS + 0.6) continue;
        mine.target = racer;
        mine.phase = 'stuck';
        onSound('mineStick', racer.x, racer.z);
        onAttach(mine);
        return;
      }
      if (mine.travelled >= MINE_RANGE * 1.5 || mine.age > MINE_FLIGHT_MAX) { remove(index); return; }
    }
  }

  function stuckMine(mine, dt, index) {
    const { target } = mine;
    mine.x = target.wx - Math.sin(target.yaw) * STICK_FORWARD;
    mine.y = target.wy + STICK_HEIGHT;
    mine.z = target.wz - Math.cos(target.yaw) * STICK_FORWARD;
    mine.fuse -= dt;
    // O pisca acelera conforme o pavio acaba.
    mine.beep -= dt;
    mine.lit = Math.max(0, mine.lit - dt);
    if (mine.beep <= 0) {
      mine.beep = 0.15 + 0.5 * Math.max(0, mine.fuse) / MINE_FUSE;
      mine.lit = 0.07;
      onSound('mineBeep', target.x, target.z);
    }
    mine.light.material = mine.lit > 0 ? onMaterial : offMaterial;
    if (mine.fuse > 0) return;
    explode(mine);
    remove(index);
  }

  function explode(mine) {
    const { target, owner } = mine;
    onExplode(mine.x, mine.y, mine.z);
    onSound('mine', mine.x, mine.z);
    if (mine.ghost || target.remote) {
      // Quem simula o alvo remoto recebe o dano pelo `hit` (damageOpponent); a cópia fantasma não causa dano.
      if (!mine.ghost) damageOpponent(target, MINE_DAMAGE * CAR_MAX_HP, owner);
      return;
    }
    if (target.isPlayer) {
      const wasAlive = car.health > 0;
      damagePlayer(car, MINE_DAMAGE * car.parts.bullet);
      car.vx *= HIT_SPEED_LOSS;
      car.vz *= HIT_SPEED_LOSS;
      car.spin += (Math.random() < 0.5 ? -1 : 1) * HIT_SPIN;
      if (wasAlive && car.health <= 0) onKill(target, owner);
      return;
    }
    const side = Math.random() < 0.5 ? -1 : 1;
    target.v *= HIT_SPEED_LOSS;
    target.spin += side * HIT_SPIN;
    target.knock += side * BOT_HIT_KNOCK;
    if (damageOpponent(target, MINE_DAMAGE * CAR_MAX_HP, owner)) onKill(target, owner);
  }

  return api;
}
