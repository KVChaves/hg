import * as THREE from 'three';

// Trechos desenhados à mão por cima da curva sorteada (track.js), para pistas que pedem um traçado que a curva
// suave não faz: o castelo da Estrada do Rei (reta, duas curvas de 90° e reta) e a mata de curvas onduladas.
// Tudo trabalha numa polilinha fechada (pontos a cada ~3 m) e devolve outra, que track.js reamostra.

const DENSE = 1;                                     // metros entre os pontos gerados aqui (antes de reamostrar)
const smooth = u => { const t = Math.max(0, Math.min(1, u)); return t * t * (3 - 2 * t); };

// Polilinha fechada → `count` pontos igualmente espaçados (~`spacing` m). `marks`: nome → índice na polilinha
// de entrada; volta nome → distância (m) desde o início.
export function resample(points, spacing, marks = {}) {
  const n = points.length, cum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) cum[i + 1] = cum[i] + points[i].distanceTo(points[(i + 1) % n]);
  const length = cum[n], count = Math.round(length / spacing), step = length / count, out = [];
  let j = 0;
  for (let k = 0; k < count; k++) {
    const d = k * step;
    while (cum[j + 1] < d) j++;
    const u = (d - cum[j]) / ((cum[j + 1] - cum[j]) || 1);
    out.push(points[j].clone().lerp(points[(j + 1) % n], u));
  }
  const at = Object.fromEntries(Object.entries(marks).map(([name, index]) => [name, cum[index]]));
  return { sampled: { length, count, step, points: out }, at };
}

const tangentAt = (points, i) => {
  const n = points.length;
  return points[(i + 1) % n].clone().sub(points[(i - 1 + n) % n]).setY(0).normalize();
};

// Curva de Hermite de `a` (direção `ta`) até `b` (direção `tb`), com pontos a cada DENSE m (sem as pontas).
function hermite(a, ta, b, tb) {
  const span = a.distanceTo(b), count = Math.max(2, Math.round(span * 1.2 / DENSE)), out = [];
  const m0 = ta.clone().multiplyScalar(span), m1 = tb.clone().multiplyScalar(span);
  for (let k = 1; k < count; k++) {
    const t = k / count, t2 = t * t, t3 = t2 * t;
    out.push(a.clone().multiplyScalar(2 * t3 - 3 * t2 + 1).addScaledVector(m0, t3 - 2 * t2 + t)
      .addScaledVector(b, -2 * t3 + 3 * t2).addScaledVector(m1, t3 - t2));
  }
  return out;
}

// Maior curvatura (1/m) de uma sequência de pontos, medida pela virada a cada ~`span` m.
function maxCurvature(points, span = 6) {
  let worst = 0;
  for (let i = span; i < points.length - span; i++) {
    const a = points[i].clone().sub(points[i - span]), b = points[i + span].clone().sub(points[i]);
    const turn = Math.abs(Math.atan2(a.x * b.z - a.z * b.x, a.x * b.x + a.z * b.z));
    worst = Math.max(worst, turn / (a.length() + b.length()) * 2);
  }
  return worst;
}

// Castelo: a partir de um ponto `s` da pista sai uma reta na direção dela (`approach` m: corrida, rampa da ponte
// levadiça e fosso), entra pelo portão e corre por dentro em retas (`inside`) ligadas por curvas de 90° de raio
// `radius`: as retas pares seguem em frente e as ímpares vão de lado. Com cinco retas o pátio faz um Π: sai para
// fora da volta, segue em frente e volta para a linha de entrada, e o portão de saída fica nela; depois mais
// `exit` m retos (a descida do castelo) e uma curva longa e suave (Hermite) que devolve a pista ao traçado
// original `rejoin` m adiante. Escolhe o `s` em que essa volta fica mais suave; nulo se nenhum serve.
// `keepClear`: [de, até] metros do início em que nada pode mudar (largada e grid).
export function insertCastle(points, step, random, spec) {
  const { approach, inside, radius, exit, rejoin, keepClear: [clearFrom, clearTo], maxRejoinCurve } = spec;
  const n = points.length, turns = inside.length - 1;
  const forward = inside.filter((_, i) => i % 2 === 0).reduce((sum, length) => sum + length, 0) + radius * turns;   // cada curva avança um raio
  const centre = points.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / n);
  const options = [];
  for (let s = Math.ceil(clearFrom / step); s < n; s += 2) {
    const b = s + Math.round((approach + forward + exit + rejoin) / step);
    if (b * step > points.length * step - clearTo) break;
    const path = castlePath(points, s, b, centre, spec);
    const bend = maxCurvature(path.rejoinPoints);
    if (bend <= maxRejoinCurve) options.push({ s, b, path, bend });
  }
  if (!options.length) return null;
  options.sort((p, q) => p.bend - q.bend);
  const pick = options[Math.floor(random() * Math.min(options.length, 6))];   // entre as mais suaves, sorteia
  const { s, b, path } = pick;
  const out = [...points.slice(0, s + 1)], base = out.length;
  const marks = {};
  for (const [name, index] of Object.entries(path.marks)) marks[name] = base + index;
  out.push(...path.points, ...path.rejoinPoints);
  marks.rejoin = out.length;
  out.push(...points.slice(b));
  return { points: out, marks, side: path.side, forward };
}

