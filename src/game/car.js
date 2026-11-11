import { ACCEL, MAX_SPEED, NITRO_ACCEL, NITRO_DRAIN, NITRO_MAX_SPEED, SLIPSTREAM_KMH, TRACK_WIDTH, WHEELBASE } from '../config.js';
import { createRig } from './carRoll.js';
import { NEUTRAL_STATS } from './carUpgrades.js';
import { createEffects, tickEffects } from './effects.js';

const OFFROAD_LIMIT = TRACK_WIDTH / 2 + 1.4;
const WRECK_BRAKING = 2.2, DRIFT_MIN_SPEED = 8, SPIN_DECAY = 3.5;
const PUNCTURE_SPEED_FACTOR = 0.75, PUNCTURE_PULL = 0.16, OIL_WOBBLE = 0.5, OIL_GRIP = 0.6;
const ENCLOSED_GRIP = 1.5, ENCLOSED_SIDE_GRIP = 13, ENCLOSED_CURVE_ASSIST = 0.8;   // em túnel e tubo o carro cola na pista e acompanha a curva
const GRIP_ACCEL = 18, GRIP_MIN_SPEED = 8;           // aceleração lateral máxima sem derrapar: curva fechada em alta não dá
const DRIFT_YAW_RATE = 2.3, DRIFT_FOLLOW = 0.55;     // no drift o bico gira mais rápido e a trajetória acompanha só parte do giro
const ICE_SIDE_GRIP = 1.8;                           // na ponte de gelo o carro escorrega de lado
const OIL_SPIN = 1.4, OIL_SWING_RATE = 5.5, OIL_SPIN_FULL_SPEED = 15;      // rabeada: giro em rad/s e ritmo do vaivém

export function createCar() {
  return {
    x: 0, y: 0, z: 0, pitch: 0, yaw: 0, vx: 0, vz: 0,
    // O tanque de nitro larga vazio e enche depois da largada (race.js).
    steer: 0, speed: 0, nitro: 0, nitroToFill: 1, health: 1, roll: 0, bob: 0,
    trackIndex: -1, offTrack: 0, lateral: 0, nitroActive: false,
    visualSteer: 0, effects: createEffects(), wrecked: 0, flip: null, invulnerable: 0, destroyed: 0, slipping: false,
    capsizes: 0, uprightFor: Infinity, rig: createRig(), overturned: false, spin: 0, drifting: false, slipstream: 0, armor: 1, wx: 0, wy: 0, wz: 0, twist: 0, twistHeading: 0, twistYaw: 0, twistPitch: 0, enclosed: false, roadTurn: 0, nitroCapacity: 1, parts: { ...NEUTRAL_STATS },   // efeitos das peças de desempenho (carUpgrades.js)
    vy: 0, airborne: false, sunk: 0, jump: null, tube: false, impact: 0, icy: false, destroyedBy: null,   // voo nas rampas e queda no rio (flight.js)
  };
}

// Volta o carro ao estado de largada. O objeto de efeitos é o mesmo: outros módulos guardam a referência.
export function resetCar(car) {
  const { effects } = car;
  Object.assign(car, createCar(), { effects });
  for (const name in effects) effects[name] = 0;
}

