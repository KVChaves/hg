import * as THREE from 'three';
import { TRACK_WIDTH } from '../config.js';
import { JUMP_WALL } from '../game/mapLayout.js';
import { track, trackAt, TWIST_RADIUS } from './track.js';
import { pixelTexture } from './textures.js';
import { wallTexture } from './tunnels.js';

// Aparência dos trechos épicos: o salto (rampa e plataformas de pedra sobre água ou abismo) e o tubo em que a estrada gira.

const TUBE_RADIUS = 14.5, TUBE_SEGMENTS = 18, TUBE_OVERHANG = 10, RIB_EVERY = 14, PORTAL_DEPTH = 3, PORTAL_GROW = 1.2;
const ABYSS_HALF_WIDTH = 96, ABYSS_BELOW = 18, WATER_BELOW = 1.6;     // abismo bem fundo; água logo abaixo do pé da rampa
const EDGE_THICKNESS = 0.04, EDGE_LIFT = 0.05, EDGE_DEPTH = 1, KERB_WIDTH = 1.4;
const CAR_HALF_WIDTH = 1.05, PARAPET_THICKNESS = 0.7, PARAPET_HEIGHT = 0.75;
const PARAPET_INNER = JUMP_WALL + CAR_HALF_WIDTH, BLOCK_HALF_WIDTH = PARAPET_INNER + PARAPET_THICKNESS;
const BLOCK_TOP_DROP = 0.12, BLOCK_SINK = 3;

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

// Altura da água (biomas com `shallow`): logo abaixo do pé da rampa, como um pântano. Senão, abismo fundo
// abaixo do ponto mais baixo do trecho.
function abyssLevel({ start, length, gaps }, shallow) {
  if (shallow) return Math.min(trackAt(start).y, trackAt(start + length).y) - WATER_BELOW;
  let lowest = Infinity;
  for (let d = gaps[0][0]; d <= gaps[gaps.length - 1][1]; d += track.step) lowest = Math.min(lowest, trackAt(d).y);
  return lowest - ABYSS_BELOW;
}

