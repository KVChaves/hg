import * as THREE from 'three';
import { enableCulling } from '../instancing.js';
import { paintGradient, paintSilhouette } from '../atmosphere.js';
import { alongRoad, EDGE, nearRoad, pickFrom, scatter, solid } from './propKit.js';
import { grassTuft, palmTree } from './plants.js';
import { beachGate } from './finishGates.js';
import { pixelTexture } from '../textures.js';
import { track } from '../track.js';

// Acostamento largo (metros a mais de cada lado): o limite da pista e o começo do capim ficam em SIDE.
const SHOULDER = 6, SIDE = EDGE + SHOULDER;

// Praia selvagem ao pôr do sol: trilha de areia dura no nível da praia, com acostamento de areia molhada e, logo
// depois, capim de duna, pedras e coqueiros no lugar do muro; mar de verdade nas partes baixas do terreno e uma
// maré alta que alaga um trecho da pista.
export const BEACH = {
  id: 'beach', name: 'PRAIA', music: 'beach',
  sky: 0xf4b890, fog: [26, 280], cabinTint: 0xffd8b0,
  // Pista que segue a costa: curvas longas e abertas, subindo e descendo as dunas.
  shape: { wiggle: 0.26, targetLength: 2350, relief: 8, hillScale: 170, shoulder: SHOULDER, sharpCurves: 2, harmonics: [[2, 0.9], [3, 0.4]], stretch: [1.3, 0.78] },
  surface: { grip: 0.97, side: 0.9, drag: 0.03, top: 0.99, offroad: 1.9 },
  layout: {
    jump: { fallLabel: 'CAIU NO MAR' },
    hazards: [{ kind: 'crabCrossing', count: 2 }, { kind: 'beachBalls', count: 2 }, { kind: 'umbrellaPatch', count: 2 }, { kind: 'coconutFall', count: 2 }],
    bumps: { height: 0.9, length: 70 },
    // Maré alta: névoa de água salgada e a pista alagada, com aderência baixa.
    storm: { length: 260, label: 'MARE', color: 0xa8dce4, fog: [14, 110], wind: 14, grip: 0.68, flooded: true, waterColor: '#2a9ab8' },
    tunnels: { count: 2, length: [90, 140], open: true },       // arcos de coqueiros
  },
  ground: {
    base: [236, 214, 160], variation: 12,
    paint(ctx) {
      ctx.fillStyle = 'rgba(200,170,110,.5)'; for (let i = 0; i < 24; i++) ctx.fillRect(Math.random() * 64, Math.random() * 64, 4 + Math.random() * 10, 1);
      ctx.fillStyle = 'rgba(255,240,200,.55)'; for (let i = 0; i < 18; i++) ctx.fillRect(Math.random() * 64, Math.random() * 64, 2, 1);
      ctx.fillStyle = 'rgba(176,130,86,.7)'; for (let i = 0; i < 6; i++) ctx.fillRect(Math.random() * 64, Math.random() * 64, 1, 1);   // conchinhas
    },
  },
  // Areia dura e molhada, mais escura que a das dunas, com marcas de pneu, conchas e pedrinhas; sem faixa pintada.
  road: {
    base: [196, 168, 118], variation: 10, edge: null, center: null,
    paint(ctx) {
      ctx.fillStyle = 'rgba(150,122,80,.5)'; ctx.fillRect(14, 0, 5, 64); ctx.fillRect(45, 0, 5, 64);   // sulcos dos pneus
      ctx.fillStyle = 'rgba(176,148,100,.6)'; for (let i = 0; i < 20; i++) ctx.fillRect(Math.random() * 64, Math.random() * 64, 3 + Math.random() * 8, 1);   // ondulações do vento
      ctx.fillStyle = 'rgba(236,214,160,.7)'; for (let i = 0; i < 16; i++) ctx.fillRect(Math.random() * 64, Math.random() * 64, 2 + Math.random() * 4, 1);
      ctx.fillStyle = 'rgba(244,236,216,.8)'; for (let i = 0; i < 5; i++) ctx.fillRect(Math.random() * 64, Math.random() * 64, 1, 1);   // conchinhas
      ctx.fillStyle = 'rgba(120,104,84,.7)'; for (let i = 0; i < 5; i++) ctx.fillRect(Math.random() * 64, Math.random() * 64, 1, 1);    // pedrinhas
    },
  },
  // Beira de areia molhada, com algas e conchas que o mar trouxe.
  kerb: {
    paint(ctx, n) {
      ctx.fillStyle = '#b89a6a'; ctx.fillRect(0, 0, n, n);
      ctx.fillStyle = '#a88a5c'; for (let i = 0; i < 10; i++) ctx.fillRect(Math.random() * n, Math.random() * n, 2 + Math.random() * 4, 1);
      ctx.fillStyle = '#4a6a3a'; for (let i = 0; i < 4; i++) ctx.fillRect(Math.random() * n, Math.random() * n, 2 + Math.random() * 3, 1);   // algas
      ctx.fillStyle = '#f4ecd8'; for (let i = 0; i < 3; i++) ctx.fillRect(Math.random() * n, Math.random() * n, 1, 1);                       // conchinhas
    },
  },
  gantry: beachGate,
  tunnel: { arch: 'palm', rib: 0x8a6a40, leaves: 0x2f8a3a },
  // Sem muro: capim, pedras e coqueiros fecham a pista (o limite de colisão continua no mesmo lugar).
  wall: null,
  epic: { ramp: { stone: [0x8a5a34, 0xa86a38, 0xc88a50, 0x9a6234], mortar: 0x5a3820, moss: [0xe8d8a0, 0xf0e4b8, 0xd8c488] }, abyss: 0x1f9ec0, glow: false, edge: '#f4ecd8', tube: { wall: '#d8b070', speckle: ['#c89a58', '#e8c888', '#a87a40'], rib: 0x8a6a40, portal: 0x2a9ab8, lines: [{ angle: Math.PI * 0.5, width: 0.05, color: 0xf4ecd8 }] } },
  // Respingos de mar e brilho dourado do sol no ar.
  weather: { count: 320, size: 2, fall: 0.6, sway: 5, swaySpeed: 1.2, colors: [0xffffff, 0xffe8b0, 0xcff0f4] },

  paintSky(ctx, w, h) {
    paintGradient(ctx, w, h, [[0, '#3a6ab8'], [0.45, '#e89a8a'], [1, '#f4b890']]);
    ctx.fillStyle = '#fff2c0';                                  // sol baixo e seu brilho
    ctx.beginPath(); ctx.arc(w * 0.3, 112, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,220,150,.35)'; ctx.fillRect(w * 0.3 - 40, 108, 80, 6);
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    for (let i = 0; i < 6; i++) ctx.fillRect(Math.random() * w, 40 + Math.random() * 50, 30 + Math.random() * 50, 2);
    paintSilhouette(ctx, w, h, '#7a5a6a', 3, 7, 0);             // ilhas distantes
    ctx.fillStyle = '#2a8aa8'; ctx.fillRect(0, h / 2 - 3, w, 5); // linha do mar
  },

  addProps(ctx) {
    // O mar: um plano abaixo da estrada. Onde o terreno desce além dele, vira água.
    let lowest = Infinity;
    for (let i = 0; i < track.count; i += 4) lowest = Math.min(lowest, track.py[i]);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 32;
    const art = canvas.getContext('2d');
    art.fillStyle = '#1f9ec0'; art.fillRect(0, 0, 32, 32);
    art.fillStyle = '#4ac0d8'; for (let i = 0; i < 20; i++) art.fillRect(Math.random() * 28, Math.random() * 32, 3 + Math.random() * 4, 1);
    art.fillStyle = '#e8fafc'; for (let i = 0; i < 6; i++) art.fillRect(Math.random() * 30, Math.random() * 32, 2, 1);
    const seaTexture = pixelTexture(canvas);
    seaTexture.wrapS = seaTexture.wrapT = THREE.RepeatWrapping;
    seaTexture.repeat.set(240, 240);
    const seaLevel = lowest - 2.6;
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: seaTexture }));
    sea.position.set((ctx.bounds.minX + ctx.bounds.maxX) / 2, seaLevel, (ctx.bounds.minZ + ctx.bounds.maxZ) / 2);
    ctx.group.add(sea);
    ctx.onUpdate(time => { seaTexture.offset.set(time * 0.012, time * 0.007); });

    // Coqueiros: tronco fino e curvo em anéis, folhas compridas caindo em arco e cacho de cocos.
    const FRONDS = [0x2f8a3a, 0x3aa048, 0x28783a, 0x4a9a3a];
    const palms = [palmTree({ colors: FRONDS }), palmTree({ height: 11, bend: 3.2, colors: FRONDS }), palmTree({ height: 8, bend: 1.6, fronds: 8, colors: FRONDS })];
    const palmSize = random => 0.85 + random() * 0.5;
    palms.forEach(parts => scatter(ctx, { count: 90, clearance: SIDE, sizeOf: palmSize, parts }));
    palms.forEach(parts => nearRoad(ctx, { count: 55, from: SIDE + 1, to: SIDE + 16, sizeOf: palmSize, parts }));

    // Borda da pista, no lugar do muro: tufos de capim de duna em fileira logo depois do acostamento, com
    // pedras da costa entre eles e mais capim e vegetação rasteira atrás.
    const grass = grassTuft({ colors: [0x9aa858, 0xb0b86a, 0x7a8a48, 0xc8b878] });
    alongRoad(ctx, { every: 2.5, offset: SIDE, sizeOf: random => 0.9 + random() * 0.5, parts: grass });
    nearRoad(ctx, { count: 700, from: SIDE, to: SIDE + 12, sizeOf: random => 0.6 + random() * 0.7, parts: grass });
    const creeper = new THREE.IcosahedronGeometry(1, 0);
    creeper.scale(1.4, 0.25, 1.4);
    nearRoad(ctx, { count: 200, from: SIDE, to: SIDE + 10, sizeOf: random => 0.8 + random() * 1.2, parts: [{ geometry: creeper, material: solid(0xffffff), colorOf: pickFrom([0x4a8a3a, 0x5a9a44, 0x6a8a3a]) }] });
    const rock = new THREE.DodecahedronGeometry(2.4, 0);
    const rockColors = pickFrom([0x8a7a68, 0x9a8a76, 0x76685a]);
    alongRoad(ctx, { every: 11, offset: SIDE + 0.5, sizeOf: random => [0.4 + random() * 0.4, 0.3 + random() * 0.3, 0.4 + random() * 0.4], parts: [{ geometry: rock, material: solid(0xffffff), colorOf: rockColors }] });

    // Dunas baixas e rochas maiores, mais para trás.
    const dune = new THREE.IcosahedronGeometry(4, 1);
    dune.scale(2.2, 0.5, 1.5);
    scatter(ctx, { count: 140, clearance: SIDE + 2, sizeOf: random => [1 + random(), 0.7 + random() * 0.8, 1 + random()], parts: [{ geometry: dune, material: solid(0xffffff), colorOf: pickFrom([0xeed8a4, 0xe4cc90, 0xf4e4b8]) }] });
    scatter(ctx, { count: 90, clearance: SIDE, sizeOf: random => [0.6 + random() * 1.4, 0.5 + random(), 0.6 + random() * 1.4], parts: [{ geometry: rock, material: solid(0xffffff), colorOf: rockColors }] });

    // Farol listrado ao longe.
    const tower = new THREE.CylinderGeometry(2.4, 3.4, 26, 8);
    tower.translate(0, 13, 0);
    const band = new THREE.CylinderGeometry(2.7, 2.9, 4, 8);
    band.translate(0, 14, 0);
    const lamp = new THREE.CylinderGeometry(2.2, 2.2, 3, 8);
    lamp.translate(0, 27.5, 0);
    scatter(ctx, { count: 3, clearance: 40, parts: [{ geometry: tower, material: solid(0xf4f0e8) }, { geometry: band, material: solid(0xd83a2a) }, { geometry: lamp, material: solid(0xffe890, { fog: false }) }] });

    // Veleiros no mar: só onde o terreno ficou abaixo da água.
    const hull = new THREE.BoxGeometry(6, 1.2, 2);
    hull.translate(0, 0.6, 0);
    const sail = new THREE.ConeGeometry(2.2, 8, 3);
    sail.translate(0, 5.2, 0);
    let boats = 0;
    const boatMesh = [new THREE.InstancedMesh(hull, solid(0x8a5a34), 14), new THREE.InstancedMesh(sail, solid(0xffffff), 14)];
    const matrix = new THREE.Matrix4(), euler = new THREE.Euler(), quaternion = new THREE.Quaternion();
    for (let tries = 0; tries < 400 && boats < 14; tries++) {
      const x = ctx.bounds.minX - 80 + ctx.random() * (ctx.bounds.maxX - ctx.bounds.minX + 160), z = ctx.bounds.minZ - 80 + ctx.random() * (ctx.bounds.maxZ - ctx.bounds.minZ + 160);
      if (ctx.heightAt(x, z) > seaLevel - 2 || !ctx.spotIsClear(x, z, 30)) continue;
      quaternion.setFromEuler(euler.set(0, ctx.random() * Math.PI * 2, 0));
      matrix.compose(new THREE.Vector3(x, seaLevel, z), quaternion, new THREE.Vector3(1, 1, 1));
      boatMesh.forEach(mesh => mesh.setMatrixAt(boats, matrix));
      boats++;
    }
    boatMesh.forEach(mesh => { mesh.count = boats; enableCulling(mesh); ctx.group.add(mesh); });

    // Gaivotas rodando no céu.
    const wing = new THREE.BoxGeometry(1.8, 0.06, 0.4), gulls = [];
    for (let i = 0; i < 14; i++) {
      const gull = new THREE.Group(), left = new THREE.Mesh(wing, solid(0xffffff)), right = new THREE.Mesh(wing, solid(0xffffff));
      left.position.x = -0.9; right.position.x = 0.9;
      gull.add(left, right);
      const centerX = ctx.bounds.minX + ctx.random() * (ctx.bounds.maxX - ctx.bounds.minX), centerZ = ctx.bounds.minZ + ctx.random() * (ctx.bounds.maxZ - ctx.bounds.minZ);
      gulls.push({ gull, left, right, centerX, centerZ, radius: 25 + ctx.random() * 40, speed: 0.15 + ctx.random() * 0.15, phase: ctx.random() * 6.28, height: 28 + ctx.random() * 22 });
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

  },
};
