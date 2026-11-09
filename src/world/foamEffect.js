import * as THREE from 'three';

// Espuma do extintor: flocos brancos que brotam do capô de quem usou e acompanham aquele carro.

const POOL = 90, SPRAY_TIME = 1.6, FLAKES_PER_SECOND = 48;
const HOOD_X = 0.8, HOOD_FRONT = -2.05, HOOD_BACK = -0.75, HOOD_Y = 0.92;   // z negativo é a frente do carro
const LIFE = [0.8, 1.4], RISE = [0.9, 2.1], SPREAD = 0.9, SIZE = [0.1, 0.26], GROW_UNTIL = 0.3, SHRINK_FROM = 0.65;
const SHADES = [0xffffff, 0xf0f2f4, 0xdfe4ea];

const random = ([low, high]) => low + Math.random() * (high - low);

export function createFoamEffect(scene) {
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial(), POOL);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0), matrix = new THREE.Matrix4(), color = new THREE.Color();
  const flakes = Array.from({ length: POOL }, (_, i) => {
    mesh.setMatrixAt(i, hidden);
    mesh.setColorAt(i, color.setHex(SHADES[i % SHADES.length]));
    return { racer: null, life: 0, age: 0, size: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };
  });
  scene.add(mesh);

  const sprays = [];                                 // { racer, left, owed }: um por carro espumando
  let next = 0, alive = 0;

  function spawn(racer) {
    const flake = flakes[next];
    next = (next + 1) % POOL;
    flake.racer = racer;
    flake.x = random([-HOOD_X, HOOD_X]);
    flake.y = HOOD_Y;
    flake.z = random([HOOD_FRONT, HOOD_BACK]);
    flake.vx = (Math.random() - 0.5) * SPREAD;
    flake.vy = random(RISE);
    flake.vz = (Math.random() - 0.5) * SPREAD;
    flake.life = random(LIFE);
    flake.age = 0;
    flake.size = random(SIZE);
  }

  // O floco cresce ao brotar e encolhe no fim, em vez de sumir de repente.
  function sizeOf(flake) {
    const t = flake.age / flake.life;
    if (t < GROW_UNTIL) return flake.size * (0.3 + 0.7 * t / GROW_UNTIL);
    if (t > SHRINK_FROM) return flake.size * (1 - (t - SHRINK_FROM) / (1 - SHRINK_FROM));
    return flake.size;
  }

  return {
    // `racer` é qualquer piloto de race.field.
    spray(racer) {
      const current = sprays.find(spray => spray.racer === racer);
      if (current) current.left = SPRAY_TIME;
      else sprays.push({ racer, left: SPRAY_TIME, owed: 0 });
    },
    reset() {
      sprays.length = 0;
      flakes.forEach((flake, i) => { flake.life = 0; mesh.setMatrixAt(i, hidden); });
      mesh.instanceMatrix.needsUpdate = true;
      alive = 0;
    },
    update(dt) {
      if (dt <= 0 || (sprays.length === 0 && alive === 0)) return;
      for (let i = sprays.length - 1; i >= 0; i--) {
        const spray = sprays[i];
        spray.left -= dt;
        spray.owed += FLAKES_PER_SECOND * dt;
        for (; spray.owed >= 1; spray.owed--) spawn(spray.racer);
        if (spray.left <= 0) sprays.splice(i, 1);
      }
      alive = 0;
      flakes.forEach((flake, i) => {
        if (flake.life <= 0) return;
        flake.age += dt;
        if (flake.age >= flake.life) {
          flake.life = 0;
          mesh.setMatrixAt(i, hidden);
          return;
        }
        alive++;
        flake.x += flake.vx * dt;
        flake.y += flake.vy * dt;
        flake.z += flake.vz * dt;
        const size = sizeOf(flake), car = flake.racer, c = Math.cos(car.yaw), s = Math.sin(car.yaw);
        matrix.makeScale(size, size, size).setPosition(car.wx + flake.x * c + flake.z * s, car.wy + flake.y, car.wz - flake.x * s + flake.z * c);
        mesh.setMatrixAt(i, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
