import { CAR_MAX_HP } from '../config.js';
import { wrapDistance } from '../world/track.js';
import { crashDamage } from './car.js';
import { ramOf } from './carUpgrades.js';
import { flipElevation } from './carFlip.js';
import { applyHit, isOverturned, rigElevation, stepRig } from './carRoll.js';
import { damageOpponent, poseOpponent } from './opponents.js';
import { WHEEL_POSITIONS_Z } from '../world/car/carLivery.js';

// Colisão entre todos os carros. Cada carro é um retângulo: o ponto de contato decide se a pancada só
// empurra ou faz girar. Se pegar perto de uma roda, levanta aquele lado; o resto é com a física em carRoll.js.

const HALF_LENGTH = 2.2, HALF_WIDTH = 0.97;
const NEARBY_DISTANCE = 6;
const CAR_HEIGHT = 1.42;                             // quem está mais alto que isso passa por cima do outro
const BOUNCE = 0.3;                                  // 0 = as latarias grudam, 1 = quicam sem perder energia
const YAW_RESPONSE = 0.1, MAX_SPIN = 3.5;
const WHEEL_SIDE = 0.86, WHEEL_REACH = 0.9, WHEEL_LIFT = 0.25;

const SOUND_MIN_IMPACT = 4, SOUND_FULL_IMPACT = 25, SOUND_MIN_STRENGTH = 0.25;
const DAMAGE_MIN_IMPACT = 4, DAMAGE_PER_SPEED = 0.4, DAMAGE_PER_SPEED_SQUARED = 0.02;

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function createCollisions({ car, field, onCrash, onDestroyed }) {
  const ramOfRacer = racer => (racer.isPlayer ? car.parts.ram : ramOf(racer.bumper));
  const stateOf = racer => (racer.isPlayer ? car : racer);
  const isOut = racer => racer.dead > 0 || racer.sunk > 0;
  const heightOfBody = racer => (racer.isPlayer ? car.y : racer.y);

  function readBody(racer) {
    const yaw = racer.isPlayer ? car.yaw : racer.group.rotation.y;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const x = racer.isPlayer ? car.x : racer.x, z = racer.isPlayer ? car.z : racer.z;
    const vx = racer.isPlayer ? car.vx : racer.remote ? racer.vx : fx * racer.v + rx * racer.laneRate;
    const vz = racer.isPlayer ? car.vz : racer.remote ? racer.vz : fz * racer.v + rz * racer.laneRate;
    return { racer, x, y: heightOfBody(racer), z, fx, fz, rx, rz, vx, vz };
  }

  const halfExtent = (body, ax, az) =>
    HALF_LENGTH * Math.abs(body.fx * ax + body.fz * az) + HALF_WIDTH * Math.abs(body.rx * ax + body.rz * az);

  // Separação por eixos: devolve a normal de A para B e a sobreposição, ou null se não encostam.
  function findOverlap(a, b) {
    const dx = b.x - a.x, dz = b.z - a.z;
    let depth = Infinity, nx = 0, nz = 0;
    for (const [ax, az] of [[a.fx, a.fz], [a.rx, a.rz], [b.fx, b.fz], [b.rx, b.rz]]) {
      const along = dx * ax + dz * az;
      const overlap = halfExtent(a, ax, az) + halfExtent(b, ax, az) - Math.abs(along);
      if (overlap <= 0) return null;
      if (overlap < depth) {
        depth = overlap;
        const sign = along >= 0 ? 1 : -1;
        nx = ax * sign;
        nz = az * sign;
      }
    }
    return { nx, nz, depth };
  }

  // Meio do trecho em que os dois carros se encostam: no centro da lataria numa batida alinhada, no canto se pegou de raspão.
  function contactPoint(a, b, nx, nz, depth) {
    const tx = -nz, tz = nx;
    const centerA = a.x * tx + a.z * tz, centerB = b.x * tx + b.z * tz;
    const extentA = halfExtent(a, tx, tz), extentB = halfExtent(b, tx, tz);
    const along = (Math.max(centerA - extentA, centerB - extentB) + Math.min(centerA + extentA, centerB + extentB)) / 2;
    const across = a.x * nx + a.z * nz + halfExtent(a, nx, nz) - depth / 2;
    return [nx * across + tx * along, nz * across + tz * along];
  }

  // Carro de outro navegador não recebe nada daqui: lá ele vê a mesma batida e reage sozinho.
  function moveBody({ racer, fx, fz, rx, rz }, dx, dz) {
    if (racer.remote) return;
    if (racer.isPlayer) {
      car.x += dx;
      car.z += dz;
    } else {
      racer.dist += dx * fx + dz * fz;
      racer.lane += dx * rx + dz * rz;
    }
  }

  // 1 em cima de uma roda, 0 longe de todas.
  function wheelCloseness(alongForward, alongRight) {
    let nearest = Infinity;
    for (const z of WHEEL_POSITIONS_Z) {
      nearest = Math.min(nearest, Math.hypot(alongForward + z, Math.abs(alongRight) - WHEEL_SIDE));
    }
    return Math.max(0, 1 - nearest / WHEEL_REACH);
  }

  function applyImpact(body, dvx, dvz, cx, cz) {
    const { racer, x, z, fx, fz, rx, rz } = body, state = stateOf(racer);
    if (racer.remote) return;
    const forward = dvx * fx + dvz * fz, lateral = dvx * rx + dvz * rz;
    if (racer.isPlayer) {
      car.vx += dvx;
      car.vz += dvz;
    } else {
      racer.v = Math.max(0, racer.v + forward);
      racer.knock += lateral;
    }

    // Um carro destruído segue a sequência dele: é empurrado, mas não gira nem tomba por causa disso.
    if (isOut(racer)) return;

    // Contato fora do centro faz o carro girar.
    state.spin = clamp(state.spin + ((cz - z) * dvx - (cx - x) * dvz) * YAW_RESPONSE, -MAX_SPIN, MAX_SPIN);

    // Perto de uma roda a pancada calça o pneu e levanta aquele lado do carro.
    const alongForward = (cx - x) * fx + (cz - z) * fz, alongRight = (cx - x) * rx + (cz - z) * rz;
    const tip = racer.isPlayer ? car.parts.tip : 1;   // suspensão alta tomba mais fácil
    const lift = Math.hypot(dvx, dvz) * wheelCloseness(alongForward, alongRight) * WHEEL_LIFT * tip;
    applyHit(state.rig, { contactX: alongRight, sideChange: lateral * tip, lift });
  }

  function hurt(racer, amount, other) {
    if (racer.remote) return;
    let destroyed;
    if (racer.isPlayer) {
      const wasAlive = car.health > 0 && car.wrecked <= 0;
      crashDamage(car, amount / CAR_MAX_HP);
      destroyed = wasAlive && car.health <= 0;
    } else {
      destroyed = damageOpponent(racer, amount, other);
    }
    if (destroyed) onDestroyed(racer, other, 'ram');
  }

  function reportSound(a, b, nx, nz, impact, cx, cz) {
    if (impact < SOUND_MIN_IMPACT) return;
    const strength = Math.max(SOUND_MIN_STRENGTH, Math.min(1, impact / SOUND_FULL_IMPACT));
    const player = a.racer.isPlayer ? a : b.racer.isPlayer ? b : null;
    if (!player) { onCrash('carHit', cx, cz, strength); return; }
    const other = player === a ? b : a, sign = player === a ? 1 : -1;
    // Quem vinha mais rápido na direção do outro é quem bateu.
    const playerSpeed = (player.vx * nx + player.vz * nz) * sign, otherSpeed = -(other.vx * nx + other.vz * nz) * sign;
    onCrash(playerSpeed >= otherSpeed ? 'carHit' : 'carPunched', cx, cz, strength);
  }

  function resolve(a, b, { nx, nz, depth }) {
    moveBody(a, -nx * depth / 2, -nz * depth / 2);
    moveBody(b, nx * depth / 2, nz * depth / 2);

    const impact = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
    if (impact <= 0) return;
    const [cx, cz] = contactPoint(a, b, nx, nz, depth);
    const change = (1 + BOUNCE) * impact / 2;        // carros de mesmo peso dividem a pancada
    applyImpact(a, -nx * change, -nz * change, cx, cz);
    applyImpact(b, nx * change, nz * change, cx, cz);
    reportSound(a, b, nx, nz, impact, cx, cz);

    if (impact < DAMAGE_MIN_IMPACT) return;
    const damage = impact * DAMAGE_PER_SPEED + impact * impact * DAMAGE_PER_SPEED_SQUARED;
    // O para-choque de quem bate aumenta o dano do outro (o dos bots é o padrão).
    hurt(a.racer, damage * ramOfRacer(b.racer), b.racer);
    hurt(b.racer, damage * ramOfRacer(a.racer), a.racer);
  }

  const heightOf = racer => (racer.dead > 0 ? flipElevation(stateOf(racer).flip, racer.dead) : rigElevation(stateOf(racer).rig));

  function collideAll() {
    const bodies = field.map(readBody);
    for (let i = 0; i < bodies.length; i++) {
      for (let k = i + 1; k < bodies.length; k++) {
        const a = bodies[i], b = bodies[k];
        if (Math.abs(wrapDistance(a.racer.dist - b.racer.dist)) > NEARBY_DISTANCE || Math.hypot(a.x - b.x, a.z - b.z) > NEARBY_DISTANCE) continue;
        if (Math.abs(a.y + heightOf(a.racer) - b.y - heightOf(b.racer)) > CAR_HEIGHT) continue;   // um voando por cima do outro não bate
        const overlap = findOverlap(a, b);
        if (overlap) resolve(a, b, overlap);
      }
    }
  }

  function updateRig(racer, dt) {
    const state = stateOf(racer);
    if (!state.rig.active) return;
    if (racer.isPlayer) {
      const rx = Math.cos(car.yaw), rz = -Math.sin(car.yaw), sideSpeed = car.vx * rx + car.vz * rz;
      const change = stepRig(car.rig, sideSpeed, dt) - sideSpeed;
      car.vx += change * rx;
      car.vz += change * rz;
    } else {
      racer.knock += stepRig(racer.rig, racer.laneRate, dt) - racer.laneRate;
    }
    state.overturned = isOverturned(state.rig);
  }

  return {
    update(dt) {
      if (dt <= 0) return;
      collideAll();
      for (const racer of field) {
        if (isOut(racer) || racer.remote) continue;
        updateRig(racer, dt);
        if (!racer.isPlayer) poseOpponent(racer);
      }
    },
  };
}
