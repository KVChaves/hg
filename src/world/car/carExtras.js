import * as THREE from 'three';
import { CAR_SHAPES } from './carShapes.js';
import { WHEEL_POSITIONS_Z } from './carLivery.js';
import { createPartSet } from './carShade.js';

// Acessórios só de visual: o que vai no teto (CAR_SLOTS.roof) e o neon embaixo do carro (CAR_SLOTS.neon).
// Nenhum conta como acerto nem muda a colisão.

const DARK = 0x1a1a1e, STEEL = 0x9aa0aa;
const HALF_PI = Math.PI / 2;
const noRaycast = () => {};

// Peças que piscam (giroflex) e brilham (neon) precisam de material próprio; o resto usa o sombreado das peças.
function ownMaterial(materials, options) {
  const material = new THREE.MeshBasicMaterial(options);
  materials.push(material);
  return material;
}

// ---- Teto: tudo é montado sobre o teto do modelo (roofFront/roofRear em CAR_SHAPES).

const ROOF = {
  none() {},

  // Bagageiro: dois trilhos nas bordas do teto e travessas entre eles.
  rack({ parts, roof, color }) {
    const { front, rear, y, halfWidth } = roof, railX = halfWidth - 0.08, top = y + 0.09;
    for (const side of [-1, 1]) {
      parts.bar([side * railX, top, front + 0.05], [side * railX, top, rear - 0.05], 0.025, color, { sides: 5 });
      for (const z of [front + 0.1, rear - 0.1]) parts.box(0.05, 0.09, 0.06, DARK, [side * railX, y + 0.045, z]);
    }
    const crossings = 3;
    for (let i = 0; i < crossings; i++) {
      const z = front + 0.12 + (rear - front - 0.24) * (i / (crossings - 1));
      parts.bar([-railX, top, z], [railX, top, z], 0.02, STEEL, { sides: 4 });
    }
  },

  // Antena fina na traseira do teto com uma bandeirinha na ponta.
  antenna({ parts, roof, color }) {
    const x = -roof.halfWidth + 0.15, z = roof.rear - 0.12, base = roof.y + 0.02;
    parts.box(0.08, 0.04, 0.08, DARK, [x, base, z]);
    parts.bar([x, base, z], [x, base + 0.85, z + 0.12], 0.012, STEEL, { sides: 4 });
    parts.add(new THREE.BoxGeometry(0.02, 0.16, 0.26), color, { position: [x, base + 0.76, z + 0.26], rotation: [0.14, 0, 0] });
  },

  // Barbatana de tubarão no meio do teto, para trás.
  fin({ parts, roof, color }) {
    const { rear, y } = roof;
    parts.prism([[rear - 0.05, y], [rear - 0.55, y], [rear - 0.12, y + 0.24], [rear - 0.04, y + 0.22]], -0.045, 0.045, color);
  },

  // Entrada de ar no teto, logo atrás do para-brisa.
  scoop({ parts, roof, color }) {
    const z = roof.front + 0.32, y = roof.y;
    parts.box(0.5, 0.12, 0.5, color, [0, y + 0.06, z]);
    parts.box(0.4, 0.07, 0.02, DARK, [0, y + 0.07, z - 0.255]);
    parts.box(0.54, 0.025, 0.54, DARK, [0, y + 0.13, z]);
  },

  // Giroflex: base escura e duas lâmpadas que se alternam (a da cor escolhida e uma branca).
  beacon({ parts, roof, color, materials, group }) {
    const z = roof.front + 0.25, y = roof.y + 0.05;
    parts.box(0.7, 0.06, 0.16, DARK, [0, y, z]);
    const lamps = [color, 0xf4f4ff].map((lampColor, i) => {
      const material = ownMaterial(materials, { color: lampColor });
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.13), material);
      lamp.position.set((i ? 1 : -1) * 0.17, y + 0.08, z);
      lamp.raycast = noRaycast;
      group.add(lamp);
      return { lamp, material, lampColor: new THREE.Color(lampColor) };
    });
    const off = new THREE.Color(0x2a2a30);
    lamps[0].lamp.onBeforeRender = () => {
      const phase = Math.floor(performance.now() / 180) % 4;     // pisca-pisca duplo de cada lado
      lamps.forEach(({ material, lampColor }, i) => material.color.copy((i === 0 ? phase < 2 : phase >= 2) && phase % 2 === 0 ? lampColor : off));
    };
  },
};

function roofOf(model) {
  const { roofFront, roofRear } = (CAR_SHAPES[model] ?? CAR_SHAPES.coupe).greenhouse;
  return { front: roofFront.z, rear: roofRear.z, y: Math.max(roofFront.y, roofRear.y), halfWidth: Math.min(roofFront.width, roofRear.width) };
}

export function createRoofAccessory(kind, color, model) {
  const parts = createPartSet(), materials = [];
  (ROOF[kind] ?? ROOF.none)({ parts, roof: roofOf(model), color, materials, group: parts.group });
  return {
    group: parts.group,
    dispose() {
      parts.group.traverse(object => { if (object.material !== undefined && materials.includes(object.material)) object.geometry.dispose(); });
      materials.forEach(material => material.dispose());
      parts.dispose();
    },
  };
}

// ---- Neon: brilho no chão, em faixas de transparência (sem degradê contínuo, para casar com o pixel art).

let glowTexture = null;
function neonTexture() {
  if (glowTexture) return glowTexture;
  const size = 32, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x + 0.5) / size * 2 - 1, dy = (y + 0.5) / size * 2 - 1;
    const edge = Math.max(Math.abs(dx), Math.abs(dy)) * 0.6 + Math.hypot(dx, dy) * 0.4;     // quadrado de cantos arredondados
    const level = Math.floor(Math.max(0, 1 - edge) * 4) / 4;
    ctx.fillStyle = `rgba(255,255,255,${level})`;
    ctx.fillRect(x, y, 1, 1);
  }
  glowTexture = new THREE.CanvasTexture(canvas);
  glowTexture.magFilter = glowTexture.minFilter = THREE.NearestFilter;
  glowTexture.generateMipmaps = false;
  return glowTexture;
}

const NEON_Y = 0.03, WHEEL_X = 0.86;

// `kind`: under (embaixo do carro), wheels (uma poça de luz por roda), pulse (embaixo, pulsando) ou rainbow (embaixo, trocando de cor).
export function createNeon(kind, color) {
  const group = new THREE.Group();
  if (!kind || kind === 'none') return { group, dispose() { group.parent?.remove(group); } };

  const material = new THREE.MeshBasicMaterial({ color, map: neonTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const geometries = [];
  const plate = (width, length, x, z) => {
    const geometry = new THREE.PlaneGeometry(width, length);
    geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -HALF_PI;
    mesh.position.set(x, NEON_Y, z);
    mesh.raycast = noRaycast;
    mesh.renderOrder = 2;
    group.add(mesh);
    return mesh;
  };

  if (kind === 'wheels') {
    for (const z of WHEEL_POSITIONS_Z) for (const side of [-1, 1]) plate(1.0, 1.1, side * WHEEL_X, z);
  } else {
    const main = plate(2.9, 5.6, 0, 0.02);
    if (kind === 'pulse') {
      main.onBeforeRender = () => { material.opacity = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(performance.now() / 260)); };
    } else if (kind === 'rainbow') {
      main.onBeforeRender = () => { material.color.setHSL((performance.now() / 4000) % 1, 1, 0.55); };
    }
  }

  return {
    group,
    dispose() {
      geometries.forEach(geometry => geometry.dispose());
      material.dispose();
      group.parent?.remove(group);
    },
  };
}
