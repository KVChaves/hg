import * as THREE from 'three';
import { paintGradient, paintSilhouette } from '../atmosphere.js';
import { pixelTexture } from '../textures.js';
import { track } from '../track.js';
import { alongRoad, EDGE, solid } from './propKit.js';
import { enableCulling } from '../instancing.js';
import { coneGeometry, palmTree, shadedPart } from './plants.js';
import { pirateGate } from './finishGates.js';
import { pirateShip } from '../pirateShip.js';

// Porto dos Piratas ao entardecer: a pista inteira é um píer de tábuas sobre palafitas, com mar dos dois lados.
// Navios piratas ficam atracados colados no píer e ancorados por todo o mar, com botes em volta; faróis em
// ilhotas de pedra. Os desafios: pontes de corda sem mureta (quem sai pela beirada cai no mar), os canhões dos
// navios atracados atirando na pista (a sombra avisa onde a bala cai), barris que escapam dos atracadouros de carga
// e atravessam rolando e a maré alta que alaga um trecho do píer.

const SEA_BELOW_ROAD = 1.8;                          // o mar fica esse tanto abaixo do ponto mais baixo do píer
// O deque passa da cerca (a cerca fica em EDGE + meia largura de carro) por uma calçada estreita de tábuas.
const PIER_DECK = EDGE + 1.05 + 2.4, PIER_DEPTH = 9;

