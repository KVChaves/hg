import * as THREE from 'three';
import { paintGradient, paintSilhouette } from '../atmosphere.js';
import { cutTop, paintBlocks, speckle } from './wallPaint.js';
import { pixelTexture } from '../textures.js';
import { billboard, nearRoad, overRoad, pickFrom, scatter, solid } from './propKit.js';

// Selva fechada sob chuva: árvores gigantes, copas que escondem o céu e lama na estrada.

const blank = (width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return [canvas, canvas.getContext('2d')];
};

// Folhas largas saindo de um ponto na base.
function paintBroadLeaves(colors, count) {
  const [canvas, ctx] = blank(64, 64);
  for (let leaf = 0; leaf < count; leaf++) {
    const angle = -Math.PI / 2 + (leaf / (count - 1) - 0.5) * 2.5, length = 24 + Math.random() * 12;
    ctx.fillStyle = colors[leaf % colors.length];
    for (let t = 0; t < 1; t += 0.02) {
      const width = Math.sin(t * Math.PI) * 6;
      const droop = t * t * 10;
      const x = 32 + Math.cos(angle) * length * t, y = 62 + Math.sin(angle) * length * t + droop;
      ctx.fillRect(x - width, y - 1, width * 2, 2);
    }
  }
  return canvas;
}

function paintFern(colors) {
  const [canvas, ctx] = blank(64, 64);
  for (let frond = 0; frond < 9; frond++) {
    const angle = -Math.PI / 2 + (frond / 8 - 0.5) * 2.8, length = 26 + Math.random() * 8;
    ctx.fillStyle = colors[frond % colors.length];
    for (let t = 0; t < 1; t += 0.04) {
      const x = 32 + Math.cos(angle) * length * t, y = 63 + Math.sin(angle) * length * t + t * t * 12, spread = (1 - t) * 5;
      ctx.fillRect(x, y, 1, 1);
      ctx.fillRect(x - spread, y - spread * 0.5, spread, 1);
      ctx.fillRect(x, y - spread * 0.5, spread, 1);
    }
  }
  return canvas;
}

function paintCanopy(colors) {
  const [canvas, ctx] = blank(192, 128);
  // Muitas folhas miúdas, em tufos: de longe vira massa de folhagem, sem cara de bloco.
  for (let tuft = 0; tuft < 46; tuft++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random());
    const cx = 96 + Math.cos(a) * r * 78, cy = 64 + Math.sin(a) * r * 48, shade = colors[Math.floor(Math.random() * colors.length)];
    for (let leaf = 0; leaf < 70; leaf++) {
      const la = Math.random() * Math.PI * 2, lr = Math.sqrt(Math.random()) * 17;
      ctx.fillStyle = Math.random() < 0.12 ? LEAF_HIGHLIGHT : shade;
      ctx.fillRect(cx + Math.cos(la) * lr, cy + Math.sin(la) * lr * 0.7, 1 + Math.random() * 3, 1 + Math.random() * 2);
    }
  }
  return canvas;
}

function paintVine() {
  const [canvas, ctx] = blank(16, 96);
  for (let strand = 0; strand < 3; strand++) {
    let x = 3 + strand * 5;
    const end = 60 + Math.random() * 36;
    for (let y = 0; y < end; y++) {
      x += Math.random() * 2 - 1;
      ctx.fillStyle = y % 7 === 0 ? '#5a9a3a' : '#2e5a26';
      ctx.fillRect(x, y, y % 7 === 0 ? 3 : 1, 1);
    }
  }
  return canvas;
}

function barkMaterial() {
  const [canvas, ctx] = blank(64, 256);
  ctx.fillStyle = '#3c2c1c';
  ctx.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 180; i++) { ctx.fillStyle = i % 3 ? '#281c10' : '#4e3a26'; ctx.fillRect(Math.random() * 64, Math.random() * 256, 1, 8 + Math.random() * 26); }
  for (let i = 0; i < 700; i++) {
    // O musgo fica mais denso perto do chão.
    const y = 256 * Math.sqrt(Math.random());
    ctx.fillStyle = i % 2 ? '#4a7a30' : '#6a9a3a';
    ctx.fillRect(Math.random() * 64, 256 - y * 0.8 - 1, 1 + Math.random() * 3, 1 + Math.random() * 2);
  }
  const texture = pixelTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return new THREE.MeshBasicMaterial({ map: texture });
}

const LEAF_HIGHLIGHT = '#7ab84a';
const LEAF_GREENS = ['#2e6a2a', '#3e8a34', '#1e4a22', '#5a9a3a'];
const DARK_GREENS = ['#16381c', '#1e4a22', '#2a5a26', '#234e20'];

