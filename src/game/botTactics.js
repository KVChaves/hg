import { TRACK_WIDTH } from '../config.js';
import { wrapDistance } from '../world/track.js';
import { effectiveRange, isAlive, styleOf, weaponOf } from './botStyles.js';

// Tática de pista dos adversários, conforme o estilo (botStyles.js): para qual faixa ir, quanto segurar a velocidade e
// quando pedir nitro. Roda antes do desvio de tráfego e das armadilhas, que continuam valendo por cima.
// Lê `op.quarry` (alvo da perseguição, escolhido em opponentCombat.js), `op.errand` (item do NPC de estrada que o bot quer,
// de roadsideHelp.js) e `op.tactics.trapAim` (faixa de quem vem atrás, para soltar a armadilha na frente dele).

const LANE_LIMIT = TRACK_WIDTH / 2 - 1.2;
const ERRAND_SIGHT = 150;                            // m antes do NPC de estrada em que o bot já vai para o lado do item
const CHASE_SIGHT = 260;                             // até onde enxerga o alvo da perseguição
const HOLD_GAIN = 0.6, HOLD_MIN_SPEED = 10;           // segurando atrás do alvo: m/s a menos por metro perto demais
const RAM_ALONG = [-2.5, 4.5], RAM_SIDE = [2, 6.5], RAM_TIME = 0.75, RAM_COOLDOWN = [2.5, 5], RAM_MIN_SPEED = 12, RAM_SPEED_LEAD = 1.2;
const BLOCK_BEHIND = [3, 24], BLOCK_CLOSING = -1.5, BLOCK_REROLL = 3;   // quem vem chegando atrás (m/s a mais) é fechado
const DEFEND_BEHIND = 9;                             // nitro para não deixar passar quem está colado
const JINK_AMPLITUDE = 2.6, JINK_RATE = 1.9;
const DRAFT_GAP = [6, 26];                           // entra no vácuo do alvo nesse trecho
const ESCAPE_LEVEL = 0.5, SHOTGUN_DANGER = 30;       // nível de ameaça para fugir; escopeta a menos disso é perigo

const between = ([low, high]) => low + Math.random() * (high - low);
const clampLane = lane => Math.max(-LANE_LIMIT, Math.min(LANE_LIMIT, lane));

export const createTactics = () => ({
  ramCooldown: between([1, 4]), ramming: 0, ramTarget: null,
  patience: 0, patienceFor: null, jinkPhase: Math.random() * Math.PI * 2,
  blockRoll: 0, blocking: false, trapAim: null, trapAimTime: 0,
  lane: null, fast: false, threat: null,
});

// Quem atrás de mim está na distância em que a arma dele me machuca. Nível de 0 a 1 (1 = colado, ou com raiva de mim).
function threatBehind(op, field) {
  let worst = null, level = 0;
  for (const other of field) {
    if (other === op || !isAlive(other)) continue;
    const behind = wrapDistance(op.dist - other.dist), type = weaponOf(other), range = effectiveRange(type);
    if (behind < 2 || behind > range) continue;
    let danger = 1 - behind / range;
    if (other.grudgeTarget === op && other.grudge > 0) danger += 0.3;
    if (other.arsenal?.target === op) danger += 0.3;
    if (type?.falloff && behind < SHOTGUN_DANGER) danger += 0.3;
    if (danger > level) { level = danger; worst = other; }
  }
  return worst ? { racer: worst, level: Math.min(1, level), shotgun: Boolean(weaponOf(worst)?.falloff) } : null;
}

// Vai para o lado do NPC com o item escolhido.
function errandLane(op) {
  const errand = op.errand;
  if (!errand) return null;
  const ahead = wrapDistance(errand.dist - op.dist);
  return ahead > -3 && ahead < ERRAND_SIGHT ? errand.lane : null;
}

// Joga o carro em quem está do lado: troca de faixa rápida para dentro dele.
function ramLane(op, field, style, t) {
  if (t.ramming > 0 && t.ramTarget && isAlive(t.ramTarget)) return t.ramTarget.lane;
  t.ramTarget = null;
  if (style.ram <= 0 || t.ramCooldown > 0 || op.v < RAM_MIN_SPEED) return null;
  t.ramCooldown = 0.3;                               // procura de novo logo mais
  for (const other of field) {
    if (other === op || !isAlive(other) || other.protectedFor > 0) continue;
    const along = wrapDistance(other.dist - op.dist), side = Math.abs(other.lane - op.lane);
    if (along < RAM_ALONG[0] || along > RAM_ALONG[1] || side < RAM_SIDE[0] || side > RAM_SIDE[1]) continue;
    t.ramCooldown = between(RAM_COOLDOWN);
    if (Math.random() > style.ram) return null;
    t.ramTarget = other;
    t.ramming = RAM_TIME;
    return other.lane;
  }
  return null;
}

