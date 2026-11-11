import * as THREE from 'three';
import { CAR_SHAPES } from './carShapes.js';
import { WHEEL_POSITIONS_Z } from './carLivery.js';
import { createPartSet } from './carShade.js';

// Detalhes de pneu, suspensão e vidro (game/carUpgrades.js). Ficam presos ao carro e à roda, então acompanham a altura e o giro.

const STEEL = 0x9aa0aa, DARK = 0x1a1a1e, RUBBER = 0x141418, LAMP = 0xfff2b0, ORANGE = 0xe07820, WHITE = 0xe8e8ec;
const WHEEL_RADIUS = 0.34, WHEEL_HALF_WIDTH = 0.11;
const HALF_PI = Math.PI / 2;

// ---- Pneus: desenhos na roda (o eixo da roda é x, e o lado de fora é `side`).

const TIRE_DETAILS = {
  street() {},

  // Corrida: letras brancas na lateral e um aro de freio colorido.
  wide({ add }, side, accent) {
    add(new THREE.TorusGeometry(0.29, 0.016, 4, 20), WHITE, { position: [side * (WHEEL_HALF_WIDTH + 0.004), 0, 0], rotation: [0, HALF_PI, 0] });
    add(new THREE.TorusGeometry(0.2, 0.012, 4, 14), accent, { position: [side * (WHEEL_HALF_WIDTH + 0.004), 0, 0], rotation: [0, HALF_PI, 0] });
  },

  // Off-road: garras altas no ombro do pneu, em duas fileiras.
  offroad({ box }) {
    const lugs = 16;
    for (let i = 0; i < lugs; i++) {
      const angle = (i / lugs) * Math.PI * 2, stagger = i % 2 ? 0.05 : -0.05, radius = WHEEL_RADIUS + 0.025;
      box(0.09, 0.07, 0.06, RUBBER, [stagger, Math.cos(angle) * radius, Math.sin(angle) * radius], [angle, 0, 0]);
    }
  },

  // Run-flat: anel de reforço laranja e parafusos na lateral.
  big({ add, cone }, side) {
    add(new THREE.TorusGeometry(0.27, 0.03, 5, 16), ORANGE, { position: [side * (WHEEL_HALF_WIDTH + 0.006), 0, 0], rotation: [0, HALF_PI, 0] });
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      add(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 6), STEEL, {
        position: [side * (WHEEL_HALF_WIDTH + 0.012), Math.cos(angle) * 0.2, Math.sin(angle) * 0.2], rotation: [0, 0, HALF_PI],
      });
    }
  },

  // Fino (gelo): pinos metálicos espalhados na banda de rodagem.
  slim({ add }) {
    const studs = 18;
    for (let i = 0; i < studs; i++) {
      const angle = (i / studs) * Math.PI * 2, x = (i % 3 - 1) * 0.045, radius = WHEEL_RADIUS + 0.012;
      add(new THREE.ConeGeometry(0.018, 0.05, 4), STEEL, { position: [x, Math.cos(angle) * radius, Math.sin(angle) * radius], rotation: [angle, 0, 0] });
    }
  },
};

// Monta os detalhes de pneu de uma roda; devolve o conjunto para descartar depois.
export function createTireDetails(kind, side, accent) {
  const parts = createPartSet();
  (TIRE_DETAILS[kind] ?? TIRE_DETAILS.street)(parts, side, accent);
  return parts;
}

// ---- Suspensão e vidro: dependem do formato da carroceria.

const SUSPENSION = {
  stock() {},

  // Saias laterais baixas com faixa e abas na frente.
  slammed({ box, prism }, { accent }) {
    for (const side of [-1, 1]) {
      prism([[-0.55, 0.1], [0.65, 0.1], [0.65, 0.24], [-0.55, 0.28]], side * 0.97, side * 0.9 + (side > 0 ? 0.02 : -0.02), DARK);
      box(0.02, 0.025, 1.05, accent, [side * 0.985, 0.2, 0.05]);
    }
  },

  low({ prism }) {
    for (const side of [-1, 1]) prism([[-0.55, 0.15], [0.65, 0.15], [0.65, 0.25], [-0.55, 0.27]], side * 0.96, side * 0.9, DARK);
  },

  // Elevada: protetor de cárter na frente e para-lamas de borracha atrás de cada roda.
  high({ box, prism }) {
    prism([[-2.0, 0.08], [-1.0, 0.08], [-0.9, 0.18], [-2.04, 0.18]], -0.6, 0.6, STEEL);
    for (const side of [-1, 1]) for (const z of WHEEL_POSITIONS_Z) box(0.04, 0.3, 0.26, RUBBER, [side * 0.94, 0.14, z + 0.5]);
  },

  // Rally: tudo da elevada, mais barra de faróis no teto e snorkel lateral.
  lifted(parts, extras) {
    SUSPENSION.high(parts, extras);
    const { box, bar, add } = parts, { greenhouse } = extras.shape, roof = greenhouse.roofFront;
    const y = roof.y + 0.05, z = roof.z + 0.1;
    box(1.1, 0.07, 0.1, DARK, [0, y + 0.03, z]);
    for (const x of [-0.4, -0.2, 0, 0.2, 0.4]) add(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 8), LAMP, { position: [x, y + 0.06, z - 0.07], rotation: [HALF_PI, 0, 0] });
    for (const x of [-0.5, 0.5]) bar([x, roof.y, z], [x, y, z], 0.025, STEEL);
    bar([-0.9, 0.7, -0.4], [-0.9, 1.3, -0.5], 0.05, DARK, { sides: 6 });          // snorkel
  },
};

