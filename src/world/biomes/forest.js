import * as THREE from 'three';
import { paintGradient, paintSilhouette } from '../atmosphere.js';
import { cutTop, speckle } from './wallPaint.js';
import { alongRoad, nearRoad, pickFrom, scatter, solid } from './propKit.js';

// Pôr do sol de outono, estrada de terra batida, árvores vermelhas e cogumelos gigantes.
export const FOREST = {
  id: 'forest', name: 'FLORESTA', music: 'forestField',
  sky: 0xd88040, fog: [14, 190], cabinTint: 0xf4c89c,
  shape: { wiggle: 0.2, targetLength: 2150, relief: 13, hillScale: 190, banks: 6, sharpCurves: 2 },
  layout: {
    jumpHops: 2,
    tunnels: { count: 2, length: [90, 150], open: true },
  },
  ground: {
    base: [92, 54, 24], variation: 26,
    paint(ctx) { for (const color of ['#c85a14', '#e0902c', '#8a2c10']) { ctx.fillStyle = color; for (let i = 0; i < 20; i++) ctx.fillRect(Math.random() * 64, Math.random() * 64, 2, 1); } },
  },
  road: {
    base: [122, 84, 48], variation: 22, edge: '#5a3a1c', center: '#7c5630',
    paint(ctx) { ctx.fillStyle = 'rgba(70,44,20,.55)'; ctx.fillRect(16, 0, 4, 64); ctx.fillRect(44, 0, 4, 64); },
  },
  kerb: ['#5a3a1c', '#a87a40'],
  gantry: [0x3a2412, 0x8a4414, 0xe8c070],
  tunnel: { rib: 0x4a2c14, leaves: 0xb83c14 },
  // Paliçada de troncos com ponta.
  wall: {
    height: 2.8, tile: 6,
    paint(ctx, w, h) {
      const LOG = 16;
      for (let x = 0; x < w; x += LOG) {
        ['#3a2210', '#5a3618', '#74481e', '#5a3618', '#3a2210'].forEach((color, band) => {
          ctx.fillStyle = color;
          ctx.fillRect(x + 1 + band * 3, 0, 3, h);
        });
        ctx.fillStyle = '#1a0f06';
        ctx.fillRect(x, 0, 1, h);
      }
      speckle(ctx, w, h, ['#2a1809', '#8a5a2a'], 120);
      ctx.fillStyle = '#c89a4a';
      ctx.fillRect(0, h - 15, w, 2);
      cutTop(ctx, w, x => Math.abs((x % 16) - 8));
    },
  },
  epic: { abyss: 0x2a1c10, glow: false, edge: '#e0a030', tube: { wall: '#5a3618', speckle: ['#74481e', '#3a2210', '#8a5a2a'], rib: 0x3a2210, portal: 0xc89a4a, lines: [{ angle: Math.PI * 0.5, width: 0.04, color: 0xe0a030 }] } },
  weather: { count: 240, size: 2, fall: 3, sway: 3, swaySpeed: 1.1, colors: [0xd86a18, 0xc03a14, 0xe8a030] },

  paintSky(ctx, w, h) {
    paintGradient(ctx, w, h, [[0, '#3a2868'], [0.45, '#c8506a'], [0.8, '#e88a3a'], [1, '#d88040']]);
    ctx.fillStyle = '#ffe0a0';
    ctx.beginPath(); ctx.arc(w * 0.3, h * 0.42, 22, 0, Math.PI * 2); ctx.fill();
    paintSilhouette(ctx, w, h, '#6a2e20', 11, 16, 6);
    paintSilhouette(ctx, w, h, '#451c14', 19, 10, 2);
  },

  addProps(ctx) {
    const trunk = new THREE.CylinderGeometry(0.5, 0.8, 7, 5);
    trunk.translate(0, 3.5, 0);
    const leaves = new THREE.IcosahedronGeometry(3.8, 0);
    leaves.scale(1.3, 0.85, 1.3);
    leaves.translate(0, 8.5, 0);
    scatter(ctx, {
      count: 560, clearance: 13, sizeOf: random => 0.8 + random() * 0.9,
      parts: [
        { geometry: trunk, material: solid(0x2a1608) },
        { geometry: leaves, material: solid(0xffffff), colorOf: pickFrom([0xb8301a, 0xd04a14, 0x9a2a10, 0xe07820, 0xc8a024]) },
      ],
    });

    nearRoad(ctx, {
      count: 260, from: 12, to: 26, sizeOf: random => 0.7 + random() * 0.7,
      parts: [
        { geometry: trunk, material: solid(0x2a1608) },
        { geometry: leaves, material: solid(0xffffff), colorOf: pickFrom([0xb8301a, 0xd04a14, 0xe07820, 0xc8a024]) },
      ],
    });

    const stem = new THREE.CylinderGeometry(0.5, 0.75, 3, 7);
    stem.translate(0, 1.5, 0);
    const cap = new THREE.SphereGeometry(2, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2);
    cap.translate(0, 3, 0);
    scatter(ctx, {
      count: 90, clearance: 12, sizeOf: random => 0.7 + random() * 1.5,
      parts: [
        { geometry: stem, material: solid(0xeadcc0) },
        { geometry: cap, material: solid(0xffffff), colorOf: pickFrom([0xc02020, 0xe07018, 0x8a3ab0]) },
      ],
    });

    const bush = new THREE.IcosahedronGeometry(1.6, 0);
    bush.translate(0, 0.9, 0);
    alongRoad(ctx, { every: 16, offset: 12.5, sizeOf: random => 0.6 + random() * 0.8, parts: [{ geometry: bush, material: solid(0xffffff), colorOf: pickFrom([0x6a3414, 0x8a4418, 0x5a6a1c]) }] });
  },
};
