import * as THREE from 'three';
import { TRACK_WIDTH } from '../config.js';
import { createMapLayout } from '../game/mapLayout.js';
import { createAtmosphere } from './atmosphere.js';
import { buildTunnels } from './tunnels.js';
import { buildWalls } from './walls.js';
import { buildEpicSections } from './epicVisuals.js';
import { buildBeltSites, buildHazardSites, buildStormSites } from './hazardSites.js';
import { createRandom, generateTrack, isOverChasm, surfaceAt, track, trackAt, valleyReach } from './track.js';
import { noiseTexture, pixelTexture, surfaceTexture } from './textures.js';
import { pngNow } from '../cabin/pngPixels.js';

const pngReady = path => Boolean(pngNow(path));

// Cenário de cada corrida: terreno, estrada, largada e objetos do bioma, refeitos a cada mapa novo.

const OPEN_MARGIN = 12;
const KERB_WIDTH = 1.4, SHOULDER_WIDTH = 6, GROUND_MARGIN = 340, GROUND_CELL = 12, GROUND_TILE = 8;

// Faixa ao longo da pista. `skip(k)` deixa um trecho sem faixa (o vão dos saltos, por exemplo).
function stripGeometry(offsetA, offsetB, tileLength, heightA, heightB, skip = () => false) {
  const { count, step, px, pz, tx, tz } = track;
  const pos = new Float32Array((count + 1) * 6), uv = new Float32Array((count + 1) * 4), index = [];
  for (let i = 0; i <= count; i++) {
    const k = i % count, rx = -tz[k], rz = tx[k], a = i * 2, v = i * step / tileLength;
    const ax = px[k] + rx * offsetA, az = pz[k] + rz * offsetA, bx = px[k] + rx * offsetB, bz = pz[k] + rz * offsetB;
    pos.set([ax, heightA(k, ax, az), az, bx, heightB(k, bx, bz), bz], a * 3);
    if (track.roll[k] !== 0) {                       // no tubo a faixa acompanha a estrada girando
      const distance = k * step;
      for (const [offset, at] of [[offsetA, 0], [offsetB, 3]]) {
        const point = surfaceAt(distance, offset);
        pos.set([point.x, point.y, point.z], a * 3 + at);
      }
    }
    uv.set([0, v, 1, v], a * 2);
    if (i < count && !skip(k) && !skip((k + 1) % count)) index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(index);
  return geometry;
}

function trackBounds() {
  const { px, pz } = track;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  px.forEach((x, i) => {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, pz[i]); maxZ = Math.max(maxZ, pz[i]);
  });
  return { minX, maxX, minZ, maxZ };
}

