import * as THREE from 'three';
import { CAR_MAX_HP, TRACK_WIDTH } from '../config.js';
import { surfaceAt, track, trackAt, wrapDistance } from '../world/track.js';
import { createDebris, createObstacleVisual, createShadow } from '../world/obstacleVisuals.js';
import { crashDamage } from './car.js';
import { damageOpponent } from './opponents.js';
import { HAZARD_KINDS } from './hazardKinds.js';
import { OBSTACLE_TYPES } from './obstacleTypes.js';

// Obstáculos dos pontos de perigo (hazardKinds.js): cada ponto fixo da pista dispara quando um carro chega perto,
// avisa (sombra e poeira, árvore balançando, bicho parado na beira) e depois recarrega. Qualquer carro dispara;
// como o primeiro a chegar costuma ser o líder, é ele quem mais abre caminho. Com o líder disparado os pontos
// recarregam até 2x mais rápido, e quem bate liderando perde mais velocidade (vale igual para jogador e bots).

const COOLDOWN = [20, 35], FIRST_COOLDOWN = [6, 14], MAX_ACTIVE = 2;   // segundos; no máximo 2 perigos em ação ao mesmo tempo
const LEAD_FOR_DOUBLE = 60, MAX_PRESSURE = 2;        // metros de vantagem do líder que dobram o ritmo da recarga
const RESPAWN_CLEAR = 150;                           // o que fica esperando (árvore, obras) só volta sem ninguém a essa distância
const FALL_TIME = 0.55, TOPPLE_TIME = 0.9, TOPPLE_SOLID_AT = 0.65, TOPPLE_LEAN = 0.12, WOBBLE = 0.06, WOBBLE_RATE = 18;
const SHAKE = 0.25, SHAKE_RATE = 30, DUST_COLORS = { rock: [0x8a867e, 0x6a665e], stalactite: [0xd8f4ff, 0x9ad8f0], barrels: [0xe8c020, 0x5a5a5a], crates: [0x9a7038, 0x5a5a5a], pillar: [0xe0b078, 0xc88a50], meteor: [0x8a8480, 0x5a5450], coconut: [0xd8c090, 0xa89a70], cactus: [0xd8c090, 0x9a8a60], cannonball: [0x5a5a5e, 0x8a8a8e] };
const LEAF_COLORS = [0x2f7a2a, 0x3a8c30, 0x5a3a20];
const CANNON_SMOKE = [0xd8d4cc, 0xa8a49c, 0xffb040], SPLINTERS = [0x7a5430, 0x5a3a20, 0x2a2a2e];

// Mira no chão onde a bala de canhão vai cair: anel vermelho com uma cruz, que pisca até o tiro chegar.
function createTarget() {
  const target = new THREE.Group(), material = () => new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 2.1, 24).rotateX(-Math.PI / 2), material());
  target.add(ring);
  for (const angle of [Math.PI / 4, -Math.PI / 4]) {
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.35).rotateX(-Math.PI / 2).rotateY(angle), material());
    target.add(bar);
  }
  target.position.y = 0.08;
  return target;
}
// Som de quebrar por material (nomes em audio/soundFiles.js); o que não está aqui usa `crash`.
const OBSTACLE_SOUND = {
  barrier: 'crash',
  tree: 'obstacleWood', crates: 'obstacleWood', umbrella: 'obstacleWood', cactus: 'obstacleWood', coconut: 'obstacleWood', tumbleweed: 'obstacleWood',
  carriage: 'obstacleWood', rollingBarrel: 'obstacleWood',
  animal: 'obstacleFlesh', deer: 'obstacleFlesh', boar: 'obstacleFlesh', camel: 'obstacleFlesh', crab: 'obstacleFlesh', kaiju: 'obstacleFlesh',
  stalactite: 'obstacleIce', snowball: 'obstacleIce', crystal: 'obstacleCrystal',
  rock: 'obstacleRock', pillar: 'obstacleRock', meteor: 'obstacleRock', cannonball: 'obstacleRock',
  barrels: 'obstacleMetal', antenna: 'obstacleMetal', rover: 'obstacleMetal',
};
const CAR_HALF_WIDTH = 0.95, CAR_HALF_LENGTH = 1.8, HIT_SLOWDOWN = 0.55, LEADER_HIT_SLOWDOWN = 0.2, LEADER_SPIN = 2.5;   // fração da velocidade que sobra
const PASSED_MARGIN = 35, LINGER = 8, CLEAR_VIEW = 120;   // caído na pista sem ninguém por perto, some depois de LINGER s
const EDGE_LANE = TRACK_WIDTH / 2 - 1.2, CROSS_FROM = TRACK_WIDTH / 2 + 4, BOT_LANE_LIMIT = TRACK_WIDTH / 2 - 1.2;
const DODGE_CHANCE = 0.65, DODGE_SIGHT = 55, DODGE_CLEARANCE = 2.4, DODGE_HOLD = 1;
const DRIVE_PASSED_RANGE = 400;
// Batida em obstáculo sólido: fração da velocidade de encontro com que se quica, velocidade que sobra de lado e
// impactos (m/s) mínimo e de dano cheio.
const BUMP_BOUNCE = 0.25, BUMP_SIDE_KEEP = 0.85, BUMP_REHIT = 0.6, BUMP_MIN_IMPACT = 2, BUMP_FULL_IMPACT = 25;                      // carroça: sai quando todos já a passaram (e ninguém ficou muito para trás nela)

