import * as THREE from 'three';
import { TRACK_WIDTH } from '../config.js';
import { fbm } from '../art/shade.js';

// Pista gerada por semente: uma curva fechada em volta do centro, reamostrada em passos iguais, apoiada
// num relevo. `track` é sempre o mesmo objeto; gerar outra pista troca o conteúdo dele.

export const track = { length: 1, count: 0, step: 1, px: null, py: null, pz: null, tx: null, tz: null, slope: null, curvature: null, turn: null, wall: null, roll: null, gap: null, epic: null, drop: null, bed: null, enclosed: null, lift: null, flight: null, bridge: null, jumps: [], bridges: [], darkZones: [], hazards: [], valley: null, openWall: 0, chasmRange: null, heightAt: () => 0, meshHeightAt: () => 0 };

const CONTROL_COUNT = 18, HARMONICS = [[2, 0.8], [3, 0.55], [4, 0.3]];
export const OPEN_WALL = TRACK_WIDTH / 2 + 3;         // até onde o centro do carro pode sair da pista, onde ficam os muros
export const TWIST_RADIUS = 10;                       // distância da estrada ao eixo do tubo em que ela gira
export const SHARP_RADIUS = 34;                       // raio (m) a partir do qual a curva conta como fechada
const FLAT_OUT_RADIUS = 62;                           // acima desse raio dá para fazer a curva a 120 km/h sem frear
const NOTCH_MIN_SPACING = 4, NOTCH_IN = [0.56, 0.7], NOTCH_OUT = [1.32, 1.5];
const MIN_ARM_DISTANCE = 62, ARM_INDEX_GAP = 60, MAX_ATTEMPTS = 60;   // braços da pista precisam ficar longe um do outro
const MAX_SLOPE = 0.2, MAX_RELIEF_RETRIES = 8, RELIEF_REDUCTION = 0.8;
const FLAT_START_RADIUS = 150, ROAD_LIFT = 0.2;       // a largada é plana; a estrada fica um pouco acima do terreno
const BLEND_FROM = 10, BLEND_TO = 30;                 // perto da estrada o terreno acompanha a altura dela
const CHASM_FROM = 42, CHASM_TO = 80;                 // sob o tubo o chão desce até essa distância
const RIVER_FROM = 80, RIVER_TO = 130;                // largura padrão do leito do rio, a partir da pista (`chasmRange` muda)
const BANK_FROM = 16, BANK_TO = 50;                   // barrancos ao lado da estrada, nos biomas que têm (`bankRange` muda)
const GROUND_SINK = 1.4, SINK_TO = 18;                // e passa por baixo do asfalto, para nunca atravessá-lo
const VALLEY_BLEND = 30;                              // além da borda do vale o terreno volta ao relevo livre
const VALLEY_MESH_SINK = 4, VALLEY_MESH_MARGIN = 12;  // sob as encostas desenhadas a malha grossa do chão afunda, para não furá-las

