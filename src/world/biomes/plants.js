import * as THREE from 'three';
import { pickFrom } from './propKit.js';
import { sceneryQuality } from '../../game/quality.js';

// Vegetação montada com várias peças (tronco, galhos, tufos de copa, folhas de palmeira) juntas numa geometria só,
// com luz falsa por face: o material não recebe luz, então cada face ganha um tom pelo ângulo em relação a uma luz
// fixa (como em world/car/carShade.js). Sem isso uma copa vira uma mancha chapada.
// Cada planta devolve uma lista de partes para scatter/nearRoad/alongRoad (propKit.js). A parte com `colorOf` sai
// branca e sombreada e recebe a cor por instância (copas de cores variadas); as outras já saem pintadas.

const LIGHT = new THREE.Vector3(0.45, 0.75, 0.35).normalize();
const AMBIENT = 0.48, FACE_JITTER = 0.1;
const UP = new THREE.Vector3(0, 1, 0);
const solidShaded = new THREE.MeshBasicMaterial({ vertexColors: true });
const doubleShaded = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
// Peças com cor por instância usam materiais só delas. No three r128 o programa do material é montado uma vez,
// com ou sem a cor por instância, e não muda: um tronco sem cor desenhado com o programa das copas quebra o quadro
// inteiro (some o mundo todo e só fica o HUD).
const solidTinted = solidShaded.clone(), doubleTinted = doubleShaded.clone();

// Junta as peças `{ geometry, color }` numa geometria com cor por vértice. `twoSided`: folhas finas, vistas dos
// dois lados (o tom usa o ângulo sem sinal).
function shade(pieces, twoSided = false) {
  const positions = [], colors = [], normal = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (const { geometry, color = 0xffffff } of pieces) {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    const pos = flat.attributes.position, base = new THREE.Color(color);
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
      normal.subVectors(c, b).cross(a.clone().sub(b)).normalize();
      const facing = normal.dot(LIGHT), lit = twoSided ? Math.abs(facing) : Math.max(0, facing);
      const light = (AMBIENT + (1 - AMBIENT) * lit) * (1 - FACE_JITTER / 2 + Math.random() * FACE_JITTER);
      for (const v of [a, b, c]) {
        positions.push(v.x, v.y, v.z);
        colors.push(Math.min(1, base.r * light), Math.min(1, base.g * light), Math.min(1, base.b * light));
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return { geometry, material: twoSided ? doubleShaded : solidShaded };
}

// Parte que recebe cor por instância (lista de cores) ou fica com a cor já pintada.
const tinted = (part, colors) => (colors ? { ...part, material: part.material === doubleShaded ? doubleTinted : solidTinted, colorOf: pickFrom(colors) } : part);

// Cilindro (ou tronco de cone) de `from` até `to`.
function bar(from, to, radius, radiusEnd = radius, sides = 6) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), direction = b.clone().sub(a);
  const geometry = new THREE.CylinderGeometry(radiusEnd, radius, direction.length(), sides, 1, false);
  geometry.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, direction.normalize())));
  const middle = a.add(b).multiplyScalar(0.5);
  geometry.translate(middle.x, middle.y, middle.z);
  return geometry;
}

// Tufo de folhagem: icosaedro amassado com os vértices mexidos, para não parecer bola.
function clump(at, radius, squash = 0.8, detail = sceneryQuality().foliage) {
  const geometry = new THREE.IcosahedronGeometry(radius, detail), pos = geometry.attributes.position, v = new THREE.Vector3();
  const moved = new Map();                           // o mesmo vértice repetido em faces vizinhas recebe o mesmo empurrão
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    if (!moved.has(key)) moved.set(key, 0.82 + Math.random() * 0.32);
    v.multiplyScalar(moved.get(key));
    pos.setXYZ(i, v.x, v.y * squash, v.z);
  }
  geometry.translate(...at);
  return geometry;
}

const cone = (at, radius, height, sides = 7) => {
  const geometry = new THREE.ConeGeometry(radius, height, sides);
  geometry.translate(at[0], at[1] + height / 2, at[2]);
  return geometry;
};