// Fundo do salto, do pé da rampa ao fim da descida: água, lava ou luzes da cidade, conforme o bioma.
function addAbyss(group, { start, length }, y, { abyss, glow }) {
  const from = start - track.step, to = start + length + track.step, steps = Math.ceil((to - from) / track.step);
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

// Faixa sólida que acompanha a pista entre `from` e `to`, de `left` a `right` metros do centro, com o topo e a
// base dados por (ponto da pista) => altura. Serve para o bloco sob a rampa e para as muretas.
function slabGeometry(from, to, left, right, topOf, bottomOf) {
  const steps = Math.max(1, Math.round((to - from) / track.step)), pos = new Float32Array((steps + 1) * 12), uv = new Float32Array((steps + 1) * 8), index = [];
  const quad = (a, b, c, d) => index.push(a, b, c, a, c, d);
  for (let i = 0; i <= steps; i++) {
    const distance = from + (to - from) * i / steps, t = trackAt(distance), top = topOf(t), bottom = bottomOf(t), v = i * 4, u = distance / 8, depth = (top - bottom) / 8;
    const point = lateral => [t.x - t.tz * lateral, t.z + t.tx * lateral];
    const [lx, lz] = point(left), [rx, rz] = point(right);
    pos.set([lx, top, lz, lx, bottom, lz, rx, bottom, rz, rx, top, rz], v * 3);
    uv.set([u, 0, u, depth, u + (right - left) / 8, depth, u + (right - left) / 8, 0], v * 2);
    if (i < steps) {
      quad(v, v + 1, v + 5, v + 4);                  // lado esquerdo
      quad(v + 3, v + 7, v + 6, v + 2);              // lado direito
      quad(v, v + 4, v + 7, v + 3);                  // tampo
    }
  }
  quad(0, 1, 2, 3);                                  // as duas pontas
  quad(steps * 4 + 3, steps * 4 + 2, steps * 4 + 1, steps * 4);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(index);
  return geometry;
}

// Pedras assentadas em fiadas desencontradas, com rejunte e manchas (musgo, neve, fuligem) mais fortes em cima.
// `stone`: tons das pedras; `mortar`: rejunte; `moss`: cores das manchas. A imagem cobre 8 x 8 m.
function masonryTexture({ stone, mortar, moss = [] }) {
  const size = 32, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d'), hex = c => `#${c.toString(16).padStart(6, '0')}`;
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  ctx.fillStyle = hex(mortar);
  ctx.fillRect(0, 0, size, size);
  for (let row = 0; row < size / 6 + 1; row++) {
    let x = row % 2 ? -5 : 0;
    while (x < size) {
      const w = 7 + Math.floor(random() * 6), color = stone[Math.floor(random() * stone.length)], y = row * 6;
      ctx.fillStyle = hex(color);
      ctx.fillRect(x + 1, y + 1, w - 1, 5);
      ctx.fillStyle = hex(stone[0]);
      ctx.fillRect(x + 1, y + 5, w - 1, 1);                // sombra embaixo de cada pedra
      x += w;
    }
  }
  for (let i = 0; i < 70 && moss.length; i++) {
    const y = Math.floor(random() ** 2 * size);             // mais manchas perto do topo
    ctx.fillStyle = hex(moss[i % moss.length]);
    ctx.fillRect(Math.floor(random() * size), y, 1 + Math.floor(random() * 4), 1 + Math.floor(random() * 2));
  }
  const texture = pixelTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// Rampa e plataformas: bloco de pedra da estrada até dentro da água, com mureta baixa dos dois lados.
function addBlocks(group, blocks, waterY, style) {
  const material = new THREE.MeshBasicMaterial({ map: style.stone ? masonryTexture(style) : wallTexture(style), side: THREE.DoubleSide });
  const road = t => t.y - BLOCK_TOP_DROP, parapetTop = t => t.y + PARAPET_HEIGHT, parapetBase = t => t.y - BLOCK_TOP_DROP;
  for (const [from, to] of blocks) {
    group.add(new THREE.Mesh(slabGeometry(from, to, -BLOCK_HALF_WIDTH, BLOCK_HALF_WIDTH, road, () => waterY - BLOCK_SINK), material));
    group.add(new THREE.Mesh(slabGeometry(from, to, -BLOCK_HALF_WIDTH, -PARAPET_INNER, parapetTop, parapetBase), material));
    group.add(new THREE.Mesh(slabGeometry(from, to, PARAPET_INNER, BLOCK_HALF_WIDTH, parapetTop, parapetBase), material));
  }
}

// Faixa pintada na beirada de cada plataforma, para enxergar onde a estrada termina e recomeça. É tinta: não tem volume.
function addEdges(group, { gaps }, color) {
  const material = new THREE.MeshBasicMaterial({ color, fog: false });
  const stripe = new THREE.BoxGeometry(TRACK_WIDTH + KERB_WIDTH * 2, EDGE_THICKNESS, EDGE_DEPTH);
  for (const [from, to] of gaps) {
    for (const [distance, inward] of [[from, -1], [to, 1]]) {
      const t = trackAt(distance + inward * EDGE_DEPTH / 2), mesh = new THREE.Mesh(stripe, material);
      mesh.position.set(t.x, t.y + EDGE_LIFT, t.z);
      mesh.rotation.order = 'YXZ';
      mesh.rotation.set(Math.atan(t.slope), Math.atan2(-t.tx, -t.tz), 0);
      group.add(mesh);
    }
  }
}

export function buildEpicSections(group, layout, biome) {
  for (const section of layout.epics) {
    if (section.type === 'twist') {
      addTube(group, section, biome.epic.tube);
    } else {
      const level = abyssLevel(section, biome.epic.shallow);
      addAbyss(group, section, level, biome.epic);
      addBlocks(group, section.blocks, level, biome.epic.ramp ?? biome.epic.tube);
      addEdges(group, section, biome.epic.edge);
    }
  }
}