export const PIRATE_PORT = {
  id: 'piratePort', name: 'PORTO DOS PIRATAS', music: 'piratePort',
  challenge: ['CANHOES ATIRAM NA PISTA: SAIA DE CIMA DA SOMBRA', 'PONTES DE CORDA SEM MURETA E MARE ALTA NO CAIS'],
  sky: 0xe8a070, fog: [26, 260], cabinTint: 0xffd8b0,
  // Píer quase plano serpenteando pelo mar, com curvas longas e algumas fechadas.
  shape: { wiggle: 0.26, targetLength: 2400, relief: 2, hillScale: 220, sharpCurves: 2, harmonics: [[2, 0.8], [3, 0.5], [5, 0.2]], stretch: [1.15, 0.85], pier: { deck: PIER_DECK, depth: PIER_DEPTH } },
  surface: { grip: 0.97, side: 0.92, drag: 0.02, offroad: 1.5 },   // tábuas gastas e úmidas: um pouco menos de aderência
  layout: {
    jump: { fallLabel: 'CAIU NO MAR', below: 1.2 },
    // Pontes de corda e tábua sobre os canais, sem mureta e baixas sobre o mar.
    bridge: [
      { length: 110, below: 7, icy: false, style: 'wood', fallLabel: 'CAIU NO MAR' },
      { length: 90, below: 7, icy: false, style: 'wood', fallLabel: 'CAIU NO MAR' },
    ],
    // Maré alta: a água do mar cobre o cais num trecho e as tábuas molhadas quase não seguram.
    storm: { length: 230, label: 'MARE ALTA', color: 0x9ac0c8, fog: [14, 110], wind: 10, grip: 0.66, flooded: true, waterColor: '#2a7a9a' },
    hazards: [{ kind: 'cannonFire', count: 3 }, { kind: 'barrelRoll', count: 2 }],
    tunnels: { count: 0 },
  },
  ground: {
    base: [214, 188, 138], variation: 14,
    paint(ctx) {
      ctx.fillStyle = 'rgba(170,140,96,.5)'; for (let i = 0; i < 24; i++) ctx.fillRect(Math.random() * 64, Math.random() * 64, 3 + Math.random() * 8, 1);
      ctx.fillStyle = 'rgba(90,130,60,.55)'; for (let i = 0; i < 18; i++) ctx.fillRect(Math.random() * 64, Math.random() * 64, 1, 2);   // capim da praia
      ctx.fillStyle = 'rgba(110,90,70,.7)'; for (let i = 0; i < 8; i++) ctx.fillRect(Math.random() * 64, Math.random() * 64, 1, 1);    // pedrinhas
    },
  },
  // Tábuas do cais atravessando a pista, gastas, com frestas escuras e pregos; sem faixa pintada.
  road: {
    base: [128, 92, 60], variation: 10, edge: null, center: null,
    paint(ctx) {
      for (let y = 0; y < 64; y += 8) {
        const k = Math.random() * 30 - 15;
        ctx.fillStyle = `rgb(${128 + k | 0},${92 + k * 0.8 | 0},${60 + k * 0.5 | 0})`;
        ctx.fillRect(0, y, 64, 7);
        ctx.fillStyle = '#2a1a0e'; ctx.fillRect(0, y + 7, 64, 1);                 // fresta entre as tábuas
        ctx.fillStyle = 'rgba(60,36,18,.45)'; for (let i = 0; i < 4; i++) ctx.fillRect(Math.random() * 64, y + 1 + Math.random() * 5, 3 + Math.random() * 8, 1);   // veios
        ctx.fillStyle = '#8a8a8a'; for (const x of [4, 22, 41, 59]) ctx.fillRect(x, y + 3, 1, 1);   // pregos
      }
      ctx.fillStyle = 'rgba(40,26,14,.3)'; ctx.fillRect(14, 0, 4, 64); ctx.fillRect(46, 0, 4, 64);   // gasto das rodas
    },
  },
  // Beira de pedra do cais, com argolas de amarrar barco.
  kerb: {
    paint(ctx, n) {
      ctx.fillStyle = '#5a5650'; ctx.fillRect(0, 0, n, n);
      for (let y = 0; y < n; y += 8) { ctx.fillStyle = '#8a857c'; ctx.fillRect(1, y + 1, n - 2, 6); }
      ctx.fillStyle = '#2a2a2e'; ctx.fillRect(6, 3, 3, 1); ctx.fillRect(6, 5, 3, 1); ctx.fillRect(5, 4, 1, 1); ctx.fillRect(9, 4, 1, 1);
    },
  },
  gantry: pirateGate,
  tunnel: { arch: 'timber', rib: 0x4a3018, leaves: 0x2a2018 },
  // Cerca do cais: postes grossos com duas cordas entre eles (vazada: dá para ver o mar).
  wall: {
    height: 1.8, tile: 6,
    paint(ctx, w, h) {
      ctx.clearRect(0, 0, w, h);
      for (let x = 0; x < w; x += 32) {
        ctx.fillStyle = '#4a3018'; ctx.fillRect(x, 2, 6, h - 2);
        ctx.fillStyle = '#6a4a2a'; ctx.fillRect(x + 1, 2, 2, h - 2);
        ctx.fillStyle = '#3a2410'; ctx.fillRect(x - 1, 0, 8, 3);                   // cabeça do poste
      }
      ctx.fillStyle = '#c8a870';
      for (const base of [9, 20]) for (let x = 0; x < w; x++) ctx.fillRect(x, base + Math.round(Math.sin((x % 32) / 32 * Math.PI) * 3), 1, 2);   // corda arqueada
    },
  },
  epic: {
    ramp: { stone: [0x5a3a20, 0x6a4a28, 0x4a3018, 0x7a5430], mortar: 0x2a1a0e, moss: [0x3a6a5a, 0x4a7a6a] },
    abyss: 0x2a8aa8, glow: false, edge: '#f0e0a0',
    tube: { wall: '#6a4a28', speckle: ['#4a3018'], rib: 0x3a2410, portal: 0x5a3a20, lines: [] },
  },
  // Respingos e brilho do sol baixo.
  weather: { count: 220, size: 2, fall: 0.6, sway: 5, swaySpeed: 1.1, colors: [0xffffff, 0xffe0a0, 0xcff0f4] },

  paintSky(ctx, w, h) {
    paintGradient(ctx, w, h, [[0, '#3a3a78'], [0.4, '#c8607a'], [0.75, '#f0a060'], [1, '#e8a070']]);
    ctx.fillStyle = '#ffe0a0';
    ctx.beginPath(); ctx.arc(w * 0.65, h * 0.47, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,210,150,.35)'; ctx.fillRect(w * 0.65 - 50, h * 0.47 + 4, 100, 3);
    ctx.fillStyle = '#2a7090'; ctx.fillRect(0, h / 2 - 2, w, 4);               // linha do mar
    // Silhuetas de navios no horizonte.
    ctx.fillStyle = '#3a2a3a';
    for (const [x, s] of [[0.15, 1], [0.32, 0.7], [0.84, 0.85]]) {
      const cx = w * x, base = h / 2 - 2;
      ctx.fillRect(cx - 14 * s, base - 4 * s, 28 * s, 4 * s);
      for (const m of [-7, 0, 7]) { ctx.fillRect(cx + m * s, base - 22 * s, 1, 18 * s); ctx.fillRect(cx + m * s - 4 * s, base - 18 * s, 8 * s, 8 * s); }
    }
    paintSilhouette(ctx, w, h, '#6a4a5a', 5, 10, 2);                               // ilhas ao longe
  },

  addProps(ctx) {
    const seaLevel = addSea(ctx);
    addShips(ctx, seaLevel);

    // Na calçada de fora da cerca: lanternas, cabeços de amarração e pilhas de barris e caixotes.
    const OUTSIDE = PIER_DECK - 0.7;
    const post = new THREE.CylinderGeometry(0.12, 0.16, 4.2, 5);
    post.translate(0, 2.1, 0);
    const arm = new THREE.BoxGeometry(0.1, 0.1, 1.2);
    arm.translate(0, 4.1, -0.5);
    const lamp = new THREE.BoxGeometry(0.45, 0.6, 0.45);
    lamp.translate(0, 3.6, -1);
    alongRoad(ctx, { every: 30, offset: OUTSIDE, facesRoad: true, parts: [{ geometry: post, material: solid(0x3a2a1a) }, { geometry: arm, material: solid(0x3a2a1a) }, { geometry: lamp, material: solid(0xffc860, { fog: false }) }] });
    const bollard = shadedPart([
      { geometry: new THREE.CylinderGeometry(0.35, 0.4, 0.9, 7).translate(0, 0.45, 0), color: 0x2a2a2e },
      { geometry: new THREE.CylinderGeometry(0.5, 0.5, 0.18, 7).translate(0, 0.95, 0), color: 0x2a2a2e },
      { geometry: new THREE.TorusGeometry(0.42, 0.1, 4, 8).rotateX(Math.PI / 2).translate(0, 0.6, 0), color: 0xc8a870 },   // corda enrolada
    ]);
    alongRoad(ctx, { every: 13, offset: OUTSIDE, parts: [bollard] });
    const cargo = shadedPart([
      { geometry: new THREE.CylinderGeometry(0.6, 0.6, 1.3, 9).translate(0, 0.65, 0), color: 0x7a4a24 },
      { geometry: new THREE.CylinderGeometry(0.62, 0.62, 0.1, 9).translate(0, 0.35, 0), color: 0x3a3a3a },
      { geometry: new THREE.CylinderGeometry(0.6, 0.6, 1.3, 9).translate(0, 0.65, 1.3), color: 0x6a3e1e },
      { geometry: new THREE.BoxGeometry(1.3, 1.3, 1.3).translate(0, 0.65, -1.4), color: 0x9a7038 },
      { geometry: new THREE.BoxGeometry(1.1, 1.1, 1.1).translate(0, 1.85, -1.3), color: 0xa87a40 },
    ]);
    alongRoad(ctx, { every: 47, offset: OUTSIDE, parts: [cargo], sizeOf: random => 0.8 + random() * 0.3 });

    // Botes a remo espalhados pelo mar.
    const boat = shadedPart([
      { geometry: new THREE.BoxGeometry(4.2, 0.8, 1.6).translate(0, 0.4, 0), color: 0x6a4224 },
      { geometry: coneGeometry([0, 0, 0], 0.8, 1.2, 4).rotateZ(-Math.PI / 2).rotateX(Math.PI / 4).translate(2.6, 0.4, 0), color: 0x6a4224 },
      { geometry: new THREE.BoxGeometry(0.3, 0.12, 1.5).translate(-0.6, 0.85, 0), color: 0x8a6a40 },
    ]);
    placeOnSea(ctx, seaLevel - 0.3, 40, 26, [boat]);

    // Ilhotas de pedra com um farol listrado ou um coqueiro torto.
    const rock = shadedPart([
      { geometry: new THREE.DodecahedronGeometry(9, 0).scale(1.4, 0.8, 1.2).translate(0, 0, 0), color: 0x6a645c },
      { geometry: new THREE.DodecahedronGeometry(5, 0).translate(6, 2, 3), color: 0x7a746a },
    ]);
    const lighthouse = shadedPart([
      { geometry: new THREE.CylinderGeometry(2.4, 3.4, 24, 8).translate(0, 17, 0), color: 0xf4f0e8 },
      { geometry: new THREE.CylinderGeometry(2.7, 2.9, 4, 8).translate(0, 14, 0), color: 0xc83a2a },
      { geometry: new THREE.CylinderGeometry(2.7, 2.9, 4, 8).translate(0, 23, 0), color: 0xc83a2a },
      { geometry: coneGeometry([0, 32, 0], 3, 3, 8), color: 0x2a2a2e },
    ]);
    const light = new THREE.CylinderGeometry(2.2, 2.2, 3, 8).translate(0, 30.5, 0);
    placeOnSea(ctx, seaLevel - 2, 3, 70, [rock, lighthouse, { geometry: light, material: solid(0xffe890, { fog: false }) }]);
    const FRONDS = [0x2f8a3a, 0x3aa048, 0x28783a];
    placeOnSea(ctx, seaLevel - 2, 8, 50, [rock, ...palmTree({ height: 9, bend: 2.6, colors: FRONDS }).map(part => ({ ...part, geometry: part.geometry.clone().translate(0, 5, 0) }))]);

    addGulls(ctx, seaLevel);
  },
};

