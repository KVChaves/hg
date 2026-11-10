import * as THREE from 'three';
import { paintGradient } from '../atmosphere.js';
import { ctxText } from '../../art/font.js';
import { acrossRoad, alongRoad, archFrame, EDGE, pickFrom, scatter, solid } from './propKit.js';

// Dia claro de competição: grama listrada, arquibancadas, refletores, bandeiras e confete.
export const STADIUM = {
  id: 'stadium', name: 'ESTADIO', music: 'stadium',
  sky: 0xbcdcf0, fog: [40, 340], cabinTint: 0xfff4e4,
  shape: { wiggle: 0.14, targetLength: 2100, relief: 3.5, hillScale: 220, sharpCurves: 2 },
  layout: {
    jump: { fallLabel: 'CAIU NA PISCINA' },
    hazards: [{ kind: 'roadworks', count: 2 }, { kind: 'pitTires', count: 2 }],   // obras sinalizadas e pneus soltos do box
    twist: true,                                     // só a pista de corrida tem o tubo giratório
    tunnels: { count: 1, length: [90, 130] },
  },
  ground: {
    base: [58, 132, 54], variation: 12,
    paint(ctx) { ctx.fillStyle = 'rgba(30,90,34,.55)'; for (let x = 0; x < 64; x += 16) ctx.fillRect(x, 0, 8, 64); },
  },
  road: {
    base: [70, 70, 74], variation: 8, edge: '#f0ece4', center: '#f0ece4',
    paint(ctx) { ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(10, 0, 6, 64); ctx.fillRect(48, 0, 6, 64); },
  },
  kerb: ['#d82020', '#f0ece4'],
  gantry: [0x2a2a30, 0x2060c0, 0xe8e4dc],
  tunnel: { wall: '#6e6e74', speckle: ['#828288', '#5a5a60', '#909096'], rib: 0xe8e4dc, portal: 0x2060c0, lines: [{ angle: Math.PI / 2, width: 0.06, color: 0xfff4c8 }] },
  // Barreira de corrida com patrocinadores inventados.
  wall: {
    height: 2.1, tile: 16,
    paint(ctx, w, h) {
      [['#d82020', 'VROOM'], ['#2060c0', 'TURBO'], ['#f0d020', 'GRIP'], ['#20a060', 'NITRO']].forEach(([color, text], i) => {
        ctx.fillStyle = color;
        ctx.fillRect(i * 32, 0, 32, h);
        ctxText(ctx, text, i * 32 + 2, 11, i === 2 ? '#14141a' : '#ffffff');
      });
      for (let x = 0; x < w; x += 8) {
        ctx.fillStyle = x % 16 ? '#f0ece4' : '#d82020';
        ctx.fillRect(x, 0, 8, 5);
      }
      ctx.fillStyle = '#34343a';
      ctx.fillRect(0, h - 6, w, 6);
    },
  },
  epic: { ramp: { stone: [0x6e6c68, 0x8a8884, 0x9a9890, 0x7a7874], mortar: 0x4a4844, moss: [0xd82020, 0xe8e4dc] }, abyss: 0x2060c0, glow: false, edge: '#f0ece4', tube: { wall: '#d8d4cc', speckle: ['#d82020', '#2060c0', '#c8c4bc'], rib: 0xd82020, portal: 0x2060c0, lines: [{ angle: Math.PI * 0.5, width: 0.05, color: 0xfff4c8 }, { angle: Math.PI * 1.5, width: 0.05, color: 0xfff4c8 }] } },
  weather: { count: 260, size: 2, fall: 3.5, sway: 2.4, swaySpeed: 2.2, colors: [0xff3040, 0x3070f0, 0xf0d020, 0x30c060, 0xffffff] },

  paintSky(ctx, w, h) {
    paintGradient(ctx, w, h, [[0, '#2a70c8'], [0.7, '#80bce8'], [1, '#bcdcf0']]);
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    for (let cloud = 0; cloud < 14; cloud++) {
      const cx = Math.random() * w, cy = 20 + Math.random() * 80;
      for (let puff = 0; puff < 7; puff++) { ctx.beginPath(); ctx.arc(cx + puff * 7 - 20, cy + Math.sin(puff) * 3, 5 + Math.random() * 6, 0, Math.PI * 2); ctx.fill(); }
    }
  },

  addProps(ctx) {
    const stand = new THREE.BoxGeometry(1, 1, 1);
    stand.translate(0, 0.5, 0);
    const crowd = new THREE.BoxGeometry(1, 0.55, 0.8);
    crowd.translate(0, 1.2, 0);
    scatter(ctx, {
      count: 150, clearance: 26, sizeOf: random => [26 + random() * 34, 10 + random() * 8, 14],
      parts: [
        { geometry: stand, material: solid(0x6a6c78) },
        { geometry: crowd, material: solid(0xffffff), colorOf: pickFrom([0xc04030, 0x3060b0, 0xe0c040, 0x40a060, 0xe8e0d0]) },
      ],
    });

    const pole = new THREE.BoxGeometry(0.7, 30, 0.7);
    pole.translate(0, 15, 0);
    const lamps = new THREE.BoxGeometry(6, 2.4, 0.6);
    lamps.translate(0, 31, 0);
    scatter(ctx, {
      count: 60, clearance: 20,
      parts: [{ geometry: pole, material: solid(0x2a2c32) }, { geometry: lamps, material: solid(0xfffae0, { fog: false }) }],
    });

    const mast = new THREE.BoxGeometry(0.16, 7, 0.16);
    mast.translate(0, 3.5, 0);
    const flag = new THREE.BoxGeometry(2.2, 1.3, 0.05);
    flag.translate(1.1, 6.2, 0);
    alongRoad(ctx, {
      every: 22, offset: EDGE - 0.5,
      parts: [{ geometry: mast, material: solid(0xc0c0c8) }, { geometry: flag, material: solid(0xffffff), colorOf: pickFrom([0xd82020, 0x2060c0, 0xf0d020, 0x20a060]) }],
    });

    // Arquibancadas acompanhando a pista.
    alongRoad(ctx, {
      every: 44, offset: EDGE + 22, facesRoad: true, sizeOf: random => [38, 12 + random() * 8, 14],
      parts: [
        { geometry: stand, material: solid(0x6a6c78) },
        { geometry: crowd, material: solid(0xffffff), colorOf: pickFrom([0xc04030, 0x3060b0, 0xe0c040, 0x40a060, 0xe8e0d0]) },
      ],
    });

    acrossRoad(ctx, { every: 190, build: () => archFrame({ post: 0xe8e4dc, beam: 0xd82020, trim: 0x2060c0 }) });
  },
};
