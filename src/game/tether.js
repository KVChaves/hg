import { wrapDistance } from '../world/track.js';

// Cabo do arpão: depois de fisgar, os dois carros ficam ligados por uma corda de ROPE_LENGTH metros por TETHER_TIME s.
//  1. Corda esticada: quem está na frente não passa muito da velocidade de quem está atrás (o de trás pode frear de
//     propósito para segurar o da frente) e o de trás é puxado um pouco para a frente. Se o fisgado fica à frente do
//     dono ou o dono ultrapassa, os papéis só se invertem: a corda continua.
//  2. Carro destruído (parado) não solta a corda: quem está na frente dele freia de forma brusca, preso a um carro parado.
//     Carro que cai da ponte ou no rio não é sustentado: a corda arrebenta e o outro leva um tranco.
//  3. Os outros carros colidem com a corda: quem a atravessa perde velocidade e é jogado de lado (`tripRacer`).
//  4. Nada solta a corda de propósito: nem nitro, nem tiro, nem o dono. Só o tempo, o EMP de qualquer um dos dois,
//     a queda de um deles e o dono reaparecer depois de destruído.
// Cada navegador aplica a força só nos carros que simula (`remote` é simulado em outro), com a mesma regra dos dois lados.
// A colisão de terceiros com a corda fica a cargo do navegador de quem fisgou (`ownerSide`), que avisa quem simula o carro atingido.

export const TETHER_TIME = 8, ROPE_LENGTH = 14;
const TENSION_RATE = 5, REAR_SHARE = 0.35, SLACK = 1.5;      // 1/s; fração da perda que o de trás recebe; m/s de folga
const ANCHOR_JOLT = 0.5, ANCHOR_BRAKE = 12;                  // 1º tranco ao esticar contra um carro parado e o freio contínuo depois (1/s)
const DROP_YANK = 0.8;                                       // o carro que sobra perde isso da velocidade quando o outro cai
const NOSE_FORWARD = 2.3, HEIGHT = 0.62;
const TRIP_WIDTH = 1.15, TRIP_COOLDOWN = 1.5, TRIP_SPEED = 0.55;   // folga entre a corda e o eixo do carro (m), pausa até a mesma corda pegar o mesmo carro e o que sobra da velocidade
const TRIP_SPIN = 1.6, BOT_TRIP_SPIN = 2, BOT_TRIP_KNOCK = 10;
const CAR_HALF_LENGTH = 2.2, CAR_AXIS_HEIGHT = 0.6;
const RECEIVER_GRACE = 1;                                    // quem só recebe a corda espera um pouco mais pelo aviso do dono

const active = new Set();

function scaleSpeed(racer, car, k) {
  if (racer.isPlayer) { car.vx *= k; car.vz *= k; } else racer.v *= k;
}
function addSpeed(racer, car, dv) {
  if (racer.isPlayer) { car.vx += -Math.sin(car.yaw) * dv; car.vz += -Math.cos(car.yaw) * dv; } else racer.v = Math.max(0, racer.v + dv);
}

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

// Quem atravessou a corda perde velocidade e é jogado para um lado (`side`: -1 ou 1). Vale para o jogador e para os bots.
export function tripRacer(racer, car, side) {
  scaleSpeed(racer, car, TRIP_SPEED);
  if (racer.isPlayer) car.spin += side * TRIP_SPIN;
  else { racer.spin += side * TRIP_SPIN * BOT_TRIP_SPIN; racer.knock += side * BOT_TRIP_KNOCK; }
}

// Eixo do carro (traseira e frente) em coordenadas do mundo, para ver se a corda o atravessa.
function carAxis(racer) {
  const fx = -Math.sin(racer.yaw), fz = -Math.cos(racer.yaw), y = racer.wy + CAR_AXIS_HEIGHT;
  return [[racer.wx - fx * CAR_HALF_LENGTH, y, racer.wz - fz * CAR_HALF_LENGTH], [racer.wx + fx * CAR_HALF_LENGTH, y, racer.wz + fz * CAR_HALF_LENGTH]];
}