function castlePath(points, s, b, centre, { approach, inside, radius, exit }) {
  const start = points[s], h = tangentAt(points, s), normal = new THREE.Vector3(-h.z, 0, h.x);
  const side = Math.sign(normal.dot(start.clone().sub(centre))) || 1, out = normal.multiplyScalar(side);   // vira para fora da volta
  const pts = [], marks = {};
  let p = start.clone();
  const straight = (dir, length) => { for (let t = DENSE; t <= length + 1e-6; t += DENSE) pts.push(p.clone().addScaledVector(dir, t)); p = p.clone().addScaledVector(dir, length); };
  const arc = (from, to) => {                        // 90° de `from` para `to`, raio `radius`
    const steps = Math.round(radius * Math.PI / 2 / DENSE);
    for (let k = 1; k <= steps; k++) {
      const theta = k / steps * Math.PI / 2;
      pts.push(p.clone().addScaledVector(from, radius * Math.sin(theta)).addScaledVector(to, radius * (1 - Math.cos(theta))));
    }
    p = p.clone().addScaledVector(from, radius).addScaledVector(to, radius);
  };
  const mark = name => { marks[name] = pts.length - 1; };
  straight(h, approach); mark('gate');
  // Reta em frente, curva para o lado, reta de lado, curva de volta... O lado alterna a cada ida: sai e volta.
  let sideways = out;
  inside.forEach((length, i) => {
    const along = i % 2 === 0 ? h : sideways;
    straight(along, length);
    if (i === inside.length - 1) return;
    const turn = i + 1;                              // curvas numeradas de 1 em diante
    mark(`turn${turn}`);
    if (i % 2 === 0) arc(h, sideways);
    else { arc(sideways, h); sideways = sideways.clone().negate(); }
    mark(`turn${turn}End`);
  });
  mark('exitGate');
  straight(h, exit); mark('causewayEnd');
  const end = p.clone(), target = points[b % points.length];
  const rejoinPoints = hermite(end, h, target, tangentAt(points, b % points.length));
  return { points: pts, rejoinPoints, marks, side };
}

// Curvas onduladas: desloca a pista de lado num seno (amplitude `amplitude` m, onda de `wavelength` m) ao longo de
// `length` m, entrando e saindo devagar. Escolhe um trecho longe de `avoid` ([de, até] em metros, na polilinha
// já reamostrada) e da largada. Devolve { points, from, to } (metros) ou nulo.
export function insertWaves(points, step, random, { amplitude, wavelength, length, keepClear: [clearFrom, clearTo] }, avoid = []) {
  const n = points.length, total = n * step, span = Math.round(length / step);
  const inside = (d, [from, to]) => ((d - from) % total + total) % total <= ((to - from) % total + total) % total;
  const spots = [];
  for (let s = Math.ceil(clearFrom / step); (s + span) * step < total - clearTo; s += 4) {
    let ok = true;
    for (let k = -20; k <= span + 20 && ok; k += 4) if (avoid.some(range => inside((s + k) * step, range))) ok = false;
    if (ok) spots.push(s);
  }
  if (!spots.length) return null;
  const s = spots[Math.floor(random() * spots.length)];
  const fade = wavelength / 2, out = points.map(p => p.clone());
  for (let k = 0; k <= span; k++) {
    const i = (s + k) % n, along = k * step, t = tangentAt(points, i), normal = new THREE.Vector3(-t.z, 0, t.x);
    const envelope = smooth(along / fade) * smooth((length - along) / fade);
    out[i].addScaledVector(normal, amplitude * envelope * Math.sin(2 * Math.PI * along / wavelength));
  }
  return { points: out, from: s * step, to: (s + span) * step };
}