export const JUNGLE = {
  id: 'jungle', name: 'SELVA', music: 'forestField',
  sky: 0x3e5c3e, fog: [6, 120], cabinTint: 0x96c48c,
  shape: { wiggle: 0.26, targetLength: 2050, relief: 11, hillScale: 150, banks: 10, sharpCurves: 2 },
  layout: {
    jumpHops: 2,
    tunnels: { count: 3, length: [80, 140], open: true },
  },
  ground: {
    base: [46, 66, 34], variation: 22,
    paint(ctx) { for (const color of ['#5a8a34', '#2a4220', '#3e5a24']) { ctx.fillStyle = color; for (let i = 0; i < 40; i++) ctx.fillRect(Math.random() * 64, Math.random() * 64, 1 + Math.random() * 3, 1); } },
  },
  road: {
    base: [78, 64, 42], variation: 24, edge: '#3a4a26', center: '#5a4a30',
    paint(ctx) {
      ctx.fillStyle = 'rgba(40,30,18,.6)';
      ctx.fillRect(14, 0, 5, 64);
      ctx.fillRect(45, 0, 5, 64);
      ctx.fillStyle = 'rgba(170,190,170,.55)';
      for (let i = 0; i < 14; i++) ctx.fillRect(Math.random() * 64, Math.random() * 64, 2 + Math.random() * 8, 1);
    },
  },
  kerb: ['#4a5a30', '#3a3020'],
  gantry: [0x2a1c10, 0x3a6a2a, 0xc8b070],
  tunnel: { rib: 0x2a1c10, leaves: 0x24561f },
  // Ruína de pedra tomada pelo musgo e pelos cipós.
  wall: {
    height: 3.2, tile: 8,
    paint(ctx, w, h) {
      paintBlocks(w, h, 24, 8, (x, y, bw, bh) => {
        ctx.fillStyle = ['#5a6a50', '#4e5e48', '#66745a'][Math.floor(Math.random() * 3)];
        ctx.fillRect(x, y, bw - 1, bh - 1);
      });
      speckle(ctx, w, h, ['#3e8a34', '#5a9a3a', '#2e6a2a'], 340);
      ctx.fillStyle = '#2e5a26';
      for (let vine = 0; vine < 10; vine++) ctx.fillRect(Math.floor(Math.random() * w), 0, 1, 10 + Math.floor(Math.random() * 18));
      cutTop(ctx, w, x => (Math.sin(x * 0.4) > 0.5 ? 3 : 0) + (x % 37 < 8 ? 2 : 0));
    },
  },
  epic: { abyss: 0x1f6a5c, glow: false, edge: '#7ab84a', tube: { wall: '#4a3a24', speckle: ['#3a7a30', '#5a4a2c', '#2e5a26'], rib: 0x2a1c10, portal: 0x3e6a2e, lines: [{ angle: Math.PI * 0.5, width: 0.05, color: 0x7ab84a }, { angle: Math.PI * 1.5, width: 0.05, color: 0x7ab84a }] } },
  weather: { count: 620, streak: 2.8, fall: 46, sway: 0.15, swaySpeed: 1, colors: [0xa8c4b0] },

  paintSky(ctx, w, h) {
    paintGradient(ctx, w, h, [[0, '#6a8a70'], [0.7, '#4e6e50'], [1, '#3e5c3e']]);
    paintSilhouette(ctx, w, h, '#2e4a30', 21, 44, 16);
    paintSilhouette(ctx, w, h, '#1e3822', 33, 26, 6);
  },

  addProps(ctx) {
    const bark = barkMaterial();
    const trunk = new THREE.CylinderGeometry(1.1, 2.2, 30, 7);
    trunk.translate(0, 15, 0);
    const root = new THREE.ConeGeometry(4.2, 5, 5);
    root.translate(0, 2.5, 0);
    const crown = billboard(paintCanopy(DARK_GREENS), 30, 18, 26);
    const trees = [{ geometry: trunk, material: bark }, { geometry: root, material: bark }, crown];
    scatter(ctx, { count: 520, clearance: 16, sizeOf: random => 0.8 + random() * 0.8, parts: trees });
    nearRoad(ctx, { count: 240, from: 12, to: 28, sizeOf: random => 0.7 + random() * 0.6, parts: trees });

    const bigLeaves = billboard(paintBroadLeaves(LEAF_GREENS, 7), 9, 8);
    nearRoad(ctx, { count: 420, from: 10.5, to: 26, sizeOf: random => 0.6 + random() * 1.1, parts: [bigLeaves] });
    const ferns = billboard(paintFern(LEAF_GREENS), 5, 3.6);
    nearRoad(ctx, { count: 620, from: 9.5, to: 22, sizeOf: random => 0.6 + random() * 0.9, parts: [ferns] });

    // Copas e cipós fecham o alto da estrada.
    const roofLeaves = billboard(paintCanopy(['#1e4a22', '#2e6a2a', '#16381c', '#3e8a34']), 24, 12);
    overRoad(ctx, { count: 240, height: [15, 22], lateral: 15, sizeOf: random => 0.7 + random() * 0.8, parts: [roofLeaves] });
    const vines = billboard(paintVine(), 2.4, 13, -13);
    overRoad(ctx, { count: 150, height: [17, 21], lateral: 11, sizeOf: random => 0.7 + random() * 0.5, parts: [vines] });

    const rock = new THREE.DodecahedronGeometry(2, 0);
    nearRoad(ctx, {
      count: 90, from: 10, to: 20, sizeOf: random => [0.5 + random(), 0.4 + random() * 0.6, 0.5 + random()],
      parts: [{ geometry: rock, material: solid(0xffffff), colorOf: pickFrom([0x4e6a3a, 0x5e7248, 0x3e5230]) }],
    });
  },
};
