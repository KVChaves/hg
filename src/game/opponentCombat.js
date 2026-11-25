import * as THREE from 'three';
import { isHidden } from './cloak.js';
import { CAR_MAX_HP, LOOK } from '../config.js';
import { SHARP_RADIUS, track, wrapDistance } from '../world/track.js';
import { createCombatVisuals } from '../world/combatVisuals.js';
import { createHarpoonVisual } from '../world/harpoonVisual.js';
import { bearingFrom, damagePlayer } from './car.js';
import { createHarpoon } from './harpoon.js';
import { damageOpponent } from './opponents.js';
import { shakeCar } from './shake.js';
import { damageAtDistance, fireInterval, shakeAtDistance, stepSpin, WEAPON_TYPES } from './weaponTypes.js';
import { rollPart } from './carParts.js';
import { bulletHit } from './weaponParts.js';
import { EMP_RADIUS } from './trapTypes.js';
import { effectiveRange, healthOf, isAlive, isVulnerable, styleOf, weaponOf } from './botStyles.js';

// Combate dos adversários: cada piloto escolhe um alvo entre todos que estão à sua frente, atira,
// recarrega, solta armadilhas em quem vem atrás e usa os power-ups. Vale a munição limitada do jogador.
// As decisões seguem o estilo do piloto (botStyles.js) e levam em conta o que cada rival carrega e o estado dele:
// vida, escudo, fogo, EMP, mina grudada, arma de quem vem atrás e curvas fechadas à frente.

const MAX_ATTACKERS_PER_TARGET = 2, CROWD_PENALTY = 0.4, GRACE_AFTER_START = 5, RETARGET_TIME = [0.4, 0.8];
const CHASE_SIGHT = 260;                             // até onde procura o alvo da perseguição (op.quarry)
const BASE_ACCURACY = 0.46, MIN_ACCURACY = 0.05, MAX_ACCURACY = 0.8;
const DISTANCE_ACCURACY_LOSS = 0.6, GRUDGE_ACCURACY = 1.25, TARGET_IN_SMOKE_ACCURACY = 0.5;
const DODGING_LANE_RATE = 2.5, DODGING_ACCURACY = 0.8, SHAKY_ACCURACY = 0.75;   // alvo ziguezagueando; atirador deslizando
// Recuo (type.kick): os bots não miram com câmera, então o recuo acumulado (arsenal.kick, em radianos) vira chance perdida.
// O quanto a mira saiu do lugar, em metros na distância do alvo, dividido por KICK_MISS_METERS: com a mira 3 m acima,
// a chance cai pela metade.
const KICK_MISS_METERS = 3;
const AIM_TIME = [0.45, 1], BURST_SIZE = [3, 6], PAUSE_VARIATION = [0.7, 1.3];
const GRUDGE_PACE = 0.7, FINISH_HEALTH = 0.3, FINISH_PACE = 0.5;   // alvo quase destruído: atira mais seguido
const WEAK_PELLETS = 0.35, SLOW_WEAPON = 0.7, MIN_SLOW_CHANCE = 0.2;   // disciplina de tiro (ver worthShooting)
const IDLE_RELOAD = 1.2;                             // segundos sem alvo para completar o carregador
// Pesos da escolha de alvo que não dependem do estilo.
const GRUDGE_FOCUS = 1.5, VULNERABLE_BONUS = 0.5, SHIELDED_PENALTY = 0.9, BURNING_PENALTY = 0.6, SPLASH_NEIGHBOUR = 0.5;
const MISS_OFFSET = [1.5, 4], MUZZLE_FORWARD = 1.6, MUZZLE_HEIGHT = 1.15, TARGET_HEIGHT = 1.1;
const TRAP_RETRY = 0.4, DROP_BEHIND = 8, TRAP_ALIGN_REACH = 9, TRAP_AIM_TIME = 0.6;
const TRAP_GAP = { default: [8, 40], dynamite: [6, 22], smoke: [6, 50], paint: [8, 35], barrier: [10, 30] };
const CURVE_TRAPS = new Set(['oil', 'spikes']), CURVE_SIGHT = 220, CURVE_WAIT_LIMIT = 14;   // óleo e espinhos rendem mais na curva
const HIT_FLASH_TIME = 0.3;
const POWERUP_RETRY = 0.3, URGENT = 2.5, EMP_BOT_REACH = 0.7;
const HARPOON_NEAR = 4, HARPOON_FAR = 17, HARPOON_AIM = 1;   // só dispara com o alvo reto à frente
const FIRING_ARC_COS = Math.cos(LOOK.maxYaw);         // o piloto só atira até onde a cabeça vira, como o jogador

