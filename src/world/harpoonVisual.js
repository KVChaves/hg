import * as THREE from 'three';

// O arpão na pista: a ponta e o cabo que a liga à frente do carro.

export function createHarpoonVisual(scene) {
  const cable = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 1), new THREE.MeshBasicMaterial({ color: 0x5a5048, fog: false }));
  const shape = new THREE.ConeGeometry(0.26, 1, 6);
  shape.rotateX(Math.PI / 2);                        // a ponta aponta para z positivo, como `lookAt` espera
  const tip = new THREE.Mesh(shape, new THREE.MeshBasicMaterial({ color: 0xe8ecf4, fog: false }));
  cable.visible = tip.visible = false;
  scene.add(cable, tip);
  const from = new THREE.Vector3(), to = new THREE.Vector3();
  const slack = new THREE.Color(0x5a5048), strained = new THREE.Color(0xff3a20);

  return {
    // 0 a 1: o cabo vai do marrom ao vermelho quando está para esticar demais.
    setTension(level) { cable.material.color.copy(slack).lerp(strained, level); },
    hide() { cable.visible = tip.visible = false; },
    // Pontos em metros: `start` é a frente do carro, `end` a ponta do arpão.
    show(startX, startY, startZ, endX, endY, endZ) {
      from.set(startX, startY, startZ);
      to.set(endX, endY, endZ);
      cable.visible = tip.visible = true;
      cable.position.copy(from).lerp(to, 0.5);
      cable.scale.z = Math.max(0.01, from.distanceTo(to));
      cable.lookAt(to);
      tip.position.copy(to);
      tip.lookAt(to.x + (to.x - from.x), to.y + (to.y - from.y), to.z + (to.z - from.z));
    },
  };
}
