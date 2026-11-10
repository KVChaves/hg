import * as THREE from 'three';

// Faróis e lanternas acesos, para os trechos escuros (caverna, túnel sem luz): ignoram a neblina, então no breu
// são o que se vê dos carros. O facho é um cone translúcido e a mancha de luz no chão, um degradê somado à cena.
// A frente do carro aponta para z negativo.

const FRONT_Z = -2.2, REAR_Z = 2.2, LAMP_X = 0.62, LAMP_Y = 0.68;
const BEAM_LENGTH = 16, BEAM_RADIUS = 3.2, POOL_WIDTH = 7, POOL_LENGTH = 15;

const lampGeometry = new THREE.BoxGeometry(0.34, 0.14, 0.06);
const headMaterial = new THREE.MeshBasicMaterial({ color: 0xfff4c8, fog: false });
const tailMaterial = new THREE.MeshBasicMaterial({ color: 0xff2414, fog: false });
const beamGeometry = new THREE.ConeGeometry(BEAM_RADIUS, BEAM_LENGTH, 12, 1, true);
beamGeometry.translate(0, -BEAM_LENGTH / 2, 0);
beamGeometry.rotateX(-Math.PI / 2);                  // ponta no farol, boca para a frente (z negativo)
const beamMaterial = new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.04, fog: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide });

function poolTexture() {
  const size = 64, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d'), gradient = ctx.createRadialGradient(size / 2, size * 0.7, 2, size / 2, size * 0.55, size / 2);
  gradient.addColorStop(0, 'rgba(255,240,190,0.45)');
  gradient.addColorStop(1, 'rgba(255,240,190,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}
const poolGeometry = new THREE.PlaneGeometry(POOL_WIDTH, POOL_LENGTH);
poolGeometry.rotateX(-Math.PI / 2);
poolGeometry.translate(0, 0.06, FRONT_Z - POOL_LENGTH / 2 + 1);
const poolMaterial = new THREE.MeshBasicMaterial({ map: poolTexture(), transparent: true, fog: false, depthWrite: false, blending: THREE.AdditiveBlending });

// `lamps` e `beams` falsos: só a mancha no chão (a luz do próprio jogador, vista de dentro da cabine).
export function createCarLights({ beams = true, lamps = true } = {}) {
  const group = new THREE.Group();
  for (const side of lamps ? [-1, 1] : []) {
    const head = new THREE.Mesh(lampGeometry, headMaterial);
    head.position.set(side * LAMP_X, LAMP_Y, FRONT_Z - 0.02);
    const tail = new THREE.Mesh(lampGeometry, tailMaterial);
    tail.position.set(side * LAMP_X, LAMP_Y + 0.05, REAR_Z + 0.02);
    group.add(head, tail);
    if (beams) {
      const beam = new THREE.Mesh(beamGeometry, beamMaterial);
      beam.position.set(side * LAMP_X, LAMP_Y, FRONT_Z);
      beam.rotation.x = -0.06;                        // o facho mira um pouco para baixo
      group.add(beam);
    }
  }
  group.add(new THREE.Mesh(poolGeometry, poolMaterial));
  group.visible = false;
  return { group, setOn(on) { group.visible = on; } };
}
