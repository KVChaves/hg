import * as THREE from 'three';
import { enableCulling } from './instancing.js';
import { TRACK_WIDTH } from '../config.js';
import { TUNNEL_HALF_WIDTH, TUNNEL_HEIGHT } from '../game/mapLayout.js';
import { track, trackAt } from './track.js';
import { pixelTexture } from './textures.js';

// Túneis: uma meia-elipse que acompanha a pista. `open` são só arcos, para o que deixa ver o céu.

const ARC_SEGMENTS = 10, RIB_EVERY = 18, OPEN_RIB_EVERY = 9, PORTAL_DEPTH = 3, PORTAL_GROW = 1.1;

function arcBand(from, to, grow, thetaA, thetaB, tile) {
  const { step } = track, rings = Math.max(1, Math.round((to - from) / step));
  const verts = (rings + 1) * (ARC_SEGMENTS + 1), pos = new Float32Array(verts * 3), uv = new Float32Array(verts * 2), index = [];
  const halfWidth = TUNNEL_HALF_WIDTH + grow, height = TUNNEL_HEIGHT + grow;
  for (let i = 0; i <= rings; i++) {
    const distance = from + (to - from) * i / rings, t = trackAt(distance);
    for (let a = 0; a <= ARC_SEGMENTS; a++) {
      const theta = thetaA + (thetaB - thetaA) * a / ARC_SEGMENTS, side = Math.cos(theta) * halfWidth, v = i * (ARC_SEGMENTS + 1) + a;
      pos.set([t.x - t.tz * side, t.y + Math.sin(theta) * height, t.z + t.tx * side], v * 3);
      uv.set([a / 2, distance / tile], v * 2);
      if (i < rings && a < ARC_SEGMENTS) index.push(v, v + ARC_SEGMENTS + 1, v + 1, v + 1, v + ARC_SEGMENTS + 1, v + ARC_SEGMENTS + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(index);
  return geometry;
}

export function wallTexture(style) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = style.wall;
  ctx.fillRect(0, 0, 32, 32);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = style.speckle[i % style.speckle.length];
    ctx.fillRect(Math.floor(Math.random() * 32), Math.floor(Math.random() * 32), 1 + Math.floor(Math.random() * 4), 1 + Math.floor(Math.random() * 2));
  }
  const texture = pixelTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

const SPIKE_CLEARANCE = 4.6, SPIKE_MIN_LENGTH = 0.3;   // a ponta das estalactites nunca desce até a altura dos carros

function addHangingSpikes(group, tunnel, spikes) {
  const geometry = new THREE.ConeGeometry(0.5, 1, 5);
  geometry.rotateX(Math.PI);
  geometry.translate(0, -0.5, 0);
  const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({ color: spikes.color }), spikes.count);
  const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), position = new THREE.Vector3(), scale = new THREE.Vector3();
  for (let i = 0; i < spikes.count; i++) {
    const t = trackAt(tunnel.start + Math.random() * tunnel.length), side = (Math.random() * 2 - 1) * (TUNNEL_HALF_WIDTH - 1.5);
    const y = t.y + TUNNEL_HEIGHT * Math.sqrt(1 - (side / TUNNEL_HALF_WIDTH) ** 2);
    const size = 0.7 + Math.random() * 1.5, length = Math.min(size * (1.2 + Math.random() * 1.6), Math.max(SPIKE_MIN_LENGTH, y - t.y - SPIKE_CLEARANCE));
    matrix.compose(position.set(t.x - t.tz * side, y, t.z + t.tx * side), quaternion, scale.set(size, length, size));
    mesh.setMatrixAt(i, matrix);
  }
  enableCulling(mesh);                               // parado: com a esfera certa a câmera descarta o túnel fora da tela
  group.add(mesh);
}

function addSolidTunnel(group, tunnel, style) {
  const { start, length } = tunnel;
  const shell = new THREE.MeshBasicMaterial({ map: wallTexture(style), side: THREE.DoubleSide });
  group.add(new THREE.Mesh(arcBand(start, start + length, 0, 0, Math.PI, 6), shell));

  const ribMaterial = new THREE.MeshBasicMaterial({ color: style.rib, side: THREE.DoubleSide });
  for (let d = 0; d <= length; d += RIB_EVERY) group.add(new THREE.Mesh(arcBand(start + d - 0.5, start + d + 0.5, -0.25, 0, Math.PI, 6), ribMaterial));

  for (const line of style.lines) {
    const material = new THREE.MeshBasicMaterial({ color: line.color, side: THREE.DoubleSide, fog: false });
    group.add(new THREE.Mesh(arcBand(start, start + length, -0.35, line.angle - line.width, line.angle + line.width, 6), material));
  }

  const portal = new THREE.MeshBasicMaterial({ color: style.portal, side: THREE.DoubleSide });
  for (const d of [start, start + length]) group.add(new THREE.Mesh(arcBand(d - PORTAL_DEPTH / 2, d + PORTAL_DEPTH / 2, PORTAL_GROW, 0, Math.PI, 6), portal));

  if (style.spikes) addHangingSpikes(group, tunnel, style.spikes);
}

