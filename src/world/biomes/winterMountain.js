import * as THREE from 'three';
import { paintGradient, paintSilhouette } from '../atmosphere.js';
import { cutTop, paintBlocks, speckle } from './wallPaint.js';
import { acrossRoad, archFrame, EDGE, nearRoad, pickFrom, scatter, solid } from './propKit.js';

// Céu frio com aurora, estrada de neve batida, pinheiros e cristais de gelo.
export const WINTER_MOUNTAIN = {
  id: 'winterMountain', name: 'MONTANHA NEVADA', music: 'winterMountain',
  sky: 0xa4b8cc, fog: [16, 200], cabinTint: 0xc4d8f0,
  shape: { wiggle: 0.24, targetLength: 2200, relief: 30, hillScale: 210, banks: 11, sharpCurves: 2 },
  layout: {
    jumpHops: 2,
    tunnels: { count: 2, length: [110, 170] },
  },
  ground: {
    base: [226, 232, 240], variation: 12,
    paint(ctx) { ctx.fillStyle = 'rgba(150,180,215,.35)'; for (let i = 0; i < 24; i++) ctx.fillRect(Math.random() * 64, Math.random() * 64, 2 + Math.random() * 8, 1); },
  },
  road: {
    base: [172, 182, 196], variation: 16, edge: '#f4f8fc', center: '#6aa0d0',
    paint(ctx) { ctx.fillStyle = 'rgba(238,244,250,.8)'; for (let i = 0; i < 30; i++) ctx.fillRect(Math.random() * 64, Math.random() * 64, 1 + Math.random() * 7, 1); },
  },
  kerb: ['#2858a0', '#f0f4f8'],
  gantry: [0x34404e, 0x2858a0, 0xe8eef4],
  tunnel: {
    wall: '#7cc4e4', speckle: ['#a8def2', '#5aa4cc', '#d4f0fa'], rib: 0xb8e6f6, portal: 0xeaf6fc,
    lines: [{ angle: Math.PI / 2, width: 0.05, color: 0xc8f4ff }],
    spikes: { color: 0xc4ecf8, count: 90 },
  },
  // Muralha de blocos de gelo com neve em cima.
  wall: {
    height: 3, tile: 8,
    paint(ctx, w, h) {
      paintBlocks(w, h, 20, 10, (x, y, bw, bh) => {
        ctx.fillStyle = ['#8ccfea', '#a8def2', '#74bcdc'][Math.floor(Math.random() * 3)];
        ctx.fillRect(x, y, bw - 1, bh - 1);
        ctx.fillStyle = '#d8f2fc';
        ctx.fillRect(x + 1, y + 1, bw - 4, 1);
      });
      speckle(ctx, w, h, ['#e8f8fe', '#5aa4cc'], 110);
      ctx.fillStyle = '#f4f8fc';
      for (let x = 0; x < w; x++) ctx.fillRect(x, 0, 1, 6 + Math.round(Math.sin(x * 0.3) * 2));
      cutTop(ctx, w, x => Math.round(1.5 + Math.sin(x * 0.17) * 1.5));
    },
  },
  epic: { shallow: true, ramp: { stone: [0x3e4652, 0x5a6470, 0x6e7884, 0x4e5662], mortar: 0x2a3038, moss: [0xe8f0f6, 0xd0dce6, 0xffffff] }, abyss: 0x3a6a9a, glow: false, edge: '#c8f4ff', tube: { wall: '#7cc4e4', speckle: ['#a8def2', '#5aa4cc', '#d4f0fa'], rib: 0xb8e6f6, portal: 0xeaf6fc, lines: [{ angle: Math.PI * 0.5, width: 0.04, color: 0xc8f4ff }] } },
  weather: { count: 700, size: 2, fall: 11, sway: 3.2, swaySpeed: 1.8, colors: [0xffffff, 0xe8f0fa] },

  paintSky(ctx, w, h) {
    paintGradient(ctx, w, h, [[0, '#1c3058'], [0.55, '#5e80ac'], [1, '#a4b8cc']]);
    ctx.fillStyle = 'rgba(90,240,170,.32)';
    for (let band = 0; band < 3; band++) for (let x = 0; x < w; x++) ctx.fillRect(x, 26 + band * 16 + Math.sin(x * 0.05 + band * 2) * 10, 1, 18 + Math.sin(x * 0.11 + band) * 8);
    paintSilhouette(ctx, w, h, '#7c8ea8', 5, 34, 8);
    paintSilhouette(ctx, w, h, '#e8eef6', 5, 12, 26);
    paintSilhouette(ctx, w, h, '#92a4bc', 9, 18, 2);
  },

  addProps(ctx) {
    const trunk = new THREE.CylinderGeometry(0.4, 0.6, 2.4, 5);
    trunk.translate(0, 1.2, 0);
    const lower = new THREE.ConeGeometry(3.4, 5, 6);
    lower.translate(0, 4.4, 0);
    const upper = new THREE.ConeGeometry(2.4, 4.4, 6);
    upper.translate(0, 7.8, 0);
    const snow = new THREE.ConeGeometry(1.3, 2.2, 6);
    snow.translate(0, 10.2, 0);
    scatter(ctx, {
      count: 620, clearance: 13, sizeOf: random => 0.8 + random() * 0.9,
      parts: [
        { geometry: trunk, material: solid(0x2a1c14) },
        { geometry: lower, material: solid(0xffffff), colorOf: pickFrom([0x24503c, 0x2c5e44, 0x1e4634]) },
        { geometry: upper, material: solid(0xffffff), colorOf: pickFrom([0x2c5e44, 0x346a4c]) },
        { geometry: snow, material: solid(0xf0f4f8) },
      ],
    });

    const crystal = new THREE.OctahedronGeometry(2, 0);
    crystal.scale(0.7, 2.6, 0.7);
    crystal.translate(0, 4, 0);
    scatter(ctx, {
      count: 130, clearance: 15, sizeOf: random => 0.7 + random() * 1.3,
      parts: [{ geometry: crystal, material: solid(0xffffff), colorOf: pickFrom([0x88d8f4, 0xb0e8f8, 0x60b8e0]) }],
    });

    const rock = new THREE.DodecahedronGeometry(3, 0);
    scatter(ctx, {
      count: 120, clearance: 12, sizeOf: random => [0.6 + random() * 1.6, 0.5 + random() * 1.2, 0.6 + random() * 1.6],
      parts: [{ geometry: rock, material: solid(0xffffff), colorOf: pickFrom([0x6a7078, 0x808690, 0x565c66]) }],
    });

    // Montes de neve na beira e paredões de gelo fecham a estrada.
    const drift = new THREE.IcosahedronGeometry(3, 0);
    drift.scale(1.6, 0.6, 1.2);
    nearRoad(ctx, { count: 300, from: EDGE - 1.5, to: EDGE + 6, sizeOf: random => 0.6 + random(), parts: [{ geometry: drift, material: solid(0xffffff), colorOf: pickFrom([0xf4f8fc, 0xdce8f2, 0xc8d8e8]) }] });
    const iceColumn = new THREE.CylinderGeometry(1.4, 2.6, 16, 6);
    iceColumn.translate(0, 8, 0);
    nearRoad(ctx, { count: 110, from: EDGE + 2, to: EDGE + 18, sizeOf: random => [0.6 + random() * 0.8, 0.6 + random() * 1.2, 0.6 + random() * 0.8], parts: [{ geometry: iceColumn, material: solid(0xffffff), colorOf: pickFrom([0x7cc4e4, 0xa8def2, 0x5aa4cc]) }] });

    // Cabanas com a janela acesa.
    const hut = new THREE.BoxGeometry(8, 5, 7);
    hut.translate(0, 2.5, 0);
    const roof = new THREE.ConeGeometry(6.5, 4, 4);
    roof.rotateY(Math.PI / 4);
    roof.translate(0, 7, 0);
    const litWindow = new THREE.BoxGeometry(8.1, 1.4, 1.8);
    litWindow.translate(0, 2.8, 0);
    nearRoad(ctx, { count: 26, from: EDGE + 8, to: EDGE + 22, parts: [{ geometry: hut, material: solid(0x5a3c24) }, { geometry: roof, material: solid(0xf0f4f8) }, { geometry: litWindow, material: solid(0xffc860, { fog: false }) }] });

    // Teleférico cruzando a pista.
    acrossRoad(ctx, {
      every: 210,
      build: () => {
        const arch = archFrame({ height: 15, post: 0x3a4654, beam: 0x2a3440 });
        for (const x of [-7, 0, 7]) {
          const chair = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.2, 1), solid(0xc83a2a));
          chair.position.set(x, 12, 0);
          arch.add(chair);
        }
        return arch;
      },
    });

  },
};
