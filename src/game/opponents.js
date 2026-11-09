import { ACCEL, CAR_MAX_HP, MAX_SPEED, NITRO_ACCEL, NITRO_DRAIN, NITRO_MAX_SPEED, SLIPSTREAM_KMH } from '../config.js';
import { LIVERIES } from '../world/car/carLivery.js';
import { createCarModel } from '../world/car/carModel.js';
import { alignToTwist, SHARP_RADIUS, surfaceAt, track, trackAt, turnAt, wrapDistance } from '../world/track.js';
import { createFlip, lifeAfterDestruction, poseFlippingCar, RESPAWN_PROTECTION } from './carFlip.js';
import { createRig, poseRig, resetRig, rigLean } from './carRoll.js';
import { createEffects, tickEffects } from './effects.js';
import { OPPONENT_PROFILES } from './opponentProfiles.js';
import { TRAP_TYPES } from './trapTypes.js';
import { upgradeFactor } from './shop.js';
import { WEAPON_TYPES } from './weaponTypes.js';

const LANE_LIMIT = 5.2, LANE_SPEED = 3.5, DODGE_LANE_SPEED = 7;
const WRECK_SLOWDOWN = 1.2, DODGE_CHANCE = 0.75, DODGE_LOOKAHEAD = 40;
const OIL_LANE_SWING = 11, OIL_SWING_RATE = 5.5, OIL_NOSE_SWING = 0.3, LANE_DRIFT_LIMIT = LANE_LIMIT + 1.5;
const KNOCK_DECAY = 3, SPIN_DECAY = 3.5, NOSE_RETURN = 3;
const DRIFT_GRIP = 1.35, DRIFT_MIN_SPEED = 12, DRIFT_NOSE = 0.42, DRIFT_NOSE_RATE = 6;   // nas curvas fechadas a IA também faz drift
const NITRO_MIN_SPEED = 15, NITRO_BURST = [1, 1.6], NITRO_PAUSE = [12, 24], NITRO_FIRST_WAIT = [8, 20];
const NITRO_VIEW = 70, NITRO_MAX_CURVE = 1 / 60, NITRO_RIVAL_AHEAD = 90, NITRO_RIVAL_BEHIND = 30;
const REMOTE_BLEND = 12, REMOTE_PREDICTION_TIME = 0.4, REMOTE_SNAP_DISTANCE = 40;
const GRUDGE_TIME = 8, FIRST_TRAP_DELAY = [6, 14];

const between = ([low, high]) => low + Math.random() * (high - low);

function createArsenal(profile) {
  const type = WEAPON_TYPES[profile.weapon];
  const maxReserve = Math.ceil(type.reserve * upgradeFactor('ammo', profile.upgrades.ammo));
  return {
    type, ammo: 0, reserve: maxReserve, maxReserve, cooldown: 0, reloadLeft: 0, loading: 0,
    aimTime: 0, burstLeft: 0, target: null, aimingAt: null, retargetIn: 0,
    traps: profile.traps.map(id => ({ type: TRAP_TYPES[id], charges: TRAP_TYPES[id].charges, capacity: TRAP_TYPES[id].charges })),
    nextTrap: 0, powerupTimer: 0, trapTimer: FIRST_TRAP_DELAY[0] + Math.random() * (FIRST_TRAP_DELAY[1] - FIRST_TRAP_DELAY[0]),
  };
}

// Volta o adversário ao estado de largada, para uma nova corrida.
export function resetOpponent(op) {
  Object.assign(op.arsenal, createArsenal(op.profile));
  Object.assign(op, {
    hp: op.maxHp, destroyed: 0, protectedFor: 0, grudge: 0, grudgeTarget: null, exploded: false,
    flip: null, overturned: false, spin: 0, nose: 0, knock: 0, laneRate: 0, dead: 0, flash: 0, v: 0, laneHold: 0, dodgeTime: 0, snapshot: null, slipstream: 0,
  });
  resetRig(op.rig);
  for (const name in op.effects) op.effects[name] = 0;
  Object.assign(op, { nitro: 1, nitroActive: false, nitroBurst: 0, nitroWait: between(NITRO_FIRST_WAIT), driftAngle: 0 });
  op.model.setNitro(false);
  op.model.setFlash(false);
  op.group.visible = true;
}

