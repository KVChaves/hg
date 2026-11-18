import * as THREE from 'three';
import { createPartSet } from './carShade.js';

// Para-choques de desempenho (game/carUpgrades.js). A frente do carro aponta para z negativo.
// `main` é a cor do corpo e `accent` a do detalhe, as duas escolhidas na garagem; o resto tem cor fixa.

const STEEL = 0x9aa0aa, DARK = 0x1a1a1e, LAMP = 0xfff2b0, RED = 0xc02424;
const HALF_PI = Math.PI / 2;

const DESIGNS = {
  stock() {},

  // Splitter baixo com aletas, entrada de ar com colméia e difusor com aletas atrás.
  sport({ box, prism }, { main, accent }) {
    prism([[-2.56, 0.2], [-2.1, 0.2], [-2.1, 0.3], [-2.46, 0.27]], -0.9, 0.9, main);
    box(0.16, 0.12, 0.34, main, [-0.9, 0.3, -2.3], [0, -0.35, 0]);               // aletas laterais
    box(0.16, 0.12, 0.34, main, [0.9, 0.3, -2.3], [0, 0.35, 0]);
    box(1.0, 0.16, 0.06, DARK, [0, 0.38, -2.26]);                                // entrada de ar
    for (let i = -2; i <= 2; i++) box(0.04, 0.16, 0.07, accent, [i * 0.18, 0.38, -2.27]);
    box(1.4, 0.04, 0.4, main, [0, 0.52, -2.2], [0.12, 0, 0]);                    // lábio sobre a entrada
    prism([[2.12, 0.2], [2.5, 0.2], [2.46, 0.34], [2.12, 0.34]], -0.84, 0.84, main);   // difusor
    for (const x of [-0.5, -0.25, 0, 0.25, 0.5]) box(0.035, 0.14, 0.4, accent, [x, 0.27, 2.32]);
  },

  // Gaiola de tubos de aço com protetor de cárter, faróis auxiliares e ganchos de reboque.
  steel({ box, bar, add, prism }, { main, accent }) {
    bar([-0.86, 0.46, -2.42], [0.86, 0.46, -2.42], 0.075, main, { sides: 8 });
    bar([-0.86, 0.26, -2.4], [0.86, 0.26, -2.4], 0.07, main, { sides: 8 });
    for (const x of [-0.86, 0.86]) bar([x, 0.22, -2.4], [x, 0.62, -2.34], 0.07, main, { sides: 8 });
    for (const x of [-0.45, 0, 0.45]) bar([x, 0.26, -2.4], [x, 0.46, -2.42], 0.045, main);
    for (const x of [-0.6, 0.6]) bar([x, 0.46, -2.42], [x * 0.9, 0.5, -2.1], 0.05, STEEL);   // braços até o chassi
    prism([[-2.38, 0.14], [-1.5, 0.14], [-1.5, 0.19], [-2.34, 0.2]], -0.6, 0.6, STEEL);       // protetor de cárter
    for (const x of [-0.5, 0.5]) {
      add(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 10), accent, { position: [x, 0.62, -2.4], rotation: [HALF_PI, 0, 0] });
      add(new THREE.CylinderGeometry(0.065, 0.065, 0.09, 10), LAMP, { position: [x, 0.62, -2.435], rotation: [HALF_PI, 0, 0] });
    }
    for (const x of [-0.3, 0.3]) add(new THREE.TorusGeometry(0.07, 0.022, 5, 8), accent, { position: [x, 0.3, -2.46] });   // ganchos
    box(1.8, 0.2, 0.2, main, [0, 0.38, 2.34]);                                   // barra traseira
    for (const x of [-0.6, 0.6]) add(new THREE.TorusGeometry(0.07, 0.022, 5, 8), accent, { position: [x, 0.36, 2.47] });
  },

  // Arado afiado: lâmina inclinada, três pontas, chifres laterais e reforços.
  ram({ box, bar, prism, cone }, { main, accent }) {
    prism([[-2.66, 0.2], [-2.2, 0.18], [-2.2, 0.62], [-2.44, 0.5]], -0.9, 0.9, main);
    prism([[-2.7, 0.22], [-2.62, 0.22], [-2.62, 0.4]], -0.9, 0.9, STEEL);                   // fio da lâmina
    for (const x of [-0.6, 0, 0.6]) cone(0.09, 0.4, accent, [x, 0.44, -2.8], [-HALF_PI, 0, 0], 6);
    for (const side of [-1, 1]) {
      box(0.12, 0.34, 0.5, main, [side * 0.96, 0.4, -2.38], [0, side * 0.3, 0]);
      cone(0.07, 0.36, accent, [side * 1.04, 0.44, -2.5], [-HALF_PI, 0, side * 0.5], 5);
    }
    for (const x of [-0.5, 0.5]) bar([x, 0.55, -2.4], [x * 0.9, 0.8, -2.0], 0.045, STEEL);   // reforços até o capô
    box(1.7, 0.2, 0.24, main, [0, 0.4, 2.3]);
    for (const x of [-0.5, 0.5]) cone(0.07, 0.3, accent, [x, 0.42, 2.58], [HALF_PI, 0, 0]);
  },

  // Feixe de dinamite amarrado na frente, com pavios e faixas de aviso.
  explosive({ box, add, cone, prism }, { main, accent }) {
    prism([[-2.5, 0.2], [-2.5, 0.3], [-2.2, 0.3], [-2.2, 0.2]], -0.9, 0.9, main);           // base
    for (const row of [0.38, 0.54]) {
      for (let i = -3; i <= 3; i++) {
        add(new THREE.CylinderGeometry(0.075, 0.075, 0.5, 8), RED, { position: [i * 0.23, row, -2.42], rotation: [HALF_PI, 0, 0] });
        cone(0.05, 0.12, DARK, [i * 0.23, row, -2.7], [-HALF_PI, 0, 0], 6);               // pavio
      }
    }
    for (const x of [-0.5, 0.5]) box(0.07, 0.34, 0.5, accent, [x, 0.46, -2.42]);           // fitas
    box(1.7, 0.2, 0.2, main, [0, 0.38, 2.34]);
    box(1.4, 0.05, 0.05, RED, [0, 0.5, 2.46]);
  },

  // Bloco grosso de borracha com cantos arredondados, faixas de aviso e refletores.
  absorber({ box, add, prism }, { main, accent }) {
    prism([[-2.54, 0.2], [-2.54, 0.5], [-2.42, 0.62], [-2.2, 0.62], [-2.2, 0.2]], -0.86, 0.86, main);
    for (const side of [-1, 1]) {
      add(new THREE.CylinderGeometry(0.21, 0.21, 0.42, 10), main, { position: [side * 0.86, 0.41, -2.34] });
      add(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 8), RED, { position: [side * 0.86, 0.5, -2.5], rotation: [HALF_PI, 0, 0] });
    }
    for (const y of [0.3, 0.44]) box(1.72, 0.045, 0.05, accent, [0, y, -2.565]);             // faixas
    for (let i = -3; i <= 3; i++) box(0.05, 0.2, 0.05, i % 2 ? accent : DARK, [i * 0.2, 0.37, -2.58], [0, 0, 0.5]);   // chevrons
    prism([[2.2, 0.2], [2.54, 0.22], [2.5, 0.54], [2.2, 0.58]], -0.84, 0.84, main);
    box(1.4, 0.05, 0.05, RED, [0, 0.42, 2.57]);
    box(1.4, 0.04, 0.05, accent, [0, 0.32, 2.57]);
  },
};

export function createBumper(kind, mainColor, accentColor = 0xd8b840) {
  const parts = createPartSet();
  (DESIGNS[kind] ?? DESIGNS.stock)(parts, { main: mainColor, accent: accentColor });
  parts.group.userData.dispose = parts.dispose;
  return parts.group;
}

export const disposeBumper = group => group.userData.dispose?.();