// Põe `count` cópias das peças no mar, a pelo menos `clearance` m da pista, em `y`, viradas ao acaso.
function placeOnSea(ctx, y, count, clearance, parts) {
  const meshes = parts.map(part => new THREE.InstancedMesh(part.geometry, part.material, count));
  const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), euler = new THREE.Euler(), position = new THREE.Vector3(), scale = new THREE.Vector3(1, 1, 1);
  let placed = 0;
  for (let tries = 0; tries < count * 30 && placed < count; tries++) {
    const x = ctx.bounds.minX - 200 + ctx.random() * (ctx.bounds.maxX - ctx.bounds.minX + 400);
    const z = ctx.bounds.minZ - 200 + ctx.random() * (ctx.bounds.maxZ - ctx.bounds.minZ + 400);
    if (!ctx.spotIsClear(x, z, clearance)) continue;
    matrix.compose(position.set(x, y, z), quaternion.setFromEuler(euler.set(0, ctx.random() * Math.PI * 2, 0)), scale);
    meshes.forEach((mesh, m) => { mesh.setMatrixAt(placed, matrix); if (parts[m].colorOf) mesh.setColorAt(placed, new THREE.Color(parts[m].colorOf(ctx.random))); });
    placed++;
  }
  meshes.forEach(mesh => { mesh.count = placed; enableCulling(mesh); ctx.group.add(mesh); });
}

