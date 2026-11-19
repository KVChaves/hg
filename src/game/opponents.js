import { shakeOpponent } from './shake.js';
import { surface } from './surface.js';
import { ACCEL, BLUE_NITRO, CAR_MAX_HP, MAX_SPEED, NITRO_ACCEL, NITRO_DRAIN, NITRO_MAX_SPEED, SLIPSTREAM_KMH } from '../config.js';
import { LIVERIES } from '../world/car/carLivery.js';
import { createCarModel } from '../world/car/carModel.js';
import { alignToTwist, boostAt, gustAt, hazardAt, jumpBoostAhead, inFlightZone, inGap, onBridge, SHARP_RADIUS, surfaceAt, track, trackAt, turnAt, wrapDistance } from '../world/track.js';
import { BOOST_SPEED, BOOST_TIME } from './car.js';
import { FALL_TIME, fallIsCertain, GRAVITY, sinkStep, stepFlight } from './flight.js';
import { BRIDGE_HALF } from './mapLayout.js';
import { createFlip, lifeAfterDestruction, poseFlippingCar, RESPAWN_PROTECTION } from './carFlip.js';
import { createRig, poseRig, resetRig, rigLean } from './carRoll.js';
import { createEffects, tickEffects } from './effects.js';
import { absorbShield } from './shield.js';
import { OPPONENT_PROFILES } from './opponentProfiles.js';
import { styleOf } from './botStyles.js';
import { createTactics, planTactics, steerByTactics } from './botTactics.js';
import { TRAP_TYPES } from './trapTypes.js';
import { upgradeFactor } from './shop.js';
import { WEAPON_TYPES } from './weaponTypes.js';
import { TRACK_WIDTH } from '../config.js';

const LANE_LIMIT = TRACK_WIDTH / 2 - 1.2, LANE_SPEED = 3.5, DODGE_LANE_SPEED = 7;
const BLOCK_LANE = 2.4, PASS_STEP = 2.6;            // quem está nesta distância lateral atrapalha; quanto sai para ultrapassar
const WRECK_SLOWDOWN = 1.2, DODGE_LOOKAHEAD = 40, DODGE_LOOKAHEAD_TIME = 1.6;   // vê a armadilha a 40 m ou 1,6 s à frente
const OIL_LANE_SWING = 11, OIL_SWING_RATE = 5.5, OIL_NOSE_SWING = 0.3, LANE_DRIFT_LIMIT = LANE_LIMIT + 1.5;
const KNOCK_DECAY = 3, SPIN_DECAY = 3.5, NOSE_RETURN = 3;
const DRIFT_GRIP = 1.35, DRIFT_MIN_SPEED = 12, DRIFT_NOSE = 0.42, DRIFT_NOSE_RATE = 6;   // nas curvas fechadas a IA também faz drift
const NITRO_MIN_SPEED = 15, NITRO_BURST = [1, 1.6], NITRO_PAUSE = [12, 24], NITRO_FIRST_WAIT = [8, 20];
const NITRO_VIEW = 70, NITRO_MAX_CURVE = 1 / 60, NITRO_RIVAL_AHEAD = 90, NITRO_RIVAL_BEHIND = 30;
const NITRO_URGE_SKIP = 9;                           // a tática (perseguir, fugir, não deixar passar) corta até isso da pausa do nitro
const REMOTE_BLEND = 12, REMOTE_PREDICTION_TIME = 0.4, REMOTE_SNAP_DISTANCE = 40;
const GRUDGE_TIME = 8, FIRST_TRAP_DELAY = [6, 14];
// Vento e turbo (cânion e salar). A rajada desloca a IA de lado (a IA corrige na velocidade de troca de faixa).
// Antes do salto grande a IA mira na placa de turbo da rampa, com um erro que às vezes a deixa de fora.
const GUST_LANE_RATE = 1 / 4, JUMP_BOOST_SIGHT = 150, JUMP_BOOST_AIM = [0.2, 1.25];

