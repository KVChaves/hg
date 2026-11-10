import * as THREE from 'three';
import { TRACK_WIDTH } from '../config.js';
import { JUMP_WALL } from '../game/mapLayout.js';
import { nearestIndex, track, trackAt, TWIST_RADIUS } from './track.js';
import { pixelTexture } from './textures.js';
import { wallTexture } from './tunnels.js';

// Aparência dos trechos épicos: o salto (rampa e plataformas de pedra sobre água ou abismo) e o tubo em que a estrada gira.

const TUBE_RADIUS = 14.5, TUBE_SEGMENTS = 18, TUBE_OVERHANG = 10, RIB_EVERY = 14, PORTAL_DEPTH = 3, PORTAL_GROW = 1.2;
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
function addBlocks(group, blocks, bottomY, style) {
  const material = new THREE.MeshBasicMaterial({ map: style.stone ? masonryTexture(style) : wallTexture(style), side: THREE.DoubleSide });
  const road = t => t.y - BLOCK_TOP_DROP, parapetTop = t => t.y + PARAPET_HEIGHT, parapetBase = t => t.y - BLOCK_TOP_DROP;
  for (const [from, to] of blocks) {
    group.add(new THREE.Mesh(slabGeometry(from, to, -BLOCK_HALF_WIDTH, BLOCK_HALF_WIDTH, road, () => bottomY - BLOCK_SINK), material));
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

// Rio que cruza a pista sob o vão (água, lava ou o fundo luminoso do abismo, conforme o bioma), correndo de um
// lado para o outro. Só cobre o chão cujo ponto
// mais próximo da pista é o leito do rio, para não alagar outro trecho da estrada que passe perto.
const RIVER_CELL = 8, RIVER_MARGIN = 15, RIVER_FLOW = 0.35;   // a correnteza anda RIVER_FLOW texturas (8 m) por segundo
function riverTexture(color) {
  const size = 32, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d'), base = new THREE.Color(color);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const k = 0.85 + Math.random() * 0.25;
    ctx.fillStyle = `rgb(${base.r * 255 * k | 0},${base.g * 255 * k | 0},${base.b * 255 * k | 0})`;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.fillStyle = 'rgba(200,235,220,.55)';           // espuma em riscos no sentido da correnteza
  for (let i = 0; i < 18; i++) ctx.fillRect(Math.floor(Math.random() * size), Math.floor(Math.random() * size), 3 + Math.floor(Math.random() * 6), 1);
  const texture = pixelTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function addRiver(group, { start, length }, y, color, glow, onUpdate) {
  const { count, step } = track, width = track.chasmRange[0] + RIVER_MARGIN;
  const bed = [];
  for (let k = Math.floor(start / step); k * step <= start + length; k++) if (track.bed[k % count] > 0) bed.push(k);
  if (!bed.length) return;
  const first = bed[0] - 2, last = bed[bed.length - 1] + 2, wet = index => {
    const offset = ((index - first) % count + count) % count;
    return offset <= last - first;
  };
  const columns = Math.ceil(width * 2 / RIVER_CELL), rows = Math.ceil((last - first) * step / RIVER_CELL);
  const pos = new Float32Array((rows + 1) * (columns + 1) * 3), uv = new Float32Array((rows + 1) * (columns + 1) * 2), index = [];
  for (let r = 0; r <= rows; r++) {
    const along = first * step + (last - first) * step * r / rows, t = trackAt(along);
    for (let c = 0; c <= columns; c++) {
      const lateral = -width + c * RIVER_CELL, v = r * (columns + 1) + c;
      pos.set([t.x - t.tz * lateral, y, t.z + t.tx * lateral], v * 3);
      uv.set([lateral / 8, along / 8], v * 2);
      if (r < rows && c < columns) {
        const mid = trackAt(along + (last - first) * step / rows / 2), centre = lateral + RIVER_CELL / 2;
        if (wet(nearestIndex(mid.x - mid.tz * centre, mid.z + mid.tx * centre, -1))) index.push(v, v + columns + 1, v + 1, v + 1, v + columns + 1, v + columns + 2);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(index);
  const map = riverTexture(color);
  group.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide, fog: !glow })));   // lava e neon brilham através da neblina
  onUpdate?.(time => { map.offset.x = time * RIVER_FLOW; });
}

// Ponte de gelo: uma laje translúcida da largura da estrada, sem mureta, com pingentes por baixo e pilares de gelo
// até o lago congelado.
const BRIDGE_THICKNESS = 1.4, PILLAR_EVERY = 45, ICICLES = 70;
function iceTexture() {
  const size = 32, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const k = Math.random() * 30;
    ctx.fillStyle = `rgb(${168 + k | 0},${214 + k * 0.8 | 0},${236 + k * 0.6 | 0})`;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.fillStyle = 'rgba(255,255,255,.75)';             // rachaduras brancas
  for (let i = 0; i < 6; i++) {
    let x = Math.random() * size, y = Math.random() * size;
    for (let k = 0; k < 12; k++) { ctx.fillRect(x | 0, y | 0, 1, 1); x += Math.random() * 2 - 0.5; y += Math.random() * 2 - 1; }
  }
  const texture = pixelTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function addBridge(group, { start, length, water }) {
  const half = TRACK_WIDTH / 2, map = iceTexture();
  const ice = new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide });
  group.add(new THREE.Mesh(slabGeometry(start, start + length, -half, half, t => t.y, t => t.y - BRIDGE_THICKNESS), ice));
  const edge = new THREE.MeshBasicMaterial({ color: 0xeaf8ff });   // a quina da laje, para ver onde acaba
  for (const side of [-1, 1]) group.add(new THREE.Mesh(slabGeometry(start, start + length, side * half - 0.25 * (side > 0), side * half + 0.25 * (side < 0), t => t.y + 0.02, t => t.y - 0.05), edge));
  const pillar = new THREE.MeshBasicMaterial({ map, color: 0xb8dcf0 });
  for (let d = PILLAR_EVERY; d < length - 10; d += PILLAR_EVERY) {
    const t = trackAt(start + d), height = t.y - BRIDGE_THICKNESS - water + 2;
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.4, height, 7), pillar);
    mesh.position.set(t.x, water - 2 + height / 2, t.z);
    group.add(mesh);
  }
  const icicle = new THREE.ConeGeometry(0.35, 1, 5);
  icicle.rotateX(Math.PI);
  icicle.translate(0, -0.5, 0);
  const icicles = new THREE.InstancedMesh(icicle, new THREE.MeshBasicMaterial({ color: 0xd4f0fc }), ICICLES);
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3(), rotation = new THREE.Quaternion();
  for (let i = 0; i < ICICLES; i++) {
    const t = trackAt(start + Math.random() * length), side = (Math.random() * 2 - 1) * (half - 0.4);
    matrix.compose(position.set(t.x - t.tz * side, t.y - BRIDGE_THICKNESS, t.z + t.tx * side), rotation, scale.set(1, 0.8 + Math.random() * 2.4, 1));
    icicles.setMatrixAt(i, matrix);
  }
  group.add(icicles);
}

