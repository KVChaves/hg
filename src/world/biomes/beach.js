import * as THREE from 'three';
import { paintGradient, paintSilhouette } from '../atmosphere.js';
import { cutTop, speckle } from './wallPaint.js';
import { acrossRoad, archFrame, EDGE, nearRoad, pickFrom, scatter, solid } from './propKit.js';
import { beachGate } from './finishGates.js';
import { pixelTexture } from '../textures.js';
import { track } from '../track.js';

// Orla ao pôr do sol: estrada costeira com areia levada pelo vento, coqueiros, guarda-sóis, mar de verdade nas
// partes baixas do terreno e uma maré alta que alaga um trecho da pista.
export const BEACH = {
  id: 'beach', name: 'PRAIA', music: 'beach',
  sky: 0xf4b890, fog: [26, 280], cabinTint: 0xffd8b0,
  // Pista que segue a costa: curvas longas e abertas, subindo e descendo as dunas.
  shape: { wiggle: 0.26, targetLength: 2350, relief: 8, hillScale: 170, sharpCurves: 2, harmonics: [[2, 0.9], [3, 0.4]], stretch: [1.3, 0.78] },
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
  // Asfalto de orla: cinza quente coberto de areia, faixa amarela no meio.
  road: {
    base: [132, 122, 110], variation: 10, edge: '#f4ecd8', center: '#f0c040',
    paint(ctx) {
      ctx.fillStyle = 'rgba(236,214,160,.65)'; for (let i = 0; i < 26; i++) ctx.fillRect(Math.random() * 64, Math.random() * 64, 2 + Math.random() * 9, 1 + Math.random() * 2);
      ctx.fillStyle = 'rgba(70,64,58,.5)'; ctx.fillRect(14, 0, 4, 64); ctx.fillRect(46, 0, 4, 64);
    },
  },
  // Beira de pranchas de madeira do calçadão.
  kerb: {
    paint(ctx, n) {
      ['#b88a54', '#a07646', '#c89a62', '#a07646'].forEach((color, row) => { ctx.fillStyle = color; ctx.fillRect(0, row * 4, n, 3); ctx.fillStyle = '#6a4a28'; ctx.fillRect(0, row * 4 + 3, n, 1); });
      ctx.fillStyle = '#5a3c20'; ctx.fillRect(2, 1, 1, 1); ctx.fillRect(12, 5, 1, 1); ctx.fillRect(6, 9, 1, 1); ctx.fillRect(13, 13, 1, 1);
    },
  },
  gantry: beachGate,
  tunnel: { arch: 'palm', rib: 0x8a6a40, leaves: 0x2f8a3a },
  // Mureta baixa de madeira pintada de azul e branco.
  wall: {
    height: 1.7, tile: 8,
    paint(ctx, w, h) {
      for (let x = 0; x < w; x += 6) { ctx.fillStyle = (x / 6) % 2 ? '#f0ece4' : '#2a9ab8'; ctx.fillRect(x, 0, 5, h); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x + 5, 0, 1, h); }
      speckle(ctx, w, h, ['#c8a870', '#ffffff'], 40);
      cutTop(ctx, w, x => (x % 6 < 5 ? 1 : 3));
    },
  },
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

    // Coqueiros: tronco curvo, copa achatada e cocos.
    const trunk = new THREE.CylinderGeometry(0.3, 0.55, 8, 6);
    trunk.translate(0, 4, 0);
    trunk.rotateZ(0.16);
    const crown = new THREE.IcosahedronGeometry(3.2, 0);
    crown.scale(1, 0.32, 1);
    crown.translate(-1.25, 8.2, 0);
    const crownLow = new THREE.IcosahedronGeometry(2.4, 0);
    crownLow.scale(1, 0.4, 1);
    crownLow.translate(-1.25, 7.5, 0);
    const nuts = new THREE.IcosahedronGeometry(0.45, 0);
    nuts.translate(-1.25, 7.4, 0.6);
    scatter(ctx, {
      count: 260, clearance: 12, sizeOf: random => 0.8 + random() * 0.7,
      parts: [
        { geometry: trunk, material: solid(0x8a6a40) },
        { geometry: crown, material: solid(0xffffff), colorOf: pickFrom([0x2f8a3a, 0x3aa048, 0x28783a]) },
        { geometry: crownLow, material: solid(0x1f6a30) },
        { geometry: nuts, material: solid(0x5a3c20) },
      ],
    });

    // Guarda-sóis de cores vivas na beira, com toalha.
    const pole = new THREE.CylinderGeometry(0.06, 0.06, 2.6, 5);
    pole.translate(0, 1.3, 0);
    const canopy = new THREE.ConeGeometry(1.9, 0.8, 8);
    canopy.translate(0, 2.9, 0);
    const towel = new THREE.BoxGeometry(1.5, 0.05, 2.6);
    towel.translate(0.4, 0.04, 1.4);
    nearRoad(ctx, {
      count: 70, from: EDGE + 2, to: EDGE + 16,
      parts: [
        { geometry: pole, material: solid(0xd8d8d0) },
        { geometry: canopy, material: solid(0xffffff), colorOf: pickFrom([0xe83a3a, 0x3a7ae8, 0xf0d030, 0xffffff, 0x3aa860]) },
        { geometry: towel, material: solid(0xffffff), colorOf: pickFrom([0xf0d030, 0xe83a3a, 0x3a7ae8]) },
      ],
    });

    // Quiosques e torres de salva-vidas.
    const shack = new THREE.BoxGeometry(6, 3.6, 5);
    shack.translate(0, 1.8, 0);
    const shackRoof = new THREE.BoxGeometry(7, 0.5, 6);
    shackRoof.translate(0, 3.85, 0);
    const counter = new THREE.BoxGeometry(5, 0.7, 0.8);
    counter.translate(0, 1.5, 2.8);
    nearRoad(ctx, {
      count: 22, from: EDGE + 8, to: EDGE + 24,
      parts: [
        { geometry: shack, material: solid(0xffffff), colorOf: pickFrom([0xf0e0b0, 0x58c0d0, 0xf08a70, 0x90d890]) },
        { geometry: shackRoof, material: solid(0xb84a2a) },
        { geometry: counter, material: solid(0xd8b070) },
      ],
    });
    const stilts = new THREE.BoxGeometry(2.4, 2.2, 2.4);
    stilts.translate(0, 1.1, 0);
    const cabin = new THREE.BoxGeometry(3.2, 2.4, 3.2);
    cabin.translate(0, 3.4, 0);
    const cabinRoof = new THREE.ConeGeometry(2.6, 1, 4);
    cabinRoof.rotateY(Math.PI / 4);
    cabinRoof.translate(0, 5.1, 0);
    nearRoad(ctx, { count: 8, from: EDGE + 6, to: EDGE + 20, parts: [{ geometry: stilts, material: solid(0xe8e4dc) }, { geometry: cabin, material: solid(0xe83a3a) }, { geometry: cabinRoof, material: solid(0xffffff) }] });

    // Pranchas de surfe fincadas na areia.
    const board = new THREE.BoxGeometry(0.7, 3, 0.1);
    board.translate(0, 1.5, 0);
    nearRoad(ctx, { count: 50, from: EDGE + 1, to: EDGE + 12, parts: [{ geometry: board, material: solid(0xffffff), colorOf: pickFrom([0xf0d030, 0xe83a3a, 0x3a7ae8, 0x3aa860, 0xf08a30]) }] });

    // Dunas baixas com capim, e rochas da costa.
    const dune = new THREE.IcosahedronGeometry(4, 1);
    dune.scale(2.2, 0.5, 1.5);
    scatter(ctx, { count: 120, clearance: 14, sizeOf: random => [1 + random(), 0.7 + random() * 0.8, 1 + random()], parts: [{ geometry: dune, material: solid(0xffffff), colorOf: pickFrom([0xeed8a4, 0xe4cc90, 0xf4e4b8]) }] });
    const rock = new THREE.DodecahedronGeometry(2.4, 0);
    scatter(ctx, { count: 70, clearance: 12, sizeOf: random => [0.6 + random() * 1.4, 0.5 + random(), 0.6 + random() * 1.4], parts: [{ geometry: rock, material: solid(0xffffff), colorOf: pickFrom([0x8a7a68, 0x9a8a76, 0x76685a]) }] });

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
    boatMesh.forEach(mesh => { mesh.count = boats; mesh.frustumCulled = false; ctx.group.add(mesh); });

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

    // Faixas de bandeirolas coloridas sobre a pista.
    acrossRoad(ctx, {
      every: 230,
      build: () => {
        const arch = archFrame({ height: 10, post: 0x8a6a40, beam: 0xd8b070 });
        [0xe83a3a, 0xf0d030, 0x3a7ae8, 0xffffff, 0x3aa860, 0xf08a30].forEach((color, i) => {
          const flag = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.2, 3), solid(color));
          flag.rotation.x = Math.PI;
          flag.position.set(-7.5 + i * 3, 8.8, 0);
          arch.add(flag);
        });
        return arch;
      },
    });
  },
};