// Fecha a faixa de quem vem chegando atrás, para não deixar passar.
function blockLane(op, field, style, t) {
  if (style.block <= 0) return null;
  if (t.blockRoll <= 0) {
    t.blockRoll = BLOCK_REROLL;
    t.blocking = Math.random() < style.block;
  }
  if (!t.blocking) return null;
  let follower = null, nearest = Infinity;
  for (const other of field) {
    if (other === op || !isAlive(other)) continue;
    const behind = wrapDistance(op.dist - other.dist);
    if (behind < BLOCK_BEHIND[0] || behind > BLOCK_BEHIND[1] || other.v - op.v < BLOCK_CLOSING) continue;
    if (behind < nearest) { nearest = behind; follower = other; }
  }
  if (!follower) return null;
  if (style.defendNitro && nearest < DEFEND_BEHIND && follower.v > op.v) op.nitroUrge = true;
  return op.lane + (follower.lane - op.lane) * Math.min(1, style.block);
}

// Vácuo do alvo: mais velocidade e o alvo bem no meio da mira.
function draftLane(op, style) {
  const quarry = op.quarry;
  if (!quarry || style.draft <= 0 || !isAlive(quarry)) return null;
  const gap = wrapDistance(quarry.dist - op.dist);
  if (gap < DRAFT_GAP[0] || gap > DRAFT_GAP[1]) return null;
  return op.lane + (quarry.lane - op.lane) * style.draft;
}

// Ziguezague sob fogo: fica mais difícil de acertar.
function jinkLane(op, style, t, time) {
  if (!t.threat || style.jink <= 0 || t.threat.level < 1 - style.jink) return null;
  return op.preferredLane + Math.sin(time * JINK_RATE + t.jinkPhase) * JINK_AMPLITUDE;
}

// Velocidade máxima que a tática aceita agora (Infinity = sem limite).
function paceCap(op, style, t, dt) {
  if (t.ramming > 0 && t.ramTarget) {               // emparelha com quem vai levar a pancada
    const along = wrapDistance(t.ramTarget.dist - op.dist);
    return along > 0 ? t.ramTarget.v + RAM_SPEED_LEAD + along : Infinity;
  }
  const quarry = op.quarry;
  if (!quarry || !style.keepAt || !isAlive(quarry)) return Infinity;
  const gap = wrapDistance(quarry.dist - op.dist);
  if (gap <= 0 || gap > CHASE_SIGHT) return Infinity;
  const [near, far] = style.keepAt;
  if (gap > far) {
    if (style.chaseNitro) op.nitroUrge = true;
    return Infinity;
  }
  if (t.patienceFor !== quarry) { t.patienceFor = quarry; t.patience = style.patience; }
  const armed = op.arsenal.ammo + op.arsenal.reserve > 0;
  if (gap >= near || t.patience <= 0 || !armed) return Infinity;
  t.patience -= dt;                                  // segura atrás para continuar atirando, mas não para sempre
  return Math.max(HOLD_MIN_SPEED, quarry.v + (gap - near) * HOLD_GAIN);
}

// Decide a tática do quadro. Devolve o limite de velocidade; a faixa fica em `op.tactics.lane` para `steerByTactics`.
export function planTactics(op, field, dt, time) {
  const style = styleOf(op), t = op.tactics;
  t.ramCooldown -= dt;
  t.ramming -= dt;
  t.blockRoll -= dt;
  t.trapAimTime -= dt;
  op.nitroUrge = false;
  t.threat = threatBehind(op, field);
  if (t.threat && style.escapeNitro && (t.threat.shotgun || t.threat.level > ESCAPE_LEVEL)) op.nitroUrge = true;

  const cap = paceCap(op, style, t, dt);
  const errand = errandLane(op);
  const ram = errand === null ? ramLane(op, field, style, t) : null;
  t.fast = ram !== null;
  if (errand !== null || ram !== null) { t.lane = errand ?? ram; return cap; }
  if (op.blocker) { t.lane = null; return cap; }      // carro na frente: o desvio de tráfego manda
  const aimTrap = t.trapAimTime > 0 ? t.trapAim : null;
  t.lane = aimTrap ?? blockLane(op, field, style, t) ?? draftLane(op, style) ?? jinkLane(op, style, t, time);
  return cap;
}

// Aplica a faixa escolhida por cima da do desvio de tráfego.
export function steerByTactics(op) {
  const { lane, fast } = op.tactics;
  if (lane === null) return;
  op.laneTarget = clampLane(lane);
  if (fast) op.dodgeTime = Math.max(op.dodgeTime, 0.15);   // a pancada é uma troca de faixa rápida
}