// Vulcão sob o vão: cone de rocha saindo do fundo do buraco, cratera com lava (a lava em que o carro cai) e
// fumaça e brasas subindo da boca.
// A borda fica 4 m acima do pé da rampa: logo abaixo do bico, então o cone aparece mas não atrapalha o voo.
const CRATER_RADIUS = 15, VOLCANO_BASE_RADIUS = 48, RIM_ABOVE_LAVA = 5.6, SMOKE_PUFFS = 14, EMBERS = 50;
function volcanoTexture() {
  const size = 32, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const k = Math.random() * 18;
    ctx.fillStyle = `rgb(${34 + k | 0},${26 + k | 0},${24 + k | 0})`;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.fillStyle = '#ff6a10';                           // filetes de lava escorrendo
  for (let i = 0; i < 5; i++) {
    let x = Math.random() * size;
    for (let y = 0; y < size; y++) { ctx.fillRect(x | 0, y, 1, 1); x += Math.random() * 2 - 1; }
  }
  const texture = pixelTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 3);
  return texture;
}

function smokeTexture() {
  const size = 16, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot(x - 7.5, y - 7.5) / 8;
    if (d > 1 || Math.random() < d * 0.6) continue;
    const k = 60 + Math.random() * 40;
    ctx.fillStyle = `rgb(${k | 0},${k * 0.9 | 0},${k * 0.85 | 0})`;
    ctx.fillRect(x, y, 1, 1);
  }
  return pixelTexture(canvas);
}

