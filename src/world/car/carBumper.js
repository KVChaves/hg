import * as THREE from 'three';

// Para-choques de desempenho (game/carUpgrades.js). Cada um é um grupo de caixas coladas na frente e na traseira
// do carro; a frente aponta para z negativo. A cor principal é a escolhida na garagem, os detalhes têm cor fixa.

const STEEL = 0xa8a8b0, YELLOW = 0xe0b030, DARK = 0x1c1c20;

// [x0, x1, y0, y1, z0, z1, cor] — `main` usa a cor do jogador.
const box = (x0, x1, y0, y1, z0, z1, color = 'main') => ({ x0, x1, y0, y1, z0, z1, color });

const DESIGNS = {
  stock: { boxes: [], spikes: [] },
  // Frisão baixo na frente, com abas nas pontas.
  sport: {
    boxes: [
      box(-0.8, 0.8, 0.22, 0.29, -2.46, -2.12), box(-0.84, -0.76, 0.22, 0.4, -2.44, -2.1), box(0.76, 0.84, 0.22, 0.4, -2.44, -2.1),
      box(-0.78, 0.78, 0.22, 0.27, 2.14, 2.42),
    ],
    spikes: [],
  },
  // Barra grossa de aço com colunas nas pontas e parafusos.
  steel: {
    boxes: [
      box(-0.9, 0.9, 0.3, 0.52, -2.44, -2.22), box(-0.9, -0.8, 0.2, 0.6, -2.44, -2.22), box(0.8, 0.9, 0.2, 0.6, -2.44, -2.22),
      box(-0.4, -0.3, 0.38, 0.44, -2.47, -2.44, STEEL), box(0.3, 0.4, 0.38, 0.44, -2.47, -2.44, STEEL),
      box(-0.86, 0.86, 0.3, 0.5, 2.22, 2.42),
    ],
    spikes: [],
  },
  // Barra com três pontas na frente: quem é atingido leva mais dano.
  ram: {
    boxes: [
      box(-0.9, 0.9, 0.3, 0.5, -2.42, -2.24), box(-0.9, -0.82, 0.2, 0.58, -2.42, -2.24), box(0.82, 0.9, 0.2, 0.58, -2.42, -2.24),
      box(-0.86, 0.86, 0.3, 0.48, 2.22, 2.4),
    ],
    spikes: [{ x: -0.6, y: 0.4 }, { x: 0, y: 0.4 }, { x: 0.6, y: 0.4 }],
  },
  // Bloco de borracha grosso com faixas de aviso amarelas.
  absorber: {
    boxes: [
      box(-0.92, 0.92, 0.2, 0.58, -2.5, -2.2, DARK), box(-0.92, 0.92, 0.31, 0.36, -2.51, -2.2, YELLOW), box(-0.92, 0.92, 0.42, 0.47, -2.51, -2.2, YELLOW),
      box(-0.9, 0.9, 0.2, 0.56, 2.2, 2.46, DARK), box(-0.9, 0.9, 0.31, 0.36, 2.2, 2.47, YELLOW),
    ],
    spikes: [],
  },
};

const spikeGeometry = new THREE.ConeGeometry(0.11, 0.38, 5);
spikeGeometry.rotateX(-Math.PI / 2);                // a ponta aponta para a frente do carro (z negativo)

const noHit = mesh => { mesh.raycast = () => {}; return mesh; };   // o tiro passa direto: o acerto vale para o carro

export function createBumper(kind, mainColor) {
  const group = new THREE.Group();
  const design = DESIGNS[kind] ?? DESIGNS.stock;
  const materials = new Map(), geometries = [];
  const materialOf = color => {
    const hex = color === 'main' ? mainColor : color;
    if (!materials.has(hex)) materials.set(hex, new THREE.MeshBasicMaterial({ color: hex }));
    return materials.get(hex);
  };

  for (const { x0, x1, y0, y1, z0, z1, color } of design.boxes) {
    const geometry = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    geometries.push(geometry);
    const mesh = noHit(new THREE.Mesh(geometry, materialOf(color)));
    mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    group.add(mesh);
    // Um filete mais claro no topo dá volume à caixa, já que o material não recebe luz.
    const topColor = new THREE.Color(color === 'main' ? mainColor : color).lerp(new THREE.Color(0xffffff), 0.28).getHex();
    const top = noHit(new THREE.Mesh(geometry, materialOf(topColor)));
    top.scale.set(0.98, 0.18, 0.98);
    top.position.set(mesh.position.x, y1 - (y1 - y0) * 0.09, mesh.position.z);
    group.add(top);
  }
  for (const { x, y } of design.spikes) {
    const spike = noHit(new THREE.Mesh(spikeGeometry, materialOf(STEEL)));
    spike.position.set(x, y, -2.55);
    group.add(spike);
  }
  group.userData.dispose = () => {
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
  };
  return group;
}

export const disposeBumper = group => group.userData.dispose?.();