// Gaivotas rodando sobre o mar.
function addGulls(ctx, seaLevel) {
  const wing = new THREE.BoxGeometry(1.8, 0.06, 0.4), white = solid(0xffffff), gulls = [];
  for (let i = 0; i < 18; i++) {
    const gull = new THREE.Group(), left = new THREE.Mesh(wing, white), right = new THREE.Mesh(wing, white);
    left.position.x = -0.9; right.position.x = 0.9;
    gull.add(left, right);
    const k = Math.floor(ctx.random() * track.count);
    gulls.push({ gull, left, right, centerX: track.px[k], centerZ: track.pz[k], radius: 20 + ctx.random() * 40, speed: 0.15 + ctx.random() * 0.15, phase: ctx.random() * 6.28, height: seaLevel + 16 + ctx.random() * 18 });
    ctx.group.add(gull);
  }
  ctx.onUpdate(time => {
    for (const g of gulls) {
      const angle = g.phase + time * g.speed;
      g.gull.position.set(g.centerX + Math.cos(angle) * g.radius, g.height + Math.sin(time + g.phase) * 2, g.centerZ + Math.sin(angle) * g.radius);
      g.gull.rotation.y = -angle;
      g.left.rotation.z = Math.sin(time * 5 + g.phase) * 0.5;
      g.right.rotation.z = -g.left.rotation.z;
    }
  });
}

