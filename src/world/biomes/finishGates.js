import * as THREE from 'three';

// Arcos de chegada de cada bioma. Cada função recebe o grupo (origem no centro da pista, de frente para ela) e
// `{ postX, span }`: onde ficam os pilares e a largura total entre eles.

const material = (color, fog = true) => new THREE.MeshBasicMaterial({ color, fog });
function part(group, geometry, color, x, y, z = 0, { fog = true, rotZ = 0, rotX = 0 } = {}) {
  const mesh = new THREE.Mesh(geometry, material(color, fog));
  mesh.position.set(x, y, z);
  mesh.rotation.set(rotX, 0, rotZ);
  group.add(mesh);
  return mesh;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cylinder = (rTop, rBottom, h, sides = 8) => new THREE.CylinderGeometry(rTop, rBottom, h, sides);
const cone = (r, h, sides = 5) => new THREE.ConeGeometry(r, h, sides);
const sides = fn => [-1, 1].forEach(fn);

// Selva: troncos grossos cobertos de cipó, viga de bambu e folhagem pendurada.
export function jungleGate(g, { postX, span }) {
  sides(s => {
    part(g, cylinder(0.55, 0.75, 9.5, 7), 0x4a3220, s * postX, 4.75);
    for (let y = 1; y < 9; y += 1.6) part(g, box(1.5, 0.22, 1.5), 0x2f6a24, s * postX, y, 0, { rotZ: 0 });
    part(g, cone(1.2, 1.6, 6), 0x3a8a2c, s * postX, 9.9);
  });
  part(g, cylinder(0.4, 0.4, span, 6), 0xb8a050, 0, 9, 0, { rotZ: Math.PI / 2 });
  part(g, box(span * 0.7, 1.5, 0.3), 0x3a6a2a, 0, 7.9);
  for (let x = -span / 2 + 1; x < span / 2; x += 1.9) part(g, box(0.18, 1.2 + Math.abs(Math.sin(x * 3)) * 1.6, 0.18), 0x2f7a2a, x, 8.2 - Math.abs(Math.sin(x * 3)) * 0.8);
}

// Floresta: troncos de pé, viga de tronco e lampiões acesos, com folhas de outono.
export function forestGate(g, { postX, span }) {
  sides(s => {
    part(g, cylinder(0.6, 0.7, 9, 8), 0x5a3618, s * postX, 4.5);
    part(g, cylinder(0.62, 0.62, 0.3, 8), 0x3a2210, s * postX, 7.2);
    part(g, cone(1.6, 2.2, 6), 0xb83c14, s * postX, 10);
  });
  part(g, cylinder(0.55, 0.55, span + 1, 8), 0x74481e, 0, 8.8, 0, { rotZ: Math.PI / 2 });
  part(g, box(span * 0.6, 1.3, 0.25), 0x8a4414, 0, 7.4);
  for (const x of [-span * 0.38, span * 0.38]) {
    part(g, box(0.06, 1, 0.06), 0x2a1a0c, x, 7.8);
    part(g, box(0.5, 0.7, 0.5), 0xffc860, x, 6.9, 0, { fog: false });
  }
  for (let x = -span / 2 + 1.5; x < span / 2; x += 3.4) part(g, new THREE.IcosahedronGeometry(0.8, 0), [0xc85a14, 0xe0902c, 0xb83c14][Math.abs(Math.round(x)) % 3], x, 9.5);
}

// Deserto: pilares de arenito com degraus, verga entalhada e bandeirolas coloridas.
export function desertGate(g, { postX, span }) {
  sides(s => {
    part(g, box(2.4, 1, 2.4), 0xa86a38, s * postX, 0.5);
    part(g, box(1.7, 8, 1.7), 0xd89860, s * postX, 5);
    for (const y of [3, 5.5]) part(g, box(1.85, 0.35, 1.85), 0xb8501c, s * postX, y);
    part(g, box(2.4, 0.8, 2.4), 0xa86a38, s * postX, 9.4);
  });
  part(g, box(span + 1, 1.3, 1.5), 0xc88a50, 0, 9.6);
  part(g, box(span * 0.6, 0.45, 1.6), 0xb8501c, 0, 9.6);
  const flags = [0xc83a2a, 0xf0c030, 0x2a8ac8, 0x3a9a4a];
  for (let i = 0, x = -span / 2 + 2; x < span / 2 - 1; i++, x += 1.7) {
    const flag = part(g, cone(0.55, 1.5, 3), flags[i % 4], x, 8.2);
    flag.rotation.x = Math.PI;
  }
}

// Montanha nevada: colunas de gelo com neve em cima, verga de gelo e pingentes.
export function winterGate(g, { postX, span }) {
  sides(s => {
    part(g, box(1.8, 8.4, 1.8), 0x8ccfea, s * postX, 4.2);
    part(g, box(1.2, 8.4, 1.2), 0xb8e6f6, s * postX, 4.4, 0.5);
    part(g, box(2.4, 0.9, 2.4), 0xf4f8fc, s * postX, 8.7);
  });
  part(g, box(span + 1, 1.5, 1.6), 0x74bcdc, 0, 8.8);
  part(g, box(span + 1.4, 0.7, 1.9), 0xf4f8fc, 0, 9.8);
  part(g, box(span * 0.55, 0.9, 1.7), 0x2858a0, 0, 8.8);
  for (let x = -span / 2 + 0.8; x < span / 2; x += 1.1) {
    const icicle = part(g, cone(0.25, 0.9 + Math.abs(Math.sin(x * 5)) * 1.6, 5), 0xc8f4ff, x, 7.6);
    icicle.rotation.x = Math.PI;
  }
}

// Fábrica: vigas de aço, treliça, painel zebrado de perigo e luzes de alerta.
export function factoryGate(g, { postX, span }) {
  sides(s => {
    part(g, box(0.5, 9, 1.4), 0x4a4644, s * (postX - 0.5), 4.5);
    part(g, box(0.5, 9, 1.4), 0x4a4644, s * (postX + 0.5), 4.5);
    part(g, box(1.5, 9, 0.4), 0x2c2826, s * postX, 4.5);
    for (let y = 1; y < 9; y += 2) part(g, box(1.6, 0.25, 1.6), 0xd86818, s * postX, y);
  });
  part(g, box(span + 2, 1.6, 1.6), 0x2c2826, 0, 9);
  for (let x = -span / 2; x < span / 2; x += 1.2) part(g, box(0.5, 1.7, 1.7), Math.round(x / 1.2) % 2 ? 0xe8b018 : 0x1a1816, x, 9);
  for (const x of [-span * 0.3, 0, span * 0.3]) part(g, box(0.6, 0.6, 0.6), 0xff5010, x, 10.2, 0, { fog: false });
}

// Neon: tubos de luz que não apagam com a neblina.
export function neonGate(g, { postX, span }) {
  sides(s => {
    part(g, box(0.4, 9, 0.4), 0xf030b0, s * postX, 4.5, 0, { fog: false });
    part(g, box(0.15, 9, 0.15), 0x20e0f0, s * (postX + 0.5), 4.5, 0, { fog: false });
    part(g, box(1.6, 0.3, 1.6), 0x18142a, s * postX, 0.15);
  });
  part(g, box(span + 1, 0.4, 0.4), 0x20e0f0, 0, 9, 0, { fog: false });
  part(g, box(span + 1, 0.2, 0.2), 0xf030b0, 0, 8.3, 0, { fog: false });
  part(g, box(span * 0.6, 1.1, 0.2), 0x18142a, 0, 8.7);
  for (let x = -span * 0.25; x <= span * 0.25; x += 1.4) part(g, box(0.9, 0.12, 0.25), 0xf0e020, x, 8.7, 0.15, { fog: false });
}

// Estádio: pórtico de treliça branca com refletores e faixa azul.
export function stadiumGate(g, { postX, span }) {
  sides(s => {
    part(g, box(1.1, 9, 1.1), 0xe8e4dc, s * postX, 4.5);
    part(g, box(1.4, 0.5, 1.4), 0x2a2a30, s * postX, 0.25);
  });
  part(g, box(span + 1.4, 1.2, 1.2), 0xe8e4dc, 0, 9);
  part(g, box(span * 0.8, 1.3, 0.2), 0x2060c0, 0, 7.7);
  for (let x = -span / 2 + 1; x < span / 2; x += 2.2) part(g, box(0.8, 0.6, 0.8), 0xfff4c8, x, 10, 0, { fog: false });
  for (let x = -span / 2; x <= span / 2; x += 2.2) part(g, box(0.15, 1.2, 0.15), 0xb0b0b8, x, 9, 0.7);
}

// Praia: troncos de coqueiro com folhas, viga de madeira com bandeirolas e boias salva-vidas.
export function beachGate(g, { postX, span }) {
  sides(s => {
    const trunk = part(g, cylinder(0.4, 0.6, 9, 7), 0x8a6a40, s * postX, 4.5);
    trunk.rotation.z = -s * 0.08;
    for (let leaf = 0; leaf < 5; leaf++) {
      const frond = part(g, box(3.6, 0.14, 0.9), leaf % 2 ? 0x2f8a3a : 0x3aa048, s * postX - s * 0.7, 9.3);
      frond.rotation.set(0, leaf * 1.26, -0.3);
    }
    part(g, new THREE.TorusGeometry(0.6, 0.18, 6, 12), 0xe83a3a, s * (postX - 1), 5, 0, { rotX: Math.PI / 2 });
  });
  part(g, box(span + 1, 0.8, 0.8), 0xd8b070, 0, 8.6);
  part(g, box(span * 0.55, 1.1, 0.2), 0x2a9ab8, 0, 7.8);
  const flags = [0xe83a3a, 0xf0d030, 0x3a7ae8, 0xffffff, 0x3aa860];
  for (let i = 0, x = -span / 2 + 1; x < span / 2; i++, x += 1.5) {
    const flag = part(g, cone(0.5, 1.1, 3), flags[i % 5], x, 7.7);
    flag.rotation.x = Math.PI;
  }
}

// Espaço: pilares de estação com anel de luz, antenas e painéis que brilham.
export function spaceGate(g, { postX, span }) {
  sides(s => {
    part(g, cylinder(0.7, 0.9, 9.5, 8), 0x8a90a0, s * postX, 4.75);
    part(g, cylinder(0.95, 0.95, 0.5, 8), 0x40e0f0, s * postX, 2, 0, { fog: false });
    part(g, cylinder(0.95, 0.95, 0.5, 8), 0x40e0f0, s * postX, 6.5, 0, { fog: false });
    part(g, cylinder(0.06, 0.06, 3, 4), 0xb8bcc8, s * (postX + 0.4), 11);
    part(g, box(0.3, 0.3, 0.3), 0xe84030, s * (postX + 0.4), 12.6, 0, { fog: false });
  });
  part(g, box(span + 1.4, 1.1, 1.1), 0x6a7080, 0, 9.4);
  part(g, box(span * 0.9, 0.3, 0.3), 0x40e0f0, 0, 9.4, 0.6, { fog: false });
  part(g, box(span * 0.55, 1.4, 0.25), 0x14182a, 0, 7.9);
  for (let x = -span * 0.25; x <= span * 0.25; x += 1.6) part(g, box(1, 0.16, 0.3), x % 3.2 ? 0xa060f0 : 0x40e0f0, x, 7.9, 0.15, { fog: false });
}

// Estrada do Rei: pilares de pedra com ameias, viga de madeira com faixa xadrez e bandeirolas do rei.
export function kingsGate(g, { postX, span }) {
  sides(s => {
    part(g, box(2.2, 10, 2.2), 0x8a8478, s * postX, 5);
    for (const [x, z] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) part(g, box(0.7, 0.9, 0.7), 0x9a948a, s * postX + x, 10.45, z);
    part(g, box(1.4, 3, 0.1), s > 0 ? 0xa01a1a : 0x1a3a8a, s * postX, 6.5, 1.16);   // estandarte na frente do pilar
  });
  part(g, box(span, 0.7, 0.7), 0x5a3a20, 0, 8.4);
  for (let x = -span * 0.4, k = 0; x <= span * 0.4 + 0.01; x += span * 0.8 / 9, k++) part(g, box(span * 0.8 / 9, 1.4, 0.2), k % 2 ? 0x1a1a1a : 0xf0ece0, x, 7.4);
  for (let x = -span / 2 + 1.2, k = 0; x < span / 2; x += 2.1, k++) part(g, cone(0.6, 1.2, 3), k % 2 ? 0xe0b030 : 0xa01a1a, x, 9.2, 0, { rotX: Math.PI });
}
