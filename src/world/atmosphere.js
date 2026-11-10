import * as THREE from 'three';
import { pixelTexture } from './textures.js';

// Céu pintado e clima de cada bioma. O domo acompanha o carro; as partículas giram numa caixa ao redor dele.

const SKY_RADIUS = 360, SKY_WIDTH = 512, SKY_HEIGHT = 256;
const BOX = { x: 70, y: 36, z: 70 }, MAX_PARTICLES = 700;

export function createAtmosphere(scene) {
  const domeMaterial = new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, depthWrite: false });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 16, 12), domeMaterial);
  dome.renderOrder = -1;
  scene.add(dome);

  const positions = new Float32Array(MAX_PARTICLES * 3), colors = new Float32Array(MAX_PARTICLES * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, fog: false }));
  points.frustumCulled = false;
  scene.add(points);

  // Chuva: um traço vertical por gota, em vez de um ponto.
  const streakPositions = new Float32Array(MAX_PARTICLES * 6);
  const streakGeometry = new THREE.BufferGeometry();
  streakGeometry.setAttribute('position', new THREE.BufferAttribute(streakPositions, 3));
  const streakMaterial = new THREE.LineBasicMaterial({ fog: false, transparent: true, opacity: 0.55 });
  const streaks = new THREE.LineSegments(streakGeometry, streakMaterial);
  streaks.frustumCulled = false;
  scene.add(streaks);

  const offsets = new Float32Array(MAX_PARTICLES * 3), sway = new Float32Array(MAX_PARTICLES);
  let weather = null, time = 0, active = 0;
  const tint = new THREE.Color();

  function setBiome(biome) {
    const canvas = document.createElement('canvas');
    canvas.width = SKY_WIDTH;
    canvas.height = SKY_HEIGHT;
    biome.paintSky(canvas.getContext('2d'), SKY_WIDTH, SKY_HEIGHT);
    domeMaterial.map?.dispose();
    domeMaterial.map = pixelTexture(canvas);
    domeMaterial.needsUpdate = true;

    weather = biome.weather;
    active = Math.min(weather.count, MAX_PARTICLES);
    points.material.size = weather.size ?? 2;
    points.visible = !weather.streak;
    streaks.visible = Boolean(weather.streak);
    streakMaterial.color.setHex(weather.colors[0]);
    for (let i = 0; i < active; i++) {
      offsets.set([Math.random() * BOX.x, Math.random() * BOX.y, Math.random() * BOX.z], i * 3);
      sway[i] = Math.random() * Math.PI * 2;
      tint.setHex(weather.colors[Math.floor(Math.random() * weather.colors.length)]);
      colors.set([tint.r, tint.g, tint.b], i * 3);
    }
    geometry.attributes.color.needsUpdate = true;
    geometry.setDrawRange(0, active);
    streakGeometry.setDrawRange(0, active * 2);
  }

  function update(dt, x, y, z) {
    dome.position.set(x, y, z);
    if (!weather) return;
    time += dt;
    const wrap = (value, size) => ((value % size) + size) % size - size / 2;
    for (let i = 0; i < active; i++) {
      offsets[i * 3 + 1] -= weather.fall * dt;
      const swing = Math.sin(time * weather.swaySpeed + sway[i]) * weather.sway;
      positions[i * 3] = x + wrap(offsets[i * 3] - x, BOX.x) + swing;
      positions[i * 3 + 1] = y + wrap(offsets[i * 3 + 1], BOX.y) + BOX.y * 0.35;
      positions[i * 3 + 2] = z + wrap(offsets[i * 3 + 2] - z, BOX.z);
      if (weather.streak) {
        streakPositions.set([positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2], positions[i * 3], positions[i * 3 + 1] + weather.streak, positions[i * 3 + 2]], i * 6);
      }
    }
    geometry.attributes.position.needsUpdate = true;
    streakGeometry.attributes.position.needsUpdate = true;
  }

  // No escuro (caverna, túnel) a chuva e a neve somem: elas ignoram a neblina e acenderiam o breu.
  function setWeatherVisible(visible) {
    points.visible = visible && Boolean(weather) && !weather.streak;
    streaks.visible = visible && Boolean(weather?.streak);
  }

  return { setBiome, update, setWeatherVisible };
}

// Ajudas para pintar céu: gradiente até a cor do horizonte (`sky` do bioma) e uma serra no meio da altura.
export function paintGradient(ctx, width, height, stops) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height / 2);
  for (const [at, color] of stops) gradient.addColorStop(at, color);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

export function paintSilhouette(ctx, width, height, color, peaks, amplitude, base = 0) {
  ctx.fillStyle = color;
  const horizon = height / 2;
  for (let x = 0; x < width; x++) {
    const h = base + Math.abs(Math.sin(x * peaks * 2 * Math.PI / width) + 0.5 * Math.sin(x * peaks * 5.3 * Math.PI / width + 1.7)) * amplitude;
    ctx.fillRect(x, Math.floor(horizon - h), 1, Math.ceil(h) + 2);
  }
}

export function paintStars(ctx, width, height, color, amount) {
  ctx.fillStyle = color;
  for (let i = 0; i < amount; i++) ctx.fillRect(Math.floor(Math.random() * width), Math.floor(Math.random() * height * 0.42), 1, 1);
}
