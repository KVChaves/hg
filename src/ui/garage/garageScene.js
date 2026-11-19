import * as THREE from 'three';
import { createCarModel } from '../../world/car/carModel.js';
import { VIEW } from '../../config.js';

// Carro do jogador sobre uma plataforma giratória.

const AUTO_SPIN = 0.3;

// Fundo em faixas de cor (sem degradê contínuo, para casar com o pixel art): breu quente em cima,
// brasa perto do chão e um clarão atrás do carro.
const BACKDROP_BANDS = ['#160c09', '#1c0f0b', '#24130d', '#2e170f', '#3a1c10', '#4a2212', '#5c2a14'];
function warmBackdrop() {
  const width = 160, height = 90, canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const glow = Math.max(0, 1 - Math.hypot((x - width / 2) / (width * 0.42), (y - height * 0.62) / (height * 0.5)));
    const level = (y / height) * 0.55 + glow * 0.6 + ((x + y) % 2) * 0.035;     // o xadrez de um pixel faz o pontilhado entre faixas
    ctx.fillStyle = BACKDROP_BANDS[Math.min(BACKDROP_BANDS.length - 1, Math.floor(level * BACKDROP_BANDS.length))];
    ctx.fillRect(x, y, 1, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createGarageScene(spec) {
  const scene = new THREE.Scene();
  scene.background = warmBackdrop();

  const floor = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.4, 0.1, 40), new THREE.MeshBasicMaterial({ color: 0x2a1512 }));
  floor.position.y = -0.05;
  scene.add(floor);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.04, 40), new THREE.MeshBasicMaterial({ color: 0x120a08 }));
  rim.position.y = -0.09;
  scene.add(rim);
  // filete de luz âmbar na beira da plataforma
  const glow = new THREE.Mesh(new THREE.RingGeometry(4.18, 4.4, 48), new THREE.MeshBasicMaterial({ color: 0x6e2c10 }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.002;
  scene.add(glow);

  const model = createCarModel(spec, 11);
  model.group.rotation.y = 2.5;
  scene.add(model.group);

  const camera = new THREE.PerspectiveCamera(30, VIEW.width / VIEW.height, 0.1, 100);
  camera.position.set(0, 3.1, 11);
  camera.lookAt(0, 0.55, 0);

  let dragging = false;

  return {
    apply: nextSpec => model.apply(nextSpec),
    setDragging(active) { dragging = active; },
    rotateBy(angle) { model.group.rotation.y += angle; },
    update(dt) { if (!dragging) model.group.rotation.y += AUTO_SPIN * dt; },
    render(renderer) { renderer.render(scene, camera); },
  };
}