const random = ([low, high]) => low + Math.random() * (high - low);

// Curva fechada entre `from` e `from + length` metros de pista?
function sharpCurveIn(from, length) {
  const { count, step, curvature } = track, start = Math.floor((((from % track.length) + track.length) % track.length) / step);
  for (let k = 0; k * step <= length; k++) if (curvature[(start + k) % count] > 1 / SHARP_RADIUS) return true;
  return false;
}

export function createOpponentCombat({ scene, car, race, opponents, traps, mines, nets, burning, look, onShot, onSound, onDestroyed, onBotShot, onRemotePull, onTetherEnd, onTrip, onKill, onPlayerShot = () => {} }) {
  const visuals = createCombatVisuals(scene);
  const from = new THREE.Vector3(), to = new THREE.Vector3();
  const combat = { hitFlash: 0, hitAngle: 0, update, reset, showRemoteShot, explodeAt: (x, y, z) => visuals.explode(x, y, z), harpoonTip: op => harpoons.get(op).tip };
  const field = race.field;
  const attackersOn = new Map();                     // quantos já atiram em cada alvo neste quadro
  const harpoons = new Map(opponents.map(op => [op, createHarpoon({ owner: op, car, race, visual: createHarpoonVisual(scene), onSound, onRemotePull, onTrip, onTetherEnd: target => onTetherEnd(target, op), onKill: victim => onKill(victim, op) })]));
  let raceTime = 0, playerExploded = false, leader = null;

  const rangeOf = op => Math.min(op.arsenal.type.range, styleOf(op).reach);
  const isBlinded = op => op.effects.paint > 0 || op.effects.smoke > 0;
  const hasCharge = (op, id) => op.arsenal.traps.some(slot => slot.type.id === id && slot.charges > 0);

  function isInFront(op, dx, dz, distance) {
    const yaw = op.group.rotation.y;
    return (-Math.sin(yaw) * dx - Math.cos(yaw) * dz) / distance > FIRING_ARC_COS;
  }

  function canReach(op, target) {
    if (target === op || target.dead > 0 || target.protectedFor > 0 || isHidden(target) || isBlinded(op) || op.overturned) return false;
    const range = rangeOf(op), dx = target.x - op.x, dz = target.z - op.z, distance = Math.hypot(dx, dz) || 1;
    return distance < range && Math.abs(wrapDistance(op.dist - target.dist)) < range && isInFront(op, dx, dz, distance);
  }

  // Quem está logo à frente de `op` na pista.
  function rivalAhead(op) {
    let rival = null, nearest = Infinity;
    for (const racer of field) {
      const gap = wrapDistance(racer.dist - op.dist);
      if (racer !== op && gap > 0 && gap < nearest) { nearest = gap; rival = racer; }
    }
    return rival;
  }

  const neighbours = (target, radius) => field.reduce((count, racer) =>
    count + (racer !== target && isAlive(racer) && Math.hypot(racer.x - target.x, racer.z - target.z) < radius ? 1 : 0), 0);

  // Quanto o piloto quer esse alvo. `closeness` vai de 0 (no limite) a 1 (colado).
  function targetScore(op, target, style, closeness, rival) {
    const { focus } = style, { type } = op.arsenal;
    let score = focus.near * closeness + focus.weak * (1 - healthOf(target) + (isVulnerable(target) ? VULNERABLE_BONUS : 0));
    if (target === leader) score += focus.leader;
    if (target === rival) score += focus.rival;
    if (op.grudge > 0 && target === op.grudgeTarget) score += GRUDGE_FOCUS;
    if (target.effects?.shield > 0) score -= SHIELDED_PENALTY;          // o escudo engole o tiro: melhor outro
    if (type.burn && target.effects?.burning > 0) score -= BURNING_PENALTY;   // já está queimando
    if (type.splash) score += SPLASH_NEIGHBOUR * neighbours(target, type.splash.radius);   // granada: quem está no meio do bolo
    return score;
  }

  // Melhor alvo ao alcance da arma.
  function chooseTarget(op, style, rival) {
    let best = null, bestScore = -Infinity;
    for (const target of field) {
      if (!canReach(op, target)) continue;
      const crowd = attackersOn.get(target) ?? 0;
      if (!style.swarm && crowd >= MAX_ATTACKERS_PER_TARGET) continue;
      const closeness = 1 - Math.hypot(target.x - op.x, target.z - op.z) / rangeOf(op);
      const score = targetScore(op, target, style, closeness, rival) - (style.swarm ? 0 : crowd * CROWD_PENALTY);
      if (score > bestScore) { best = target; bestScore = score; }
    }
    return best;
  }

  // Alvo da perseguição: o preferido entre quem está à frente, mesmo fora do alcance (a tática de pista vai atrás dele).
  function chooseQuarry(op, style, rival) {
    let best = null, bestScore = -Infinity;
    for (const target of field) {
      if (target === op || !isAlive(target) || isHidden(target)) continue;
      const gap = wrapDistance(target.dist - op.dist);
      if (gap <= 0 || gap > CHASE_SIGHT) continue;
      const score = targetScore(op, target, style, 1 - gap / CHASE_SIGHT, rival);
      if (score > bestScore) { best = target; bestScore = score; }
    }
    return best;
  }

  function updateTarget(op, dt, style, combatOpen) {
    const { arsenal } = op;
    arsenal.retargetIn -= dt;
    if (arsenal.retargetIn <= 0 || (arsenal.target && !canReach(op, arsenal.target))) {
      const rival = rivalAhead(op);
      op.quarry = chooseQuarry(op, style, rival);
      arsenal.target = combatOpen ? chooseTarget(op, style, rival) : null;
      arsenal.retargetIn = random(RETARGET_TIME);
    }
    if (!combatOpen) arsenal.target = null;
    if (arsenal.target) attackersOn.set(arsenal.target, (attackersOn.get(arsenal.target) ?? 0) + 1);
    return arsenal.target;
  }

  function hitChance(op, target, distance, style) {
    const { type } = op.arsenal;
    let chance = BASE_ACCURACY * style.accuracy * (1 - DISTANCE_ACCURACY_LOSS * distance / type.range);
    if (op.grudge > 0) chance *= GRUDGE_ACCURACY;
    if (target.effects.smoke > 0 || traps.smokeBlocks(op.x, op.z, target.x, target.z)) chance *= TARGET_IN_SMOKE_ACCURACY;
    if (Math.abs(target.laneRate ?? 0) > DODGING_LANE_RATE) chance *= DODGING_ACCURACY;
    if (op.effects.oil > 0 || Math.abs(op.knock) > 4) chance *= SHAKY_ACCURACY;
    chance /= 1 + op.arsenal.kick * distance / KICK_MISS_METERS;
    return Math.max(MIN_ACCURACY, Math.min(MAX_ACCURACY, chance));
  }

  // Disciplina de tiro: a escopeta espera chegar perto, e arma lenta não gasta bala com chance ruim ou em escudo.
  function worthShooting(op, target, distance, chance) {
    const { type } = op.arsenal, finishing = healthOf(target) < FINISH_HEALTH;
    if (op.grudge > 0 && op.grudgeTarget === target) return true;
    if (type.falloff && damageAtDistance(type, distance) < type.damage * WEAK_PELLETS) return false;
    if (type.interval < SLOW_WEAPON) return true;
    if (target.effects.shield > 0 && !finishing) return false;
    return chance >= MIN_SLOW_CHANCE || finishing;
  }

  // `ammo`: tipo de munição do tiro (weaponParts.bulletHit); a explosão da granada não tem.
  function hurt(target, op, amount, bearing, shake = 0, ammo = null) {
    if (!target.isPlayer) {
      if (damageOpponent(target, amount, op, shake, ammo)) onKill(target, op);
      return;
    }
    const wasAlive = car.health > 0 && car.wrecked <= 0;
    const hit = bulletHit(ammo, amount, car.parts.bullet, car.effects.shield > 0);
    damagePlayer(car, hit.amount / CAR_MAX_HP, hit.pierce);
    if (shake > 0 && car.health > 0) shakeCar(car, shake);
    if (wasAlive && car.health <= 0) onKill(target, op);
    combat.hitFlash = HIT_FLASH_TIME;
    combat.hitAngle = bearing;
  }

  // Tiro de quem é simulado em outro navegador: só o traço, o som e a explosão da granada (o dano vem de lá).
  function showRemoteShot(weaponId, start, end) {
    from.fromArray(start);
    to.fromArray(end);
    visuals.showShot(from, to);
    if (WEAPON_TYPES[weaponId]?.splash) {
      visuals.explode(end[0], end[1] - 1.2, end[2]);
      onSound('dynamite', end[0], end[2]);
    }
    onShot(weaponId, Math.hypot(car.x - start[0], car.z - start[2]), -Math.sin(bearingFrom(car, look, start[0], start[2])));
  }

  function shoot(op, target, chance) {
    const { arsenal } = op, { type } = arsenal;
    arsenal.ammo--;
    arsenal.kick += type.kick.up;
    const dx = target.x - op.x, dz = target.z - op.z, distance = Math.hypot(dx, dz) || 1;
    const ux = dx / distance, uz = dz / distance;
    const hit = Math.random() < chance;

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

    if (hit) hurt(target, op, damageAtDistance(type, distance) * rollPart().multiplier, bearing, shakeAtDistance(type, distance), type.ammo);
    if (hit && target.isPlayer) onPlayerShot();       // bala batendo na lataria
    if (!hit && target.isPlayer && !type.splash && !type.burn) onSound('ricochet', to.x, to.z);   // passou raspando
    if (type.splash) splash(op, type, to, hit ? target : null);
    if (type.burn) {
      if (hit) burning.ignite(target, op, type.burn);
      else traps.burnGround(target.dist, target.lane + Math.sign(-uz * (to.x - target.wx) + ux * (to.z - target.wz)) * 2, op, op);
    }
  }

  // Granada de um bot: explode no ponto do tiro e machuca todos em volta, menos quem atirou e o alvo direto.
  function splash(op, type, point, direct) {
    const { radius, min } = type.splash;
    visuals.explode(point.x, point.y - TARGET_HEIGHT, point.z);
    onSound('dynamite', point.x, point.z);
    for (const racer of field) {
      if (racer === op || racer === direct || racer.dead > 0 || racer.protectedFor > 0) continue;
      const distance = Math.hypot(racer.wx - point.x, racer.wy + TARGET_HEIGHT - point.y, racer.wz - point.z);
      if (distance > radius) continue;
      const share = 1 - (1 - min) * distance / radius;   // munição de impacto: a explosão também balança
      hurt(racer, op, type.damage * share, bearingFrom(car, look, point.x, point.z), (type.shake ?? 0) * share);
    }
  }

  // Pausa média entre ataques para a munição da arma durar o tempo que o estilo quer.
  const burstOf = type => type.botBurst ?? BURST_SIZE;
  function ammoPause({ type, maxReserve }, style) {
    const burst = burstOf(type), shotsPerAttack = type.automatic ? (burst[0] + burst[1]) / 2 : 1;
    return style.ammoTime / (type.magazine + maxReserve) * shotsPerAttack;
  }

  function scheduleNextShot(op, target, style) {
    const { arsenal } = op, { type } = arsenal;
    if (type.automatic && arsenal.burstLeft <= 0) arsenal.burstLeft = Math.round(random(burstOf(type)));
    arsenal.burstLeft--;
    const pace = (op.grudge > 0 ? GRUDGE_PACE : 1) * (healthOf(target) < FINISH_HEALTH ? FINISH_PACE : 1);
    // Na metralhadora a rajada acelera junto com os canos (arsenal.spin, como o jogador).
    if (arsenal.burstLeft > 0) arsenal.cooldown = fireInterval(type, arsenal.spin);
    else arsenal.cooldown = Math.max(type.interval, ammoPause(arsenal, style) * random(PAUSE_VARIATION) * pace);
  }

  function startReload(arsenal) {
    const { type } = arsenal;
    const rounds = Math.min(type.magazine - arsenal.ammo, arsenal.reserve);
    if (rounds <= 0) return;
    arsenal.loading = rounds;
    arsenal.reloadLeft = type.reloadsWholeMagazine ? type.roundTime : type.roundTime * rounds;
    arsenal.burstLeft = 0;
  }

  function updateGun(op, dt, target, style) {
    const { arsenal } = op, { type } = arsenal;
    arsenal.cooldown -= dt;
    arsenal.kick *= Math.exp(-type.kick.recover * dt);
    arsenal.spin = stepSpin(type, arsenal.spin ?? 0, arsenal.burstLeft > 0 && arsenal.reloadLeft <= 0 && op.effects.emp <= 0, dt);
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
    // Sem ninguém na mira, aproveita para completar o carregador antes da próxima briga.
    arsenal.idle = target ? 0 : (arsenal.idle ?? 0) + dt;
    if (arsenal.idle > IDLE_RELOAD && type.magazine > 1 && arsenal.ammo <= type.magazine / 2 && arsenal.reserve > 0) {
      startReload(arsenal);
      return;
    }
    if (arsenal.aimingAt !== target) {             // trocar de alvo custa tempo de mira
      arsenal.aimingAt = target;
      arsenal.aimTime = random(AIM_TIME) * style.aim;
      arsenal.burstLeft = 0;
    }
    if (!target || op.effects.emp > 0 || (arsenal.aimTime -= dt) > 0 || arsenal.cooldown > 0) return;
    const distance = Math.hypot(target.x - op.x, target.z - op.z) || 1, chance = hitChance(op, target, distance, style);
    if (arsenal.burstLeft <= 0 && !worthShooting(op, target, distance, chance)) return;
    shoot(op, target, chance);
    scheduleNextShot(op, target, style);
  }

  // Quem vem atrás na distância certa para essa armadilha, com o quanto está de lado.
  function followersFor(op, type) {
    const [near, far] = TRAP_GAP[type.id] ?? TRAP_GAP.default;
    const list = [];
    for (const racer of field) {
      if (racer === op || !isAlive(racer)) continue;
      const gap = wrapDistance(op.dist - racer.dist), side = Math.abs(op.lane - racer.lane);
      if (gap >= near && gap <= far && side <= TRAP_ALIGN_REACH) list.push({ racer, gap, side });
    }
    return list;
  }

  // Quanto vale soltar essa armadilha nesse perseguidor agora.
  function trapScore(op, type, { racer, gap }, style) {
    const weapon = weaponOf(racer), aimsAtMe = racer.arsenal?.target === op || (op.grudge > 0 && op.grudgeTarget === racer);
    let score = 1;
    if (type.id === 'dynamite' && racer.v > op.v) score += 0.5;                       // chega rápido demais para desviar
    if (CURVE_TRAPS.has(type.id) && sharpCurveIn(op.dist - DROP_BEHIND - 10, 30)) score += style.curveTraps ? 1.5 : 0.6;
    if (type.id === 'paint' && weapon) score += 0.5 + (aimsAtMe ? 0.8 : 0);            // cega quem atira em mim
    if (type.id === 'smoke') score += (effectiveRange(weapon) >= 120 ? 1.2 : 0) + (aimsAtMe ? 0.8 : 0);   // esconde de quem mira de longe
    if (type.id === 'barrier' && racer.v > op.v) score += 0.6;                       // vem rápido: não dá tempo de desviar
    if (gap < 12) score += 0.3;
    return score;
  }

  // O trapaceiro guarda óleo e espinhos para a entrada da curva fechada, se ela vem logo.
  function waitsForCurve(op, type, style) {
    if (!style.curveTraps || !CURVE_TRAPS.has(type.id) || op.arsenal.curveWait > CURVE_WAIT_LIMIT) return false;
    return !sharpCurveIn(op.dist - DROP_BEHIND - 10, 30) && sharpCurveIn(op.dist, CURVE_SIGHT);
  }

  function updateTraps(op, dt, style) {
    const { arsenal } = op;
    if (!traps.isUnlocked() || op.effects.emp > 0 || (arsenal.trapTimer -= dt) > 0) return;
    arsenal.trapTimer = TRAP_RETRY;
    let best = null;
    for (const slot of arsenal.traps) {
      if (slot.charges <= 0 || slot.type.powerup) continue;
      for (const follower of followersFor(op, slot.type)) {
        const score = trapScore(op, slot.type, follower, style);
        if (!best || score > best.score) best = { slot, follower, score };
      }
    }
    if (!best) { arsenal.curveWait = 0; return; }
    const { slot, follower } = best, { type } = slot;
    if (waitsForCurve(op, type, style)) { arsenal.curveWait = (arsenal.curveWait ?? 0) + TRAP_RETRY; return; }
    if (follower.side > type.halfWidth + 1) {        // fora da faixa dele: quem sabe entra na frente e tenta de novo
      if (style.trapLane) Object.assign(op.tactics, { trapAim: follower.racer.lane, trapAimTime: TRAP_AIM_TIME });
      return;
    }
    slot.charges--;
    traps.dropFrom(op, type);
    arsenal.curveWait = 0;
    arsenal.trapTimer = random(style.trapPause);
  }

  function hasHarpoonShot(op) {
    const fx = -Math.sin(op.yaw), fz = -Math.cos(op.yaw);
    return !isBlinded(op) && field.some(target => {
      if (target === op || target.dead > 0 || target.protectedFor > 0 || isHidden(target)) return false;
      const dx = target.x - op.x, dz = target.z - op.z, forward = fx * dx + fz * dz, right = -fz * dx + fx * dz;
      return forward >= HARPOON_NEAR && forward <= HARPOON_FAR && Math.abs(right) <= HARPOON_AIM;
    });
  }

  // Alguém por perto que pode me machucar agora: mira em mim, tem raiva de mim ou está atrás no alcance da arma dele.
  function threatens(racer, op) {
    if (racer.arsenal?.target === op || (racer.grudge > 0 && racer.grudgeTarget === op)) return true;
    const behind = wrapDistance(op.dist - racer.dist);
    return behind > 0 && behind < effectiveRange(weaponOf(racer));
  }

  // Urgência de cada power-up (0 = não usa). URGENT ou mais passa por cima da pausa entre itens.
  function powerupUrgency(op, type, style) {
    const health = healthOf(op), burning = op.effects.burning > 0, mineOnMe = mines.fuseOn(op) > 0;
    if (type.id === 'emp') {
      if (mineOnMe) return 3;                        // o pulso desarma a mina grudada
      const near = field.filter(racer => racer !== op && isAlive(racer) && racer.effects.emp <= 0 && Math.hypot(racer.x - op.x, racer.z - op.z) < EMP_RADIUS * EMP_BOT_REACH);
      if (near.length < style.empCrowd) return 0;
      return near.some(racer => threatens(racer, op)) ? 1.6 : near.length > style.empCrowd ? 1.1 : 0;
    }
    if (type.id === 'shield') {
      if (op.effects.shield > 0) return 0;
      if (mineOnMe && !hasCharge(op, 'emp')) return 2.8;
      if (burning && health < 0.6 && !hasCharge(op, 'extinguisher')) return 2;
      const underFire = op.grudge > 0 || field.some(racer => racer.arsenal?.target === op);
      if (health < style.shieldAt && underFire) return 1.8;
      if (op.tactics.ramming > 0 && style.ram >= 1) return 1;   // o brutamontes ergue o escudo antes da pancada
      return 0;
    }
    if (type.id === 'cloak') {
      if (op.effects.cloak > 0 || mineOnMe) return 0;  // a mina já grudada não cai com a camuflagem
      const hunters = field.filter(racer => racer.arsenal?.target === op).length + (op.grudge > 0 ? 1 : 0);
      if (health < style.shieldAt && hunters > 0) return 1.7;
      return hunters >= 2 ? 1.2 : 0;                   // muita gente atirando nele: some
    }
    if (type.id === 'extinguisher') {
      if (burning && health < 0.75) return 2.6;     // apaga o fogo antes que ele termine o serviço
      return health < style.extinguishAt ? 2 : 0;
    }
    if (type.id === 'mine') {
      const target = mines.targetFor(op);
      if (!target || isBlinded(op) || target.effects?.shield > 0) return 0;
      return 1.4 + (target === op.quarry ? 0.4 : 0) + (healthOf(target) < 0.35 ? 0.5 : 0);
    }
    if (type.id === 'net') {
      const target = nets.targetFor(op);
      if (!target || isBlinded(op)) return 0;
      return 1.2 + (target === op.quarry ? 0.4 : 0) + (target.nitroActive || target.v > op.v ? 0.3 : 0);
    }
    if (type.id === 'harpoon') return !harpoons.get(op).busy && hasHarpoonShot(op) ? 1.3 : 0;
    return 0;
  }

  function usePowerup(op, type) {
    if (type.id === 'extinguisher') { traps.extinguish(op); return true; }
    if (type.id === 'harpoon') { harpoons.get(op).fire(); return true; }
    return traps.usePower(type.id, op);
  }

  function updatePowerups(op, dt, style) {
    const { arsenal } = op;
    arsenal.powerupTimer -= dt;
    if (!race.started || op.overturned || op.effects.emp > 0 || (arsenal.powerupCheck -= dt) > 0) return;
    arsenal.powerupCheck = POWERUP_RETRY;
    let best = null, bestUrgency = 0;
    for (const slot of arsenal.traps) {
      if (!slot.type.powerup || slot.charges <= 0 || !traps.isUnlocked(slot.type)) continue;
      const urgency = powerupUrgency(op, slot.type, style);
      if (urgency > bestUrgency && (arsenal.powerupTimer <= 0 || urgency >= URGENT)) { best = slot; bestUrgency = urgency; }
    }
    if (!best || !usePowerup(op, best.type)) return;
    best.charges--;
    arsenal.powerupTimer = random(style.powerupPause);
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
    leader = field.reduce((best, racer) => (!best || racer.dist > best.dist ? racer : best), null);
    const combatOpen = raceTime >= GRACE_AFTER_START;
    for (const op of opponents) {
      if (op.dead > 0 || op.remote) continue;
      const style = styleOf(op);
      op.grudge -= dt;
      updateGun(op, dt, updateTarget(op, dt, style, combatOpen), style);
      updateTraps(op, dt, style);
      if (combatOpen) updatePowerups(op, dt, style);
    }
  }

  return combat;
}
