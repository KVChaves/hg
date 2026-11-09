import * as THREE from 'three';
import { track, trackAt, TWIST_RADIUS } from './track.js';
import { wallTexture } from './tunnels.js';

// Aparência dos trechos épicos: abismo sob os saltos e o tubo em que a estrada gira.

const TUBE_RADIUS = 14.5, TUBE_SEGMENTS = 18, TUBE_OVERHANG = 10, RIB_EVERY = 14, PORTAL_DEPTH = 3, PORTAL_GROW = 1.2;
const ABYSS_HALF_WIDTH = 96, ABYSS_BELOW = 18, EDGE_HEIGHT = 0.35;
const PILLAR_HALF_WIDTH = 14.2, PILLAR_TOP_DROP = 0.12, PILLAR_SINK = 8;

function tubeBand(from, to, radius, thetaA, thetaB) {
  const rings = Math.max(1, Math.round((to - from) / track.step)), verts = (rings + 1) * (TUBE_SEGMENTS + 1);
  const pos = new Float32Array(verts * 3), uv = new Float32Array(verts * 2), index = [];
  for (let i = 0; i <= rings; i++) {
    const distance = from + (to - from) * i / rings, t = trackAt(distance);
    for (let a = 0; a <= TUBE_SEGMENTS; a++) {
      const theta = thetaA + (thetaB - thetaA) * a / TUBE_SEGMENTS, side = Math.cos(theta) * radius, v = i * (TUBE_SEGMENTS + 1) + a;
      pos.set([t.x - t.tz * side, t.y + TWIST_RADIUS + Math.sin(theta) * radius, t.z + t.tx * side], v * 3);
      uv.set([a / 3, distance / 8], v * 2);
      if (i < rings && a < TUBE_SEGMENTS) index.push(v, v + TUBE_SEGMENTS + 1, v + 1, v + 1, v + TUBE_SEGMENTS + 1, v + TUBE_SEGMENTS + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(index);
  return geometry;
}

function addTube(group, { start, length }, style) {
  const from = start - TUBE_OVERHANG, to = start + length + TUBE_OVERHANG, full = Math.PI * 2;
  const material = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, ...extra });
  group.add(new THREE.Mesh(tubeBand(from, to, TUBE_RADIUS, 0, full), new THREE.MeshBasicMaterial({ map: wallTexture(style), side: THREE.DoubleSide })));
  for (let d = 0; d <= to - from; d += RIB_EVERY) group.add(new THREE.Mesh(tubeBand(from + d - 0.5, from + d + 0.5, TUBE_RADIUS - 0.3, 0, full), material(style.rib)));
  for (const line of style.lines) group.add(new THREE.Mesh(tubeBand(from, to, TUBE_RADIUS - 0.4, line.angle - line.width, line.angle + line.width), material(line.color, { fog: false })));
  for (const d of [from, to]) group.add(new THREE.Mesh(tubeBand(d - PORTAL_DEPTH / 2, d + PORTAL_DEPTH / 2, TUBE_RADIUS + PORTAL_GROW, 0, full), material(style.portal)));
}

// Altura da superfície do abismo: abaixo do ponto mais baixo do trecho.
function abyssLevel(gaps) {
  let lowest = Infinity;
  for (let d = gaps[0][0]; d <= gaps[gaps.length - 1][1]; d += track.step) lowest = Math.min(lowest, trackAt(d).y);
  return lowest - ABYSS_BELOW;
}

// Fundo do abismo, de uma ponta à outra do salto: água, lava ou luzes da cidade, conforme o bioma.
function addAbyss(group, gaps, y, { abyss, glow }) {
  const from = gaps[0][0] - track.step, to = gaps[gaps.length - 1][1] + track.step, steps = Math.ceil((to - from) / track.step);
  const pos = new Float32Array((steps + 1) * 6), index = [];
  for (let i = 0; i <= steps; i++) {
    const t = trackAt(from + (to - from) * i / steps), a = i * 2;
    pos.set([t.x + t.tz * ABYSS_HALF_WIDTH, y, t.z - t.tx * ABYSS_HALF_WIDTH, t.x - t.tz * ABYSS_HALF_WIDTH, y, t.z + t.tx * ABYSS_HALF_WIDTH], a * 3);
    if (i < steps) index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setIndex(index);
  group.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: abyss, side: THREE.DoubleSide, fog: !glow })));
}

// Bloco que sustenta uma plataforma entre dois vãos, do nível da estrada até o abismo.
function pillarGeometry(from, to, bottom) {
  const steps = Math.max(1, Math.round((to - from) / track.step)), pos = new Float32Array((steps + 1) * 12), uv = new Float32Array((steps + 1) * 8), index = [];
  const quad = (a, b, c, d) => index.push(a, b, c, a, c, d);
  for (let i = 0; i <= steps; i++) {
    const distance = from + (to - from) * i / steps, t = trackAt(distance), top = t.y - PILLAR_TOP_DROP, v = i * 4, u = distance / 8, depth = (top - bottom) / 8;
    const sideX = -t.tz * PILLAR_HALF_WIDTH, sideZ = t.tx * PILLAR_HALF_WIDTH;
    pos.set([t.x - sideX, top, t.z - sideZ, t.x - sideX, bottom, t.z - sideZ, t.x + sideX, bottom, t.z + sideZ, t.x + sideX, top, t.z + sideZ], v * 3);
    uv.set([u, 0, u, depth, u, 0, u, depth], v * 2);
    if (i < steps) {
      quad(v, v + 1, v + 5, v + 4);                  // lado esquerdo
      quad(v + 3, v + 7, v + 6, v + 2);              // lado direito
      quad(v, v + 4, v + 7, v + 3);                  // tampo
    }
  }
  quad(0, 1, 2, 3);                                  // as duas faces voltadas para os vãos
  quad(steps * 4 + 3, steps * 4 + 2, steps * 4 + 1, steps * 4);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(index);
  return geometry;
}

function addIslands(group, islands, y, style) {
  const material = new THREE.MeshBasicMaterial({ map: wallTexture(style), side: THREE.DoubleSide });
  for (const [from, to] of islands) group.add(new THREE.Mesh(pillarGeometry(from, to, y - PILLAR_SINK), material));
}

// Faixa luminosa na beirada de cada plataforma, para enxergar onde a estrada termina e recomeça.
function addEdges(group, { gaps }, color) {
  const material = new THREE.MeshBasicMaterial({ color, fog: false });
  const bar = new THREE.BoxGeometry(17.8, EDGE_HEIGHT, 0.8);
  for (const [from, to] of gaps) {
    for (const distance of [from, to]) {
      const t = trackAt(distance), mesh = new THREE.Mesh(bar, material);
      mesh.position.set(t.x, t.y + EDGE_HEIGHT / 2, t.z);
      mesh.rotation.y = Math.atan2(-t.tx, -t.tz);
      group.add(mesh);
    }
  }
}

export function buildEpicSections(group, layout, biome) {
  for (const section of layout.epics) {
    if (section.type === 'twist') {
      addTube(group, section, biome.epic.tube);
    } else {
      const level = abyssLevel(section.gaps);
      addAbyss(group, section.gaps, level, biome.epic);
      addIslands(group, section.islands, level, biome.epic.tube);
      addEdges(group, section, biome.epic.edge);
    }
  }
}
