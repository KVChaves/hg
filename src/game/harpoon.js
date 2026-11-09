import { trackAt } from '../world/track.js';
import { damageOpponent } from './opponents.js';

// Arpão: sai da frente do carro e vai reto. Se encostar em outro carro até 30 m, puxa ele para trás.
// O do jogador (`holdToExtend`) segue esticando enquanto o E estiver apertado; soltou, recolhe. O dos bots voa
// de uma vez até o alcance. Errou, volta sozinho. O cabo sempre liga a ponta à frente do carro. Cada piloto tem o seu.

const RANGE = 30, FLIGHT_SPEED = 75;                 // metros e m/s a mais que o carro
const EXTEND_SPEED = 38, MIN_HOLD = 0.15, HOLD_AT_MAX = 0.4;   // modo segurar: velocidade do cabo, tempo mínimo e espera no alcance máximo
const NOSE_FORWARD = 2.3, HEIGHT = 0.62;
const PULL_DISTANCE = 8, PULL_TIME = 0.45, PULL_SPEED_LOSS = 0.6, RETRACT_TIME = 0.15;
const STEP = 0.5;                                    // de quanto em quanto a ponta procura um carro
const HOOK_SPIN = [1.4, 2.2];                        // o tranco desvia o carro preso, em rad/s de giro
const BOT_HOOK_SPIN = 2, BOT_HOOK_KNOCK = 14;        // o bot volta para a faixa sozinho, então o tranco nele é maior
const HALF_LENGTH = 2.2, HALF_WIDTH = 0.97;

// O tranco do arpão freia o carro preso e tira ele da direção, para um lado sorteado.
function jerk(racer, car) {
  const side = Math.random() < 0.5 ? -1 : 1;
  const spin = side * (HOOK_SPIN[0] + Math.random() * (HOOK_SPIN[1] - HOOK_SPIN[0]));
  if (racer.isPlayer) {
    car.vx *= PULL_SPEED_LOSS;
    car.vz *= PULL_SPEED_LOSS;
    car.spin += spin;
  } else {
    racer.v *= PULL_SPEED_LOSS;
    racer.spin += spin * BOT_HOOK_SPIN;
    racer.knock += side * BOT_HOOK_KNOCK;
  }
}

function pullBack(racer, car, distance) {
  if (!racer.isPlayer) { racer.dist -= distance; return; }
  const t = trackAt(racer.dist);
  car.x -= t.tx * distance;
  car.z -= t.tz * distance;
}

// Puxões vindos de outro navegador: quem simula o carro atingido é quem o puxa.
export function createPullReceiver(car) {
  const active = [];
  return {
    start(racer, shooter) {
      jerk(racer, car);
      if (!racer.isPlayer && shooter) damageOpponent(racer, 0, shooter);
      active.push({ racer, left: PULL_TIME });
    },
    update(dt) {
      for (let i = active.length - 1; i >= 0; i--) {
        pullBack(active[i].racer, car, PULL_DISTANCE / PULL_TIME * dt);
        if ((active[i].left -= dt) <= 0) active.splice(i, 1);
      }
    },
    reset() { active.length = 0; },
  };
}

// `owner` é o piloto de race.field que dispara. `onRemotePull` avisa quando o alvo é simulado em outro navegador.
export function createHarpoon({ owner, car, race, visual, onSound, onRemotePull = () => {}, onHooked = () => {}, holdToExtend = false }) {
  let held = false, flightTime = 0, atMaxTime = 0;
  let phase = 'idle', timer = 0, dirX = 0, dirZ = 0, tipX = 0, tipZ = 0, target = null, attachForward = 0, attachRight = 0;

  const noseX = () => owner.x - Math.sin(owner.yaw) * NOSE_FORWARD;
  const noseZ = () => owner.z - Math.cos(owner.yaw) * NOSE_FORWARD;

  function fire() {
    phase = 'flying';
    flightTime = atMaxTime = 0;
    dirX = -Math.sin(owner.yaw);
    dirZ = -Math.cos(owner.yaw);
    tipX = noseX();
    tipZ = noseZ();
    onSound('harpoon', tipX, tipZ);
  }

  function reset() {
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
      if (!target.isPlayer) damageOpponent(target, 0, owner);   // sem dano, mas o carro atingido fica com raiva
    }
    onSound('harpoonHit', target.x, target.z);
    onHooked(target);
    phase = 'pulling';
    timer = PULL_TIME;
  }

  function retract() {
    phase = 'retracting';
    timer = RETRACT_TIME;
  }

  function updateFlying(dt) {
    flightTime += dt;
    if (holdToExtend && !held && flightTime > MIN_HOLD) { retract(); return; }   // soltou o E
    // Segurando, o cabo estica numa velocidade própria; sem segurar (bots), voa de uma vez.
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

  function updatePulling(dt) {
    const { yaw } = target;
    tipX = target.x - Math.sin(yaw) * attachForward + Math.cos(yaw) * attachRight;
    tipZ = target.z - Math.cos(yaw) * attachForward - Math.sin(yaw) * attachRight;
    if (!target.remote) pullBack(target, car, PULL_DISTANCE / PULL_TIME * dt);
    if ((timer -= dt) <= 0 || target.dead > 0) { target = null; phase = 'idle'; }
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
    if (owner.dead > 0) { reset(); return; }
    if (phase === 'flying') updateFlying(dt);
    else if (phase === 'pulling') updatePulling(dt);
    else updateRetracting(dt);
    if (phase === 'idle') visual.hide();
    else {
      // No tubo o desenho acompanha o carro na parede ou no teto; a lógica segue na pista plana.
      const end = target ?? owner;
      visual.show(noseX() + owner.wx - owner.x, owner.wy + HEIGHT, noseZ() + owner.wz - owner.z, tipX + end.wx - end.x, end.wy + HEIGHT, tipZ + end.wz - end.z);
    }
  }

  return {
    get busy() { return phase !== 'idle'; },
    get tip() { return phase === 'idle' ? null : [tipX, (target ? target.y : owner.y) + HEIGHT, tipZ]; },
    fire, update, reset,
    setHeld(value) { held = value; },
  };
}