function createOpponent(scene, index) {
  const livery = LIVERIES[index % LIVERIES.length];
  const model = createCarModel(livery, index * 37);
  const { group } = model;
  group.rotation.order = 'YXZ';                      // direção antes da inclinação da pista
  scene.add(group);

  const skill = 0.92 + Math.random() * 0.14;
  const profile = OPPONENT_PROFILES[index];
  const maxHp = CAR_MAX_HP * upgradeFactor('life', profile.upgrades.life);
  const opponent = {
    livery, slipstream: 0, wx: 0, wy: 0, wz: 0, twist: 0, twistHeading: 0, twistYaw: 0, twistPitch: 0, y: 0, yaw: 0, vx: 0, vz: 0, remote: false, netId: `local${index}`, snapshot: null, onRemoteDamage: null, group, model, name: profile.name, profile, arsenal: createArsenal(profile),
    dist: 0, v: 0, lane: 0, laneTarget: 0, preferredLane: 0, laneHold: 0, x: 0, z: 0,
    vmax: MAX_SPEED, grip: 25 * skill, acc: ACCEL, brake: 22,
    hp: maxHp, maxHp, nitroCapacity: upgradeFactor('nitro', profile.upgrades.nitro), destroyed: 0, protectedFor: 0, grudge: 0, grudgeTarget: null,
    flip: null, rig: createRig(), overturned: false, spin: 0, nose: 0, knock: 0, laneRate: 0, exploded: false, dead: 0, flash: 0, effects: createEffects(), dodgeTime: 0,
    nitro: 1, nitroActive: false, nitroBurst: 0, nitroWait: between(NITRO_FIRST_WAIT), driftAngle: 0,
  };
  group.traverse(o => { o.userData.opponent = opponent; });
  return opponent;
}

export function createOpponents(scene, count) {
  return Array.from({ length: count }, (_, i) => createOpponent(scene, i));
}

function targetSpeedForCurves(op, topSpeed) {
  const { length, count, step, curvature } = track;
  let target = topSpeed;
  const start = Math.floor((((op.dist % length) + length) % length) / step);
  const lookahead = Math.ceil((30 + op.v * 2.5) / step);
  for (let k = 0; k <= lookahead; k++) {
    const bend = curvature[(start + k) % count], grip = bend > 1 / SHARP_RADIUS ? op.grip * DRIFT_GRIP : op.grip;
    const allowed = Math.sqrt(grip / Math.max(bend, 0.0006) + 2 * op.brake * k * step);
    if (allowed < target) target = allowed;
  }
  return target;
}

function avoidTraffic(op, target, field, dt) {
  let blocker = null;
  for (const other of field) {
    if (other === op || other.dead > 0) continue;
    const ahead = wrapDistance(other.dist - op.dist);
    if (ahead > 0 && ahead < 24 && Math.abs(other.lane - op.lane) < 3.2) {
      const limit = ahead < 9 ? other.v * 0.85 : other.v + (ahead - 9) * 0.7;
      if (limit < target) target = limit;
      blocker = other;
    }
  }
  if (blocker) {
    const dodge = blocker.lane <= op.lane ? 3.6 : -3.6;
    op.laneTarget = Math.max(-LANE_LIMIT, Math.min(LANE_LIMIT, op.lane + dodge));
    op.laneHold = 1.2;
  } else if ((op.laneHold -= dt) <= 0) {
    op.laneTarget = op.preferredLane;
  }
  return target;
}

// Devolve true se o carro foi destruído. Quem leva dano fica com raiva de quem atacou e revida.
// `attacker` é outro piloto de race.field.
export function damageOpponent(op, amount, attacker) {
  if (op.remote) {                                   // quem aplica o dano é o navegador que simula esse carro
    op.onRemoteDamage(amount, attacker);
    return false;
  }
  if (op.protectedFor > 0 || op.dead > 0) return false;
  op.hp -= amount;
  if (attacker && attacker !== op) {
    op.grudge = GRUDGE_TIME;
    op.grudgeTarget = attacker;
  }
  op.flash = 0.08;
  if (op.hp > 0) return false;
  op.hp = 0;
  op.destroyed++;
  const lean = rigLean(op.rig);
  op.flip = createFlip({ direction: Math.sign(lean) || 1, startRoll: Math.abs(lean) });
  op.dead = op.flip.duration;
  resetRig(op.rig);
  op.overturned = false;
  return true;
}

// Na maioria das vezes o piloto vê a armadilha e muda de faixa. Fumaça ocupa a pista inteira.
function dodgeTraps(op, activeTraps) {
  for (const trap of activeTraps) {
    const { effect, halfWidth } = trap.type;
    if (!effect || halfWidth >= LANE_LIMIT) continue;
    const ahead = wrapDistance(trap.dist - op.dist), clearance = halfWidth + 2;
    if (ahead <= 0 || ahead > DODGE_LOOKAHEAD || Math.abs(trap.lane - op.lane) >= clearance) continue;

    if (!trap.dodgers.has(op)) trap.dodgers.set(op, Math.random() < DODGE_CHANCE);
    if (!trap.dodgers.get(op)) continue;
    const side = trap.lane >= 0 ? -1 : 1;
    op.laneTarget = Math.max(-LANE_LIMIT, Math.min(LANE_LIMIT, trap.lane + side * clearance));
    op.laneHold = 1;
    op.dodgeTime = 0.6;
  }
}

