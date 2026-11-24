import * as THREE from 'three';
import { TRACK_WIDTH } from '../../config.js';
import { OPEN_WALL, track, trackAt } from '../track.js';
import { pixelTexture } from '../textures.js';
import { addCulledInstances } from '../instancing.js';
import { sceneryQuality } from '../../game/quality.js';

// Peças comuns aos biomas: objetos instanciados espalhados fora da pista ou enfileirados na beira dela.

const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), euler = new THREE.Euler();
const position = new THREE.Vector3(), scale = new THREE.Vector3(), tint = new THREE.Color();
const MAX_TRIES = 40;
// Distâncias laterais do cenário contam a partir daqui (o muro). Assim elas acompanham a largura da pista.
export const EDGE = OPEN_WALL;
// Árvores e enfeites ficam atrás do muro (ou, sem muro, do acostamento: `track.shoulder` o alarga).
const behindWall = () => OPEN_WALL + track.shoulder + 2.6;
const ROAD_KEEP = TRACK_WIDTH / 2 + 2;               // nada na altura dos carros chega mais perto do centro de qualquer trecho da pista
const CAR_ZONE = 8, FOOTPRINT_STEP = 6;              // metros: altura que atrapalha a vista e espaçamento dos pontos testados

export const solid = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });
export const pickFrom = list => random => list[Math.floor(random() * list.length)];

// Os meshes daqui só recebem as posições; no fim (`finish`) as instâncias vão para a cena repartidas em blocos
// que a câmera pode descartar (world/instancing.js).
function instancedParts(ctx, parts, count) {
  return parts.map(part => new THREE.InstancedMesh(part.geometry, part.material, count));
}

const finish = (ctx, meshes, placed) => addCulledInstances(ctx.group, meshes, placed);

// Quantas peças espalhadas de fato, pela qualidade gráfica (game/quality.js).
const thinned = count => Math.round(count * sceneryQuality().props);

const dimensions = size => (Array.isArray(size) ? size : [size, size, size]);

// Retângulo que a peça ocupa no chão, contando só o que fica na altura dos carros: copa alta não atrapalha.
function footprintOf(parts, size) {
  const [w, h, d] = dimensions(size);
  const area = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const { geometry } of parts) {
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      if (position.getY(i) * h > CAR_ZONE) continue;
      area.minX = Math.min(area.minX, position.getX(i) * w);
      area.maxX = Math.max(area.maxX, position.getX(i) * w);
      area.minZ = Math.min(area.minZ, position.getZ(i) * d);
      area.maxZ = Math.max(area.maxZ, position.getZ(i) * d);
    }
  }
  return area.minX === Infinity ? null : area;
}

// A distância até a pista é medida do centro; peça grande precisa ter o corpo todo longe de qualquer trecho.
function footprintIsClear({ spotIsClear }, area, x, z, yaw) {
  if (!area) return true;
  const c = Math.cos(yaw), s = Math.sin(yaw), { minX, maxX, minZ, maxZ } = area;
  const columns = Math.max(1, Math.ceil((maxX - minX) / FOOTPRINT_STEP)), rows = Math.max(1, Math.ceil((maxZ - minZ) / FOOTPRINT_STEP));
  for (let i = 0; i <= columns; i++) {
    for (let j = 0; j <= rows; j++) {
      const localX = minX + (maxX - minX) * i / columns, localZ = minZ + (maxZ - minZ) * j / rows;
      if (!spotIsClear(x + localX * c + localZ * s, z - localX * s + localZ * c, ROAD_KEEP)) return false;
    }
  }
  return true;
}

function placeInstance(meshes, parts, index, x, y, z, yaw, size, random) {
  const [w, h, d] = dimensions(size);
  euler.set(0, yaw, 0);
  matrix.compose(position.set(x, y, z), quaternion.setFromEuler(euler), scale.set(w, h, d));
  meshes.forEach((mesh, m) => {
    mesh.setMatrixAt(index, matrix);
    if (parts[m].colorOf) mesh.setColorAt(index, tint.setHex(parts[m].colorOf(random)));
  });
}