const smoothstep = (from, to, value) => {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

// Vale côncavo (`shape.valley`): o leito plano vai até `floor` metros do centro, a encosta sobe como meia
// parábola até `top` (`height` metros de altura) e depois amansa numa borda de `lip` metros. Sem acostamento:
// a terra começa onde a estrada acaba, e o carro pode subir a encosta.
export function valleyRise(offset, valley = track.valley) {
  const { floor, top, height, lip } = valley, d = Math.abs(offset);
  if (d <= floor) return 0;
  if (d <= top) return height * ((d - floor) / (top - floor)) ** 2;
  const edge = 2 * height / (top - floor), x = Math.min(d - top, lip);
  return height + edge * x - edge * x * x / (2 * lip);
}

// Inclinação da encosta (metros de subida por metro de lado), com sinal: positiva quando sobe para `offset` maior.
export function valleySlope(offset, valley = track.valley) {
  const { floor, top, height, lip } = valley, d = Math.abs(offset), edge = 2 * height / (top - floor);
  const slope = d <= floor ? 0 : d <= top ? edge * (d - floor) / (top - floor) : edge * Math.max(0, 1 - (d - top) / lip);
  return Math.sign(offset) * slope;
}

// Largura total do vale até a borda.
export const valleyReach = (valley = track.valley) => valley.top + valley.lip;

export function createRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Ao redor de um centro os ângulos só aumentam, então a curva nunca se cruza.
function controlPoints(random, { wiggle, targetLength, sharpCurves = 0 }) {
  const baseRadius = targetLength / (Math.PI * 2 * 1.1);
  // Ondas longas dão curvas amplas, feitas sem frear; as fechadas vêm só de addNotches.
  const waves = HARMONICS.map(([k, weight]) => ({ k, amplitude: wiggle * weight * (0.6 + random() * 0.4), phase: random() * Math.PI * 2 }));
  const radii = Array.from({ length: CONTROL_COUNT }, (_, i) => {
    const angle = i / CONTROL_COUNT * Math.PI * 2;
    return 1 + waves.reduce((sum, { k, amplitude, phase }) => sum + amplitude * Math.sin(k * angle + phase), 0);
  });
  addNotches(radii, random, sharpCurves);
  return radii.map((r, i) => {
    const angle = i / CONTROL_COUNT * Math.PI * 2;
    return new THREE.Vector3(Math.cos(angle) * r * baseRadius, 0, Math.sin(angle) * r * baseRadius);
  });
}

// Um ponto muito para dentro ou para fora, com os vizinhos no raio normal, vira uma curva bem fechada.
function addNotches(radii, random, wanted) {
  const between = ([low, high]) => low + random() * (high - low);
  const taken = [];
  for (let tries = 0; tries < 80 && taken.length < wanted; tries++) {
    const i = 3 + Math.floor(random() * (CONTROL_COUNT - 5));
    if (taken.some(other => Math.min(Math.abs(other - i), CONTROL_COUNT - Math.abs(other - i)) < NOTCH_MIN_SPACING)) continue;
    taken.push(i);
    radii[i] *= between(random() < 0.6 ? NOTCH_IN : NOTCH_OUT);
  }
}

function sampleCurve(points) {
  const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal');
  curve.arcLengthDivisions = 3000;
  curve.updateArcLengths();
  const length = curve.getLength(), count = Math.round(length / 3);
  return { length, count, step: length / count, points: curve.getSpacedPoints(count) };
}

function armsKeepApart({ count, points }) {
  const limit = MIN_ARM_DISTANCE * MIN_ARM_DISTANCE;
  for (let i = 0; i < count; i += 4) {
    for (let k = i + ARM_INDEX_GAP; k < count; k += 4) {
      if (Math.min(k - i, count - k + i) < ARM_INDEX_GAP) continue;
      const dx = points[i].x - points[k].x, dz = points[i].z - points[k].z;
      if (dx * dx + dz * dz < limit) return false;
    }
  }
  return true;
}

function fillGeometry(sampled) {
  const { count, step, points } = sampled;
  const px = new Float32Array(count), pz = new Float32Array(count), tx = new Float32Array(count), tz = new Float32Array(count);
  for (let i = 0; i < count; i++) { px[i] = points[i].x; pz[i] = points[i].z; }
  for (let i = 0; i < count; i++) {
    const a = (i - 1 + count) % count, b = (i + 1) % count, dx = px[b] - px[a], dz = pz[b] - pz[a], len = Math.hypot(dx, dz);
    tx[i] = dx / len; tz[i] = dz / len;
  }
  // `turn` tem sinal (positivo vira à direita); `curvature` é o módulo.
  const raw = new Float32Array(count), turn = new Float32Array(count), curvature = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = (i - 1 + count) % count, b = (i + 1) % count;
    raw[i] = Math.atan2(tx[a] * tz[b] - tz[a] * tx[b], tx[a] * tx[b] + tz[a] * tz[b]) / (2 * step);
  }
  for (let i = 0; i < count; i++) {
    let sum = 0;
    for (let k = -3; k <= 3; k++) sum += raw[(i + k + count) % count];
    turn[i] = sum / 7;
    curvature[i] = Math.abs(turn[i]);
  }
  return { length: sampled.length, count, step, px, pz, tx, tz, turn, curvature };
}

// Relevo único para o mundo todo: a estrada e o terreno sempre concordam, mesmo entre braços próximos.
function createHeightField(random, { relief, hillScale }, startX, startZ) {
  const offsetX = random() * 1000, offsetZ = random() * 1000;
  const raw = (x, z) => (fbm(x / hillScale + offsetX, z / hillScale + offsetZ) - 0.5) * 2 * relief;
  const startHeight = raw(startX, startZ);
  return (x, z) => {
    const t = Math.min(1, Math.hypot(x - startX, z - startZ) / FLAT_START_RADIUS), blend = t * t * (3 - 2 * t);
    return startHeight + (raw(x, z) - startHeight) * blend;
  };
}