function speedFactorFromEffects({ puncture, oil, paint, smoke }) {
  let factor = 1;
  if (puncture > 0) factor *= 0.75;
  if (oil > 0) factor *= 0.7;
  if (paint > 0 || smoke > 0) factor *= 0.8;
  return factor;
}

// Posição no mundo: igual à lógica, menos no tubo, onde a faixa vira parede e teto.
function placeOnSurface(op) {
  const point = surfaceAt(op.dist, op.lane);
  op.twist = point.roll;
  op.twistHeading = point.heading;
  op.twistYaw = point.twistYaw;
  op.twistPitch = point.twistPitch;
  op.wx = point.roll ? point.x : op.x;
  op.wy = point.roll ? point.y : op.y;
  op.wz = point.roll ? point.z : op.z;
  op.group.position.set(op.wx, op.wy, op.wz);
}

export function placeOpponent(op) {
  const t = trackAt(op.dist);
  op.x = t.x - t.tz * op.lane;
  op.z = t.z + t.tx * op.lane;
  op.y = t.y;
  const pitch = Math.atan(t.slope), yaw = Math.atan2(-t.tx, -t.tz);
  placeOnSurface(op);
  op.group.rotation.set(pitch, yaw, op.twist);
  op.yaw = op.group.rotation.y;
}

// Coloca o carro na pista com o balanço do óleo, o giro de uma batida e a inclinação.
export function poseOpponent(op) {
  placeOpponent(op);
  if (op.effects.oil > 0) op.group.rotation.y += Math.sin(op.effects.oil * OIL_SWING_RATE) * OIL_NOSE_SWING;
  op.group.rotation.y += op.nose + op.driftAngle;
  op.yaw = op.group.rotation.y;
  if (op.rig.active) poseRig(op.group, op.rig);
  alignToTwist(op.group, op);
}

// Empurrão lateral recebido em batidas, para carros que não estão sendo pilotados.
function driftFromKnock(op, dt) {
  const laneBefore = op.lane;
  op.lane = Math.max(-LANE_DRIFT_LIMIT, Math.min(LANE_DRIFT_LIMIT, op.lane + op.knock * dt));
  op.knock *= Math.exp(-KNOCK_DECAY * dt);
  op.laneRate = dt > 0 ? (op.lane - laneBefore) / dt : 0;
}

function isClearForNitro(op) {
  const { length, count, step, curvature } = track, start = Math.floor((((op.dist % length) + length) % length) / step);
  for (let k = 0; k * step <= NITRO_VIEW; k++) if (curvature[(start + k) % count] > NITRO_MAX_CURVE) return false;
  return true;
}

function hasRivalNear(op, field) {
  return field.some(other => {
    if (other === op || other.dead > 0) return false;
    const gap = wrapDistance(other.dist - op.dist);
    return gap > -NITRO_RIVAL_BEHIND && gap < NITRO_RIVAL_AHEAD;
  });
}

// Nitro em rajadas curtas nas retas, para passar quem vai à frente ou fugir de quem vem atrás. Não recarrega.
function updateNitro(op, dt, field) {
  op.nitroBurst -= dt;
  op.nitroWait -= dt;
  if (op.nitroBurst <= 0 && op.nitroWait <= 0 && op.nitro > 0 && op.v > NITRO_MIN_SPEED && isClearForNitro(op) && hasRivalNear(op, field)) {
    op.nitroBurst = between(NITRO_BURST);
    op.nitroWait = between(NITRO_PAUSE);
  }
  op.nitroActive = op.nitroBurst > 0 && op.nitro > 0;
  if (op.nitroActive) op.nitro = Math.max(0, op.nitro - dt * NITRO_DRAIN / op.nitroCapacity);
}

function updateDrift(op, dt) {
  const turn = turnAt(op.dist);
  const drifting = Math.abs(turn) > 1 / SHARP_RADIUS && op.v > DRIFT_MIN_SPEED && !op.rig.active;
  const goal = drifting ? -Math.sign(turn) * DRIFT_NOSE : 0;   // o bico aponta para dentro da curva
  op.driftAngle += (goal - op.driftAngle) * Math.min(1, dt * DRIFT_NOSE_RATE);
}

function tumble(op, dt) {
  op.v *= Math.exp(-WRECK_SLOWDOWN * dt);
  op.dist += op.v * dt;
  driftFromKnock(op, dt);
  placeOpponent(op);
  poseFlippingCar(op.group, op.flip, op.dead);
  alignToTwist(op.group, op);
  op.model.setFlash(false);
}