const GLASS = {
  clear() {},

  // Anti-tinta: pala de sol sobre o para-brisa e calhas de chuva nas janelas.
  light({ box }, { shape }) {
    const { roofFront, roofRear } = shape.greenhouse;
    box(roofFront.width * 2 + 0.04, 0.045, 0.2, DARK, [0, roofFront.y + 0.03, roofFront.z - 0.12], [0.3, 0, 0]);
    for (const side of [-1, 1]) box(0.03, 0.04, roofRear.z - roofFront.z, DARK, [side * (roofFront.width + 0.03), roofFront.y - 0.02, (roofFront.z + roofRear.z) / 2]);
  },

  // Fumê: calhas de chuva mais compridas e um friso cromado na base do vidro.
  medium({ box }, { shape }) {
    const { front, rear, roofFront, roofRear } = shape.greenhouse;
    for (const side of [-1, 1]) {
      box(0.03, 0.04, roofRear.z - roofFront.z + 0.1, DARK, [side * (roofFront.width + 0.03), roofFront.y - 0.02, (roofFront.z + roofRear.z) / 2]);
      box(0.015, 0.025, rear.z - front.z - 0.3, STEEL, [side * (front.width + 0.01), front.y + 0.03, (front.z + rear.z) / 2]);
    }
  },

  // Blindado: barras de reforço cruzando para-brisa e vidro traseiro, com parafusos.
  dark({ bar, add }, { shape }) {
    const { front, roofFront, roofRear, rear } = shape.greenhouse;
    const out = 0.02;
    for (const [lower, upper] of [[front, roofFront], [rear, roofRear]]) {
      const lowY = lower.y + out, topY = upper.y + out;
      for (const side of [-1, 1]) bar([side * lower.width, lowY, lower.z], [side * upper.width, topY, upper.z], 0.03, STEEL, { sides: 5 });
      bar([-lower.width * 0.5, lowY, lower.z], [lower.width * 0.5, topY, upper.z], 0.022, STEEL, { sides: 5 });
      bar([lower.width * 0.5, lowY, lower.z], [-lower.width * 0.5, topY, upper.z], 0.022, STEEL, { sides: 5 });
      for (const side of [-1, 1]) add(new THREE.SphereGeometry(0.035, 5, 4), STEEL, { position: [side * lower.width, lowY, lower.z] });
    }
  },

  // Preto total: colunas pretas largas e película cobrindo a borda do teto.
  black({ bar, box }, { shape }) {
    const { front, roofFront, roofRear, rear } = shape.greenhouse;
    for (const side of [-1, 1]) {
      bar([side * front.width, front.y, front.z], [side * roofFront.width, roofFront.y, roofFront.z], 0.07, DARK, { sides: 4 });
      bar([side * rear.width, rear.y, rear.z], [side * roofRear.width, roofRear.y, roofRear.z], 0.07, DARK, { sides: 4 });
    }
    box(roofFront.width * 2, 0.03, roofRear.z - roofFront.z, DARK, [0, roofFront.y + 0.02, (roofFront.z + roofRear.z) / 2]);
  },
};

// Detalhes presos à carroceria: suspensão e vidro, na forma do modelo escolhido.
export function createBodyAddons({ model, heightKind, glassKind, accent }) {
  const parts = createPartSet(), extras = { shape: CAR_SHAPES[model] ?? CAR_SHAPES.coupe, accent };
  (SUSPENSION[heightKind] ?? SUSPENSION.stock)(parts, extras);
  (GLASS[glassKind] ?? GLASS.clear)(parts, extras);
  return parts;
}
