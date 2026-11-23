import * as THREE from 'three';
import { paintGradient, paintSilhouette } from '../atmosphere.js';
import { alongRoad, EDGE, nearRoad, pickFrom, scatter, solid } from './propKit.js';
import { broadleafTree, bush, pineTree } from './plants.js';
import { useImage } from '../textures.js';
import { forestGate } from './finishGates.js';

// Acostamento largo (metros a mais de cada lado): o limite da pista e o começo da mata ficam em SIDE.
const SHOULDER = 6, SIDE = EDGE + SHOULDER;

// Pôr do sol de outono, trilha de terra coberta de folhas, árvores vermelhas e cogumelos gigantes. Sem muro: a
// trilha fica no nível do chão, com acostamento largo de terra, e a mata fechada começa logo depois.
export const FOREST = {
  id: 'forest', name: 'FLORESTA', music: 'forestField',
  sky: 0xd88040, fog: [14, 190], cabinTint: 0xf4c89c,
  shape: { wiggle: 0.2, targetLength: 2150, relief: 13, hillScale: 190, shoulder: SHOULDER, sharpCurves: 2 },
  surface: { grip: 0.95, side: 0.9, drag: 0.02, offroad: 1.2 },                  // terra batida: segura um pouco menos que asfalto
  layout: {
    jump: { fallLabel: 'CAIU NA LAMA' },
    hazards: [{ kind: 'rockfall', count: 3 }],                // paredões de onde caem pedras
    // Caverna: breu total; só se veem os faróis, o fogo e as balas (e o que os faróis do jogador alcançam).
    dark: {
      length: [200, 260], fog: [0, 10],
      style: { wall: '#2a2018', speckle: ['#3a2c20', '#1a120c', '#4a3828'], rib: 0x1e1610, portal: 0x3a2a1c, lines: [], spikes: { color: 0x4a3c30, count: 120 } },
    },
    tunnels: { count: 2, length: [90, 150], open: true },
  },
  ground: {
    base: [92, 54, 24], variation: 26, image: useImage('assets/tex/autumn-leaves.png'), shade: 0.9,
    paint(ctx) { for (const color of ['#c85a14', '#e0902c', '#8a2c10']) { ctx.fillStyle = color; for (let i = 0; i < 20; i++) ctx.fillRect(Math.random() * 64, Math.random() * 64, 2, 1); } },
  },
  // Terra batida com folhas caídas por cima; as bordas somem nas folhas do chão, sem faixa pintada.
  road: {
    base: [122, 84, 48], variation: 22, image: useImage('assets/tex/dirt.png'), shade: 1.15, edge: null, center: null,
    paint(ctx) { ctx.fillStyle = 'rgba(70,44,20,.55)'; ctx.fillRect(16, 0, 4, 64); ctx.fillRect(44, 0, 4, 64); },   // sulcos das rodas
    overlay(ctx) {
      for (const color of ['#c85a14', '#e0902c', '#8a2c10', '#a8701c']) { ctx.fillStyle = color; for (let i = 0; i < 14; i++) ctx.fillRect(Math.random() * 64, Math.random() * 64, 2, 1); }
      ctx.fillStyle = 'rgba(92,54,24,.7)'; for (let i = 0; i < 18; i++) ctx.fillRect(Math.random() < 0.5 ? Math.random() * 8 : 56 + Math.random() * 8, Math.random() * 64, 2, 1);
    },
  },
  // Beira de toras deitadas, com folhas caídas.
  kerb: {
    paint(ctx, n) {
      ['#3a2210', '#5a3618', '#74481e', '#5a3618'].forEach((color, row) => { ctx.fillStyle = color; ctx.fillRect(0, row * 4, n, 4); });
      ctx.fillStyle = '#2a1608'; ctx.fillRect(0, 0, n, 1); ctx.fillRect(0, 8, n, 1);
      ctx.fillStyle = '#c85a14'; for (let i = 0; i < 5; i++) ctx.fillRect(Math.random() * n, Math.random() * n, 2, 1);
    },
  },
  gantry: forestGate,
  tunnel: { arch: 'timber', rib: 0x5a3618, leaves: 0xb83c14 },
  // Sem muro: a mata fecha a pista (o limite de colisão continua no mesmo lugar, junto das primeiras moitas).
  wall: null,
  epic: { ramp: { stone: [0x3a302c, 0x5a4c44, 0x6a5a4e, 0x4a3e38], mortar: 0x221a16, moss: [0x7a3418, 0x9a4a1c, 0x5a5a20] }, abyss: 0x2a1c10, glow: false, edge: '#e0a030', tube: { wall: '#5a3618', speckle: ['#74481e', '#3a2210', '#8a5a2a'], rib: 0x3a2210, portal: 0xc89a4a, lines: [{ angle: Math.PI * 0.5, width: 0.04, color: 0xe0a030 }] } },
  weather: { count: 240, size: 2, fall: 3, sway: 3, swaySpeed: 1.1, colors: [0xd86a18, 0xc03a14, 0xe8a030] },

  paintSky(ctx, w, h) {
    paintGradient(ctx, w, h, [[0, '#3a2868'], [0.45, '#c8506a'], [0.8, '#e88a3a'], [1, '#d88040']]);
    ctx.fillStyle = '#ffe0a0';
    ctx.beginPath(); ctx.arc(w * 0.3, h * 0.42, 22, 0, Math.PI * 2); ctx.fill();
    paintSilhouette(ctx, w, h, '#6a2e20', 11, 16, 6);
    paintSilhouette(ctx, w, h, '#451c14', 19, 10, 2);
  },

  addProps(ctx) {
    // Mata de outono: carvalhos e bordos de copa vermelha, laranja e amarela, com alguns pinheiros escuros.
    const AUTUMN = [0xb8301a, 0xd04a14, 0x9a2a10, 0xe07820, 0xc8a024, 0xa83c18];
    const oaks = [broadleafTree({ colors: AUTUMN }), broadleafTree({ height: 8, crown: 3.8, colors: AUTUMN }), broadleafTree({ height: 6, crown: 3, bark: 0x4a2e18, colors: AUTUMN })];
    const pine = pineTree({ colors: [0x2a4a2a, 0x34522c, 0x223e24] });
    const treeSize = random => 0.8 + random() * 0.7;
    oaks.forEach(parts => scatter(ctx, { count: 160, clearance: SIDE, sizeOf: treeSize, parts }));
    scatter(ctx, { count: 110, clearance: SIDE, sizeOf: random => 0.8 + random() * 0.6, parts: pine });

    // Mata fechada colada no acostamento.
    oaks.forEach(parts => nearRoad(ctx, { count: 150, from: SIDE, to: SIDE + 16, sizeOf: treeSize, parts }));
    nearRoad(ctx, { count: 90, from: SIDE + 2, to: SIDE + 16, sizeOf: random => 0.7 + random() * 0.5, parts: pine });

    const stem = new THREE.CylinderGeometry(0.5, 0.75, 3, 7);
    stem.translate(0, 1.5, 0);
    const cap = new THREE.SphereGeometry(2, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2);
    cap.translate(0, 3, 0);
    scatter(ctx, {
      count: 90, clearance: SIDE, sizeOf: random => 0.7 + random() * 1.5,
      parts: [
        { geometry: stem, material: solid(0xeadcc0) },
        { geometry: cap, material: solid(0xffffff), colorOf: pickFrom([0xc02020, 0xe07018, 0x8a3ab0]) },
      ],
    });

    // Fileira de moitas logo depois do acostamento: é a borda da pista, no lugar do muro.
    const bushes = bush({ colors: [0x6a3414, 0x8a4418, 0x5a6a1c, 0xa8501a, 0x7a5a1c] });
    alongRoad(ctx, { every: 4, offset: SIDE, sizeOf: random => 0.8 + random() * 0.5, parts: bushes });
    nearRoad(ctx, { count: 500, from: SIDE, to: SIDE + 10, sizeOf: random => 0.6 + random() * 0.7, parts: bushes });
  },
};