function measureRoad({ count, step, px, pz }, heightAt) {
  const py = new Float32Array(count), slope = new Float32Array(count);
  for (let i = 0; i < count; i++) py[i] = heightAt(px[i], pz[i]) + ROAD_LIFT;
  let steepest = 0;
  for (let i = 0; i < count; i++) {
    slope[i] = (py[(i + 1) % count] - py[(i - 1 + count) % count]) / (2 * step);
    steepest = Math.max(steepest, Math.abs(slope[i]));
  }
  return { py, slope, steepest };
}

// Altura final do terreno: livre longe da pista e assentada sob a estrada perto dela.
// `banks` é a altura dos barrancos e `bankRange` [de, até] a distância do centro da pista em que eles sobem:
// começando colado na pista, a estrada corre no fundo de um vale. Com `valley` o vale tem perfil próprio
// (valleyRise). `track.lift` é o que a rampa ergueu a estrada: o chão fica na altura de antes.
// Devolve a altura de verdade e a da malha grossa do chão, que no vale fica um pouco abaixo das encostas.
function conformToRoad(terrainAt, { count, px, pz }, py, { banks = 0, bankRange: [bankFrom, bankTo] = [BANK_FROM, BANK_TO], valley = null, chasmRange: [riverFrom, riverTo] = [RIVER_FROM, RIVER_TO] } = {}) {
  const height = (x, z, mesh) => {
    let nearest = Infinity, index = 0;
    for (let i = 0; i < count; i++) {
      const dx = x - px[i], dz = z - pz[i], d = dx * dx + dz * dz;
      if (d < nearest) { nearest = d; index = i; }
    }
    const distance = Math.sqrt(nearest), terrain = terrainAt(x, z), road = py[index] - track.lift[index] - ROAD_LIFT;
    const chasm = track.drop[index] * (1 - smoothstep(CHASM_FROM, CHASM_TO, distance));   // sob o tubo o terreno afunda
    let ground, sink = 0;
    if (valley) {
      const reach = valleyReach(valley);
      if (mesh) sink = VALLEY_MESH_SINK * (1 - smoothstep(reach, reach + VALLEY_MESH_MARGIN, distance));
      ground = road + valleyRise(distance, valley) + (terrain - road) * smoothstep(reach, reach + VALLEY_BLEND, distance) - chasm;
    } else {
      const bank = banks * smoothstep(bankFrom, bankTo, distance) - chasm;
      ground = distance >= BLEND_TO ? terrain + bank
        : road + (terrain - road) * smoothstep(BLEND_FROM, BLEND_TO, distance) - GROUND_SINK * (1 - smoothstep(BLEND_FROM, SINK_TO, distance)) + bank;
    }
    // O rio corta barrancos e encostas: o leito fica `bed` metros abaixo da estrada, por mais alto que o chão seja.
    const river = track.bed[index] > 0 ? 1 - smoothstep(riverFrom, riverTo, distance) : 0;
    return ground + (road - track.bed[index] - ground) * river - sink;
  };
  return [(x, z) => height(x, z, false), (x, z) => height(x, z, true)];
}

// Trechos separados em que a curva é mais fechada que `radius`.
function countSharpCurves({ count, curvature }, radius) {
  let curves = 0;
  for (let i = 0; i < count; i++) {
    const inside = curvature[i] > 1 / radius, before = curvature[(i - 1 + count) % count] > 1 / radius;
    if (inside && !before) curves++;
  }
  return curves;
}