const between = ([low, high]) => low + Math.random() * (high - low);

function createArsenal(profile) {
  const type = WEAPON_TYPES[profile.weapon];
  const maxReserve = Math.ceil(type.reserve * upgradeFactor('ammo', profile.upgrades.ammo));
  return {
    type, ammo: 0, reserve: maxReserve, maxReserve, cooldown: 0, reloadLeft: 0, loading: 0,
    aimTime: 0, burstLeft: 0, target: null, aimingAt: null, retargetIn: 0,
    traps: profile.traps.map(id => ({ type: TRAP_TYPES[id], charges: TRAP_TYPES[id].charges, capacity: TRAP_TYPES[id].charges })),
    powerupTimer: 0, powerupCheck: 0, idle: 0, curveWait: 0, trapTimer: FIRST_TRAP_DELAY[0] + Math.random() * (FIRST_TRAP_DELAY[1] - FIRST_TRAP_DELAY[0]),
  };
}

// Volta o adversário ao estado de largada, para uma nova corrida.
export function resetOpponent(op) {
  Object.assign(op.arsenal, createArsenal(op.profile));
  Object.assign(op, {
    hp: op.maxHp, destroyed: 0, protectedFor: 0, grudge: 0, grudgeTarget: null, exploded: false,
    flip: null, overturned: false, spin: 0, nose: 0, knock: 0, laneRate: 0, dead: 0, flash: 0, v: 0, laneHold: 0, dodgeTime: 0, snapshot: null, slipstream: 0,
    vy: 0, airborne: false, flying: false, sunk: 0, jump: null, impact: 0,
    tactics: createTactics(), quarry: null, errand: null, blocker: null, nitroUrge: false,
    weaponId: null,                                  // arma vista de um carro remoto: aprende de novo a cada corrida
  });
  resetRig(op.rig);
  for (const name in op.effects) op.effects[name] = 0;
  Object.assign(op, { nitro: 0, nitroToFill: 1, nitroActive: false, nitroBurst: 0, nitroWait: between(NITRO_FIRST_WAIT), driftAngle: 0, blueNitro: 0 });
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
    livery, slipstream: 0, wx: 0, wy: 0, wz: 0, twist: 0, twistHeading: 0, twistYaw: 0, twistPitch: 0, y: 0, yaw: 0, vx: 0, vz: 0, remote: false, netId: `local${index}`, snapshot: null, onRemoteDamage: null, onRemoteIgnite: null, burnBy: null, group, model, name: profile.name, profile, arsenal: createArsenal(profile),
    dist: 0, v: 0, lane: 0, laneTarget: 0, preferredLane: 0, laneHold: 0, x: 0, z: 0,
    vmax: MAX_SPEED, grip: 25 * skill, acc: ACCEL, brake: 22,
    hp: maxHp, maxHp, nitroCapacity: upgradeFactor('nitro', profile.upgrades.nitro), destroyed: 0, protectedFor: 0, grudge: 0, grudgeTarget: null,
    flip: null, rig: createRig(), overturned: false, spin: 0, nose: 0, knock: 0, laneRate: 0, exploded: false, dead: 0, flash: 0, effects: createEffects(), dodgeTime: 0,
    nitro: 0, nitroToFill: 1, nitroActive: false, nitroBurst: 0, nitroWait: between(NITRO_FIRST_WAIT), driftAngle: 0, blueNitro: 0,
    vy: 0, airborne: false, flying: false, sunk: 0, jump: null, impact: 0,   // voo nas rampas e queda no rio (flight.js)
    tactics: createTactics(), quarry: null, errand: null, blocker: null, nitroUrge: false,   // estilo de jogo (botTactics.js)
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
    const bend = curvature[(start + k) % count], grip = (bend > 1 / SHARP_RADIUS ? op.grip * DRIFT_GRIP : op.grip) * surface.rain;
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
    if (ahead > 0 && ahead < 24 && Math.abs(other.lane - op.lane) < BLOCK_LANE) {
      const limit = ahead < 9 ? other.v * 0.85 : other.v + (ahead - 9) * 0.7;
      if (limit < target) target = limit;
      blocker = other;
    }
  }
  op.blocker = blocker;
  if (blocker) {
    const dodge = blocker.lane <= op.lane ? PASS_STEP : -PASS_STEP;
    op.laneTarget = Math.max(-LANE_LIMIT, Math.min(LANE_LIMIT, op.lane + dodge));
    op.laneHold = 1.2;
  } else if ((op.laneHold -= dt) <= 0) {
    op.laneTarget = op.preferredLane;
  }
  return target;
}