// Três estilos de arco aberto (`style.arch`): copa de folhas (padrão, selva), vigas de tronco com folhagem
// (`timber`, floresta) e arcos naturais de pedra (`rock`, deserto).
function addOpenTunnel(group, tunnel, style) {
  const { start, length } = tunnel;
  if (style.arch === 'rock') return addRockArches(group, tunnel, style);
  if (style.arch === 'timber') return addTimberArches(group, tunnel, style);
  if (style.arch === 'palm') return addPalmArches(group, tunnel, style);
  const material = new THREE.MeshBasicMaterial({ color: style.rib, side: THREE.DoubleSide });
  const leaves = new THREE.MeshBasicMaterial({ color: style.leaves });
  const blob = new THREE.IcosahedronGeometry(2.6, 0);
  for (let d = 0; d <= length; d += OPEN_RIB_EVERY) {
    group.add(new THREE.Mesh(arcBand(start + d - 0.6, start + d + 0.6, 0, 0, Math.PI, 6), material));
    const t = trackAt(start + d);
    for (const side of [-5.5, 0, 5.5]) {
      const mesh = new THREE.Mesh(blob, leaves);
      mesh.position.set(t.x - t.tz * side, t.y + TUNNEL_HEIGHT - Math.abs(side) * 0.3 + 0.6, t.z + t.tx * side);
      mesh.scale.set(1.3, 0.8, 1.6);
      group.add(mesh);
    }
  }
}

// Pórticos de pedra: blocos empilhados nos dois lados que se fecham no alto; a cada pórtico o topo ora fecha, ora deixa o céu aparecer.
function addRockArches(group, { start, length }, style) {
  const rock = new THREE.DodecahedronGeometry(1, 0), materials = [style.rib, style.leaves].map(color => new THREE.MeshBasicMaterial({ color }));
  const ARCH_EVERY = 16, STEPS = 8;
  let n = 0;
  for (let d = ARCH_EVERY / 2; d < length; d += ARCH_EVERY, n++) {
    const t = trackAt(start + d), yaw = Math.atan2(-t.tx, -t.tz);
    for (let a = 0; a <= STEPS; a++) {
      const theta = Math.PI * a / STEPS, topGap = a > 1 && a < STEPS - 1 && (n % 2 === 1 && a !== STEPS / 2);   // pórticos ímpares têm só a chave do arco
      if (topGap) continue;
      const side = Math.cos(theta) * (TUNNEL_HALF_WIDTH + 1.5), height = Math.sin(theta) * (TUNNEL_HEIGHT + 0.5);
      const size = (a === 0 || a === STEPS) ? 2.6 : 2.0 + ((a * 7 + n * 3) % 5) * 0.2;
      for (const lift of (a === 0 || a === STEPS) ? [0, 1.8] : [0]) {
        const mesh = new THREE.Mesh(rock, materials[(a + n + lift) % 2]);
        mesh.position.set(t.x - t.tz * side, t.y + height + lift + 0.5, t.z + t.tx * side);
        mesh.rotation.set(0, yaw + a, 0);
        mesh.scale.set(size * 1.1, size * 0.9, size * 1.5);
        group.add(mesh);
      }
    }
  }
}

// Pórticos de coqueiros: dois troncos inclinados que se encontram no alto, com as folhas se cruzando sobre a pista.
function addPalmArches(group, { start, length }, style) {
  const height = TUNNEL_HEIGHT + 2, lean = 0.8, base = TUNNEL_HALF_WIDTH + 0.8;
  const trunk = new THREE.CylinderGeometry(0.3, 0.5, height, 6), frond = new THREE.BoxGeometry(8, 0.14, 1.2);
  const bark = new THREE.MeshBasicMaterial({ color: style.rib }), leaves = [style.leaves, style.leaves + 0x081008].map(color => new THREE.MeshBasicMaterial({ color }));
  for (let d = 0; d <= length; d += OPEN_RIB_EVERY * 1.5) {
    const t = trackAt(start + d), arch = new THREE.Group();
    arch.position.set(t.x, t.y, t.z);
    arch.rotation.y = Math.atan2(-t.tx, -t.tz);       // o eixo x do grupo é o lado da pista
    for (const side of [-1, 1]) {
      const mesh = new THREE.Mesh(trunk, bark);
      mesh.position.set(side * (base - Math.sin(lean) * height / 2), Math.cos(lean) * height / 2 - 0.4, 0);
      mesh.rotation.z = side * lean;
      arch.add(mesh);
      const topX = side * (base - Math.sin(lean) * height), topY = Math.cos(lean) * height - 0.4;
      for (let leaf = 0; leaf < 4; leaf++) {
        const f = new THREE.Mesh(frond, leaves[leaf % 2]);
        f.position.set(topX, topY - (leaf % 2) * 0.3, 0);
        f.rotation.set(0, leaf * 0.8 + side * 0.4, side * 0.2);
        arch.add(f);
      }
    }
    group.add(arch);
  }
}