function addVolcano(group, { gaps: [[from, to]], water, floor }, onUpdate) {
  const t = trackAt((from + to) / 2), rim = water + RIM_ABOVE_LAVA, base = floor - 4, height = rim - base;
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(CRATER_RADIUS + 1, VOLCANO_BASE_RADIUS, height, 28, 4, true), new THREE.MeshBasicMaterial({ map: volcanoTexture() }));
  cone.position.set(t.x, base + height / 2, t.z);
  group.add(cone);
  const crater = new THREE.Mesh(new THREE.CylinderGeometry(CRATER_RADIUS + 1, CRATER_RADIUS - 1, RIM_ABOVE_LAVA + 1, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0x2a1410, side: THREE.DoubleSide }));
  crater.position.set(t.x, water + (RIM_ABOVE_LAVA - 1) / 2, t.z);
  group.add(crater);
  const lavaMap = riverTexture(0xff5a10);
  const lava = new THREE.Mesh(new THREE.CircleGeometry(CRATER_RADIUS, 24), new THREE.MeshBasicMaterial({ map: lavaMap, fog: false }));
  lava.rotation.x = -Math.PI / 2;
  lava.position.set(t.x, water, t.z);
  group.add(lava);

  const smokeMaterial = new THREE.SpriteMaterial({ map: smokeTexture(), transparent: true, depthWrite: false });
  const puffs = Array.from({ length: SMOKE_PUFFS }, (_, i) => {
    const sprite = new THREE.Sprite(smokeMaterial);
    group.add(sprite);
    return { sprite, phase: i / SMOKE_PUFFS, angle: Math.random() * Math.PI * 2, spread: Math.random() * CRATER_RADIUS * 0.6 };
  });
  const emberGeometry = new THREE.BoxGeometry(0.25, 0.25, 0.25), emberMaterial = new THREE.MeshBasicMaterial({ color: 0xffb030, fog: false });
  const embers = Array.from({ length: EMBERS }, () => {
    const mesh = new THREE.Mesh(emberGeometry, emberMaterial);
    group.add(mesh);
    return { mesh, phase: Math.random(), angle: Math.random() * Math.PI * 2, spread: Math.random() * CRATER_RADIUS * 0.8, speed: 0.25 + Math.random() * 0.3 };
  });
  const SMOKE_CYCLE = 9, SMOKE_RISE = 70;
  onUpdate?.(time => {
    lavaMap.offset.set(Math.sin(time * 0.3) * 0.2, time * 0.05);
    for (const puff of puffs) {
      const u = (time / SMOKE_CYCLE + puff.phase) % 1, size = 6 + u * 26;
      puff.sprite.position.set(t.x + Math.cos(puff.angle) * puff.spread * (1 + u), water + 1 + u * SMOKE_RISE, t.z + Math.sin(puff.angle) * puff.spread * (1 + u));
      puff.sprite.scale.set(size, size, 1);
    }
    for (const ember of embers) {
      const u = (time * ember.speed + ember.phase) % 1;
      ember.mesh.position.set(t.x + Math.cos(ember.angle) * ember.spread, water + u * 30, t.z + Math.sin(ember.angle) * ember.spread);
      ember.mesh.visible = u < 0.9;
    }
  });
}

export function buildEpicSections(group, layout, biome, onUpdate) {
  for (const section of layout.epics) {
    if (section.type === 'twist') {
      addTube(group, section, biome.epic.tube);
    } else if (section.type === 'bridge') {
      addRiver(group, section, section.water, biome.epic.abyss, false, onUpdate);
      addBridge(group, section);
    } else {
      // Com vulcão a lava em volta fica lá no fundo do buraco; a que importa é a da cratera.
      addRiver(group, section, section.volcano ? section.floor + 3 : section.water, biome.epic.abyss, biome.epic.glow, onUpdate);
      if (section.volcano) addVolcano(group, section, onUpdate);
      addBlocks(group, section.blocks, section.floor, biome.epic.ramp ?? biome.epic.tube);
      addEdges(group, section, biome.epic.edge);
    }
  }
}
