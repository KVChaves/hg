import { CAR_MAX_HP } from '../config.js';
import { damagePlayer } from './car.js';
import { damageOpponent } from './opponents.js';
import { aimOffset, AIM_RADIUS } from './aim.js';
import { createTether, tripRacer } from './tether.js';

// Arpão: sai da frente do carro e persegue o carro mais perto dentro da área de mira (um cone em volta de onde o jogador olha; os bots, para a frente). Sem ninguém na área, vai reto. Se encostar em outro carro até 60 m, fisga: os dois ficam presos por um
// cabo por alguns segundos (game/tether.js). Preso, o cabo só se solta com o tempo ou com EMP: o dono não cancela. Cancelar só vale com o cabo ainda em voo.
// O do jogador (`holdToExtend`) segue esticando enquanto o E estiver apertado; soltou, recolhe. O dos bots voa
// de uma vez até o alcance. Errou, volta sozinho. O cabo sempre liga a ponta à frente do carro. Cada piloto tem o seu.

const RANGE = 60, FLIGHT_SPEED = 75;                 // metros e m/s a mais que o carro
const EXTEND_SPEED = 38, MIN_HOLD = 0.15, HOLD_AT_MAX = 0.4;   // modo segurar: velocidade do cabo, tempo mínimo e espera no alcance máximo
const NOSE_FORWARD = 2.3, HEIGHT = 0.62;
const HOOK_SPEED_LOSS = 0.8, RETRACT_TIME = 0.15;   // o tranco da fisgada; depois a corda toma conta (tether.js)
const AIM_CONE = 0.55, HOMING_TURN = 9;                 // cosseno do cone de mira (~57°) e quão rápido o cabo curva até o alvo (1/s)
const STEP = 0.5;                                    // de quanto em quanto a ponta procura um carro
const HOOK_SPIN = [0.7, 1.2];                        // o tranco desvia o carro preso, em rad/s de giro
const BOT_HOOK_SPIN = 2, BOT_HOOK_KNOCK = 14;        // o bot volta para a faixa sozinho, então o tranco nele é maior
const HALF_LENGTH = 2.2, HALF_WIDTH = 0.97;
const HOOK_DAMAGE = 15;                              // dano baixo da fisgada, na escala de CAR_MAX_HP

// Dano da fisgada em quem é simulado aqui (cada navegador cuida dos seus carros); `onKill(vítima, atirador)` avisa do abate.
function hookHurt(racer, shooter, car, onKill) {
  if (racer.isPlayer) {
    const wasAlive = car.health > 0;
    damagePlayer(car, HOOK_DAMAGE / CAR_MAX_HP * car.parts.bullet);
    if (wasAlive && car.health <= 0) onKill(racer, shooter);
  } else if (damageOpponent(racer, HOOK_DAMAGE, shooter)) {
    onKill(racer, shooter);
  }
}

// O tranco do arpão freia o carro preso e tira ele da direção, para um lado sorteado.
function jerk(racer, car) {
  const side = Math.random() < 0.5 ? -1 : 1;
  const spin = side * (HOOK_SPIN[0] + Math.random() * (HOOK_SPIN[1] - HOOK_SPIN[0]));
  if (racer.isPlayer) {
    car.vx *= HOOK_SPEED_LOSS;
    car.vz *= HOOK_SPEED_LOSS;
    car.spin += spin;
  } else {
    racer.v *= HOOK_SPEED_LOSS;
    racer.spin += spin * BOT_HOOK_SPIN;
    racer.knock += side * BOT_HOOK_KNOCK;
  }
}

// Cabos de arpões disparados em outro navegador: quem simula o carro fisgado aplica a corda nele.
export function createPullReceiver(car, { onKill = () => {} } = {}) {
  const ropes = [];
  const drop = index => { ropes[index].dispose(); ropes.splice(index, 1); };
  return {
    // Alguém atravessou o cabo de outro navegador: quem simula o carro aplica o tranco.
    trip(racer, side) { tripRacer(racer, car, side); },
    start(racer, shooter) {
      jerk(racer, car);
      hookHurt(racer, shooter ?? null, car, onKill);
      if (shooter) ropes.push(createTether({ owner: shooter, target: racer, car, ownerSide: false }));
    },
    // O dono avisou que soltou, ou o tempo acabou lá.
    endFrom(shooter) {
      for (let i = ropes.length - 1; i >= 0; i--) if (ropes[i].owner === shooter) drop(i);
    },
    // Segundos que `racer` ainda fica preso (0 se não está).
    leftFor(racer) {
      return ropes.reduce((left, rope) => (rope.target === racer ? Math.max(left, rope.left()) : left), 0);
    },
    update(dt) {
      for (let i = ropes.length - 1; i >= 0; i--) if (ropes[i].update(dt)) drop(i);
    },
    reset() { while (ropes.length) drop(0); },
  };
}