function addGround(group, biome, bounds, groundMaterial) {
  const minX = bounds.minX - GROUND_MARGIN, minZ = bounds.minZ - GROUND_MARGIN;
  const width = bounds.maxX + GROUND_MARGIN - minX, depth = bounds.maxZ + GROUND_MARGIN - minZ;
  const nx = Math.ceil(width / GROUND_CELL), nz = Math.ceil(depth / GROUND_CELL);
  const pos = new Float32Array((nx + 1) * (nz + 1) * 3), uv = new Float32Array((nx + 1) * (nz + 1) * 2), index = [];
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = minX + width * i / nx, z = minZ + depth * j / nz, v = j * (nx + 1) + i;
      pos.set([x, track.meshHeightAt(x, z), z], v * 3);
      uv.set([x / GROUND_TILE, z / GROUND_TILE], v * 2);
      if (i < nx && j < nz) index.push(v, v + nx + 1, v + 1, v + 1, v + nx + 1, v + nx + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(index);
  group.add(new THREE.Mesh(geometry, groundMaterial));
}

function roadTexture({ base, variation, edge, center, paint, image, shade }) {
  const asphalt = surfaceTexture({ base, variation, image, shade });
  const ctx = asphalt.image.getContext('2d');
  if (!image || !pngReady(image)) paint?.(ctx);
  ctx.fillStyle = edge; ctx.fillRect(2, 0, 2, 64); ctx.fillRect(60, 0, 2, 64);
  ctx.fillStyle = center; ctx.fillRect(31, 0, 2, 32);
  asphalt.needsUpdate = true;
  return asphalt;
}

// Borda da pista: lista de duas cores (listras) ou `{ paint(ctx, size) }` para uma imagem própria do bioma.
// A imagem se repete a cada 4 m ao longo da pista.
function kerbTexture(kerb) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (Array.isArray(kerb)) {
    canvas.width = 2; canvas.height = 8;
    ctx.fillStyle = kerb[0]; ctx.fillRect(0, 0, 2, 4);
    ctx.fillStyle = kerb[1]; ctx.fillRect(0, 4, 2, 4);
  } else {
    canvas.width = canvas.height = 16;
    kerb.paint(ctx, 16);
  }
  const texture = pixelTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// Encostas do vale, de cada lado da estrada até além da borda, numa malha fina que segue a curva do perfil.
// Sem acostamento: a primeira coluna começa colada na beira da estrada, na altura do chão dela.
const VALLEY_COLUMN = 2, VALLEY_OVERLAP = 12;
function valleyGeometry(side) {
  const { count, step, px, py, pz, tx, tz, lift, drop, bed } = track, floor = track.valley.floor;
  const columns = Math.ceil((valleyReach() + VALLEY_OVERLAP - floor) / VALLEY_COLUMN), rowSize = columns + 1;
  const pos = new Float32Array((count + 1) * rowSize * 3), uv = new Float32Array((count + 1) * rowSize * 2), index = [];
  for (let i = 0; i <= count; i++) {
    const k = i % count;
    for (let c = 0; c <= columns; c++) {
      const lateral = side * (floor + c * VALLEY_COLUMN), x = px[k] - tz[k] * lateral, z = pz[k] + tx[k] * lateral, v = i * rowSize + c;
      pos.set([x, c === 0 ? py[k] - lift[k] : track.heightAt(x, z), z], v * 3);
      uv.set([lateral / 8, i * step / 8], v * 2);
      const next = (k + 1) % count;
      if (i < count && c < columns && !drop[k] && !drop[next] && !bed[k] && !bed[next]) {
        if (side > 0) index.push(v, v + rowSize, v + 1, v + 1, v + rowSize, v + rowSize + 1);
        else index.push(v, v + 1, v + rowSize, v + 1, v + rowSize + 1, v + rowSize);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(index);
  return geometry;
}

function addRoad(group, biome, groundMaterial) {
  const { py } = track, half = TRACK_WIDTH / 2, outer = half + KERB_WIDTH;
  const offset = n => ({ polygonOffset: true, polygonOffsetFactor: n, polygonOffsetUnits: n });
  const roadMaterial = new THREE.MeshBasicMaterial({ map: roadTexture(biome.road), side: THREE.DoubleSide, ...offset(-2) });
  const kerbMaterial = new THREE.MeshBasicMaterial({ map: kerbTexture(biome.kerb), side: THREE.DoubleSide, ...offset(-3) });

  const roadY = k => py[k], kerbY = k => py[k] + 0.005, groundY = (k, x, z) => track.heightAt(x, z);
  const isGap = k => track.gap[k] === 1 || track.bridge[k] === 1, overChasm = k => track.drop[k] > 0 || track.bed[k] > 0 || track.lift[k] > 0;   // a rampa é de pedra e a ponte, de gelo (desenhadas em epicVisuals): sem estrada comum nem barranco
  group.add(new THREE.Mesh(stripGeometry(-half, half, 10, roadY, roadY, isGap), roadMaterial));
  if (track.valley) {                                // vale: sem zebra nem acostamento, a terra sobe direto da estrada
    for (const side of [-1, 1]) group.add(new THREE.Mesh(valleyGeometry(side), groundMaterial));
    return;
  }
  group.add(new THREE.Mesh(stripGeometry(-outer, -half, 4, kerbY, kerbY, isGap), kerbMaterial));
  group.add(new THREE.Mesh(stripGeometry(half, outer, 4, kerbY, kerbY, isGap), kerbMaterial));
  // Faixa de terra que desce da beira da estrada até o terreno, para não sobrar degrau.
  group.add(new THREE.Mesh(stripGeometry(-outer - SHOULDER_WIDTH, -outer, 3, groundY, roadY, overChasm), groundMaterial));
  group.add(new THREE.Mesh(stripGeometry(outer, outer + SHOULDER_WIDTH, 3, roadY, groundY, overChasm), groundMaterial));
}

function addStartLine(group, biome) {
  const canvas = document.createElement('canvas');
  canvas.width = 16; canvas.height = 4;
  const ctx = canvas.getContext('2d');
  for (let y = 0; y < 4; y++) for (let x = 0; x < 16; x++) {
    ctx.fillStyle = (x + y) & 1 ? '#e8e0d4' : '#141010';
    ctx.fillRect(x, y, 1, 1);
  }

  const t = trackAt(0), yaw = Math.atan2(-t.tx, -t.tz);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(TRACK_WIDTH, 2.4),
    new THREE.MeshBasicMaterial({ map: pixelTexture(canvas), polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  line.position.set(t.x, t.y + 0.02, t.z);
  line.rotation.set(-Math.PI / 2, 0, yaw);
  group.add(line);

  const gantry = new THREE.Group();
  gantry.position.set(t.x, t.y, t.z);
  gantry.rotation.y = yaw;
  const postX = TRACK_WIDTH / 2 + 2.5, span = TRACK_WIDTH + 5.8;
  if (typeof biome.gantry === 'function') {          // arco de chegada próprio do bioma (world/biomes/finishGates.js)
    biome.gantry(gantry, { postX, span });
  } else {
    const box = (w, h, d, x, y, color) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color }));
      mesh.position.set(x, y, 0);
      gantry.add(mesh);
    };
    const [post, banner, trim] = biome.gantry;
    box(0.8, 8, 0.8, -postX, 4, post);
    box(0.8, 8, 0.8, postX, 4, post);
    box(span, 1.4, 1, 0, 8, banner);
    box(span, 0.3, 1.1, 0, 7.2, trim);
  }
  group.add(gantry);
}

function spotChecker() {
  const { count, px, pz } = track;
  return (x, z, clearance) => {
    const limit = clearance * clearance;
    for (let k = 0; k < count; k += 2) {
      const dx = x - px[k], dz = z - pz[k];
      if (dx * dx + dz * dz < limit) return false;
    }
    return true;
  };
}

// Trechos sem túnel nem parte épica, onde cabem enfeites na beira ou por cima da pista.
function openCheck({ tunnels, epics }) {
  const inside = (d, start, length) => {
    const offset = ((d - start) % track.length + track.length) % track.length;
    return offset < length || offset > track.length - OPEN_MARGIN;
  };
  return d => ![...tunnels, ...epics].some(t => inside(d, t.start - OPEN_MARGIN, t.length + OPEN_MARGIN * 2));
}

function disposeGroup(group) {
  group.traverse(object => {
    object.geometry?.dispose();
    object.material?.map?.dispose();
    object.material?.dispose();
    object.dispose?.();
  });
}

export function createWorldScene() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, 15, 230);
  const atmosphere = createAtmosphere(scene);
  let content = null, time = 0, biomeAnimations = [], currentBiome = null;
  const stormColor = new THREE.Color(), daySky = new THREE.Color(), black = new THREE.Color(0x000000);

  // Gera pista e cenário novos com o bioma pedido.
  scene.buildMap = (biome, seed) => {
    if (content) {
      scene.remove(content);
      disposeGroup(content);
    }
    generateTrack(seed, biome.shape);
    const layout = createMapLayout(biome.layout, seed);   // define também o relevo dos saltos, antes de desenhar o chão
    content = new THREE.Group();
    scene.add(content);

    currentBiome = biome;
    scene.background = new THREE.Color(biome.sky);
    scene.fog.color.setHex(biome.sky);
    [scene.fog.near, scene.fog.far] = biome.fog;

    atmosphere.setBiome(biome);
    const texture = surfaceTexture(biome.ground);
    if (!biome.ground.image || !pngReady(biome.ground.image)) biome.ground.paint?.(texture.image.getContext('2d'));
    const groundMaterial = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
    const bounds = trackBounds();
    addGround(content, biome, bounds, groundMaterial);
    addRoad(content, biome, groundMaterial);
    addStartLine(content, biome);

    buildTunnels(content, layout, biome.tunnel);
    biomeAnimations = [];
    buildEpicSections(content, layout, biome, animation => biomeAnimations.push(animation));
    buildWalls(content, layout, biome.wall);
    buildHazardSites(content, layout, animation => biomeAnimations.push(animation));
    buildStormSites(content, layout, animation => biomeAnimations.push(animation));
    buildBeltSites(content, layout, animation => biomeAnimations.push(animation));
    biome.addProps({
      onUpdate: animation => biomeAnimations.push(animation), group: content, random: createRandom(seed + 2), bounds, heightAt: track.heightAt, spotIsClear: (() => { const isClear = spotChecker(); return (x, z, distance) => isClear(x, z, distance) && !isOverChasm(x, z); })(), isOpen: openCheck(layout),
    });
    return layout;
  };

  // Escuridão de 0 (dia do bioma) a 1 (breu do trecho escuro). `fog` é a neblina [perto, longe] lá dentro: tudo
  // que não brilha some no preto a essa distância do olho, como se só os faróis iluminassem.
  // Tempestade de areia: tinge a neblina com a cor dela e a aperta até quase tapar a pista. Chame antes de setDarkness.
  let stormLevel = 0, stormZone = null;
  scene.setStorm = (level, zone) => {
    stormLevel = level;
    stormZone = zone;
    atmosphere.setStorm(level, zone?.wind ?? 0);
  };

  scene.setDarkness = (level, fog) => {
    if (!currentBiome) return;
    const [near, far] = currentBiome.fog;
    daySky.setHex(currentBiome.sky);
    scene.fog.color.copy(daySky).lerp(black, level);
    scene.background.copy(scene.fog.color);
    scene.fog.near = level > 0 ? near + (fog[0] - near) * level : near;
    scene.fog.far = level > 0 ? far + (fog[1] - far) * level : far;
    if (stormLevel > 0 && stormZone) {
      scene.fog.color.lerp(stormColor.setHex(stormZone.color), stormLevel);
      scene.background.copy(scene.fog.color);
      scene.fog.near += (stormZone.fog[0] - scene.fog.near) * stormLevel;
      scene.fog.far += (stormZone.fog[1] - scene.fog.far) * stormLevel;
    }
    atmosphere.setWeatherVisible(level < 0.3);
  };

  // Anima céu, clima e bioma em volta da posição (x, y, z) do carro.
  scene.updateMap = (dt, x, y, z) => {
    time += dt;
    atmosphere.update(dt, x, y, z);
    for (const animate of biomeAnimations) animate(time);
  };
  return scene;
}