const between = ([low, high]) => low + Math.random() * (high - low);
const clamp = (v, limit) => Math.max(-limit, Math.min(limit, v));
const kindOf = site => HAZARD_KINDS[site.kind];
const typeFor = kind => (Array.isArray(kind.obstacle) ? kind.obstacle[Math.floor(Math.random() * kind.obstacle.length)] : kind.obstacle);

// `isAuthority`: só um navegador decide quando os pontos disparam (o admin no online); os outros recebem pela rede.
// `onCaught(racer, ob)`: alguém simulado aqui bateu numa barreira inflável (ob.owner é quem a soltou).
export function createObstacles({ scene, race, car, isAuthority, onSound, onPlayerHit, onSpawned, onBroken, onCaught = () => {} }) {
  const obstacles = { active: [] };
  const debris = [];
  let nextId = 1, sites = [];
  const position = new THREE.Vector3();

  // Faixa que o obstáculo ocupa: a árvore caída cobre da base até a outra ponta.
  function bounds(ob) {
    if (ob.motion === 'topple') return { lane: ob.lane - ob.side * ob.type.length / 2, halfWidth: ob.type.length / 2 };
    return { lane: ob.lane, halfWidth: ob.type.halfWidth };
  }

  function place(ob) {
    const t = trackAt(ob.dist), pitch = Math.atan(t.slope), yaw = Math.atan2(-t.tx, -t.tz);
    const point = surfaceAt(ob.dist, ob.lane);
    ob.group.position.set(point.x, point.y, point.z);
    ob.group.rotation.order = 'YXZ';
    ob.group.rotation.set(pitch, yaw, point.roll);
  }

  // Fase inicial: o que cai ou atravessa nasce já avisando; árvore e obras nascem esperando.
  // A carroça (`drive`) já nasce andando.
  const firstPhase = motion => ({ drop: 'warning', cross: 'warning', topple: 'idle', static: 'solid', drive: 'solid' })[motion];

  function add(id, typeId, dist, lane, side, siteIndex, phase) {
    const type = OBSTACLE_TYPES[typeId], site = sites[siteIndex] ?? null, kind = site ? kindOf(site) : { motion: 'static' };
    const visual = createObstacleVisual(typeId);
    const ob = {
      id, type, visual, group: visual.group, body: visual.body, dist, lane, side, hp: type.hp, isObstacle: true, dead: false,
      site, kind, motion: kind.motion, phase: phase ?? firstPhase(kind.motion), t: 0, decisions: new Map(), shadow: null,
    };
    ob.solid = ob.phase === 'solid' || ob.motion === 'cross';
    ob.group.traverse(object => { object.userData.opponent = ob; });   // é por aqui que o tiro reconhece o obstáculo
    if (ob.motion === 'drop') {
      ob.body.position.y = kind.height;
      ob.shadow = createShadow(Math.max(type.halfWidth, type.halfLength) * 1.2);
      ob.shadow.scale.setScalar(0.2);
      ob.group.add(ob.shadow);
      if (kind.arc) {                                // tiro de canhão: a bala ainda está no navio; no chão, a mira
        ob.body.visible = false;
        ob.marker = createTarget();
        ob.group.add(ob.marker);
      }
    }
    if (ob.motion === 'topple') ob.body.rotation.z = side * TOPPLE_LEAN;
    if (ob.motion === 'cross') ob.walk = -side;
    if (ob.motion === 'drive') { ob.travelled = 0; ob.body.rotation.y = Math.PI / 2; }   // de frente para +x: vira para o sentido da pista
    if (type.inflate) { ob.body.scale.setScalar(0.05); ob.solid = false; }   // a barreira cai murcha e só vale depois de encher
    if (site) { site.ob = ob; site.state = 'active'; }
    scene.add(ob.group);
    place(ob);
    obstacles.active.push(ob);
    return ob;
  }

  // Cria o obstáculo de um ponto (só quem tem a autoridade) e avisa a rede.
  function spawnAt(site) {
    const kind = kindOf(site), typeId = typeFor(kind);
    let lane;
    if (kind.motion === 'topple') lane = site.side * EDGE_LANE;
    else if (kind.motion === 'cross') lane = site.side * CROSS_FROM;
    else if (kind.motion === 'drive') lane = site.side * between(kind.lanes);
    else if (kind.atTunnel) lane = between(kind.lanes);
    else lane = site.side * between(kind.lanes);
    onSpawned(add(nextId++, typeId, site.dist, lane, site.side, site.index));
  }

  obstacles.spawnFromNetwork = ({ n, i, d, l, s, w = -1, p, by }) => {
    if (!OBSTACLE_TYPES[i] || obstacles.active.some(ob => ob.id === n)) return;
    const ob = add(n, i, d, l, s, w, p);
    if (by !== undefined) {
      spare(ob, race.field.find(racer => racer.netId === by) ?? null);
      onSound('barrier', ob.owner?.x ?? 0, ob.owner?.z ?? 0, 0.8);   // o chiado de encher, ouvido de longe
    }
  };

  // Quem já está em cima quando ela cai não bate (só vale para quem a vê no chão).
  function spare(ob, owner) {
    ob.owner = owner;
    ob.spared = new Set(race.field.filter(racer => touches(racer, ob)));
  }

  // Barreira inflável solta por `owner` (de race.field). Qualquer navegador cria a sua e avisa os outros;
  // o id é sorteado para não bater com os dos pontos de perigo, que só o admin numera.
  obstacles.deployBarrier = (dist, lane, owner) => {
    const ob = add(`b${Math.random().toString(36).slice(2, 8)}`, 'barrier', dist, lane, 0, -1, 'solid');
    spare(ob, owner);
    onSound('barrier', owner.x, owner.z, 0.8);
    onSpawned(ob);
    return ob;
  };
  obstacles.removeFromNetwork = id => {
    const ob = obstacles.active.find(candidate => candidate.id === id);
    if (ob) destroy(ob, false);
  };

  // O ponto fica livre: espera a recarga para disparar de novo.
  function release(ob) {
    if (!ob.site || ob.site.ob !== ob) return;
    ob.site.ob = null;
    ob.site.state = 'cooldown';
    ob.site.cooldown = between(COOLDOWN);
  }

  function remove(ob) {
    obstacles.active.splice(obstacles.active.indexOf(ob), 1);
    scene.remove(ob.group);
    ob.visual.dispose();
    ob.shadow?.material.dispose();
    ob.dead = true;
    release(ob);
  }

  function destroy(ob, announce = true) {
    ob.group.getWorldPosition(position);
    debris.push(createDebris(scene, position, ob.type.debris));
    remove(ob);
    onSound(OBSTACLE_SOUND[ob.type.id] ?? 'crash', position.x, position.z, 0.7);
    if (announce) onBroken(ob);
  }

  // Tiro do jogador: devolve true se quebrou.
  obstacles.shoot = (ob, amount) => {
    if (ob.dead || ob.type.solid) return false;      // o que é sólido (carruagem) aguenta o tiro
    ob.hp -= amount;
    if (ob.hp > 0) return false;
    destroy(ob);
    return true;
  };

  const alive = () => race.field.filter(racer => racer.dead <= 0);
  const leaderOf = racers => racers.reduce((best, racer) => (!best || racer.dist > best.dist ? racer : best), null);

  // Ritmo da recarga: 1 com a corrida embolada, até MAX_PRESSURE com o líder disparado.
  function pressure() {
    const [first, second] = alive().map(racer => racer.dist).sort((a, b) => b - a);
    if (second === undefined) return 1;
    return Math.min(MAX_PRESSURE, 1 + (first - second) / LEAD_FOR_DOUBLE);
  }

  function crash(racer, ob) {
    const leading = leaderOf(alive()) === racer, keep = Math.min(ob.type.keep ?? HIT_SLOWDOWN, leading ? LEADER_HIT_SLOWDOWN : 1);
    const kick = (ob.type.spin ?? 0) + (leading ? LEADER_SPIN : 0), side = Math.random() < 0.5 ? -1 : 1;
    if (racer.isPlayer) {
      crashDamage(car, ob.type.damage);
      car.vx *= keep;
      car.vz *= keep;
      car.spin += side * kick;
      onPlayerHit(ob.type);
    } else {
      damageOpponent(racer, ob.type.damage * CAR_MAX_HP, null);
      racer.v *= keep;
      racer.spin += side * kick;
    }
    if (ob.owner) onCaught(racer, ob);
    destroy(ob);
  }

  // Obstáculo sólido (`solid` em obstacleTypes.js, como a carruagem): não quebra. Quem bate é empurrado para fora
  // dele pelo lado em que entrou menos, perde a velocidade de encontro (quica um pouco) e toma dano conforme o
  // impacto; ele segue o caminho. O dano e o aviso valem uma vez por encontro (BUMP_REHIT s sem encostar).
  function bump(racer, ob) {
    const t = trackAt(ob.dist), nx = -t.tz, nz = t.tx, along = wrapDistance(racer.dist - ob.dist), lateral = racer.lane - ob.lane;
    const alongIn = ob.type.halfLength + CAR_HALF_LENGTH - Math.abs(along), sideIn = ob.type.halfWidth + CAR_HALF_WIDTH - Math.abs(lateral);
    const own = ob.motion === 'drive' && ob.travelled < ob.kind.travel ? ob.kind.speed : 0;   // a carruagem anda junto com a pista
    let impact = 0;
    if (alongIn < sideIn) {                          // na traseira (ou de frente): volta para trás dela
      const sign = Math.sign(along) || -1;
      if (racer.isPlayer) {
        car.x += t.tx * sign * alongIn;
        car.z += t.tz * sign * alongIn;
        const v = car.vx * t.tx + car.vz * t.tz, closing = (own - v) * sign;
        if (closing > 0) { const dv = closing * sign * (1 + BUMP_BOUNCE); car.vx += t.tx * dv; car.vz += t.tz * dv; impact = closing; }
      } else {
        racer.dist += sign * alongIn;
        const closing = (own - racer.v) * sign;
        if (closing > 0) { racer.v += closing * sign * (1 + BUMP_BOUNCE); impact = closing; }
      }
    } else {                                         // de lado: sai de lado
      const sign = Math.sign(lateral) || 1;
      if (racer.isPlayer) {
        car.x += nx * sign * sideIn;
        car.z += nz * sign * sideIn;
        const vn = car.vx * nx + car.vz * nz;
        if (vn * sign < 0) { car.vx -= nx * vn * (1 + BUMP_BOUNCE); car.vz -= nz * vn * (1 + BUMP_BOUNCE); impact = Math.abs(vn); }
        car.vx *= BUMP_SIDE_KEEP;
        car.vz *= BUMP_SIDE_KEEP;
      } else {
        racer.lane += sign * sideIn;
        racer.v *= BUMP_SIDE_KEEP;
        impact = Math.abs(racer.laneRate ?? 0);
      }
    }
    const now = race.time, last = ob.bumps?.get(racer) ?? -Infinity;
    (ob.bumps ??= new Map()).set(racer, now);
    if (now - last < BUMP_REHIT || impact < BUMP_MIN_IMPACT) return;
    const share = Math.min(1, impact / BUMP_FULL_IMPACT), kick = (ob.type.spin ?? 0) * share * (Math.random() < 0.5 ? -1 : 1);
    if (racer.isPlayer) {
      crashDamage(car, ob.type.damage * share);
      car.spin += kick;
      onPlayerHit(ob.type);
    } else {
      damageOpponent(racer, ob.type.damage * share * CAR_MAX_HP, null);
      racer.spin += kick;
    }
    ob.group.getWorldPosition(position);
    onSound(OBSTACLE_SOUND[ob.type.id] ?? 'crash', position.x, position.z, 0.3 + 0.5 * share);
  }

  function touches(racer, ob) {
    const { lane, halfWidth } = bounds(ob);
    return Math.abs(wrapDistance(racer.dist - ob.dist)) < ob.type.halfLength + CAR_HALF_LENGTH && Math.abs(racer.lane - lane) < halfWidth + CAR_HALF_WIDTH;
  }

  // Os bots nem sempre percebem: cada um decide uma vez se desvia de cada obstáculo.
  function steerBots(ob) {
    const { lane, halfWidth } = bounds(ob);
    if (ob.motion === 'cross' && Math.abs(lane) > TRACK_WIDTH / 2 + halfWidth) return;   // ainda (ou já) fora da pista
    for (const racer of race.field) {
      if (racer.isPlayer || racer.remote || racer.dead > 0) continue;
      const ahead = wrapDistance(ob.dist - racer.dist);
      if (ahead <= 0 || ahead > DODGE_SIGHT || Math.abs(racer.lane - lane) > halfWidth + DODGE_CLEARANCE) continue;
      if (!ob.decisions.has(racer)) ob.decisions.set(racer, Math.random() < DODGE_CHANCE);
      if (!ob.decisions.get(racer)) continue;
      let target;
      if (ob.motion === 'topple') target = -ob.side * BOT_LANE_LIMIT;
      else if (ob.motion === 'cross') target = -ob.walk * BOT_LANE_LIMIT;        // passa por trás de quem atravessa
      else {
        const direction = racer.lane >= lane ? 1 : -1;
        target = lane + direction * (halfWidth + DODGE_CLEARANCE);
        if (Math.abs(target) > BOT_LANE_LIMIT) target = lane - direction * (halfWidth + DODGE_CLEARANCE);
      }
      racer.laneTarget = clamp(target, BOT_LANE_LIMIT);
      racer.laneHold = DODGE_HOLD;
    }
  }

  // Algum carro vindo, entre 0 e `range` metros antes do ponto.
  const approaching = (dist, range) => alive().some(racer => {
    const ahead = wrapDistance(dist - racer.dist);
    return ahead > 0 && ahead < range;
  });
  const anyoneNear = (dist, range) => race.field.some(racer => Math.abs(wrapDistance(dist - racer.dist)) < range);

  function dropDust(ob, height) {
    ob.group.getWorldPosition(position);
    position.y += height;
    debris.push(createDebris(scene, position, DUST_COLORS[ob.type.id] ?? ob.type.debris, 7, { dust: true }));
  }

  // O que cai pousou: fica sólido. Quem já está embaixo quando pousa não bate: só vale para quem o vê no chão.
  function landDrop(ob) {
    ob.phase = 'solid';
    ob.solid = true;
    ob.spared = new Set(race.field.filter(racer => touches(racer, ob)));
    ob.body.position.set(0, 0, 0);
    ob.group.remove(ob.shadow);
    if (ob.marker) { ob.group.remove(ob.marker); ob.marker = null; }
    ob.group.getWorldPosition(position);
    onSound('crash', position.x, position.z, 0.5);
    if (ob.kind.arc) debris.push(createDebris(scene, position, SPLINTERS, 10));   // a bala estilhaça as tábuas
  }

  // Estrondo e fumaça na boca do canhão, no costado do navio do lado do ponto.
  function fireCannon(ob, kind) {
    ob.group.updateMatrixWorld(true);                // recém-criado: a matriz ainda não foi atualizada pelo desenho
    position.set(ob.side * kind.arc.from - ob.lane, kind.arc.muzzle, 0);
    ob.group.localToWorld(position);
    debris.push(createDebris(scene, position, CANNON_SMOKE, 9, { dust: true }));
    onSound('dynamite', position.x, position.z, 0.8);
  }

  function animate(ob, dt) {
    ob.t += dt;
    const { kind } = ob;
    if (ob.type.inflate) {                           // enche em `inflate` s, com um pequeno exagero no fim
      const k = Math.min(1, ob.t / ob.type.inflate);
      ob.body.scale.set(0.05 + 0.95 * k, (0.05 + 0.95 * k) * (1 + Math.sin(k * Math.PI) * 0.15), 0.05 + 0.95 * k);
      if (k >= 1 && !ob.solid) {                     // cheia: passa a bloquear (quem está em cima nessa hora não bate)
        ob.solid = true;
        ob.spared = new Set(race.field.filter(racer => touches(racer, ob)));
      }
    }
    if (ob.motion === 'drop') {
      if (ob.phase === 'warning' && kind.arc) {
        // Canhão: fumaça e estrondo no navio quando ele mira; no chão, a mira vermelha pisca cada vez mais rápido.
        if (ob.t - dt <= 0) fireCannon(ob, kind);
        const urgency = Math.min(1, ob.t / kind.warning), blink = Math.sin(ob.t * (8 + urgency * 22));
        ob.marker.scale.setScalar(1 + 0.12 * blink);
        ob.marker.children.forEach(part => { part.material.opacity = 0.55 + 0.45 * Math.max(0, blink); });
        ob.shadow.scale.setScalar(ob.shadow.userData.radius * (0.2 + 0.8 * urgency));
        if (ob.t >= kind.warning) { ob.phase = 'falling'; ob.t = 0; ob.body.visible = true; }
      } else if (ob.phase === 'falling' && kind.arc) {
        // A bala voa em arco do costado do navio até a mira.
        const k = Math.min(1, ob.t / kind.arc.time), from = ob.side * kind.arc.from - ob.lane;
        ob.body.position.x = from * (1 - k);
        ob.body.position.y = kind.arc.muzzle * (1 - k) + kind.arc.apex * 4 * k * (1 - k);
        if (k >= 1) landDrop(ob);
      } else if (ob.phase === 'warning') {
        // Sacode lá em cima, solta poeira e a sombra cresce no chão onde vai cair.
        ob.body.position.x = Math.sin(ob.t * SHAKE_RATE) * SHAKE;
        ob.shadow.scale.setScalar(ob.shadow.userData.radius * (0.2 + 0.8 * Math.min(1, ob.t / kind.warning)));
        if (ob.t - dt < 0.05 || (ob.t - dt < kind.warning * 0.6 && ob.t >= kind.warning * 0.6)) dropDust(ob, kind.height);
        if (ob.t >= kind.warning) { ob.phase = 'falling'; ob.t = 0; ob.body.position.x = 0; }
      } else if (ob.phase === 'falling') {
        const k = Math.min(1, ob.t / FALL_TIME);
        ob.body.position.y = kind.height * (1 - k * k);
        ob.body.rotation.y += dt * 4;
        if (k >= 1) landDrop(ob);
      }
    } else if (ob.motion === 'topple') {
      if (ob.phase === 'idle' && approaching(ob.dist, kind.range)) { ob.phase = 'warning'; ob.t = 0; }
      if (ob.phase === 'warning') {
        // O galho estala: a árvore balança e solta folhas antes de vir abaixo.
        ob.body.rotation.z = ob.side * (TOPPLE_LEAN + Math.sin(ob.t * WOBBLE_RATE) * WOBBLE);
        if (ob.t - dt < 0.05) { ob.group.getWorldPosition(position); position.y += 7; debris.push(createDebris(scene, position, LEAF_COLORS, 8, { dust: true })); }
        if (ob.t >= kind.warning) { ob.phase = 'falling'; ob.t = 0; }
      } else if (ob.phase === 'falling') {
        const k = Math.min(1, ob.t / TOPPLE_TIME), angle = TOPPLE_LEAN + (Math.PI / 2 - TOPPLE_LEAN) * k * k;
        ob.body.rotation.z = ob.side * angle;
        ob.solid = k >= TOPPLE_SOLID_AT;
        if (k >= 1) ob.phase = 'solid';
      }
    } else if (ob.motion === 'cross') {
      // Espera na beira (dá para ver chegando) e atravessa; do outro lado, vai embora.
      if (ob.phase === 'warning' && ob.t >= kind.warning) ob.phase = 'walking';
      if (ob.phase === 'walking') {
        const step = kind.speed * dt;
        ob.lane += ob.walk * step;
        if (ob.type.radius) ob.body.rotation.z -= ob.walk * step / ob.type.radius;   // a bola rola
        place(ob);
      }
      ob.body.rotation.y = ob.type.radius ? 0 : ob.walk > 0 ? 0 : Math.PI;
    } else if (ob.motion === 'drive' && ob.travelled < kind.travel) {
      // A carroça segue pela faixa dela, devagar, até o fim da reta que o ponto reservou; aí para.
      const step = Math.min(kind.speed * dt, kind.travel - ob.travelled);
      ob.dist += step;
      ob.travelled += step;
      ob.visual.roll?.(step);
      place(ob);
    }
  }

  // O que ninguém mais vai alcançar sai da pista: todos já passaram, ou terminou a travessia.
  const passedByAll = ob => ob.phase !== 'idle' && race.field.every(racer => {
    const behind = wrapDistance(racer.dist - ob.dist);
    return behind > PASSED_MARGIN && (ob.motion !== 'drive' || behind < DRIVE_PASSED_RANGE);
  });
  const crossedOver = ob => ob.motion === 'cross' && Math.sign(ob.lane) === Math.sign(ob.walk) && Math.abs(ob.lane) > CROSS_FROM;

  obstacles.reset = () => {
    for (const ob of [...obstacles.active]) { scene.remove(ob.group); ob.visual.dispose(); }
    obstacles.active.length = 0;
    for (const piece of debris) piece.dispose();
    debris.length = 0;
    sites = track.hazards.map((site, index) => ({ ...site, index, state: 'cooldown', cooldown: between(FIRST_COOLDOWN), ob: null }));
    // Árvore torta e obras já estão lá na largada.
    if (isAuthority()) for (const site of sites) if (kindOf(site).idle) { site.state = 'ready'; spawnAt(site); }
  };

  function updateSites(dt) {
    const push = pressure(), busy = obstacles.active.filter(ob => ob.phase !== 'idle' && ob.motion !== 'static' && ob.motion !== 'drive').length;
    let available = MAX_ACTIVE - busy;
    for (const site of sites) {
      const kind = kindOf(site);
      if (site.state === 'cooldown' && (site.cooldown -= dt * push) <= 0) site.state = 'ready';
      if (site.state !== 'ready') continue;
      if (kind.idle) {
        if (!anyoneNear(site.dist, RESPAWN_CLEAR)) spawnAt(site);   // volta sem ninguém ver brotar
      } else if (available > 0 && approaching(site.dist, kind.range)) {
        spawnAt(site);
        available--;
      }
    }
  }

  obstacles.update = dt => {
    for (let i = debris.length - 1; i >= 0; i--) {
      if (!debris[i].update(dt)) { debris[i].dispose(); debris.splice(i, 1); }
    }
    if (!race.started || race.finished || dt <= 0) return;
    if (isAuthority()) updateSites(dt);
    for (const ob of [...obstacles.active]) {
      animate(ob, dt);
      steerBots(ob);
      if (ob.solid) {
        if (ob.spared) { for (const racer of ob.spared) if (!touches(racer, ob)) ob.spared.delete(racer); }
        const hitter = race.field.find(racer => !ob.spared?.has(racer) && !racer.remote && racer.dead <= 0 && !racer.airborne && !(racer.isPlayer && (car.wrecked > 0 || car.overturned || car.airborne)) && touches(racer, ob));
        if (hitter && ob.type.solid) bump(hitter, ob);
        else if (hitter) { crash(hitter, ob); continue; }
      }
      // Pedra caída, árvore tombada: saem quando todos passaram, ou depois de um tempo longe de todo mundo.
      // As obras (static) ficam até alguém bater.
      const settled = ob.phase === 'solid' && ob.motion !== 'static' && ob.motion !== 'drive';
      if (settled) ob.solidFor = (ob.solidFor ?? 0) + dt;
      if (ob.type.life && ob.t > ob.type.life) { destroy(ob, false); continue; }   // murcha sozinha em todos os navegadores
      if (crossedOver(ob) || (settled && (passedByAll(ob) || (ob.solidFor > LINGER && !anyoneNear(ob.dist, CLEAR_VIEW)))) || (ob.motion === 'drive' && passedByAll(ob))) remove(ob);
    }
  };

  return obstacles;
}
