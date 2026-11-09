import * as THREE from 'three';

// Fumaça e fogo que mostram a vida de cada carro. É só visual: lê o estado dos carros a cada quadro.
// Cada `racer` é { x, z, yaw, vx, vz, health (0 a 1), elevation (metros, ao capotar), visible }.

const SMOKE_POOL = 280, FIRE_POOL = 140;

// Faixas de vida, da mais saudável para a pior; `above` é o limite inferior da faixa.
const STAGES = [
  { above: 0.75, smokeRate: 0 },                                  // saudável
  { above: 0.5, smokeRate: 6, color: 0x8c8882 },                  // pouco dano: cinza
  { above: 0.25, smokeRate: 11, color: 0x1e1b1a },                // médio: preta
  { above: -1, smokeRate: 16, color: 0x161413, burning: true },   // severo: preta e fogo
];
const FIRE_RATE = 13;                                             // chamas por segundo em cada ponto

// Em relação ao centro do carro: x à direita, z positivo para trás.
const HOOD = { x: 0, y: 0.95, z: -1.3 };
const FIRE_POINTS = [
  { x: -0.5, y: 0.95, z: -1.35 }, { x: 0.5, y: 0.95, z: -1.1 }, { x: -0.75, y: 0.75, z: 0.2 },
  { x: 0.75, y: 0.75, z: 0.75 }, { x: 0, y: 0.95, z: 1.75 },
];
const FIRE_POINTS_PER_CAR = 3;
const INHERITED_SPEED = 0.35;                                     // a fumaça fica para trás do carro

const SMOKE_LIFE = [0.9, 1.5], SMOKE_RISE = [1.5, 2.6], SMOKE_START_SIZE = 0.2, SMOKE_GROWTH = 0.5, SMOKE_SPREAD = 0.5;
const FIRE_LIFE = [0.22, 0.42], FIRE_RISE = [2.4, 3.8], FIRE_START_SIZE = 0.3, FIRE_SPREAD = 0.2;
const FIRE_COLORS = [0xd83a10, 0xff8a20, 0xffd860];              // do fim para o começo da chama

const random = ([low, high]) => low + Math.random() * (high - low);

function createPool(scene, size, material) {
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), material, size);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  const color = new THREE.Color(0);
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < size; i++) {
    mesh.setMatrixAt(i, hidden);
    mesh.setColorAt(i, color);
  }
  scene.add(mesh);
  return {
    mesh, color, hidden,
    particles: Array.from({ length: size }, () => ({ life: 0, age: 0, size: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 })),
    next: 0,
    alive: 0,
  };
}

export function createCarDamageEffects(scene, racerCount) {
  const smoke = createPool(scene, SMOKE_POOL, new THREE.MeshBasicMaterial());
  const fire = createPool(scene, FIRE_POOL, new THREE.MeshBasicMaterial({ fog: false }));
  const matrix = new THREE.Matrix4();
  const emitters = Array.from({ length: racerCount }, (_, index) => ({
    smoke: 0, fire: 0,
    // Cada carro pega fogo em lugares diferentes.
    firePoints: Array.from({ length: FIRE_POINTS_PER_CAR }, (__, k) => FIRE_POINTS[(index * 2 + k * 2) % FIRE_POINTS.length]),
  }));

  function spawn(pool, racer, point, spread, life, rise, size) {
    const particle = pool.particles[pool.next];
    pool.next = (pool.next + 1) % pool.particles.length;
    const c = Math.cos(racer.yaw), s = Math.sin(racer.yaw);
    particle.x = racer.x + point.x * c + point.z * s + (Math.random() - 0.5) * spread;
    particle.y = point.y + racer.elevation;
    particle.z = racer.z - point.x * s + point.z * c + (Math.random() - 0.5) * spread;
    particle.vx = racer.vx * INHERITED_SPEED + (Math.random() - 0.5) * spread;
    particle.vy = random(rise);
    particle.vz = racer.vz * INHERITED_SPEED + (Math.random() - 0.5) * spread;
    particle.life = random(life);
    particle.age = 0;
    particle.size = size;
    return pool.next === 0 ? pool.particles.length - 1 : pool.next - 1;
  }

  function emit(racer, emitter, dt) {
    const stage = STAGES.find(candidate => racer.health > candidate.above);
    emitter.smoke += stage.smokeRate * dt;
    for (; emitter.smoke >= 1; emitter.smoke--) {
      const index = spawn(smoke, racer, HOOD, SMOKE_SPREAD, SMOKE_LIFE, SMOKE_RISE, SMOKE_START_SIZE);
      smoke.mesh.setColorAt(index, smoke.color.setHex(stage.color));
      smoke.mesh.instanceColor.needsUpdate = true;
    }
    if (!stage.burning) return;
    emitter.fire += FIRE_RATE * dt * FIRE_POINTS_PER_CAR;
    for (; emitter.fire >= 1; emitter.fire--) {
      const point = emitter.firePoints[Math.floor(Math.random() * FIRE_POINTS_PER_CAR)];
      spawn(fire, racer, point, FIRE_SPREAD, FIRE_LIFE, FIRE_RISE, FIRE_START_SIZE);
    }
  }

  function step(pool, dt, sizeOf, colorOf) {
    let alive = 0;
    pool.particles.forEach((particle, i) => {
      if (particle.life <= 0) return;
      particle.age += dt;
      if (particle.age >= particle.life) {
        particle.life = 0;
        pool.mesh.setMatrixAt(i, pool.hidden);
        alive++;                                         // este quadro ainda precisa enviar a matriz zerada
        return;
      }
      alive++;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.z += particle.vz * dt;
      const size = sizeOf(particle);
      matrix.makeScale(size, size, size).setPosition(particle.x, particle.y, particle.z);
      pool.mesh.setMatrixAt(i, matrix);
      colorOf?.(particle, i);
    });
    if (alive || pool.alive) pool.mesh.instanceMatrix.needsUpdate = true;
    pool.alive = alive;
  }

  const smokeSize = p => p.size + p.age * SMOKE_GROWTH;
  const fireSize = p => p.size * (1 - p.age / p.life * 0.7);
  const fireColor = (p, i) => {
    fire.mesh.setColorAt(i, fire.color.setHex(FIRE_COLORS[Math.min(FIRE_COLORS.length - 1, Math.floor((1 - p.age / p.life) * FIRE_COLORS.length))]));
    fire.mesh.instanceColor.needsUpdate = true;
  };

  function clearPool(pool) {
    pool.particles.forEach((particle, i) => {
      particle.life = 0;
      pool.mesh.setMatrixAt(i, pool.hidden);
    });
    pool.mesh.instanceMatrix.needsUpdate = true;
    pool.alive = 0;
  }

  return {
    reset() {
      clearPool(smoke);
      clearPool(fire);
    },
    update(dt, racers) {
      if (dt <= 0) return;
      racers.forEach((racer, i) => { if (racer.visible) emit(racer, emitters[i], dt); });
      step(smoke, dt, smokeSize);
      step(fire, dt, fireSize, fireColor);
    },
  };
}