// Fora das rodas o piloto não controla nada: o carro só desliza até parar.
function coast(op, dt) {
  tickEffects(op.effects, dt);
  op.v *= Math.exp(-WRECK_SLOWDOWN * dt);
  op.dist += op.v * dt;
  driftFromKnock(op, dt);
  poseOpponent(op);
}

function revive(op) {
  op.hp = op.maxHp * lifeAfterDestruction(op.destroyed);
  op.dead = 0;
  op.v = 0;
  op.flip = null;
  op.nose = op.spin = op.knock = 0;
  op.protectedFor = RESPAWN_PROTECTION;
}

// Carro simulado em outro navegador: segue a última posição recebida, com um pouco de previsão entre os pacotes.
export function updateRemoteRacer(op, dt) {
  const s = op.snapshot;
  if (!s) return;
  s.age += dt;
  if (s.age < REMOTE_PREDICTION_TIME) {
    s.dist += s.v * dt;
    s.x += s.vx * dt;
    s.z += s.vz * dt;
  }
  s.dead = Math.max(0, s.dead - dt);
  const teleported = Math.abs(s.dist - op.dist) > REMOTE_SNAP_DISTANCE;
  const k = teleported ? 1 : 1 - Math.exp(-REMOTE_BLEND * dt);
  const towards = field => { op[field] += (s[field] - op[field]) * k; };
  ['dist', 'lane', 'x', 'y', 'z'].forEach(towards);
  op.yaw += Math.atan2(Math.sin(s.yaw - op.yaw), Math.cos(s.yaw - op.yaw)) * k;
  Object.assign(op, { v: s.v, vx: s.vx, vz: s.vz, hp: s.health * op.maxHp, protectedFor: s.protectedFor, dead: s.dead, overturned: s.overturned, laneRate: 0 });
  Object.assign(op.rig, { active: s.rigActive, angle: s.rigAngle, y: s.rigY });

  placeOnSurface(op);
  op.group.rotation.set(s.pitch, op.yaw, op.twist);
  if (op.dead > 0) {
    op.flip ??= createFlip({ direction: 1, startRoll: 0 });
    poseFlippingCar(op.group, op.flip, op.dead);
  } else {
    op.flip = null;
    if (op.rig.active) poseRig(op.group, op.rig);
  }
  alignToTwist(op.group, op);
  op.model.setNitro(s.nitro && op.dead <= 0);
  op.model.roll(op.v * dt);
}

export function updateOpponent(op, dt, field, racing, activeTraps) {
  op.nitroActive = false;
  if (op.dead > 0) {
    op.model.setNitro(false);
    op.dead -= dt;
    if (op.dead > 0) { tumble(op, dt); return; }
    revive(op);
  }
  op.protectedFor = Math.max(0, op.protectedFor - dt);
  if (racing && op.overturned) { op.model.setNitro(false); coast(op, dt); return; }
  if (racing) {
    tickEffects(op.effects, dt);
    const laneBefore = op.lane;
    updateNitro(op, dt, field);
    updateDrift(op, dt);
    const target = avoidTraffic(op, targetSpeedForCurves(op, op.nitroActive ? NITRO_MAX_SPEED : op.vmax + op.slipstream * SLIPSTREAM_KMH / 3.6), field, dt) * speedFactorFromEffects(op.effects);
    dodgeTraps(op, activeTraps);
    op.dodgeTime -= dt;
    const accel = op.acc + (op.nitroActive ? NITRO_ACCEL : 0);
    op.v = op.v < target ? Math.min(target, op.v + accel * dt) : Math.max(target, op.v - 30 * dt);
    const laneStep = (op.dodgeTime > 0 ? DODGE_LANE_SPEED : LANE_SPEED) * dt;
    if (!op.rig.active) op.lane += Math.max(-laneStep, Math.min(laneStep, op.laneTarget - op.lane));
    if (op.effects.paint > 0) op.lane += Math.sin(op.dist * 0.7) * 3 * dt;
    if (op.effects.oil > 0) op.lane += Math.sin(op.effects.oil * OIL_SWING_RATE) * OIL_LANE_SWING * dt;
    op.lane += op.knock * dt;
    op.knock *= Math.exp(-KNOCK_DECAY * dt);
    op.lane = Math.max(-LANE_DRIFT_LIMIT, Math.min(LANE_DRIFT_LIMIT, op.lane));
    op.laneRate = dt > 0 ? (op.lane - laneBefore) / dt : 0;
    op.nose += op.spin * dt;
    op.spin *= Math.exp(-SPIN_DECAY * dt);
    op.nose *= Math.exp(-NOSE_RETURN * dt);
    op.dist += op.v * dt;
    op.model.roll(op.v * dt);
  }
  poseOpponent(op);
  op.model.setNitro(op.nitroActive);
  op.flash -= dt;
  op.model.setFlash(op.flash > 0);
}
