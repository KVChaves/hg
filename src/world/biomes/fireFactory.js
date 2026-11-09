import * as THREE from 'three';
import { paintGradient, paintSilhouette } from '../atmosphere.js';
import { speckle } from './wallPaint.js';
import { acrossRoad, archFrame, alongRoad, nearRoad, pickFrom, scatter, solid } from './propKit.js';

// Céu em brasa, piso de chapas de aço, escória com rachaduras de fogo, chaminés e tanques.
export const FIRE_FACTORY = {
  id: 'fireFactory', name: 'FABRICA DE FOGO', music: 'fireFactory',
  sky: 0x4a1608, fog: [8, 170], cabinTint: 0xf0a878,
  shape: { wiggle: 0.24, targetLength: 2050, relief: 7, hillScale: 150, sharpCurves: 2 },
  layout: {
    jumpHops: 3,
    tunnels: { count: 2, length: [80, 130] },
  },
  ground: {
    base: [30, 24, 24], variation: 16,
    paint(ctx) { ctx.fillStyle = '#ff6a10'; for (let i = 0; i < 8; i++) { let x = Math.random() * 64, y = Math.random() * 64; for (let k = 0; k < 10; k++) { ctx.fillRect(x, y, 1, 1); x += Math.random() * 3 - 1; y += Math.random() * 2; } } },
  },
  road: {
    base: [62, 60, 64], variation: 12, edge: '#e0a020', center: '#e07018',
    paint(ctx) {
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      for (let x = 0; x < 64; x += 16) ctx.fillRect(x, 0, 1, 64);
      for (let y = 0; y < 64; y += 16) ctx.fillRect(0, y, 64, 1);
      ctx.fillStyle = '#9a98a0';
      for (let x = 3; x < 64; x += 16) for (let y = 3; y < 64; y += 16) ctx.fillRect(x, y, 1, 1);
    },
  },
  kerb: ['#e8b018', '#1a1816'],
  gantry: [0x2c2826, 0xd86818, 0xf0d040],
  tunnel: { wall: '#3a3430', speckle: ['#4e4640', '#2a2422', '#6a3a1c'], rib: 0x8a6420, portal: 0xd89018, lines: [{ angle: Math.PI / 2, width: 0.05, color: 0xff7a18 }, { angle: 0.5, width: 0.03, color: 0xffb030 }, { angle: Math.PI - 0.5, width: 0.03, color: 0xffb030 }] },
  // Chapas de aço enferrujadas com faixa de perigo.
  wall: {
    height: 3.4, tile: 8,
    paint(ctx, w, h) {
      ctx.fillStyle = '#4e4640';
      ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, ['#7a4a20', '#5a3a24', '#3a3430'], 260);
      for (let x = 0; x < w; x += 32) {
        ctx.fillStyle = '#1e1a18';
        ctx.fillRect(x, 0, 1, h);
        ctx.fillStyle = '#9a9288';
        for (const y of [10, 28]) { ctx.fillRect(x + 3, y, 1, 1); ctx.fillRect(x + 28, y, 1, 1); }
      }
      for (let x = 0; x < w; x += 8) {
        ctx.fillStyle = x % 16 ? '#1a1816' : '#e8b018';
        ctx.fillRect(x, 0, 8, 6);
      }
    },
  },
  epic: { abyss: 0xff6a10, glow: true, edge: '#ffd040', tube: { wall: '#3a3430', speckle: ['#4e4640', '#6a3a1c', '#2a2422'], rib: 0xd8a818, portal: 0xe8b018, lines: [{ angle: 0, width: 0.04, color: 0xff7a18 }, { angle: Math.PI, width: 0.04, color: 0xff7a18 }] } },
  weather: { count: 320, size: 2, fall: -6, sway: 1.6, swaySpeed: 2, colors: [0xff7a18, 0xffb040, 0xff4010] },

  paintSky(ctx, w, h) {
    paintGradient(ctx, w, h, [[0, '#120406'], [0.5, '#5a1408'], [0.85, '#b03a10'], [1, '#4a1608']]);
    ctx.fillStyle = 'rgba(20,10,10,.75)';
    for (let plume = 0; plume < 12; plume++) { const x = Math.random() * w; for (let y = 0; y < h / 2; y += 3) ctx.fillRect(x + Math.sin(y * 0.1 + plume) * 14 + y * 0.2, y, 14 + y * 0.12, 3); }
    paintSilhouette(ctx, w, h, '#1a0a08', 27, 20, 8);
  },

  addProps(ctx) {
    const chimney = new THREE.CylinderGeometry(1.6, 2.6, 34, 7);
    chimney.translate(0, 17, 0);
    const glow = new THREE.CylinderGeometry(1.8, 1.8, 1.6, 7);
    glow.translate(0, 34.8, 0);
    scatter(ctx, {
      count: 70, clearance: 26, sizeOf: random => 0.7 + random() * 0.8,
      parts: [{ geometry: chimney, material: solid(0x3a3230) }, { geometry: glow, material: solid(0xff7a18, { fog: false }) }],
    });

    const tank = new THREE.CylinderGeometry(7, 7, 10, 10);
    tank.translate(0, 5, 0);
    const rim = new THREE.CylinderGeometry(7.2, 7.2, 0.7, 10);
    rim.translate(0, 10.2, 0);
    scatter(ctx, {
      count: 80, clearance: 24, sizeOf: random => 0.7 + random() * 0.7,
      parts: [
        { geometry: tank, material: solid(0xffffff), colorOf: pickFrom([0x5a5048, 0x6a4020, 0x48484e]) },
        { geometry: rim, material: solid(0xd8a818) },
      ],
    });

    const shed = new THREE.BoxGeometry(1, 1, 1);
    shed.translate(0, 0.5, 0);
    scatter(ctx, {
      count: 150, clearance: 22, sizeOf: random => [12 + random() * 22, 7 + random() * 12, 10 + random() * 20],
      parts: [{ geometry: shed, material: solid(0xffffff), colorOf: pickFrom([0x3e3430, 0x4a2c20, 0x2e2c30, 0x5c3a24]) }],
    });

    const flame = new THREE.ConeGeometry(1.2, 5, 5);
    flame.translate(0, 2.5, 0);
    alongRoad(ctx, { every: 44, offset: 14, sizeOf: random => 0.7 + random() * 0.9, parts: [{ geometry: flame, material: solid(0xffffff, { fog: false }), colorOf: pickFrom([0xff9a20, 0xff6a10, 0xffc040]) }] });

    // Caçambas despejando metal derretido.
    const bucket = new THREE.CylinderGeometry(3.2, 2.2, 3.4, 8);
    bucket.translate(0, 15, 0);
    const pour = new THREE.CylinderGeometry(0.6, 0.9, 14, 6);
    pour.translate(0, 7, 0);
    const moltenMaterial = solid(0xff8a18, { fog: false });
    nearRoad(ctx, { count: 26, from: 15, to: 26, parts: [{ geometry: bucket, material: solid(0x34302c) }, { geometry: pour, material: moltenMaterial }] });
    ctx.onUpdate(time => moltenMaterial.color.setHex(Math.floor(time * 9) % 2 ? 0xff8a18 : 0xffb030));

    // Dutos passando por cima da estrada.
    acrossRoad(ctx, {
      every: 62,
      build: random => {
        const arch = archFrame({ height: 8, post: 0x2c2826, beam: 0x4a3a2a, trim: 0xe8a018 });
        const duct = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 34, 8), solid(pickFrom([0x6a5a48, 0x7a4a28, 0x505058])(random)));
        duct.rotation.z = Math.PI / 2;
        duct.position.y = 10;
        arch.add(duct);
        return arch;
      },
    });
  },
};
