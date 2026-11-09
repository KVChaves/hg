import * as THREE from 'three';

// Efeitos de combate dos adversários na pista: rastro das balas, clarão no carro e explosões.

const SHOT_POOL = 10, EXPLOSION_POOL = 6;
const SHOT_LIFE = 0.06, EXPLOSION_LIFE = 0.55, EXPLOSION_START_SIZE = 1.5, EXPLOSION_GROWTH = 6;

const glowing = color => new THREE.MeshBasicMaterial({ color, fog: false });

export function createCombatVisuals(scene) {
  const tracerShape = new THREE.BoxGeometry(0.06, 0.06, 1);
  const flashShape = new THREE.BoxGeometry(0.4, 0.4, 0.4);
  const fireShape = new THREE.IcosahedronGeometry(1, 1);

  const hidden = mesh => { mesh.visible = false; scene.add(mesh); return mesh; };
  const shots = Array.from({ length: SHOT_POOL }, () => ({
    tracer: hidden(new THREE.Mesh(tracerShape, glowing(0xffd890))),
    flash: hidden(new THREE.Mesh(flashShape, glowing(0xffe080))),
    life: 0,
  }));
  const explosions = Array.from({ length: EXPLOSION_POOL }, () => ({
    mesh: hidden(new THREE.Mesh(fireShape, glowing(0xffc040))), age: EXPLOSION_LIFE,
  }));

  function showShot(from, to) {
    const shot = shots.reduce((oldest, candidate) => (candidate.life < oldest.life ? candidate : oldest));
    shot.life = SHOT_LIFE;
    shot.tracer.position.copy(from).lerp(to, 0.5);
    shot.tracer.scale.z = from.distanceTo(to);
    shot.tracer.lookAt(to);
    shot.tracer.visible = true;
    shot.flash.position.copy(from);
    shot.flash.visible = true;
  }

  function explode(x, y, z) {
    const explosion = explosions.reduce((oldest, candidate) => (candidate.age > oldest.age ? candidate : oldest));
    explosion.age = 0;
    explosion.mesh.position.set(x, y + 1.2, z);
    explosion.mesh.visible = true;
  }

  function update(dt) {
    for (const shot of shots) {
      if (shot.life <= 0) continue;
      shot.life -= dt;
      if (shot.life <= 0) shot.tracer.visible = shot.flash.visible = false;
    }
    for (const explosion of explosions) {
      if (!explosion.mesh.visible) continue;
      explosion.age += dt;
      const progress = explosion.age / EXPLOSION_LIFE;
      explosion.mesh.visible = progress < 1;
      explosion.mesh.scale.setScalar(EXPLOSION_START_SIZE + progress * EXPLOSION_GROWTH);
      explosion.mesh.material.color.setHex(progress < 0.45 ? 0xffc040 : 0xd84a14);
    }
  }

  return { showShot, explode, update };
}