// `shape` traz wiggle, targetLength, relief e hillScale, definidos por bioma.
export function generateTrack(seed, shape) {
  const random = createRandom(seed);
  const wanted = shape.sharpCurves ?? 0;
  let geometry = null, bestScore = -Infinity;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const sampled = sampleCurve(controlPoints(random, shape));
    if (!armsKeepApart(sampled)) continue;
    const candidate = fillGeometry(sampled), sharp = countSharpCurves(candidate, SHARP_RADIUS), bends = countSharpCurves(candidate, FLAT_OUT_RADIUS);
    // Fora as curvas fechadas pedidas, nenhuma outra deve exigir freada.
    const score = -Math.abs(sharp - wanted) * 2 - Math.abs(bends - wanted);
    if (score > bestScore) { geometry = candidate; bestScore = score; }
    if (score === 0) break;
  }
  if (!geometry) geometry = fillGeometry(sampleCurve(controlPoints(random, { ...shape, sharpCurves: 0 })));

  let heights = shape.relief, road, heightAt;
  for (let i = 0; i < MAX_RELIEF_RETRIES; i++) {
    heightAt = createHeightField(createRandom(seed + 1), { ...shape, relief: heights }, geometry.px[0], geometry.pz[0]);
    road = measureRoad(geometry, heightAt);
    if (road.steepest <= MAX_SLOPE) break;
    heights *= RELIEF_REDUCTION;
  }
  // No vale o limite lateral fica na borda dele: a encosta toda é pista.
  const openWall = shape.valley ? valleyReach(shape.valley) : OPEN_WALL;
  const [groundAt, meshAt] = conformToRoad(heightAt, geometry, road.py, shape);
  Object.assign(track, geometry, {
    py: road.py, slope: road.slope, wall: new Float32Array(geometry.count).fill(openWall), openWall, valley: shape.valley ?? null, chasmRange: shape.chasmRange ?? [RIVER_FROM, RIVER_TO],
    roll: new Float32Array(geometry.count), gap: new Uint8Array(geometry.count), epic: new Uint8Array(geometry.count),
    drop: new Float32Array(geometry.count), bed: new Float32Array(geometry.count), enclosed: new Uint8Array(geometry.count),
    lift: new Float32Array(geometry.count), flight: new Uint8Array(geometry.count), bridge: new Uint8Array(geometry.count), jumps: [], bridges: [], darkZones: [], hazards: [],
    heightAt: groundAt, meshHeightAt: meshAt,
  });
}

const sample = { x: 0, y: 0, z: 0, tx: 0, tz: -1, slope: 0, grade: 0 };

// Ponto da pista a uma distância (m) do início. Retorna um objeto compartilhado: use na hora.
export function trackAt(distance) {
  const { length, count, step, px, py, pz, tx, tz, slope } = track;
  const f = ((distance % length) + length) % length / step;
  const i = Math.floor(f) % count, j = (i + 1) % count, u = f - Math.floor(f);
  sample.x = px[i] + (px[j] - px[i]) * u;
  sample.y = py[i] + (py[j] - py[i]) * u;
  sample.z = pz[i] + (pz[j] - pz[i]) * u;
  sample.slope = slope[i] + (slope[j] - slope[i]) * u;
  sample.grade = (py[j] - py[i]) / step;             // inclinação do trecho reto entre as amostras: é por ele que o carro anda
  const x = tx[i] + (tx[j] - tx[i]) * u, z = tz[i] + (tz[j] - tz[i]) * u, n = Math.hypot(x, z) || 1;
  sample.tx = x / n;
  sample.tz = z / n;
  return sample;
}

// Índice da amostra mais próxima; com `hint` >= 0 procura só na vizinhança.
export function nearestIndex(x, z, hint) {
  const { count, px, pz } = track;
  let best = Infinity, bestIndex = Math.max(hint, 0);
  const from = hint < 0 ? 0 : -20, to = hint < 0 ? count - 1 : 20;
  for (let k = from; k <= to; k++) {
    const i = hint < 0 ? k : (((hint + k) % count) + count) % count;
    const dx = x - px[i], dz = z - pz[i], d = dx * dx + dz * dz;
    if (d < best) { best = d; bestIndex = i; }
  }
  return bestIndex;
}

// Onde a reta que sai de `origin` na direção `dir` (normalizada) bate no asfalto, até `range` metros.
// Devolve { x, y, z, dist, lane } ou nulo (não chegou ao chão, caiu fora da pista, num vão ou no tubo).
const GROUND_RAY_STEP = 0.75, MAX_GROUND_ROLL = 0.2;
export function groundHit(origin, dir, range) {
  let index = -1;
  for (let d = GROUND_RAY_STEP; d <= range; d += GROUND_RAY_STEP) {
    const x = origin.x + dir.x * d, y = origin.y + dir.y * d, z = origin.z + dir.z * d;
    index = nearestIndex(x, z, index);
    if (y > track.py[index]) continue;
    if (Math.abs(track.roll[index]) > MAX_GROUND_ROLL || track.gap[index] === 1) return null;
    const n = Math.hypot(track.tx[index], track.tz[index]) || 1, tx = track.tx[index] / n, tz = track.tz[index] / n;
    const lane = -(x - track.px[index]) * tz + (z - track.pz[index]) * tx;
    if (Math.abs(lane) > track.openWall) return null;
    return { x, y: track.py[index], z, dist: index * track.step, lane };
  }
  return null;
}

