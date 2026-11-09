import * as THREE from 'three';
import { OPEN_WALL, track, trackAt } from '../track.js';
import { pixelTexture } from '../textures.js';

// Peças comuns aos biomas: objetos instanciados espalhados fora da pista ou enfileirados na beira dela.

const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), euler = new THREE.Euler();
const position = new THREE.Vector3(), scale = new THREE.Vector3(), tint = new THREE.Color();
const MAX_TRIES = 40;
const BEHIND_WALL = OPEN_WALL + 2.6;                 // árvores e enfeites ficam atrás do muro

export const solid = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });
export const pickFrom = list => random => list[Math.floor(random() * list.length)];

function instancedParts(ctx, parts, count) {
  return parts.map(part => {
    const mesh = new THREE.InstancedMesh(part.geometry, part.material, count);
    mesh.frustumCulled = false;
    ctx.group.add(mesh);
    return mesh;
  });
}

function placeInstance(meshes, parts, index, x, y, z, yaw, size, random) {
  const [w, h, d] = Array.isArray(size) ? size : [size, size, size];
  euler.set(0, yaw, 0);
  matrix.compose(position.set(x, y, z), quaternion.setFromEuler(euler), scale.set(w, h, d));
  meshes.forEach((mesh, m) => {
    mesh.setMatrixAt(index, matrix);
    if (parts[m].colorOf) mesh.setColorAt(index, tint.setHex(parts[m].colorOf(random)));
  });
}

// `sizeOf(random)` devolve um número ou [largura, altura, profundidade]; `clearance` é a distância mínima até a pista.
export function scatter(ctx, { count, clearance, parts, sizeOf = () => 1 }) {
  const { random, spotIsClear, bounds, heightAt } = ctx;
  const meshes = instancedParts(ctx, parts, count), distance = Math.max(clearance, BEHIND_WALL);
  let placed = 0;
  for (let i = 0; i < count; i++) {
    let x = 0, z = 0, found = false;
    for (let tries = 0; tries < MAX_TRIES && !found; tries++) {
      x = bounds.minX - 90 + random() * (bounds.maxX - bounds.minX + 180);
      z = bounds.minZ - 90 + random() * (bounds.maxZ - bounds.minZ + 180);
      found = spotIsClear(x, z, distance);
    }
    if (!found) continue;
    placeInstance(meshes, parts, placed++, x, heightAt(x, z), z, random() * Math.PI * 2, sizeOf(random), random);
  }
  for (const mesh of meshes) mesh.count = placed;
}

// Dois planos cruzados com uma imagem: planta ou copa desenhada em pixel art. `lift` sobe a base em metros.
export function billboard(canvas, width, height, lift = 0) {
  const half = width / 2, top = lift + height, q = [[-half, 0], [half, 0], [0, -half], [0, half]];
  const pos = [], uv = [], index = [];
  [[q[0], q[1]], [q[2], q[3]]].forEach(([[ax, az], [bx, bz]], plane) => {
    pos.push(ax, lift, az, bx, lift, bz, bx, top, bz, ax, top, az);
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    const v = plane * 4;
    index.push(v, v + 1, v + 2, v, v + 2, v + 3);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
  geometry.setIndex(index);
  return { geometry, material: new THREE.MeshBasicMaterial({ map: pixelTexture(canvas), alphaTest: 0.5, side: THREE.DoubleSide }) };
}

// Espalha numa faixa colada à estrada, entre `from` e `to` metros do centro, para fechar a vista.
export function nearRoad(ctx, { count, from, to, parts, sizeOf = () => 1 }) {
  const { random, isOpen, spotIsClear, heightAt } = ctx;
  const meshes = instancedParts(ctx, parts, count);
  let placed = 0;
  for (let i = 0; i < count; i++) {
    const d = random() * track.length;
    if (!isOpen(d)) continue;
    const start = Math.max(from, BEHIND_WALL);
    const t = trackAt(d), lateral = (random() < 0.5 ? -1 : 1) * (start + random() * (to - from));
    const x = t.x - t.tz * lateral, z = t.z + t.tx * lateral;
    if (!spotIsClear(x, z, start * 0.9)) continue;
    placeInstance(meshes, parts, placed++, x, heightAt(x, z), z, random() * Math.PI * 2, sizeOf(random), random);
  }
  for (const mesh of meshes) mesh.count = placed;
}

// Coloca acima da pista, em alturas `height` e até `lateral` metros para cada lado.
export function overRoad(ctx, { count, height, lateral, parts, sizeOf = () => 1 }) {
  const { random, isOpen } = ctx;
  const meshes = instancedParts(ctx, parts, count);
  let placed = 0;
  for (let i = 0; i < count; i++) {
    const d = random() * track.length;
    if (!isOpen(d)) continue;
    const t = trackAt(d), side = (random() * 2 - 1) * lateral;
    placeInstance(meshes, parts, placed++, t.x - t.tz * side, t.y + height[0] + random() * (height[1] - height[0]), t.z + t.tx * side, random() * Math.PI * 2, sizeOf(random), random);
  }
  for (const mesh of meshes) mesh.count = placed;
}

// Enfileira objetos dos dois lados da pista a cada `every` metros, fora dos túneis.
export function alongRoad(ctx, { every, offset, parts, sizeOf = () => 1, facesRoad = false }) {
  const { random, isOpen, heightAt } = ctx, count = Math.floor(track.length / every) * 2 + 2;
  const meshes = instancedParts(ctx, parts, count);
  let placed = 0;
  for (let d = every / 2; d < track.length; d += every) {
    if (!isOpen(d)) continue;
    for (const side of [-1, 1]) {
      const distance = Math.max(offset, BEHIND_WALL);
      const t = trackAt(d), x = t.x - t.tz * side * distance, z = t.z + t.tx * side * distance;
      const yaw = Math.atan2(-t.tx, -t.tz) + (facesRoad ? side * Math.PI / 2 : 0);
      placeInstance(meshes, parts, placed++, x, heightAt(x, z), z, yaw, sizeOf(random), random);
    }
  }
  for (const mesh of meshes) mesh.count = placed;
}

// Pórticos que atravessam a pista. `build(random)` devolve um grupo com origem no centro da estrada.
export function acrossRoad(ctx, { every, build }) {
  const { group, random, isOpen } = ctx;
  for (let d = every * 0.7; d < track.length - 40; d += every + random() * every * 0.4) {
    if (!isOpen(d)) continue;
    const t = trackAt(d), arch = build(random);
    arch.position.set(t.x, t.y, t.z);
    arch.rotation.y = Math.atan2(-t.tx, -t.tz);
    group.add(arch);
  }
}

export function archFrame({ halfSpan = BEHIND_WALL, height = 9, post, beam, trim }) {
  const arch = new THREE.Group();
  const add = (w, h, d, x, y, color, extra) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), solid(color, extra));
    mesh.position.set(x, y, 0);
    arch.add(mesh);
  };
  add(0.8, height, 0.8, -halfSpan, height / 2, post);
  add(0.8, height, 0.8, halfSpan, height / 2, post);
  add(halfSpan * 2 + 0.8, 1.2, 0.8, 0, height, beam, { fog: false });
  if (trim) add(halfSpan * 2 + 0.8, 0.25, 0.9, 0, height - 0.8, trim, { fog: false });
  return arch;
}
