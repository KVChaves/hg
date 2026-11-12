import * as THREE from 'three';
import { paintGradient, paintSilhouette, paintStars } from '../atmosphere.js';
import { paintBlocks, speckle } from './wallPaint.js';
import { acrossRoad, alongRoad, archFrame, EDGE, nearRoad, pickFrom, scatter, solid } from './propKit.js';
import { spaceGate } from './finishGates.js';

// Base lunar: sem atmosfera, a Terra no céu, gravidade baixa (saltos enormes e carro que flutua), poeira
// levantada num trecho e meteoros que caem na pista.
export const SPACE = {
  id: 'space', name: 'ESTACAO LUNAR', music: 'space',
  sky: 0x0a0a16, fog: [70, 460], cabinTint: 0xc8d4ff,
  gravity: 6,                                        // m/s² (a Terra tem 9,81): o salto sobre o rio vira um voo longo
  // Crateras e colinas: traçado de retas e curvas médias, com ondulações que fazem o carro flutuar.
  shape: { wiggle: 0.22, targetLength: 2300, relief: 22, hillScale: 120, sharpCurves: 2, harmonics: [[2, 0.8], [3, 0.4]], stretch: [1.15, 0.9] },
  surface: { grip: 0.8, side: 0.55, accel: 0.95, offroad: 1.3 },   // pouca aderência: o carro desliza
  layout: {
    jump: { fallLabel: 'CAIU NA CRATERA' },
    hazards: [{ kind: 'meteorShower', count: 3 }, { kind: 'roverCrossing', count: 1 }, { kind: 'brokenAntenna', count: 2 }, { kind: 'crystalPatch', count: 2 }],
    bumps: { height: 2.2, length: 80 },
    // Nuvem de poeira lunar levantada por uma explosão: vista curta e chão solto.
    storm: { length: 280, label: 'POEIRA', color: 0x8a8a96, fog: [4, 34], wind: 25, grip: 0.75 },
    tunnels: { count: 2, length: [90, 140] },        // tubos pressurizados entre os módulos
  },
  ground: {
    base: [120, 120, 128], variation: 14,
    paint(ctx) {
      ctx.fillStyle = 'rgba(60,60,70,.5)'; for (let i = 0; i < 4; i++) { const x = Math.random() * 56, y = Math.random() * 56, r = 3 + Math.random() * 4; ctx.beginPath(); ctx.arc(x + 4, y + 4, r, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = 'rgba(190,190,200,.5)'; for (let i = 0; i < 24; i++) ctx.fillRect(Math.random() * 64, Math.random() * 64, 1 + Math.random() * 2, 1);
    },
  },
  // Pista de placas de liga escura com parafusos e faixa de guia.
  road: {
    base: [58, 62, 74], variation: 8, edge: '#40e0f0', center: '#a060f0',
    paint(ctx) {
      ctx.fillStyle = 'rgba(0,0,0,.45)'; for (let y = 0; y < 64; y += 16) ctx.fillRect(0, y, 64, 1);
      ctx.fillStyle = 'rgba(150,160,184,.5)'; for (let y = 2; y < 64; y += 16) for (const x of [6, 57]) ctx.fillRect(x, y, 2, 2);
      ctx.fillStyle = 'rgba(160,170,190,.3)'; for (let i = 0; i < 14; i++) ctx.fillRect(Math.random() * 64, Math.random() * 64, 3 + Math.random() * 6, 1);
    },
  },
  // Beira de balizas: blocos de metal com luz ciano acesa.
  kerb: {
    paint(ctx, n) {
      ctx.fillStyle = '#6a7080'; ctx.fillRect(0, 0, n, n);
      ctx.fillStyle = '#8a90a0'; ctx.fillRect(0, 0, n, 2);
      ctx.fillStyle = '#2a2e3a'; ctx.fillRect(0, 8, n, 1);
      ctx.fillStyle = '#40e0f0'; ctx.fillRect(5, 3, 6, 3);
      ctx.fillStyle = '#a060f0'; ctx.fillRect(5, 11, 6, 3);
    },
  },
  gantry: spaceGate,
  tunnel: { wall: '#2c3446', speckle: ['#3a4458', '#1e2432', '#4a5670'], rib: 0x8a90a0, portal: 0x40e0f0, lines: [{ angle: Math.PI / 2, width: 0.05, color: 0x40e0f0 }, { angle: 0.4, width: 0.03, color: 0xa060f0 }, { angle: Math.PI - 0.4, width: 0.03, color: 0xa060f0 }] },
  // Painéis de blindagem com faixa de aviso e luzes.
  wall: {
    height: 2.4, tile: 8,
    paint(ctx, w, h) {
      paintBlocks(w, h, 24, 12, (x, y, bw, bh) => {
        ctx.fillStyle = ['#6a7080', '#5a6070', '#7a8090'][Math.floor(Math.random() * 3)];
        ctx.fillRect(x, y, bw - 1, bh - 1);
        ctx.fillStyle = '#9aa0b0'; ctx.fillRect(x + 1, y + 1, bw - 4, 1);
      });
      for (let x = 0; x < w; x += 8) { ctx.fillStyle = x % 16 ? '#e8b018' : '#1a1a20'; ctx.fillRect(x, h - 4, 8, 3); }
      ctx.fillStyle = '#40e0f0'; for (let x = 6; x < w; x += 24) ctx.fillRect(x, 3, 3, 2);
      speckle(ctx, w, h, ['#3a3e4a', '#a0a6b8'], 50);
    },
  },
  epic: { ramp: { stone: [0x4a5060, 0x5a6070, 0x6a7080, 0x3e4452], mortar: 0x20242e, moss: [0x40e0f0, 0x2ab0c8, 0xa060f0] }, abyss: 0x0a0818, glow: false, edge: '#40e0f0', tube: { wall: '#2c3446', speckle: ['#3a4458', '#1e2432', '#4a5670'], rib: 0x8a90a0, portal: 0x40e0f0, lines: [{ angle: Math.PI * 0.5, width: 0.05, color: 0x40e0f0 }] } },
  // Poeira lunar flutuando devagar, sem cair.
  weather: { count: 300, size: 2, fall: -0.4, sway: 2.2, swaySpeed: 0.8, colors: [0xa0a0b0, 0x808090, 0xc8c8d8] },

  paintSky(ctx, w, h) {
    paintGradient(ctx, w, h, [[0, '#02020a'], [0.7, '#080814'], [1, '#14142a']]);
    paintStars(ctx, w, h, '#ffffff', 340);
    paintStars(ctx, w, h, '#a8b8ff', 120);
    ctx.fillStyle = '#2a6ab8';                                  // a Terra, grande no céu
    ctx.beginPath(); ctx.arc(w * 0.72, 54, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a9a5a';
    for (const [x, y, r] of [[-8, -6, 9], [6, 4, 8], [-2, 12, 5]]) { ctx.beginPath(); ctx.arc(w * 0.72 + x, 54 + y, r, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(w * 0.72 - 20, 40, 18, 2); ctx.fillRect(w * 0.72 + 2, 62, 16, 2);
    ctx.fillStyle = 'rgba(8,8,20,.45)'; ctx.beginPath(); ctx.arc(w * 0.72 + 12, 58, 24, 0, Math.PI * 2); ctx.fill();   // terminador
    ctx.fillStyle = '#fff6d8'; ctx.beginPath(); ctx.arc(w * 0.18, 30, 7, 0, Math.PI * 2); ctx.fill();            // sol, sem céu azul em volta
    paintSilhouette(ctx, w, h, '#5a5a68', 4, 14, 3);            // cumes de crateras
    paintSilhouette(ctx, w, h, '#3e3e4a', 9, 8, 1);
  },

  addProps(ctx) {
    // Rochas lunares e crateras (discos escuros com borda clara).
    const rock = new THREE.DodecahedronGeometry(2.4, 0);
    scatter(ctx, { count: 220, clearance: 11, sizeOf: random => [0.4 + random() * 1.6, 0.4 + random() * 1.1, 0.4 + random() * 1.6], parts: [{ geometry: rock, material: solid(0xffffff), colorOf: pickFrom([0x8a8a96, 0x74747f, 0x9a9aa6, 0x62626e]) }] });
    const crater = new THREE.CylinderGeometry(6, 6.5, 0.3, 14);
    crater.translate(0, 0.1, 0);
    const rim = new THREE.TorusGeometry(6.8, 0.8, 4, 14);
    rim.rotateX(Math.PI / 2);
    rim.translate(0, 0.4, 0);
    scatter(ctx, { count: 90, clearance: 16, sizeOf: random => 0.8 + random() * 2.2, parts: [{ geometry: crater, material: solid(0x44444e) }, { geometry: rim, material: solid(0x9a9aa6) }] });

    // Cúpulas de habitação com janelas acesas.
    const dome = new THREE.SphereGeometry(7, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2);
    const base = new THREE.CylinderGeometry(7.4, 7.6, 1.4, 12);
    base.translate(0, 0.7, 0);
    const windows = new THREE.CylinderGeometry(7.1, 7.1, 0.7, 12);
    windows.translate(0, 3, 0);
    nearRoad(ctx, {
      count: 14, from: EDGE + 12, to: EDGE + 34,
      parts: [
        { geometry: dome, material: solid(0xffffff), colorOf: pickFrom([0xc8d0e0, 0xb8c4d8, 0xd8dce8]) },
        { geometry: base, material: solid(0x6a7080) },
        { geometry: windows, material: solid(0x80e8f4, { fog: false }) },
      ],
    });

    // Painéis solares em fileira.
    const post = new THREE.CylinderGeometry(0.15, 0.2, 2.4, 5);
    post.translate(0, 1.2, 0);
    const panel = new THREE.BoxGeometry(5, 0.12, 3);
    panel.rotateX(-0.45);
    panel.translate(0, 2.9, 0);
    scatter(ctx, { count: 70, clearance: 14, parts: [{ geometry: post, material: solid(0xb8bcc8) }, { geometry: panel, material: solid(0x2848a8) }] });

    // Antenas parabólicas com luz vermelha no topo.
    const mast = new THREE.CylinderGeometry(0.2, 0.3, 11, 6);
    mast.translate(0, 5.5, 0);
    const dish = new THREE.ConeGeometry(2, 1, 10);
    dish.rotateX(Math.PI);
    dish.translate(0, 11.4, 0);
    const beacon = new THREE.BoxGeometry(0.35, 0.35, 0.35);
    beacon.translate(0, 12.4, 0);
    scatter(ctx, { count: 36, clearance: 14, parts: [{ geometry: mast, material: solid(0xb8bcc8) }, { geometry: dish, material: solid(0xe8eaf0) }, { geometry: beacon, material: solid(0xe84030, { fog: false }) }] });

    // Módulos de pouso: corpo dourado sobre prato de apoio.
    const lander = new THREE.BoxGeometry(5, 3, 5);
    lander.translate(0, 3.4, 0);
    const legs = new THREE.CylinderGeometry(3.4, 4.4, 1.2, 8);
    legs.translate(0, 0.6, 0);
    const landerTop = new THREE.CylinderGeometry(1.2, 2.4, 1.6, 8);
    landerTop.translate(0, 5.6, 0);
    scatter(ctx, { count: 6, clearance: 22, parts: [{ geometry: lander, material: solid(0xd8b040) }, { geometry: legs, material: solid(0x9a9ea8) }, { geometry: landerTop, material: solid(0xe8e8f0) }] });

    // Postes de luz ao longo da pista, com lâmpada ciano.
    const lamppost = new THREE.CylinderGeometry(0.15, 0.2, 8, 5);
    lamppost.translate(0, 4, 0);
    const lamp = new THREE.BoxGeometry(1.6, 0.4, 0.5);
    lamp.translate(0, 8.2, 0);
    alongRoad(ctx, { every: 34, offset: EDGE - 0.4, parts: [{ geometry: lamppost, material: solid(0xb8bcc8) }, { geometry: lamp, material: solid(0x80f0ff, { fog: false }) }] });

    // Arcos de sinalização com tubos de luz sobre a pista.
    acrossRoad(ctx, {
      every: 240,
      build: () => {
        const arch = archFrame({ height: 11, post: 0x8a90a0, beam: 0x40e0f0, trim: 0xa060f0 });
        for (const x of [-6, 0, 6]) {
          const light = new THREE.Mesh(new THREE.BoxGeometry(2, 0.3, 0.3), solid(0x80f0ff, { fog: false }));
          light.position.set(x, 9.6, 0);
          arch.add(light);
        }
        return arch;
      },
    });
  },
};