// Quem pulsou o EMP se solta de qualquer cabo (a única forma de soltar a corda antes do tempo).
export function cutInvolving(racer, reason) {
  for (const tether of active) if (tether.owner === racer || tether.target === racer) tether.cut(reason);
}

// `ownerSide`: o navegador de quem fisgou, que decide o tempo. Sem isso, a corda só espera o aviso de fim.
// `field` são todos os carros da corrida; `onTrip(carro, lado)` avisa que um deles atravessou a corda (quem simula esse carro aplica o tranco).
export function createTether({ owner, target, car, ownerSide, field = [], onTrip = () => {} }) {
  const tether = { owner, target, age: 0, tension: 0, ownerSide, pending: null };
  let ownerWasDead = false, jolted = false;
  const tripped = new Map();                        // carro -> segundos até a corda poder pegá-lo de novo
  active.add(tether);

  tether.cut = reason => { tether.pending ??= reason; };
  tether.dispose = () => active.delete(tether);
  tether.left = () => Math.max(0, TETHER_TIME - tether.age);

  // Terceiros que cruzam a corda: o eixo do carro encosta no segmento entre as pontas.
  function collide(dt) {
    for (const [racer, wait] of tripped) { if (wait - dt <= 0) tripped.delete(racer); else tripped.set(racer, wait - dt); }
    const [a, b] = ropeEnds(owner, target), rope = sub(b, a);
    for (const racer of field) {
      if (racer === owner || racer === target || racer.dead > 0 || racer.sunk > 0 || racer.protectedFor > 0 || tripped.has(racer)) continue;
      const [tail, nose] = carAxis(racer);
      if (segmentDistance(a, b, tail, nose) >= TRIP_WIDTH) continue;
      tripped.set(racer, TRIP_COOLDOWN);
      const side = Math.sign(rope[0] * (racer.wz - a[2]) - rope[2] * (racer.wx - a[0])) || 1;   // de que lado da corda o carro está
      if (!racer.remote) tripRacer(racer, car, side);
      onTrip(racer, side);
    }
  }

  // Devolve o motivo do fim, ou nulo se a corda continua.
  tether.update = dt => {
    tether.age += dt;
    if (tether.pending) return tether.pending;
    if (tether.age >= TETHER_TIME + (ownerSide ? 0 : RECEIVER_GRACE)) return 'tempo';
    if (owner.sunk > 0 || target.sunk > 0) {         // caiu da ponte ou no rio: a corda não sustenta
      const left = owner.sunk > 0 ? target : owner;
      if (left.sunk <= 0 && !left.remote && left.dead <= 0) scaleSpeed(left, car, DROP_YANK);
      return 'queda';
    }
    if (owner.dead > 0) ownerWasDead = true;
    else if (ownerWasDead) return 'reaparece';       // o dono voltou à pista em outro lugar
    if (ownerSide) collide(dt);
    const distance = Math.hypot(owner.x - target.x, owner.z - target.z), taut = distance > ROPE_LENGTH;
    tether.tension = Math.max(0, Math.min(1, (distance - ROPE_LENGTH * 0.7) / (ROPE_LENGTH * 0.3)));
    if (!taut) return null;
    const anchor = owner.dead > 0 ? owner : target.dead > 0 ? target : null;   // carro destruído fica parado
    if (anchor) {
      const live = anchor === owner ? target : owner;
      if (live.dead > 0 || wrapDistance(live.dist - anchor.dist) <= 0 || live.remote) return null;   // atrás do parado só chega nele
      if (!jolted) { jolted = true; scaleSpeed(live, car, ANCHOR_JOLT); }
      scaleSpeed(live, car, Math.exp(-ANCHOR_BRAKE * dt));
      return null;
    }

    const targetAhead = wrapDistance(target.dist - owner.dist) >= 0, front = targetAhead ? target : owner, rear = targetAhead ? owner : target;
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