// `owner` é o piloto de race.field que dispara. `onRemotePull` avisa quando o alvo é simulado em outro navegador.
export function createHarpoon({ owner, car, race, visual, onSound, onRemotePull = () => {}, onTetherEnd = () => {}, onHooked = () => {}, onKill = () => {}, onTrip = () => {}, playerAim = false, holdToExtend = false, aimYaw = () => owner.yaw }) {
  let held = false, flightTime = 0, atMaxTime = 0, rope = null;
  let phase = 'idle', timer = 0, dirX = 0, dirZ = 0, aimX = 0, aimZ = 0, lock = null, tipX = 0, tipZ = 0, target = null, attachForward = 0, attachRight = 0;

  const noseX = () => owner.x - Math.sin(owner.yaw) * NOSE_FORWARD;
  const noseZ = () => owner.z - Math.cos(owner.yaw) * NOSE_FORWARD;

  function fire() {
    phase = 'flying';
    flightTime = atMaxTime = 0;
    const yaw = aimYaw();                            // o do jogador sai para onde ele aponta; o dos bots, reto
    dirX = aimX = -Math.sin(yaw);
    dirZ = aimZ = -Math.cos(yaw);
    tipX = noseX();
    tipZ = noseZ();
    lock = null;
    acquire();
    onSound('harpoon', tipX, tipZ);
  }

  // O carro mais perto da ponta, dentro do cone da mira (direção `ax`, `az`) e do alcance.
  function findLock(ax, az) {
    let best = Infinity, found = null;
    for (const racer of race.field) {
      if (racer === owner || racer.dead > 0 || racer.sunk > 0) continue;
      const dx = racer.x - noseX(), dz = racer.z - noseZ(), d = Math.hypot(dx, dz) || 1;
      if (d > RANGE || d >= best) continue;
      if (playerAim) {                               // mira do jogador: na linha de visada (aim.js)
        const { forward, lateral } = aimOffset(noseX(), noseZ(), Math.atan2(-ax, -az), racer.x, racer.z);
        if (forward <= 3 || Math.abs(lateral) > AIM_RADIUS) continue;
      } else if ((dx * ax + dz * az) / d < AIM_CONE) continue;
      best = d;
      found = racer;
    }
    return found;
  }
  const acquire = () => { lock = findLock(aimX, aimZ); };

  // Curva a direção do cabo até o carro travado.
  function homeIn(dt) {
    if (!lock || lock.dead > 0 || lock.sunk > 0) acquire();
    if (!lock) return;
    const dx = lock.x - tipX, dz = lock.z - tipZ, d = Math.hypot(dx, dz) || 1, k = Math.min(1, HOMING_TURN * dt);
    const nx = dirX + (dx / d - dirX) * k, nz = dirZ + (dz / d - dirZ) * k, n = Math.hypot(nx, nz) || 1;
    dirX = nx / n;
    dirZ = nz / n;
  }

  function dropRope() {
    rope?.dispose();
    rope = null;
  }

  function reset() {
    dropRope();
    phase = 'idle';
    target = null;
    visual.hide();
  }

  function carAt(x, z) {
    for (const racer of race.field) {
      if (racer === owner || racer.dead > 0) continue;
      const { yaw } = racer, dx = x - racer.x, dz = z - racer.z;
      const forward = -Math.sin(yaw) * dx - Math.cos(yaw) * dz, right = Math.cos(yaw) * dx - Math.sin(yaw) * dz;
      if (Math.abs(forward) <= HALF_LENGTH && Math.abs(right) <= HALF_WIDTH) return { racer, forward, right };
    }
    return null;
  }

  function latch(hit) {
    target = hit.racer;
    attachForward = hit.forward;
    attachRight = hit.right;
    if (target.remote) {
      onRemotePull(target, owner);
    } else {
      jerk(target, car);
      hookHurt(target, owner, car, onKill);       // dano baixo; o carro atingido também fica com raiva
    }
    onSound('harpoonHit', target.x, target.z);
    onHooked(target);
    rope = createTether({ owner, target: hit.racer, car, ownerSide: true, field: race.field, onTrip });
    phase = 'tethered';
  }

  function retract() {
    phase = 'retracting';
    timer = RETRACT_TIME;
  }

  function updateFlying(dt) {
    flightTime += dt;
    if (holdToExtend && !held && flightTime > MIN_HOLD) { retract(); return; }   // soltou o E
    // Segurando, o cabo estica numa velocidade própria; sem segurar (bots), voa de uma vez.
    homeIn(dt);
    let travel = ((holdToExtend ? EXTEND_SPEED : FLIGHT_SPEED) + Math.max(0, owner.v)) * dt;
    while (travel > 0) {
      const step = Math.min(STEP, travel);
      travel -= step;
      tipX += dirX * step;
      tipZ += dirZ * step;
      const hit = carAt(tipX, tipZ);
      if (hit) { latch(hit); return; }
      const reach = Math.hypot(tipX - noseX(), tipZ - noseZ());
      if (reach >= RANGE) {
        if (!holdToExtend) { retract(); return; }
        const k = RANGE / reach;                     // no alcance máximo o cabo só acompanha o carro
        tipX = noseX() + (tipX - noseX()) * k;
        tipZ = noseZ() + (tipZ - noseZ()) * k;
        if ((atMaxTime += dt) >= HOLD_AT_MAX) { retract(); return; }
        break;
      }
    }
  }

  function endTether(reason) {
    if (target) onTetherEnd(target, reason);
    dropRope();
    target = null;
    retract();
  }

  function updateTethered(dt) {
    const { yaw } = target;
    tipX = target.x - Math.sin(yaw) * attachForward + Math.cos(yaw) * attachRight;
    tipZ = target.z - Math.cos(yaw) * attachForward - Math.sin(yaw) * attachRight;
    const reason = rope.update(dt);
    if (reason) endTether(reason);
  }

  function updateRetracting(dt) {
    timer -= dt;
    const k = Math.max(0, timer) / RETRACT_TIME, baseX = noseX(), baseZ = noseZ();
    tipX = baseX + (tipX - baseX) * k;
    tipZ = baseZ + (tipZ - baseZ) * k;
    if (timer <= 0) phase = 'idle';
  }

  function update(dt) {
    if (phase === 'idle' || dt <= 0) return;
    if (owner.dead > 0 && phase !== 'tethered') { reset(); return; }   // preso, o cabo segue mesmo com o dono destruído
    if (phase === 'flying') updateFlying(dt);
    else if (phase === 'tethered') updateTethered(dt);
    else updateRetracting(dt);
    if (phase === 'idle') visual.hide();
    else {
      // No tubo o desenho acompanha o carro na parede ou no teto; a lógica segue na pista plana.
      const end = target ?? owner;
      visual.setTension?.(rope ? rope.tension : 0);
      visual.show(noseX() + owner.wx - owner.x, owner.wy + HEIGHT, noseZ() + owner.wz - owner.z, tipX + end.wx - end.x, end.wy + HEIGHT, tipZ + end.wz - end.z);
    }
  }

  return {
    get busy() { return phase !== 'idle'; },
    // Quem o arpão travaria se fosse disparado agora, mirando para `yaw` (sem disparar).
    targetAt: (yaw = aimYaw()) => findLock(-Math.sin(yaw), -Math.cos(yaw)),
    get tip() { return phase === 'idle' ? null : [tipX, (target ? target.y : owner.y) + HEIGHT, tipZ]; },
    fire, update, reset,
    // Segundos até o cabo se soltar sozinho (0 se não há cabo).
    get tetherLeft() { return rope ? rope.left() : 0; },
    setHeld(value) {
      // Lançamento em voo: um novo aperto do E (soltou e apertou de novo) cancela e recolhe o cabo.
      if (phase === 'flying' && value && !held && flightTime > 0.05) retract();
      held = value;
    },
  };
}
