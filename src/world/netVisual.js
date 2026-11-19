import * as THREE from 'three';

// Desenho do lança-redes (game/nets.js): cordas, nós e pesos, sem diagonais. Em voo é um quadrado de malha que
// gira e abre; preso, é uma malha que cai por cima do carro — teto, capô e porta-malas — e escorre até o chão.
// As geometrias são criadas uma vez e compartilhadas por todas as redes.

const ROPE = 0xf0dca8, KNOT = 0xb08c50, WEIGHT = 0x3a3c42;   // corda clara: tem de aparecer sobre qualquer pintura e qualquer chão

// Rede caída: medidas em metros a partir do chão, com o carro (1,94 x 4,4 m) por baixo.
const HALF_WIDTH = 1.4, HALF_LENGTH = 2.6;           // até onde as bordas alcançam no chão
const ROOF = 1.62, HOOD = 1.22, FLOOR = 0.06;   // um pouco acima da lataria, para ela não atravessar a malha
const COLUMNS = 6, ROWS = 10, STEPS = 6;             // quadrados da malha e segmentos por lado de quadrado
const SAG = 0.05;                                    // a corda cede entre os nós

const smooth = (from, to, x) => {
  const t = Math.max(0, Math.min(1, (x - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

// Altura da rede em (u, v), de -1 a 1 na largura e no comprimento: teto no meio, capô e porta-malas mais baixos,
// e a borda caindo até o chão nas laterais e nas pontas.
function drapeHeight(u, v) {
  const profile = HOOD + (ROOF - HOOD) * (1 - smooth(0.22, 0.45, Math.abs(v)));
  const across = 1 - smooth(0.74, 1, Math.abs(u)), along = 1 - smooth(0.86, 1, Math.abs(v));
  return FLOOR + (profile - FLOOR) * across * along;
}

// Ponto da corda: `cellU`/`cellV` é a fração dentro do quadrado (0 nos nós), usada para a corda ceder no meio.
function drapePoint(u, v, sagU, sagV) {
  const sag = SAG * (Math.sin(sagU * Math.PI) + Math.sin(sagV * Math.PI));
  return [u * HALF_WIDTH, Math.max(FLOOR, drapeHeight(u, v) - sag), v * HALF_LENGTH];
}

function buildDrape() {
  const rope = [];
  const push = (a, b) => rope.push(...a, ...b);
  for (let i = 0; i <= COLUMNS; i++) {               // cordas no sentido do comprimento
    const u = -1 + 2 * i / COLUMNS;
    for (let k = 0; k < ROWS * STEPS; k++) {
      const v0 = -1 + 2 * k / (ROWS * STEPS), v1 = -1 + 2 * (k + 1) / (ROWS * STEPS);
      push(drapePoint(u, v0, 0, (k % STEPS) / STEPS), drapePoint(u, v1, 0, ((k % STEPS) + 1) / STEPS));
    }
  }
  for (let j = 0; j <= ROWS; j++) {                  // cordas atravessadas
    const v = -1 + 2 * j / ROWS;
    for (let k = 0; k < COLUMNS * STEPS; k++) {
      const u0 = -1 + 2 * k / (COLUMNS * STEPS), u1 = -1 + 2 * (k + 1) / (COLUMNS * STEPS);
      push(drapePoint(u0, v, (k % STEPS) / STEPS, 0), drapePoint(u1, v, ((k % STEPS) + 1) / STEPS, 0));
    }
  }
  const knots = [], weights = [];
  for (let i = 0; i <= COLUMNS; i++) {
    for (let j = 0; j <= ROWS; j++) {
      const u = -1 + 2 * i / COLUMNS, v = -1 + 2 * j / ROWS, point = drapePoint(u, v, 0, 0);
      const edge = i === 0 || i === COLUMNS || j === 0 || j === ROWS;
      (edge && (i + j) % 2 === 0 ? weights : knots).push(point);   // na borda, um nó sim, outro não, é um peso
    }
  }
  return { rope, knots, weights };
}

// Rede em voo: quadrado de malha no plano XY (o eixo Z aponta para o alvo), com um peso em cada canto.
const FLIGHT_HALF = 0.9, FLIGHT_CELLS = 5;
function buildFlight() {
  const rope = [], knots = [], weights = [];
  for (let i = 0; i <= FLIGHT_CELLS; i++) {
    const t = -FLIGHT_HALF + 2 * FLIGHT_HALF * i / FLIGHT_CELLS;
    rope.push(t, -FLIGHT_HALF, 0, t, FLIGHT_HALF, 0, -FLIGHT_HALF, t, 0, FLIGHT_HALF, t, 0);
    for (let k = 0; k <= FLIGHT_CELLS; k++) knots.push([t, -FLIGHT_HALF + 2 * FLIGHT_HALF * k / FLIGHT_CELLS, 0]);
  }
  for (const x of [-1, 1]) for (const y of [-1, 1]) weights.push([x * (FLIGHT_HALF + 0.15), y * (FLIGHT_HALF + 0.15), 0]);
  return { rope, knots, weights };
}

const ropeMaterial = new THREE.LineBasicMaterial({ color: ROPE, fog: false });
const knotGeometry = new THREE.BoxGeometry(0.08, 0.08, 0.08), knotMaterial = new THREE.MeshBasicMaterial({ color: KNOT });
const weightGeometry = new THREE.SphereGeometry(0.12, 6, 4), weightMaterial = new THREE.MeshBasicMaterial({ color: WEIGHT });

function instanced(geometry, material, points) {
  const mesh = new THREE.InstancedMesh(geometry, material, points.length), matrix = new THREE.Matrix4();
  points.forEach((point, i) => mesh.setMatrixAt(i, matrix.makeTranslation(...point)));
  mesh.frustumCulled = false;                        // o volume de corte seria o de um nó só, não o da rede inteira
  return mesh;
}

// Monta uma vez as peças de um formato e devolve uma fábrica de grupos que as reaproveita.
function factory(build) {
  let parts = null;
  return () => {
    if (!parts) {
      const { rope, knots, weights } = build();
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(rope, 3));
      parts = { geometry, knots, weights };
    }
    const group = new THREE.Group();
    group.add(new THREE.LineSegments(parts.geometry, ropeMaterial));
    group.add(instanced(knotGeometry, knotMaterial, parts.knots));
    group.add(instanced(weightGeometry, weightMaterial, parts.weights));
    return group;
  };
}

export const createDrapedNet = factory(buildDrape);
export const createFlyingNet = factory(buildFlight);
