import * as THREE from 'three';
import { createCarModel } from '../../world/car/carModel.js';
import { VIEW } from '../../config.js';

// Carro do jogador sobre uma plataforma giratória.

const AUTO_SPIN = 0.3;

export function createGarageScene(spec) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14141a);

  const floor = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.4, 0.1, 40), new THREE.MeshBasicMaterial({ color: 0x2a1512 }));
  floor.position.y = -0.05;
  scene.add(floor);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.04, 40), new THREE.MeshBasicMaterial({ color: 0x120a08 }));
  rim.position.y = -0.09;
  scene.add(rim);

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
