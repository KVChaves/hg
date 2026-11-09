import * as THREE from 'three';
import { pixelTexture } from '../../world/textures.js';
import { HALF_HEIGHT as HH, HALF_WIDTH as HW } from '../sprite.js';
import { paintFront, paintFrontSkirt } from './front.js';
import { paintCeiling, paintLeftWall, paintRightWall } from './sides.js';

// A cabeça do piloto só gira em torno do olho, então a cabine é um "cenário pintado" ao redor dele:
// paredes cuja frente coincide com o enquadramento da tela. Fica idêntica à pintura com a cabeça
// centrada. Os limites do olhar (LOOK em config.js) impedem ver atrás de BACK_Z e abaixo de BOTTOM_Y.

const FRONT_Z = -1, BACK_Z = 1.1, BOTTOM_Y = -1.3;
const LENGTH = BACK_Z - FRONT_Z, MID_Z = (FRONT_Z + BACK_Z) / 2;
const WALL_HEIGHT = HH - BOTTOM_Y, WALL_MID_Y = (HH + BOTTOM_Y) / 2;
const SKIRT_HEIGHT = -HH - BOTTOM_Y;

const materials = [];

function panel(parent, canvas, width, height, position, rotation) {
  const material = new THREE.MeshBasicMaterial({ map: pixelTexture(canvas), alphaTest: 0.5 });
  materials.push(material);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  parent.add(mesh);
}

export function buildShell(parent) {
  panel(parent, paintFront(), 2 * HW, 2 * HH, [0, 0, FRONT_Z], [0, 0, 0]);
  panel(parent, paintFrontSkirt(), 2 * HW, SKIRT_HEIGHT, [0, -HH - SKIRT_HEIGHT / 2, FRONT_Z], [0, 0, 0]);
  panel(parent, paintLeftWall(), LENGTH, WALL_HEIGHT, [-HW, WALL_MID_Y, MID_Z], [0, Math.PI / 2, 0]);
  panel(parent, paintRightWall(), LENGTH, WALL_HEIGHT, [HW, WALL_MID_Y, MID_Z], [0, -Math.PI / 2, 0]);
  panel(parent, paintCeiling(), 2 * HW, LENGTH, [0, HH, MID_Z], [Math.PI / 2, 0, 0]);
}

// Camadas logo atrás das paredes laterais, visíveis só pelos recortes das janelas.
// Cada `canvases[i]` cobre a largura da parede e vai do topo até `canvasHeight` (de `wall.height` pixels).
export function addSideGlass(parent, canvases, wall, canvasHeight) {
  const height = WALL_HEIGHT * canvasHeight / wall.height;
  const centerY = HH - height / 2;
  const OUTSIDE_WALL = 0.02;
  const textures = canvases.map(canvas => pixelTexture(canvas));
  const meshes = textures.map((map, i) => {
    const side = i === 0 ? -1 : 1;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(LENGTH, height), new THREE.MeshBasicMaterial({ map, alphaTest: 0.5 }));
    mesh.position.set(side * (HW + OUTSIDE_WALL), centerY, MID_Z);
    mesh.rotation.y = -side * Math.PI / 2;
    mesh.visible = false;
    parent.add(mesh);
    return mesh;
  });
  return {
    refresh() { for (const texture of textures) texture.needsUpdate = true; },
    setVisible(visible) { for (const mesh of meshes) mesh.visible = visible; },
  };
}

// Muda a cor do interior multiplicando a pintura inteira.
// A cor escolhida na garagem e a luz do ambiente se multiplicam.
let shellTint = [1, 1, 1], shellAmbient = new THREE.Color(0xffffff);

function applyShellColor() {
  const [r, g, b] = shellTint;
  for (const material of materials) material.color.setRGB(r * shellAmbient.r, g * shellAmbient.g, b * shellAmbient.b);
}

export function setShellTint(tint) {
  shellTint = tint;
  applyShellColor();
}

export const isShellMaterial = material => materials.includes(material);

export function setShellAmbient(hex) {
  shellAmbient.setHex(hex);
  applyShellColor();
}