// Pórticos de madeira: dois troncos de pé, viga de tronco por cima e folhagem de outono pendurada.
// Cada tipo de peça vira uma chamada de desenho só por trecho.
function addTimberArches(group, { start, length }, style) {
  const post = new THREE.CylinderGeometry(0.55, 0.65, TUNNEL_HEIGHT + 0.6, 7), beam = new THREE.CylinderGeometry(0.5, 0.5, TUNNEL_HALF_WIDTH * 2 + 3, 7);
  const bark = new THREE.MeshBasicMaterial({ color: style.rib }), foliage = new THREE.MeshBasicMaterial({ color: style.leaves });
  const tuft = new THREE.IcosahedronGeometry(1.1, 0), posts = [], beams = [], tufts = [];
  const dummy = new THREE.Object3D();
  const place = (list, x, y, z, yaw = 0, roll = 0, squash = 1) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, yaw, roll);
    dummy.scale.set(1, squash, 1);
    dummy.updateMatrix();
    list.push(dummy.matrix.clone());
  };
  for (let d = 0; d <= length; d += OPEN_RIB_EVERY * 1.5) {
    const t = trackAt(start + d), yaw = Math.atan2(-t.tx, -t.tz);
    for (const side of [-1, 1]) {
      const x = side * (TUNNEL_HALF_WIDTH + 0.8);
      place(posts, t.x - t.tz * x, t.y + (TUNNEL_HEIGHT + 0.6) / 2, t.z + t.tx * x);
    }
    place(beams, t.x, t.y + TUNNEL_HEIGHT + 0.6, t.z, yaw, Math.PI / 2);
    for (let i = -2; i <= 2; i++) {
      const lateral = i * 3.2;
      place(tufts, t.x - t.tz * lateral, t.y + TUNNEL_HEIGHT - 0.3 - (i % 2) * 0.4, t.z + t.tx * lateral, 0, 0, 0.6);
    }
  }
  for (const [geometry, material, matrices] of [[post, bark, posts], [beam, bark, beams], [tuft, foliage, tufts]]) {
    const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
    matrices.forEach((placed, i) => mesh.setMatrixAt(i, placed));
    enableCulling(mesh);
    group.add(mesh);
  }
}

// Faixas que brilham na beira da estrada dentro do túnel escuro: no breu é só o que se vê da pista.
const EDGE_GLOW_WIDTH = 0.35, EDGE_GLOW_LIFT = 0.03;
function addGlowingEdges(group, { start, length }, colors) {
  const { step } = track, rows = Math.max(1, Math.round(length / step)), half = TRACK_WIDTH / 2;
  colors.forEach((color, n) => {
    const side = n % 2 ? 1 : -1, inner = side * (half - EDGE_GLOW_WIDTH), outer = side * half;
    const pos = new Float32Array((rows + 1) * 6), index = [];
    for (let i = 0; i <= rows; i++) {
      const t = trackAt(start + length * i / rows);
      pos.set([t.x - t.tz * inner, t.y + EDGE_GLOW_LIFT, t.z + t.tx * inner, t.x - t.tz * outer, t.y + EDGE_GLOW_LIFT, t.z + t.tx * outer], i * 6);
      if (i < rows) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geometry.setIndex(index);
    group.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, fog: false, side: THREE.DoubleSide })));
  });
}

// Um túnel escuro (`tunnel.dark`) usa o próprio visual (`dark.style`, por cima do estilo do bioma).
export function buildTunnels(group, layout, style) {
  for (const tunnel of layout.tunnels) {
    if (tunnel.open) { addOpenTunnel(group, tunnel, style); continue; }
    addSolidTunnel(group, tunnel, tunnel.dark ? { ...style, ...tunnel.dark.style } : style);
    if (tunnel.dark?.glowEdges) addGlowingEdges(group, tunnel, tunnel.dark.glowEdges);
  }
}
