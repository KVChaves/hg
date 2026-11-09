import * as THREE from 'three';
import { CAR_MAX_HP, LOOK } from '../config.js';
import { wrapDistance } from '../world/track.js';
import { createCombatVisuals } from '../world/combatVisuals.js';
import { createHarpoonVisual } from '../world/harpoonVisual.js';
import { bearingFrom, damagePlayer } from './car.js';
import { lifeAfterDestruction } from './carFlip.js';
import { createHarpoon } from './harpoon.js';
import { damageOpponent } from './opponents.js';
import { damageAtDistance } from './weaponTypes.js';
import { rollPart } from './carParts.js';

// Combate dos adversários: cada piloto escolhe um alvo entre todos que estão à sua frente, atira,
// recarrega, solta armadilhas em quem vem atrás e usa os power-ups. Vale a munição limitada do jogador.

const ENGAGE_RANGE = 85, MAX_ATTACKERS_PER_TARGET = 2, GRACE_AFTER_START = 5, RETARGET_TIME = [0.5, 1];
const BASE_ACCURACY = 0.42, MIN_ACCURACY = 0.05, MAX_ACCURACY = 0.75;
const DISTANCE_ACCURACY_LOSS = 0.6, GRUDGE_ACCURACY = 1.25, TARGET_IN_SMOKE_ACCURACY = 0.5;
const AIM_TIME = [0.5, 1.1], BURST_SIZE = [3, 6], PAUSE_VARIATION = [0.7, 1.3];
const AMMO_BUDGET_TIME = 150;                        // a munição é dosada para durar esses segundos de combate
const GRUDGE_PACE = 0.7;
const MISS_OFFSET = [1.5, 4], MUZZLE_FORWARD = 1.6, MUZZLE_HEIGHT = 1.15, TARGET_HEIGHT = 1.1;
const TRAP_RETRY = 0.4, TRAP_PAUSE = [22, 42];
const TRAP_GAP = { default: [8, 40], dynamite: [6, 22] };
const TRAP_LANE_REACH = 6;
const HIT_FLASH_TIME = 0.3;
const POWERUP_RETRY = 0.3, POWERUP_PAUSE = [4, 9], EXTINGUISH_BELOW = 0.45;
const HARPOON_NEAR = 4, HARPOON_FAR = 17, HARPOON_AIM = 1;   // só dispara com o alvo reto à frente
const FIRING_ARC_COS = Math.cos(LOOK.maxYaw);         // o piloto só atira até onde a cabeça vira, como o jogador

const random = ([low, high]) => low + Math.random() * (high - low);

