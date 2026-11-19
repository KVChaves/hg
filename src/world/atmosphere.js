import * as THREE from 'three';
import { pixelTexture } from './textures.js';

// Céu pintado e clima de cada bioma. O domo acompanha o carro; as partículas giram numa caixa ao redor dele.

const SKY_RADIUS = 360, SKY_WIDTH = 512, SKY_HEIGHT = 256;
const BOX = { x: 70, y: 36, z: 70 }, MAX_PARTICLES = 700;

export function createAtmosphere(scene) {
  const domeMaterial = new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, depthWrite: false });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 16, 12), domeMaterial);
  dome.renderOrder = -1;
  // O domo é desenhado primeiro e não grava profundidade: o tamanho não muda a imagem. Ele se centra em cada câmera
  // que o desenha (frente, retrovisor, espectador) e encolhe para caber no alcance dela, que muda com a neblina.
  dome.frustumCulled = false;
  const eye = new THREE.Vector3();
  dome.onBeforeRender = (renderer, scene, camera) => {
    const radius = Math.min(SKY_RADIUS, camera.far * 0.9) / SKY_RADIUS;
    eye.setFromMatrixPosition(camera.matrixWorld);
    dome.matrixWorld.makeScale(radius, radius, radius).setPosition(eye);
  };
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

  // Chuva ou neve do clima dinâmico (game/dynamicWeather.js): outra camada de partículas, por cima das do bioma.
  const PRECIP_COUNT = 650;
  const rainPositions = new Float32Array(PRECIP_COUNT * 6), snowPositions = new Float32Array(PRECIP_COUNT * 3);
  const rainGeometry = new THREE.BufferGeometry(), snowGeometry = new THREE.BufferGeometry();
  rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  snowGeometry.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
  const rain = new THREE.LineSegments(rainGeometry, new THREE.LineBasicMaterial({ color: 0xa8b8c8, fog: false, transparent: true, opacity: 0.5 }));
  const snow = new THREE.Points(snowGeometry, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false }));
  for (const layer of [rain, snow]) { layer.frustumCulled = false; layer.visible = false; scene.add(layer); }
  const dropOffsets = new Float32Array(PRECIP_COUNT * 3), dropSway = new Float32Array(PRECIP_COUNT);
  for (let i = 0; i < PRECIP_COUNT; i++) { dropOffsets.set([Math.random() * BOX.x, Math.random() * BOX.y, Math.random() * BOX.z], i * 3); dropSway[i] = Math.random() * Math.PI * 2; }
  let precip = null, precipLevel = 0, precipVisible = true;
  let density = 1;                                   // fração das partículas desenhadas (qualidade gráfica)

  const offsets = new Float32Array(MAX_PARTICLES * 3), sway = new Float32Array(MAX_PARTICLES);
  let weather = null, time = 0, active = 0, storm = 0, wind = 0, gustX = 0, gustZ = 0;
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
    active = Math.round(Math.min(weather.count, MAX_PARTICLES) * density);
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
      offsets[i * 3] -= storm * wind * dt - gustX * dt;   // vento do temporal (e a rajada do cânion) empurra as partículas de lado
      offsets[i * 3 + 2] += gustZ * dt;
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
    updatePrecip(dt, x, y, z);
  }

  const RAIN_FALL = 48, RAIN_STREAK = 2.4, SNOW_FALL = 7, SNOW_SWAY = 2.6;
  function updatePrecip(dt, x, y, z) {
    if (!precip || precipLevel <= 0.01) return;
    const count = Math.ceil(PRECIP_COUNT * precipLevel * density), wrap = (value, size) => ((value % size) + size) % size - size / 2;
    const fall = precip === 'rain' ? RAIN_FALL : SNOW_FALL;
    for (let i = 0; i < count; i++) {
      dropOffsets[i * 3 + 1] -= fall * dt;
      const swing = precip === 'snow' ? Math.sin(time * 1.6 + dropSway[i]) * SNOW_SWAY : 0;
      const px = x + wrap(dropOffsets[i * 3] - x, BOX.x) + swing, py = y + wrap(dropOffsets[i * 3 + 1], BOX.y) + BOX.y * 0.35, pz = z + wrap(dropOffsets[i * 3 + 2] - z, BOX.z);
      if (precip === 'rain') rainPositions.set([px, py, pz, px, py + RAIN_STREAK, pz], i * 6);
      else snowPositions.set([px, py, pz], i * 3);
    }
    const geometryInUse = precip === 'rain' ? rainGeometry : snowGeometry;
    geometryInUse.setDrawRange(0, precip === 'rain' ? count * 2 : count);
    geometryInUse.attributes.position.needsUpdate = true;
  }

  // Clima dinâmico: `kind` é 'rain', 'snow' ou null; `level` de 0 a 1 é quantas gotas ou flocos aparecem. `dim` escurece o céu pintado.
  function setPrecipitation(kind, level, dim = 0) {
    precip = level > 0.01 ? kind : null;
    precipLevel = level;
    rain.visible = precipVisible && precip === 'rain';
    snow.visible = precipVisible && precip === 'snow';
    const shade = 1 - dim * level;
    domeMaterial.color.setRGB(shade, shade, shade);
  }

  // No escuro (caverna, túnel) a chuva e a neve somem: elas ignoram a neblina e acenderiam o breu.
  function setWeatherVisible(visible) {
    precipVisible = visible;
    rain.visible = visible && precip === 'rain';
    snow.visible = visible && precip === 'snow';
    points.visible = visible && Boolean(weather) && !weather.streak;
    streaks.visible = visible && Boolean(weather?.streak);
  }

  // Tempestade (0 a 1): a areia fica mais grossa e corre de lado.
  function setStorm(level, speed = 60) {
    storm = level;
    wind = speed;
    if (weather) points.material.size = (weather.size ?? 2) + level * 2;
  }

  function setGust(x, z) {
    gustX = x;
    gustZ = z;
  }

  // Qualidade gráfica: `value` de 0 a 1. Vale a partir do próximo bioma para a poeira e já para chuva e neve.
  function setDensity(value) { density = value; }

  return { setDensity, setBiome, update, setWeatherVisible, setStorm, setGust, setPrecipitation };
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