// O mar: um plano abaixo do píer, em todo o mapa (o fundo fica bem abaixo dele). Devolve a altura dele.
function addSea(ctx) {
  let lowest = Infinity;
  for (let i = 0; i < track.count; i += 4) lowest = Math.min(lowest, track.py[i]);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const art = canvas.getContext('2d');
  art.fillStyle = '#2a7a9a'; art.fillRect(0, 0, 32, 32);
  art.fillStyle = '#4aa0b8'; for (let i = 0; i < 20; i++) art.fillRect(Math.random() * 28, Math.random() * 32, 3 + Math.random() * 4, 1);
  art.fillStyle = '#f8d8a0'; for (let i = 0; i < 6; i++) art.fillRect(Math.random() * 30, Math.random() * 32, 2, 1);   // reflexo do sol
  const texture = pixelTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(240, 240);
  const level = lowest - SEA_BELOW_ROAD;
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: texture }));
  sea.position.set((ctx.bounds.minX + ctx.bounds.maxX) / 2, level, (ctx.bounds.minZ + ctx.bounds.maxZ) / 2);
  ctx.group.add(sea);
  ctx.onUpdate(time => { texture.offset.set(time * 0.01, time * 0.006); });
  return level;
}

// Navios: uns atracados colados no píer (de lado, com a proa no sentido da pista), outros ancorados pelo mar,
// todos balançando nas ondas.
const MOORED = 10, ANCHORED = 12, MOORED_FROM = PIER_DECK + 6.5, MOORED_SPACING = 120;
function addShips(ctx, seaLevel) {
  const designs = [pirateShip(0x1a1a1a), pirateShip(0xe8dcc0), pirateShip(0x8a2a2a)];
  const ships = [], add = (x, z, yaw) => {
    const ship = designs[ships.length % designs.length].clone();
    ship.position.set(x, seaLevel - 0.6, z);
    ship.rotation.y = yaw;
    ship.userData.phase = ctx.random() * Math.PI * 2;
    ctx.group.add(ship);
    ships.push(ship);
  };
  const farFrom = (x, z, gap) => ships.every(other => Math.hypot(other.position.x - x, other.position.z - z) >= gap);
  // Atracados: a borda do casco quase encostada no píer; o lado é sorteado e o ponto tem de estar livre de outros trechos.
  for (let tries = 0; tries < 200 && ships.length < MOORED; tries++) {
    const d = ctx.random() * track.length, k = Math.floor(d / track.step) % track.count;
    if (!ctx.isOpen(d) || track.curvature[k] > 1 / 120) continue;
    const side = ctx.random() < 0.5 ? -1 : 1, x = track.px[k] - track.tz[k] * side * MOORED_FROM, z = track.pz[k] + track.tx[k] * side * MOORED_FROM;
    if (!ctx.spotIsClear(x, z, MOORED_FROM - 1) || !farFrom(x, z, MOORED_SPACING)) continue;
    add(x, z, Math.atan2(-track.tx[k], -track.tz[k]) + Math.PI / 2);
  }
  // Ancorados pelo mar, perto e longe.
  for (let tries = 0; tries < 900 && ships.length < MOORED + ANCHORED; tries++) {
    const x = ctx.bounds.minX - 200 + ctx.random() * (ctx.bounds.maxX - ctx.bounds.minX + 400);
    const z = ctx.bounds.minZ - 200 + ctx.random() * (ctx.bounds.maxZ - ctx.bounds.minZ + 400);
    if (!ctx.spotIsClear(x, z, 40) || !farFrom(x, z, 45)) continue;
    add(x, z, ctx.random() * Math.PI * 2);
  }
  ctx.onUpdate(time => {
    for (const ship of ships) {
      const phase = ship.userData.phase;
      ship.rotation.x = Math.sin(time * 0.8 + phase) * 0.03;
      ship.position.y = seaLevel - 0.6 + Math.sin(time * 0.9 + phase) * 0.25;
    }
  });
}