export function createOpponentCombat({ scene, car, race, opponents, traps, look, onShot, onSound, onDestroyed, onBotShot, onRemotePull, onKill }) {
  const visuals = createCombatVisuals(scene);
  const from = new THREE.Vector3(), to = new THREE.Vector3();
  const combat = { hitFlash: 0, hitAngle: 0, update, reset, showRemoteShot, explodeAt: (x, y, z) => visuals.explode(x, y, z), harpoonTip: op => harpoons.get(op).tip };
  const field = race.field;
  const attackersOn = new Map();                     // quantos já atiram em cada alvo neste quadro
  const harpoons = new Map(opponents.map(op => [op, createHarpoon({ owner: op, car, race, visual: createHarpoonVisual(scene), onSound, onRemotePull })]));
  let raceTime = 0, playerExploded = false;

  const rangeOf = op => Math.min(op.arsenal.type.range, ENGAGE_RANGE);
  const isBlinded = op => op.effects.paint > 0 || op.effects.smoke > 0;

  function isInFront(op, dx, dz, distance) {
    const yaw = op.group.rotation.y;
    return (-Math.sin(yaw) * dx - Math.cos(yaw) * dz) / distance > FIRING_ARC_COS;
  }

  function canReach(op, target) {
    if (target === op || target.dead > 0 || target.protectedFor > 0 || isBlinded(op) || op.overturned) return false;
    const range = rangeOf(op), dx = target.x - op.x, dz = target.z - op.z, distance = Math.hypot(dx, dz) || 1;
    return distance < range && Math.abs(wrapDistance(op.dist - target.dist)) < range && isInFront(op, dx, dz, distance);
  }

  // Primeiro revida em quem o atacou; senão pega o mais próximo que ainda não está cercado.
  function chooseTarget(op) {
    if (op.grudge > 0 && canReach(op, op.grudgeTarget)) return op.grudgeTarget;
    let best = null, bestDistance = Infinity;
    for (const target of field) {
      if (!canReach(op, target) || (attackersOn.get(target) ?? 0) >= MAX_ATTACKERS_PER_TARGET) continue;
      const distance = Math.hypot(target.x - op.x, target.z - op.z);
      if (distance < bestDistance) { best = target; bestDistance = distance; }
    }
    return best;
  }

  function updateTarget(op, dt) {
    const { arsenal } = op;
    arsenal.retargetIn -= dt;
    if (arsenal.retargetIn <= 0 || !arsenal.target || !canReach(op, arsenal.target)) {
      arsenal.target = chooseTarget(op);
      arsenal.retargetIn = random(RETARGET_TIME);
    }
    if (arsenal.target) attackersOn.set(arsenal.target, (attackersOn.get(arsenal.target) ?? 0) + 1);
    return arsenal.target;
  }

  function hitChance(op, target, distance) {
    let chance = BASE_ACCURACY * (1 - DISTANCE_ACCURACY_LOSS * distance / rangeOf(op));
    if (op.grudge > 0) chance *= GRUDGE_ACCURACY;
    if (target.effects.smoke > 0) chance *= TARGET_IN_SMOKE_ACCURACY;
    return Math.max(MIN_ACCURACY, Math.min(MAX_ACCURACY, chance));
  }

  function hurt(target, op, amount, bearing) {
    if (!target.isPlayer) {
      if (damageOpponent(target, amount, op)) onKill(target, op);
      return;
    }
    const wasAlive = car.health > 0 && car.wrecked <= 0;
    damagePlayer(car, amount / CAR_MAX_HP);
    if (wasAlive && car.health <= 0) onKill(target, op);
    combat.hitFlash = HIT_FLASH_TIME;
    combat.hitAngle = bearing;
  }

  // Tiro de quem é simulado em outro navegador: só o traço e o som.
  function showRemoteShot(weaponId, start, end) {
    from.fromArray(start);
    to.fromArray(end);
    visuals.showShot(from, to);
    onShot(weaponId, Math.hypot(car.x - start[0], car.z - start[2]), -Math.sin(bearingFrom(car, look, start[0], start[2])));
  }

  function shoot(op, target) {
    const { arsenal } = op, { type } = arsenal;
    arsenal.ammo--;
    const dx = target.x - op.x, dz = target.z - op.z, distance = Math.hypot(dx, dz) || 1;
    const ux = dx / distance, uz = dz / distance;
    const hit = Math.random() < hitChance(op, target, distance);

    from.set(op.wx + ux * MUZZLE_FORWARD, op.wy + MUZZLE_HEIGHT, op.wz + uz * MUZZLE_FORWARD);
    to.set(target.wx, target.wy + TARGET_HEIGHT, target.wz);
    if (!hit) {
      const miss = random(MISS_OFFSET) * (Math.random() < 0.5 ? -1 : 1);
      to.x += -uz * miss;
      to.z += ux * miss;
    }
    visuals.showShot(from, to);
    onBotShot(type.id, from, to);
    const bearing = bearingFrom(car, look, op.x, op.z);
    onShot(type.id, Math.hypot(car.x - op.x, car.z - op.z), -Math.sin(bearing));

    if (hit) hurt(target, op, damageAtDistance(type, distance) * rollPart().multiplier, bearing);
  }

  // Pausa média entre ataques para a munição da arma durar a corrida.
  function ammoPause({ type, maxReserve }) {
    const shotsPerAttack = type.automatic ? (BURST_SIZE[0] + BURST_SIZE[1]) / 2 : 1;
    return AMMO_BUDGET_TIME / (type.magazine + maxReserve) * shotsPerAttack;
  }

  function scheduleNextShot(op) {
    const { arsenal } = op, { type } = arsenal;
    if (type.automatic && arsenal.burstLeft <= 0) arsenal.burstLeft = Math.round(random(BURST_SIZE));
    arsenal.burstLeft--;
    const pace = op.grudge > 0 ? GRUDGE_PACE : 1;
    if (arsenal.burstLeft > 0) arsenal.cooldown = type.interval;
    else arsenal.cooldown = Math.max(type.interval, ammoPause(arsenal) * random(PAUSE_VARIATION) * pace);
  }

  function startReload(arsenal) {
    const { type } = arsenal;
    const rounds = Math.min(type.magazine, arsenal.reserve);
    arsenal.loading = rounds;
    arsenal.reloadLeft = type.reloadsWholeMagazine ? type.roundTime : type.roundTime * rounds;
    arsenal.burstLeft = 0;
  }

  function updateGun(op, dt, target) {
    const { arsenal } = op;
    arsenal.cooldown -= dt;
    if (arsenal.reloadLeft > 0) {
      arsenal.reloadLeft -= dt;
      if (arsenal.reloadLeft <= 0) {
        arsenal.ammo += arsenal.loading;
        arsenal.reserve -= arsenal.loading;
      }
      return;
    }
    if (arsenal.ammo <= 0) {
      if (arsenal.reserve > 0) startReload(arsenal);
      return;
    }
    if (arsenal.aimingAt !== target) {             // trocar de alvo custa tempo de mira
      arsenal.aimingAt = target;
      arsenal.aimTime = random(AIM_TIME);
      arsenal.burstLeft = 0;
    }
    if (!target || (arsenal.aimTime -= dt) > 0 || arsenal.cooldown > 0) return;
    shoot(op, target);
    scheduleNextShot(op);
  }

  function nextLoadedTrap(arsenal) {
    const { traps: slots } = arsenal;
    for (let k = 0; k < slots.length; k++) {
      const index = (arsenal.nextTrap + k) % slots.length;
      if (slots[index].charges > 0 && !slots[index].type.powerup) {
        arsenal.nextTrap = index;
        return slots[index];
      }
    }
    return null;
  }

  // Alguém vem logo atrás, na mesma parte da pista, a uma distância boa para essa armadilha?
  function hasFollower(op, type) {
    const [near, far] = TRAP_GAP[type.id] ?? TRAP_GAP.default;
    return field.some(racer => {
      if (racer === op || racer.dead > 0) return false;
      const gap = wrapDistance(op.dist - racer.dist);
      return gap >= near && gap <= far && Math.abs(op.lane - racer.lane) <= TRAP_LANE_REACH;
    });
  }

  function updateTraps(op, dt) {
    const { arsenal } = op;
    if (!traps.isUnlocked() || (arsenal.trapTimer -= dt) > 0) return;
    arsenal.trapTimer = TRAP_RETRY;
    const slot = nextLoadedTrap(arsenal);
    if (!slot) return;
    if (!hasFollower(op, slot.type)) return;
    slot.charges--;
    traps.dropFrom(op, slot.type);
    arsenal.nextTrap = (arsenal.nextTrap + 1) % arsenal.traps.length;
    arsenal.trapTimer = random(TRAP_PAUSE);
  }

  function hasHarpoonShot(op) {
    const fx = -Math.sin(op.yaw), fz = -Math.cos(op.yaw);
    return !isBlinded(op) && field.some(target => {
      if (target === op || target.dead > 0 || target.protectedFor > 0) return false;
      const dx = target.x - op.x, dz = target.z - op.z, forward = fx * dx + fz * dz, right = -fz * dx + fx * dz;
      return forward >= HARPOON_NEAR && forward <= HARPOON_FAR && Math.abs(right) <= HARPOON_AIM;
    });
  }

  function usePowerup(op, type) {
    if (type.id === 'extinguisher') {
      if (op.hp / (op.maxHp * lifeAfterDestruction(op.destroyed)) > EXTINGUISH_BELOW) return false;
      traps.extinguish(op);
      return true;
    }
    const harpoon = harpoons.get(op);
    if (harpoon.busy || !hasHarpoonShot(op)) return false;
    harpoon.fire();
    return true;
  }

  function updatePowerups(op, dt) {
    const { arsenal } = op;
    if (!traps.isUnlocked() || op.overturned || (arsenal.powerupTimer -= dt) > 0) return;
    arsenal.powerupTimer = POWERUP_RETRY;
    for (const slot of arsenal.traps) {
      if (!slot.type.powerup || slot.charges <= 0 || !usePowerup(op, slot.type)) continue;
      slot.charges--;
      arsenal.powerupTimer = random(POWERUP_PAUSE);
      return;
    }
  }

  function showDestruction(x, y, z) {
    visuals.explode(x, y, z);
    onDestroyed(x, z);
  }

  function updateCondition() {
    for (const op of opponents) {
      if (op.dead > 0 && !op.exploded) {
        op.exploded = true;
        showDestruction(op.x, op.y, op.z);
      } else if (op.dead <= 0) {
        op.exploded = false;
      }
    }
    if (car.wrecked > 0 && !playerExploded) showDestruction(car.x, car.y, car.z);
    playerExploded = car.wrecked > 0;
  }

  function reset() {
    raceTime = 0;
    playerExploded = false;
    combat.hitFlash = 0;
    for (const harpoon of harpoons.values()) harpoon.reset();
  }

  function update(dt) {
    combat.hitFlash = Math.max(0, combat.hitFlash - dt);
    visuals.update(dt);
    updateCondition();
    for (const op of opponents) harpoons.get(op).update(dt);
    if (!race.started || race.finished) return;
    raceTime += dt;
    attackersOn.clear();
    const combatOpen = raceTime >= GRACE_AFTER_START;
    for (const op of opponents) {
      if (op.dead > 0 || op.remote) continue;
      op.grudge -= dt;
      updateGun(op, dt, combatOpen ? updateTarget(op, dt) : null);
      updateTraps(op, dt);
      if (combatOpen) updatePowerups(op, dt);
    }
  }

  return combat;
}