// Folha de palmeira: sai do topo em `angle`, sobe um pouco e cai em arco; dobrada em V ao longo da nervura.
function frond(top, angle, length, droop, width, segments = 6) {
  const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)), side = new THREE.Vector3(-dir.z, 0, dir.x);
  const spine = [], edges = [];
  for (let s = 0; s <= segments; s++) {
    const t = s / segments, out = length * t, rise = length * 0.32 * t - droop * t * t;
    const center = new THREE.Vector3(top[0] + dir.x * out, top[1] + rise, top[2] + dir.z * out);
    const half = width * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.95)) * (1 - t * 0.35);
    spine.push(center);
    edges.push([center.clone().addScaledVector(side, half).add(new THREE.Vector3(0, -half * 0.45, 0)), center.clone().addScaledVector(side, -half).add(new THREE.Vector3(0, -half * 0.45, 0))]);
  }
  const positions = [];
  const tri = (p, q, r) => positions.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z);
  for (let s = 0; s < segments; s++) {
    for (const k of [0, 1]) {
      tri(spine[s], edges[s][k], spine[s + 1]);
      tri(edges[s][k], edges[s + 1][k], spine[s + 1]);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

// Árvore de folhas largas (carvalho, bordo): tronco com raízes, dois ou três galhos e copa de vários tufos.
export function broadleafTree({ height = 7, crown = 3.4, bark = 0x3a2414, colors } = {}) {
  const top = [0.25, height, 0.1];
  const wood = [
    bar([0, -0.4, 0], top, 0.78, 0.42, 7),
    cone([0, -0.2, 0], 1.25, 1.6, 7),                                     // pé alargado, com raízes
  ];
  const limbs = [];
  for (let i = 0; i < 3; i++) {
    const angle = i * 2.1 + Math.random() * 0.8, from = height * (0.55 + i * 0.1), reach = crown * (0.65 + Math.random() * 0.25);
    const end = [Math.cos(angle) * reach, from + crown * 0.55, Math.sin(angle) * reach];
    wood.push(bar([0.1, from, 0], end, 0.3, 0.14, 5));
    limbs.push(end);
  }
  const leaves = [clump([top[0], height + crown * 0.75, top[2]], crown, 0.78)];
  for (const end of limbs) leaves.push(clump([end[0], end[1] + crown * 0.15, end[2]], crown * (0.66 + Math.random() * 0.15), 0.8));
  leaves.push(clump([-0.3, height + crown * 1.35, 0.3], crown * 0.62, 0.8));
  return [
    shade(wood.map(geometry => ({ geometry, color: bark }))),
    tinted(shade(leaves.map(geometry => ({ geometry }))), colors),
  ];
}

// Pinheiro: tronco fino e cones de galhada empilhados.
export function pineTree({ height = 12, width = 3.6, bark = 0x3a2414, colors } = {}) {
  const tiers = [];
  // Cada andar é mais largo que o de cima naquela altura: a silhueta fica em degraus de galhada, não um cone liso.
  const TIERS = 5;
  for (let i = 0; i < TIERS; i++) {
    const radius = width * (1 - i * 0.17);
    tiers.push(cone([0, height * (0.18 + i * 0.15), 0], radius, height * (0.3 - i * 0.02), 8));
  }
  return [
    shade([{ geometry: bar([0, -0.3, 0], [0, height * 0.5, 0], 0.45, 0.3, 6), color: bark }]),
    tinted(shade(tiers.map(geometry => ({ geometry }))), colors),
  ];
}

// Moita: três tufos baixos colados.
export function bush({ radius = 1.4, colors } = {}) {
  const pieces = [clump([0, radius * 0.55, 0], radius, 0.7)];
  for (let i = 0; i < 3; i++) {
    const angle = i * 2.1 + Math.random(), r = radius * 0.75;
    pieces.push(clump([Math.cos(angle) * r, radius * 0.4, Math.sin(angle) * r], radius * (0.55 + Math.random() * 0.2), 0.7));
  }
  return [tinted(shade(pieces.map(geometry => ({ geometry }))), colors)];
}

// Coqueiro: tronco fino e curvo em anéis, coroa de folhas compridas que caem em arco e cacho de cocos.
export function palmTree({ height = 9.5, bend = 2.4, fronds = 9, colors } = {}) {
  const SEGMENTS = 8, ring = [0x8a6a40, 0x6e5232];
  const at = t => [bend * t * t, height * t, 0];
  const trunk = [];
  for (let s = 0; s < SEGMENTS; s++) {
    const t0 = s / SEGMENTS, t1 = (s + 1) / SEGMENTS, r0 = 0.46 - t0 * 0.2, r1 = 0.46 - t1 * 0.2;
    trunk.push({ geometry: bar(at(t0), at(t1), r0, r1 * 0.92, 6), color: ring[s % 2] });   // cada gomo afina no fim: dá o anel
  }
  const top = at(1);
  trunk.push({ geometry: clump([top[0], top[1] - 0.2, top[2]], 0.55, 1, 0), color: 0x6a5a30 });   // miolo da coroa
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2 + 0.4;
    trunk.push({ geometry: clump([top[0] + Math.cos(angle) * 0.55, top[1] - 0.65, top[2] + Math.sin(angle) * 0.55], 0.36, 1, 0), color: 0x5a3c1c });   // cocos
  }
  const leaves = [];
  for (let i = 0; i < fronds; i++) {
    const angle = i / fronds * Math.PI * 2 + Math.random() * 0.3, length = 4.6 + Math.random() * 1.4;
    leaves.push(frond(top, angle, length, length * (0.75 + Math.random() * 0.25), 0.85));
  }
  for (let i = 0; i < 3; i++) leaves.push(frond(top, i * 2.1 + 0.6, 2.6, 0.2, 0.6));    // folhas novas, mais curtas e em pé
  return [shade(trunk), tinted(shade(leaves.map(geometry => ({ geometry })), true), colors)];
}

// Cipreste do brejo, quase morto: pé largo, tronco torto, galhos secos, pouca folhagem e barba-de-velho pendurada.
export function swampCypress({ height = 12, colors } = {}) {
  const wood = [cone([0, -0.3, 0], 2, 3, 7), bar([0, 0, 0], [0.6, height * 0.55, 0.2], 1, 0.6, 7), bar([0.6, height * 0.55, 0.2], [0.1, height, -0.2], 0.6, 0.3, 6)];
  const tips = [], moss = [];
  for (let i = 0; i < 5; i++) {
    const angle = i * 1.3 + Math.random() * 0.6, from = height * (0.45 + i * 0.1), reach = 2.4 + Math.random() * 1.8;
    const end = [Math.cos(angle) * reach, from + 1.2 + Math.random(), Math.sin(angle) * reach];
    wood.push(bar([0.4, from, 0], end, 0.26, 0.1, 5));
    tips.push(end);
    const hang = new THREE.ConeGeometry(0.5, 2.4 + Math.random() * 1.6, 5);
    hang.rotateX(Math.PI);                            // ponta para baixo
    hang.translate(end[0] * 0.8, end[1] - 1.4, end[2] * 0.8);
    moss.push({ geometry: hang, color: 0x7a8a6a });
  }
  const leaves = tips.filter((_, i) => i % 2 === 0).map(end => ({ geometry: clump([end[0], end[1] + 0.4, end[2]], 1.5, 0.55, 0) }));
  leaves.push({ geometry: clump([0.1, height + 0.6, -0.2], 1.9, 0.55, 0) });
  return [shade([...wood.map(geometry => ({ geometry, color: 0x3a3024 })), ...moss]), tinted(shade(leaves), colors)];
}

// Lâmina fina de capim ou junco: triângulo comprido que sai do chão inclinado para fora.
function blade(angle, lean, height, width) {
  const dx = Math.cos(angle), dz = Math.sin(angle), sx = -dz * width, sz = dx * width;
  const tip = [dx * lean, height, dz * lean];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-sx, 0, -sz, sx, 0, sz, ...tip], 3));
  return geometry;
}