// `sizeOf(random)` devolve um número ou [largura, altura, profundidade]; `clearance` é a distância mínima até a pista.
export function scatter(ctx, { count, clearance, parts, sizeOf = () => 1 }) {
  count = thinned(count);
  const { random, spotIsClear, bounds, heightAt } = ctx;
  const meshes = instancedParts(ctx, parts, count), distance = Math.max(clearance, behindWall());
  let placed = 0;
  for (let i = 0; i < count; i++) {
    const size = sizeOf(random), area = footprintOf(parts, size);
    let x = 0, z = 0, yaw = 0, found = false;
    for (let tries = 0; tries < MAX_TRIES && !found; tries++) {
      x = bounds.minX - 90 + random() * (bounds.maxX - bounds.minX + 180);
      z = bounds.minZ - 90 + random() * (bounds.maxZ - bounds.minZ + 180);
      yaw = random() * Math.PI * 2;
      found = spotIsClear(x, z, distance) && footprintIsClear(ctx, area, x, z, yaw);
    }
    if (!found) continue;
    placeInstance(meshes, parts, placed++, x, heightAt(x, z), z, yaw, size, random);
  }
  finish(ctx, meshes, placed);
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
// `zone` ({ start, length }): só nesse trecho da pista; `where(distância)`: filtro de onde pode.
export function nearRoad(ctx, { count, from, to, parts, sizeOf = () => 1, zone = null, where = () => true }) {
  count = thinned(count);
  const { random, isOpen, spotIsClear, heightAt } = ctx;
  const meshes = instancedParts(ctx, parts, count);
  let placed = 0;
  for (let i = 0; i < count; i++) {
    const d = zone ? zone.start + random() * zone.length : random() * track.length;
    if (!isOpen(d) || !where(d)) continue;
    const start = Math.max(from, behindWall());
    const t = trackAt(d), lateral = (random() < 0.5 ? -1 : 1) * (start + random() * (to - from));
    const x = t.x - t.tz * lateral, z = t.z + t.tx * lateral;
    const yaw = random() * Math.PI * 2, size = sizeOf(random);
    if (!spotIsClear(x, z, start * 0.9) || !footprintIsClear(ctx, footprintOf(parts, size), x, z, yaw)) continue;
    placeInstance(meshes, parts, placed++, x, heightAt(x, z), z, yaw, size, random);
  }
  finish(ctx, meshes, placed);
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
  finish(ctx, meshes, placed);
}

// Enfileira objetos dos dois lados da pista a cada `every` metros, fora dos túneis.
export function alongRoad(ctx, { every, offset, parts, sizeOf = () => 1, facesRoad = false, where = () => true }) {
  const { random, isOpen, heightAt } = ctx, count = Math.floor(track.length / every) * 2 + 2;
  const meshes = instancedParts(ctx, parts, count);
  let placed = 0;
  for (let d = every / 2; d < track.length; d += every) {
    if (!isOpen(d) || !where(d)) continue;
    for (const side of [-1, 1]) {
      const distance = Math.max(offset, behindWall());
      const t = trackAt(d), x = t.x - t.tz * side * distance, z = t.z + t.tx * side * distance;
      const yaw = Math.atan2(-t.tx, -t.tz) + (facesRoad ? side * Math.PI / 2 : 0), size = sizeOf(random);
      if (!footprintIsClear(ctx, footprintOf(parts, size), x, z, yaw)) continue;    // no grampo o outro trecho da pista passa perto
      placeInstance(meshes, parts, placed++, x, heightAt(x, z), z, yaw, size, random);
    }
  }
  finish(ctx, meshes, placed);
}

// Pórticos que atravessam a pista. `build(random)` devolve um grupo com origem no centro da estrada.
export function acrossRoad(ctx, { every, build }) {
  const { group, random, isOpen, spotIsClear } = ctx;
  for (let d = every * 0.7; d < track.length - 40; d += every + random() * every * 0.4) {
    if (!isOpen(d)) continue;
    const t = trackAt(d);
    if (![-1, 1].every(side => spotIsClear(t.x - t.tz * side * behindWall(), t.z + t.tx * side * behindWall(), ROAD_KEEP))) continue;
    const arch = build(random);
    arch.position.set(t.x, t.y, t.z);
    arch.rotation.y = Math.atan2(-t.tx, -t.tz);
    group.add(arch);
  }
}

export function archFrame({ halfSpan = behindWall(), height = 9, post, beam, trim }) {
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