// Ângulo do ponto (x, z) em relação a onde o piloto olha; positivo fica à esquerda.
export function bearingFrom(car, look, x, z) {
  const angle = Math.atan2(car.x - x, car.z - z) - car.yaw - look.yaw;
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

const CAPSIZE_RESET_TIME = 1;                        // segundos com as rodas no chão antes de contar outra capotagem

// Conta cada capotagem uma vez, mesmo que o carro gire várias vezes ou acabe destruído no mesmo tombo.
export function trackCapsizes(car, dt) {
  if (car.wrecked > 0 || car.overturned) {
    if (car.uprightFor >= CAPSIZE_RESET_TIME) car.capsizes++;
    car.uprightFor = 0;
  } else {
    car.uprightFor += dt;
  }
}

// Batidas (parede, obstáculo, outro carro) passam pelo para-choque; tiro e fogo não.
export function crashDamage(car, amount) {
  damagePlayer(car, amount * car.parts.crash);
}

// `amount` de 0 a 1, em relação à vida padrão; `armor` é a melhoria comprada. Logo depois de voltar à pista o carro não sofre dano.
export function damagePlayer(car, amount) {
  if (car.invulnerable <= 0) car.health = Math.max(0, car.health - amount / car.armor);
}

const AIR_DRAG = 0.02, WATER_DRAG = 3;             // por segundo

// No ar (ou dentro do rio) as rodas não tocam nada: acelerar, frear e virar não mudam a trajetória.
function coastWithoutGrip(car, dt, forward) {
  const drag = Math.exp(-(car.sunk > 0 ? WATER_DRAG : AIR_DRAG) * dt);
  car.vx *= drag;
  car.vz *= drag;
  car.x += car.vx * dt;
  car.z += car.vz * dt;
  car.speed = forward * drag;
  car.nitroActive = car.drifting = car.slipping = false;
  car.visualSteer = car.steer;
  car.bob += Math.abs(car.speed) * dt * 1.1;
}

// `nitroHandReady`: a mão do piloto está no registro; sem isso o nitro não abre.
export function updateCar(car, dt, keys, canAccelerate, nitroHandReady) {
  tickEffects(car.effects, dt);
  const { puncture, oil } = car.effects;

  const fx = -Math.sin(car.yaw), fz = -Math.cos(car.yaw);
  const rx = Math.cos(car.yaw), rz = -Math.sin(car.yaw);
  if (car.airborne || car.sunk > 0) { coastWithoutGrip(car, dt, fx * car.vx + fz * car.vz); return; }
  let forward = car.vx * fx + car.vz * fz;
  let side = car.vx * rx + car.vz * rz;

  const throttle = canAccelerate && (keys.KeyW || keys.ArrowUp);
  const brake = canAccelerate && (keys.KeyS || keys.ArrowDown);   // antes da largada o carro fica parado: nem ré
  const handbrake = keys.ShiftLeft || keys.ShiftRight;
  const left = keys.KeyA || keys.ArrowLeft, right = keys.KeyD || keys.ArrowRight;
  const useNitro = Boolean(canAccelerate && keys.Space && car.nitro > 0 && nitroHandReady);
  car.nitroActive = useNitro;

  const steerTarget = (right ? 1 : 0) - (left ? 1 : 0);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * (steerTarget ? 6 : 9));

  const { parts } = car;
  const punctureFactor = puncture > 0 ? 1 - (1 - PUNCTURE_SPEED_FACTOR) * parts.punctureEffect : 1;
  const top = (useNitro ? NITRO_MAX_SPEED : MAX_SPEED + car.slipstream * SLIPSTREAM_KMH / 3.6) * punctureFactor;
  let accel = 0;
  if (throttle || useNitro) accel += forward < 0 ? 30 : ACCEL * Math.max(0, Math.min(1, (top - forward) / 8));
  if (useNitro) { accel += NITRO_ACCEL * Math.max(0, Math.min(1, (top - forward) / 8)); car.nitro = Math.max(0, car.nitro - dt * NITRO_DRAIN / car.nitroCapacity); }
  if (brake) accel += forward > 1 ? -32 : -9 * (1 - Math.min(-forward / 14, 1));
  forward += accel * dt;

  if (!throttle && !useNitro) forward -= forward * 0.12 * dt + Math.sign(forward) * Math.min(Math.abs(forward), 1.2 * dt);
  if (forward > top) forward = Math.max(top, forward - 10 * dt);
  if (handbrake) forward -= Math.sign(forward) * Math.min(Math.abs(forward), 10 * dt);
  if (car.offTrack > OFFROAD_LIMIT) forward -= forward * 1.4 * parts.offroad * dt;
  if (car.wrecked > 0) forward *= Math.exp(-WRECK_BRAKING * dt);

  side *= Math.exp(-(oil > 0 ? OIL_GRIP * parts.oil : handbrake ? 1.2 : car.icy ? ICE_SIDE_GRIP * parts.ice : car.enclosed ? ENCLOSED_SIDE_GRIP : 7 * parts.grip) * dt);

  // Pneu furado puxa para um lado; óleo faz o volante escapar sozinho.
  const disturbance = (puncture > 0 ? PUNCTURE_PULL * parts.punctureEffect : 0) + (oil > 0 ? Math.sin(car.bob * 3) * OIL_WOBBLE : 0);
  car.visualSteer = Math.max(-1, Math.min(1, car.steer + disturbance));

  const angle = car.visualSteer * 0.62 / (1 + Math.abs(forward) / 22);
  const drifting = handbrake && Math.abs(forward) > DRIFT_MIN_SPEED;
  car.drifting = drifting;
  const yawLimit = drifting ? DRIFT_YAW_RATE : GRIP_ACCEL * parts.grip * (car.enclosed ? ENCLOSED_GRIP : 1) / Math.max(Math.abs(forward), GRIP_MIN_SPEED);
  const yawRate = Math.max(-yawLimit, Math.min(yawLimit, forward * Math.tan(angle) / WHEELBASE));
  car.yaw -= yawRate * dt;
  if (car.enclosed) car.yaw -= car.roadTurn * forward * ENCLOSED_CURVE_ASSIST * dt;
  car.yaw += car.spin * dt;
  car.spin *= Math.exp(-SPIN_DECAY * dt);
  if (oil > 0) car.yaw += Math.sin(oil * OIL_SWING_RATE) * OIL_SPIN * Math.min(1, Math.abs(forward) / OIL_SPIN_FULL_SPEED) * dt;

  const nfx = -Math.sin(car.yaw), nfz = -Math.cos(car.yaw), nrx = Math.cos(car.yaw), nrz = -Math.sin(car.yaw);
  car.vx = nfx * forward + nrx * side;
  car.vz = nfz * forward + nrz * side;
  if (drifting) {
    // Só parte do giro vai para a trajetória; o resto vira ângulo de derrapagem.
    const lag = yawRate * dt * (1 - DRIFT_FOLLOW), c = Math.cos(lag), s = Math.sin(lag), vx = car.vx;
    car.vx = vx * c + car.vz * s;
    car.vz = car.vz * c - vx * s;
  }
  car.x += car.vx * dt;
  car.z += car.vz * dt;
  car.speed = forward;
  car.slipping = Math.abs(forward) > DRIFT_MIN_SPEED && Boolean(handbrake || oil > 0);

  const rollTarget = -car.steer * Math.min(Math.abs(forward) / 40, 1) * 0.05;
  car.roll += (rollTarget - car.roll) * Math.min(1, dt * 5);
  car.bob += Math.abs(forward) * dt * 1.1;
}
