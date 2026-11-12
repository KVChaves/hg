import { wrapDistance } from '../world/track.js';

// Cabo do arpão: depois de fisgar, os dois carros ficam ligados por uma corda de ROPE_LENGTH metros por TETHER_TIME s.
//  1. Corda esticada: quem está na frente não passa muito da velocidade de quem está atrás (o de trás pode frear de
//     propósito para segurar o da frente) e o de trás é puxado um pouco para a frente.
//  2. Quem fisgou ultrapassa e a corda estica de novo: chicote. O fisgado gira e perde velocidade, o cabo se solta.
//  3. A corda também se solta por tempo, nitro de quem está na frente, EMP, tiro no cabo, carro destruído ou
//     o dono apertando E de novo.
// Cada navegador aplica a força só nos carros que simula (`remote` é simulado em outro), com a mesma regra dos dois lados.

export const TETHER_TIME = 6, ROPE_LENGTH = 14;
const TENSION_RATE = 5, REAR_SHARE = 0.35, SLACK = 1.5;      // 1/s; fração da perda que o de trás recebe; m/s de folga
const SWAP_MARGIN = 2;                                       // m à frente do fisgado para valer como ultrapassagem
const WHIP_SPIN = [1.4, 0.1], WHIP_TARGET_SPEED = 0.7, WHIP_OWNER_SPEED = 0.92, WHIP_REL_MAX = 25;
const BOT_SPIN = 2, BOT_KNOCK = 14;
const NOSE_FORWARD = 2.3, HEIGHT = 0.62;
const CUT_DISTANCE = 0.6, SHOT_IGNORE = 4;                   // tiro a menos disso do cabo o corta; tiro que sai de uma ponta não conta
const RECEIVER_GRACE = 1;                                    // quem só recebe a corda espera um pouco mais pelo aviso do dono

const active = new Set();

function scaleSpeed(racer, car, k) {
  if (racer.isPlayer) { car.vx *= k; car.vz *= k; } else racer.v *= k;
}
function addSpeed(racer, car, dv) {
  if (racer.isPlayer) { car.vx += -Math.sin(car.yaw) * dv; car.vz += -Math.cos(car.yaw) * dv; } else racer.v = Math.max(0, racer.v + dv);
}
const usesNitro = (racer, car) => (racer.isPlayer ? car.nitroActive : racer.remote ? Boolean(racer.snapshot?.nitro) : racer.nitroActive);

// Pontas do cabo em coordenadas do mundo: a frente do dono e o centro do fisgado.
export function ropeEnds(owner, target) {
  return [[owner.wx - Math.sin(owner.yaw) * NOSE_FORWARD, owner.wy + HEIGHT, owner.wz - Math.cos(owner.yaw) * NOSE_FORWARD], [target.wx, target.wy + HEIGHT, target.wz]];
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const clamp01 = x => Math.max(0, Math.min(1, x));

// Menor distância entre os segmentos p1-q1 e p2-q2.
function segmentDistance(p1, q1, p2, q2) {
  const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2);
  const a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  let s = 0, t = 0;
  if (a > 1e-9 && e > 1e-9) {
    const b = dot(d1, d2), c = dot(d1, r), denom = a * e - b * b;
    s = denom > 1e-9 ? clamp01((b * f - c * e) / denom) : 0;
    t = (b * s + f) / e;
    if (t < 0) { t = 0; s = clamp01(-c / a); } else if (t > 1) { t = 1; s = clamp01((b - c) / a); }
  } else if (a > 1e-9) {
    s = clamp01(-dot(d1, r) / a);
  } else if (e > 1e-9) {
    t = clamp01(f / e);
  }
  const c1 = [p1[0] + d1[0] * s, p1[1] + d1[1] * s, p1[2] + d1[2] * s], c2 = [p2[0] + d2[0] * t, p2[1] + d2[1] * t, p2[2] + d2[2] * t];
  return Math.hypot(...sub(c1, c2));
}

const asPoint = point => (Array.isArray(point) ? point : [point.x, point.y, point.z]);

// Um tiro de `from` até `to` que passa perto de um cabo o corta (menos o tiro que sai de uma das pontas).
export function cutByShot(from, to) {
  const start = asPoint(from), end = asPoint(to);
  for (const tether of active) {
    const [a, b] = ropeEnds(tether.owner, tether.target);
    if (Math.hypot(...sub(start, a)) < SHOT_IGNORE || Math.hypot(...sub(start, b)) < SHOT_IGNORE) continue;
    if (segmentDistance(start, end, a, b) < CUT_DISTANCE) tether.cut('tiro');
  }
}

// Quem pulsou o EMP se solta de qualquer cabo.
export function cutInvolving(racer, reason) {
  for (const tether of active) if (tether.owner === racer || tether.target === racer) tether.cut(reason);
}

// `ownerSide`: o navegador de quem fisgou, que decide o tempo. Sem isso, a corda só espera o aviso de fim.
export function createTether({ owner, target, car, ownerSide, onWhip = () => {} }) {
  const tether = { owner, target, age: 0, tension: 0, ownerSide, pending: null };
  const frontIsTarget = wrapDistance(target.dist - owner.dist) >= 0;
  active.add(tether);

  tether.cut = reason => { tether.pending ??= reason; };
  tether.dispose = () => active.delete(tether);
  tether.left = () => Math.max(0, TETHER_TIME - tether.age);

  function whip() {
    const rel = Math.min(WHIP_REL_MAX, Math.abs(owner.v - target.v));
    const side = Math.sign(target.lane - owner.lane) || (Math.random() < 0.5 ? -1 : 1);
    const spin = side * (WHIP_SPIN[0] + rel * WHIP_SPIN[1]);
    if (!target.remote) {
      scaleSpeed(target, car, WHIP_TARGET_SPEED);
      if (target.isPlayer) car.spin += spin;
      else { target.spin += spin * BOT_SPIN; target.knock += side * BOT_KNOCK; }
    }
    if (!owner.remote) scaleSpeed(owner, car, WHIP_OWNER_SPEED);
    onWhip(target);
  }

  // Devolve o motivo do fim, ou nulo se a corda continua.
  tether.update = dt => {
    tether.age += dt;
    if (tether.pending) return tether.pending;
    if (tether.age >= TETHER_TIME + (ownerSide ? 0 : RECEIVER_GRACE)) return 'tempo';
    if (owner.dead > 0 || target.dead > 0) return 'destruido';
    const distance = Math.hypot(owner.x - target.x, owner.z - target.z), taut = distance > ROPE_LENGTH;
    tether.tension = Math.max(0, Math.min(1, (distance - ROPE_LENGTH * 0.7) / (ROPE_LENGTH * 0.3)));
    if (!taut) return null;

    const targetAhead = wrapDistance(target.dist - owner.dist) >= 0, front = targetAhead ? target : owner, rear = targetAhead ? owner : target;
    if (usesNitro(front, car)) return 'nitro';
    const passed = frontIsTarget ? wrapDistance(owner.dist - target.dist) > SWAP_MARGIN : wrapDistance(target.dist - owner.dist) > SWAP_MARGIN;
    if (passed) { whip(); return 'chicote'; }

    const rel = front.v - rear.v;
    if (rel > SLACK) {
      const pull = (rel - SLACK) * Math.min(1, TENSION_RATE * dt);
      if (!front.remote) addSpeed(front, car, -pull);
      if (!rear.remote) addSpeed(rear, car, pull * REAR_SHARE);
    }
    return null;
  };

  return tether;
}