// Tufo de capim de duna: muitas lâminas finas abertas em leque.
export function grassTuft({ blades = 14, height = 1.6, colors } = {}) {
  const pieces = [];
  for (let i = 0; i < blades; i++) {
    const angle = Math.random() * Math.PI * 2, h = height * (0.6 + Math.random() * 0.5);
    pieces.push({ geometry: blade(angle, h * (0.25 + Math.random() * 0.45), h, 0.09) });
  }
  return [tinted(shade(pieces, true), colors)];
}

// Moita de taboa: folhas compridas e em pé e algumas hastes com a espiga marrom no alto.
export function reedClump({ height = 2.6, colors } = {}) {
  const leaves = [], heads = [];
  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2, h = height * (0.65 + Math.random() * 0.45);
    leaves.push({ geometry: blade(angle, h * (0.08 + Math.random() * 0.25), h, 0.12) });
  }
  for (let i = 0; i < 3; i++) {
    const x = (Math.random() - 0.5) * 0.5, z = (Math.random() - 0.5) * 0.5, h = height * (1 + Math.random() * 0.3);
    heads.push({ geometry: bar([x, 0, z], [x, h, z], 0.04, 0.04, 3), color: 0x6a7a3a });
    heads.push({ geometry: bar([x, h, z], [x, h + 0.55, z], 0.13, 0.11, 5), color: 0x5a3a1c });
  }
  return [tinted(shade(leaves, true), colors), shade(heads)];
}

// Para outras peças montadas (casas, moinhos, feno): junta { geometry, color } com a mesma luz falsa por face.
export const shadedPart = (pieces, colors) => tinted(shade(pieces), colors);
export { bar as barGeometry, cone as coneGeometry };