// Ponto do mapa sobre o leito do rio ou ao lado do tubo: ali o chão afunda, então não vai cenário.
export function isOverChasm(x, z) {
  let nearest = Infinity, index = 0;
  for (let i = 0; i < track.count; i++) {
    const dx = x - track.px[i], dz = z - track.pz[i], d = dx * dx + dz * dz;
    if (d < nearest) { nearest = d; index = i; }
  }
  if (track.bed[index] > 0) return nearest < track.chasmRange[1] ** 2;
  return track.drop[index] > 0 && nearest < CHASM_TO * CHASM_TO;
}

const sampleIndex = distance => Math.floor((((distance % track.length) + track.length) % track.length) / track.step) % track.count;
export const isEpic = distance => track.epic[sampleIndex(distance)] === 1;
export const inGap = distance => track.gap[sampleIndex(distance)] === 1;
export const inFlightZone = distance => track.flight[sampleIndex(distance)] === 1;

export const onBridge = distance => track.bridge[sampleIndex(distance)] === 1;

const offsetInto = (distance, from) => (((distance - from) % track.length) + track.length) % track.length;

// Trecho perigoso (vão de um salto ou ponte sem borda) que contém `distance`, ou nulo. É dele a água em que o
// carro cai e o ponto para onde volta.
export function hazardAt(distance) {
  return track.jumps.find(jump => jump.gaps.some(([from, to]) => offsetInto(distance, from) < to - from))
    ?? track.bridges.find(bridge => offsetInto(distance, bridge.start) < bridge.length) ?? null;
}

// Quanto o trecho escuro (caverna, túnel sem luz) envolve o ponto: 0 fora, 1 dentro, com transição na boca.
const DARK_FADE = 18;
export function darkZoneAt(distance) {
  for (const zone of track.darkZones) {
    const offset = offsetInto(distance, zone.start - DARK_FADE);
    if (offset >= zone.length + DARK_FADE * 2) continue;
    return { zone, level: Math.min(1, offset / DARK_FADE, (zone.length + DARK_FADE * 2 - offset) / DARK_FADE) };
  }
  return null;
}

const surface = { x: 0, y: 0, z: 0, roll: 0, heading: 0, twistYaw: 0, twistPitch: 0 };

// Ponto da superfície da pista em (distância, faixa). A física segue plana; no tubo a estrada gira em volta
// do eixo, e é aqui que a faixa vira parede e teto. Devolve um objeto compartilhado: use na hora.
export function surfaceAt(distance, lane) {
  const f = ((distance % track.length) + track.length) % track.length / track.step;
  const i = Math.floor(f) % track.count, j = (i + 1) % track.count;
  let delta = track.roll[j] - track.roll[i];
  if (delta < -Math.PI) delta += Math.PI * 2;        // saída do tubo: o giro completo equivale a giro nenhum
  const roll = track.roll[i] + delta * (f - Math.floor(f)), rate = delta / track.step;
  const t = trackAt(distance);
  const side = TWIST_RADIUS * Math.sin(roll) + lane * Math.cos(roll);
  surface.x = t.x - t.tz * side;
  surface.y = t.y + TWIST_RADIUS * (1 - Math.cos(roll)) + lane * Math.sin(roll);
  surface.z = t.z + t.tx * side;
  surface.roll = roll;
  surface.heading = Math.atan2(-t.tx, -t.tz);
  // A estrada é uma hélice: quem anda nela aponta um pouco para o lado para onde ela gira, e sobe ou desce conforme a faixa.
  surface.twistYaw = Math.atan(TWIST_RADIUS * rate);
  surface.twistPitch = Math.atan(lane * rate);
  return surface;
}

// Depois de posar o carro: alinha o objeto com a estrada dentro do tubo. O quanto o carro está virado em relação
// à pista gira em volta do chão dele, não da vertical do mundo; senão, no teto, o volante pareceria invertido.
// O retrovisor olha para trás, e para ele a subida da hélice tem o sinal contrário (`climbSign`).
export function alignToTwist(object, racer, climbSign = 1) {
  if (!racer.twist) return;
  const relative = Math.atan2(Math.sin(racer.yaw - racer.twistHeading), Math.cos(racer.yaw - racer.twistHeading));
  object.rotation.y -= relative;
  object.rotateY(relative - racer.twistYaw);
  object.rotateX(racer.twistPitch * climbSign);
}

// Curvatura com sinal no ponto (1/m): positiva vira à direita.
export function turnAt(distance) {
  const { length, count, step, turn } = track;
  return turn[Math.floor((((distance % length) + length) % length) / step) % count];
}

// Normaliza uma diferença de distância para o intervalo [-L/2, L/2).
export function wrapDistance(d) {
  const L = track.length;
  return ((d % L) + L + L / 2) % L - L / 2;
}