// Devolve true se o carro foi destruído. Quem leva dano fica com raiva de quem atacou e revida.
// `attacker` é outro piloto de race.field.
export function damageOpponent(op, amount, attacker, shake = 0) {
  if (op.remote) {                                   // quem aplica o dano é o navegador que simula esse carro
    op.onRemoteDamage(amount, attacker, shake);
    return false;
  }
  if (op.protectedFor > 0 || op.dead > 0) return false;
  if (shake > 0) shakeOpponent(op, shake);           // escopeta: o carro balança
  op.hp -= absorbShield(op, amount);
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

// O piloto vê a armadilha (e a dinamite) e muda de faixa; quanto desvia depende do estilo. Fumaça ocupa a pista inteira.
function dodgeTraps(op, activeTraps) {
  const sight = Math.max(DODGE_LOOKAHEAD, op.v * DODGE_LOOKAHEAD_TIME), chance = styleOf(op).dodge;
  for (const trap of activeTraps) {
    const { halfWidth } = trap.type;
    if (halfWidth >= LANE_LIMIT || trap.explodedFor >= 0) continue;
    const ahead = wrapDistance(trap.dist - op.dist), clearance = halfWidth + 2;
    if (ahead <= 0 || ahead > sight || Math.abs(trap.lane - op.lane) >= clearance) continue;

    if (!trap.dodgers.has(op)) trap.dodgers.set(op, Math.random() < chance);
    if (!trap.dodgers.get(op)) continue;
    const side = trap.lane >= 0 ? -1 : 1;
    op.laneTarget = Math.max(-LANE_LIMIT, Math.min(LANE_LIMIT, trap.lane + side * clearance));
    op.laneHold = 1;
    op.dodgeTime = 0.6;
  }
}

function speedFactorFromEffects({ puncture, oil, paint, smoke }) {
  let factor = 1;
  if (puncture > 0) factor *= 0.875;
  if (oil > 0) factor *= 0.7;
  if (paint > 0 || smoke > 0) factor *= 0.8;
  return factor;
}

// Preso na rede o piloto não esterça: segue na direção que ia e a curva o joga para fora da faixa.
const NET_CURVE_PUSH = 0.35;
function driftInNet(op, dt) {
  op.netVel ??= op.laneRate;
  op.netVel -= turnAt(op.dist) * op.v * op.v * NET_CURVE_PUSH * dt;      // curva à direita (turn > 0) joga para a esquerda (lane menor)
  if (!op.rig.active && !op.airborne) op.lane += op.netVel * dt;
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
  if (!op.flying) op.y = t.y;                        // voando, a altura vem de flyOpponent
  const pitch = op.sunk > 0 ? SUNK_PITCH : op.flying ? Math.atan2(op.vy, Math.max(op.v, 1)) : Math.atan(t.slope), yaw = Math.atan2(-t.tx, -t.tz);
  placeOnSurface(op);
  op.group.rotation.set(pitch, yaw, op.twist);
  op.yaw = op.group.rotation.y;
}

const SUNK_PITCH = 0.08, FACE_BOUNCE = 0.2;

// Na rampa do rio a IA também voa de verdade: a gravidade a freia na subida e, se sair devagar do bico, cai.
function flyOpponent(op, dt) {
  const t = trackAt(op.dist), offBridge = onBridge(op.dist) && (Math.abs(op.lane) > BRIDGE_HALF || (op.airborne && op.y < t.y - 0.5));
  if (!op.airborne && !inFlightZone(op.dist) && !offBridge) { op.flying = false; return; }
  const ground = inGap(op.dist) || offBridge ? null : t.y;
  if (ground === null) op.jump = hazardAt(op.dist) ?? op.jump;
  if (!op.airborne) op.v -= GRAVITY * t.slope / Math.sqrt(1 + t.slope * t.slope) * dt;
  const result = stepFlight(op, ground, t.grade * op.v, dt);
  if (result === 'blocked' && op.jump) {             // bateu na face da outra margem: volta para o vão
    op.dist -= wrapDistance(op.dist - op.jump.gaps[0][1]) + 0.3;
    op.v *= -FACE_BOUNCE;
  }
  if (ground === null && fallIsCertain(op, op.jump, op.dist)) op.sunk = FALL_TIME;
  op.flying = op.airborne || op.sunk > 0;
}

// Caindo e dentro d'água: desce, boia parado e depois volta ao começo do trecho.
const FALL_DRAG = 3;
function sinkOpponent(op, dt) {
  op.v *= Math.exp(-FALL_DRAG * dt);
  op.dist += op.v * dt;
  sinkStep(op, op.jump.water, dt);
  if (op.sunk <= 0) {
    const target = op.jump.respawn;
    op.dist -= ((op.dist - target) % track.length + track.length) % track.length;
    Object.assign(op, { v: 0, lane: 0, laneTarget: 0, vy: 0, airborne: false, flying: false, jump: null, protectedFor: RESPAWN_PROTECTION });
  }
  op.model.setNitro(false);
  poseOpponent(op);
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
// Quando a tática pede (`nitroUrge`: alvo fugindo, ameaça atrás, alguém querendo passar), a pausa entre rajadas encurta.
function updateNitro(op, dt, field) {
  op.nitroBurst -= dt;
  op.nitroWait -= dt;
  const blue = op.blueNitro > 0;                     // com nitro azul a IA usa toda reta livre, sem esperar rival por perto
  const urged = op.nitroUrge && op.nitroWait <= NITRO_URGE_SKIP;
  if (op.nitroBurst <= 0 && (blue || urged || op.nitroWait <= 0) && op.nitro > 0 && op.v > NITRO_MIN_SPEED && isClearForNitro(op) && (blue || urged || hasRivalNear(op, field))) {
    op.nitroBurst = between(NITRO_BURST);
    if (!blue) op.nitroWait = between(NITRO_PAUSE);
  }
  op.nitroActive = op.nitroBurst > 0 && op.nitro > 0 && op.effects.emp <= 0;
  if (!op.nitroActive) return;
  if (blue) op.blueNitro = Math.max(0, op.blueNitro - dt);
  else op.nitro = Math.max(0, op.nitro - dt * NITRO_DRAIN / op.nitroCapacity);
}

function updateDrift(op, dt) {
  const turn = turnAt(op.dist);
  const drifting = Math.abs(turn) > 1 / SHARP_RADIUS && op.v > DRIFT_MIN_SPEED && !op.rig.active;
  const goal = drifting ? -Math.sign(turn) * DRIFT_NOSE : 0;   // o bico aponta para dentro da curva
  op.driftAngle += (goal - op.driftAngle) * Math.min(1, dt * DRIFT_NOSE_RATE);
}

function tumble(op, dt) {
  op.airborne = op.flying = false;
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

// Placa de turbo: igual ao jogador, joga a IA a BOOST_SPEED por BOOST_TIME segundos.
function hitBoostPad(op) {
  const pad = boostAt(op.dist, op.lane);
  if (pad && pad !== op.boostPad && op.v > 3) {
    op.v = Math.max(op.v, BOOST_SPEED);
    op.boost = BOOST_TIME;
  }
  op.boostPad = pad;
}

// Chegando ao salto grande a IA vai para a placa de turbo da rampa. Cada carro sorteia uma vez o quanto acerta.
function steerToJumpBoost(op) {
  const pad = jumpBoostAhead(op.dist, JUMP_BOOST_SIGHT);
  if (!pad) { op.boostAim = null; return; }
  op.boostAim ??= (Math.random() < 0.5 ? -1 : 1) * pad.half * between(JUMP_BOOST_AIM);
  op.laneTarget = pad.lane + op.boostAim;
  op.laneHold = Math.max(op.laneHold, 0.3);
}

export function updateOpponent(op, dt, field, racing, activeTraps, time = 0) {
  op.nitroActive = false;
  if (op.sunk > 0) { sinkOpponent(op, dt); return; }
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
    const tacticCap = planTactics(op, field, dt, time);
    updateNitro(op, dt, field);
    updateDrift(op, dt);
    op.boost = Math.max(0, (op.boost ?? 0) - dt);
    const topSpeed = op.nitroActive ? NITRO_MAX_SPEED * (op.blueNitro > 0 ? BLUE_NITRO.top : 1) : op.vmax + op.slipstream * SLIPSTREAM_KMH / 3.6;
    let target = Math.min(tacticCap, avoidTraffic(op, targetSpeedForCurves(op, topSpeed), field, dt)) * speedFactorFromEffects(op.effects);
    if (op.boost > 0) target = Math.max(target, BOOST_SPEED);
    steerByTactics(op);
    dodgeTraps(op, activeTraps);
    if (track.boosts.length) steerToJumpBoost(op);
    op.dodgeTime -= dt;
    const accel = op.acc + (op.nitroActive ? NITRO_ACCEL * (op.blueNitro > 0 ? BLUE_NITRO.accel : 1) : 0);
    if (!op.airborne) op.v = op.v < target ? Math.min(target, op.v + accel * dt) : Math.max(target, op.v - 30 * dt);   // no ar o pé no acelerador não muda nada
    const laneStep = (op.dodgeTime > 0 ? DODGE_LANE_SPEED : LANE_SPEED) * dt;
    if (op.effects.net > 0) driftInNet(op, dt);
    else {
      op.netVel = null;
      if (!op.rig.active && !op.airborne) op.lane += Math.max(-laneStep, Math.min(laneStep, op.laneTarget - op.lane));
    }
    if (op.effects.paint > 0) op.lane += Math.sin(op.dist * 0.7) * 3 * dt;
    if (op.effects.oil > 0) op.lane += Math.sin(op.effects.oil * OIL_SWING_RATE) * OIL_LANE_SWING * dt;
    op.lane += op.knock * dt;
    op.knock *= Math.exp(-KNOCK_DECAY * dt);
    if (track.gusts.length) op.lane += (gustAt(op.dist, time)?.push ?? 0) * GUST_LANE_RATE * dt;
    op.lane = Math.max(-LANE_DRIFT_LIMIT, Math.min(LANE_DRIFT_LIMIT, op.lane));
    op.laneRate = dt > 0 ? (op.lane - laneBefore) / dt : 0;
    if (track.boosts.length && !op.airborne) hitBoostPad(op);
    op.nose += op.spin * dt;
    op.spin *= Math.exp(-SPIN_DECAY * dt);
    op.nose *= Math.exp(-NOSE_RETURN * dt);
    op.dist += op.v * dt;
    flyOpponent(op, dt);
    op.model.roll(op.v * dt);
  }
  poseOpponent(op);
  op.model.setNitro(op.nitroActive);
  op.flash -= dt;
  op.model.setFlash(op.flash > 0);
}
