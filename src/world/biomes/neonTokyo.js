import * as THREE from 'three';
import { paintGradient, paintSilhouette, paintStars } from '../atmosphere.js';
import { speckle } from './wallPaint.js';
import { pixelTexture } from '../textures.js';
import { glyphTexture } from './neonGlyphs.js';
import { acrossRoad, alongRoad, archFrame, EDGE, nearRoad, pickFrom, scatter, solid } from './propKit.js';

function windowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 16, 32);
  for (let y = 1; y < 32; y += 3) {
    for (let x = 1; x < 16; x += 3) {
      ctx.fillStyle = Math.random() < 0.4 ? '#f8e080' : '#404050';
      ctx.fillRect(x, y, 2, 2);
    }
  }
  const texture = pixelTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// Noite chuvosa: pista com grade neon, prédios, letreiros e pórticos luminosos.
export const NEON_TOKYO = {
  id: 'neonTokyo', name: 'NEON TOKYO', music: 'neonTokyo',
  sky: 0x16102e, fog: [16, 220], cabinTint: 0xb4a0e8,
  shape: { wiggle: 0.26, targetLength: 2000, relief: 5, hillScale: 140, sharpCurves: 3 },
  layout: {
    jumpHops: 3,
    tunnels: { count: 2, length: [90, 140] },
  },
  ground: {
    base: [20, 18, 36], variation: 10,
    paint(ctx) { ctx.fillStyle = '#3a2a7a'; for (let i = 0; i < 64; i += 16) { ctx.fillRect(i, 0, 1, 64); ctx.fillRect(0, i, 64, 1); } },
  },
  road: {
    base: [20, 18, 32], variation: 8, edge: '#20e0f0', center: '#f040c0',
    paint(ctx) { ctx.fillStyle = 'rgba(32,224,240,.35)'; for (let y = 0; y < 64; y += 8) ctx.fillRect(4, y, 56, 1); },
  },
  kerb: ['#f030b0', '#20d0f0'],
  gantry: [0x18142a, 0xf030b0, 0x20e0f0],
  tunnel: { wall: '#16122c', speckle: ['#241c44', '#100c20', '#2e2458'], rib: 0xf030b0, portal: 0x20e0f0, lines: [{ angle: 0.45, width: 0.035, color: 0x20e0f0 }, { angle: Math.PI - 0.45, width: 0.035, color: 0xf030b0 }, { angle: Math.PI / 2, width: 0.03, color: 0xf0e020 }] },
  // Barreira de concreto com faixas de neon.
  wall: {
    height: 2.6, tile: 8,
    paint(ctx, w, h) {
      ctx.fillStyle = '#1e1a34';
      ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, ['#2a2448', '#141026'], 200);
      ctx.fillStyle = '#20e0f0';
      ctx.fillRect(0, 4, w, 3);
      ctx.fillStyle = '#f030b0';
      ctx.fillRect(0, 22, w, 2);
      ctx.fillStyle = '#f0e020';
      for (let x = 6; x < w; x += 32) { ctx.fillRect(x, 11, 6, 2); ctx.fillRect(x + 2, 9, 2, 8); ctx.fillRect(x + 14, 11, 2, 6); }
    },
  },
  epic: { ramp: { stone: [0x1a1628, 0x26203a, 0x302848, 0x1e1a30], mortar: 0x0c0a14, moss: [0x20e0f0, 0xf030b0] }, abyss: 0x2a1458, glow: true, edge: '#20e0f0', tube: { wall: '#14102a', speckle: ['#241c44', '#100c20', '#2e2458'], rib: 0xf030b0, portal: 0x20e0f0, lines: [{ angle: 0.8, width: 0.05, color: 0x20e0f0 }, { angle: 2.4, width: 0.05, color: 0xf030b0 }, { angle: 4, width: 0.05, color: 0xf0e020 }, { angle: 5.5, width: 0.05, color: 0x60f070 }] } },
  weather: { count: 700, streak: 2.2, fall: 48, sway: 0.1, swaySpeed: 1, colors: [0x8098e0] },

  paintSky(ctx, w, h) {
    paintGradient(ctx, w, h, [[0, '#06020e'], [0.6, '#2a1050'], [0.9, '#6a1a70'], [1, '#16102e']]);
    paintStars(ctx, w, h, '#d8d0f0', 160);
    ctx.fillStyle = '#f0e8ff';
    ctx.beginPath(); ctx.arc(w * 0.72, h * 0.2, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#100a24';
    for (let x = 0; x < w;) { const width = 8 + Math.random() * 18, height = 18 + Math.random() * 52; ctx.fillRect(x, h / 2 - height, width, height + 2); ctx.fillStyle = Math.random() < 0.4 ? '#180f36' : '#100a24'; x += width; }
    ctx.fillStyle = 'rgba(248,224,128,.7)';
    for (let i = 0; i < 300; i++) ctx.fillRect(Math.random() * w, h / 2 - Math.random() * 60, 1, 1);
    paintSilhouette(ctx, w, h, '#0a0618', 40, 8, 2);
  },

  addProps(ctx) {
    const tower = new THREE.BoxGeometry(1, 1, 1);
    tower.translate(0, 0.5, 0);
    scatter(ctx, {
      count: 380, clearance: 22, sizeOf: random => [10 + random() * 18, 16 + random() * 70, 10 + random() * 18],
      parts: [{ geometry: tower, material: new THREE.MeshBasicMaterial({ map: windowTexture() }), colorOf: pickFrom([0x5040a0, 0x402870, 0x304a90, 0x60306a]) }],
    });

    const sign = new THREE.BoxGeometry(1, 1, 0.4);
    sign.translate(0, 3.5, 0);
    const signMaterial = new THREE.MeshBasicMaterial({ map: glyphTexture(), fog: false });
    alongRoad(ctx, {
      every: 14, offset: EDGE + 1, facesRoad: true, sizeOf: random => [4 + random() * 8, 2 + random() * 6, 1],
      parts: [{ geometry: sign, material: signMaterial, colorOf: pickFrom([0xff30b0, 0x20e8f0, 0xf0e020, 0x60f070, 0xa040ff]) }],
    });
    ctx.onUpdate(time => signMaterial.color.setScalar(Math.sin(time * 37) > 0.93 ? 0.55 : 1));   // letreiros piscam

    // Lojinhas acesas coladas à calçada.
    const shop = new THREE.BoxGeometry(9, 5, 7);
    shop.translate(0, 2.5, 0);
    const awning = new THREE.BoxGeometry(9.6, 0.4, 2.4);
    awning.translate(0, 3.6, -4);
    nearRoad(ctx, {
      count: 150, from: EDGE + 3, to: EDGE + 12,
      parts: [
        { geometry: shop, material: solid(0xffffff), colorOf: pickFrom([0x302258, 0x3c2460, 0x24304e]) },
        { geometry: awning, material: solid(0xffffff, { fog: false }), colorOf: pickFrom([0xf030b0, 0x20e0f0, 0xf0d020, 0xff5030]) },
      ],
    });

    // Varais de lanternas de papel.
    acrossRoad(ctx, {
      every: 46,
      build: () => {
        const string = new THREE.Group();
        const wire = new THREE.Mesh(new THREE.BoxGeometry(32, 0.06, 0.06), solid(0x101018));
        wire.position.y = 9;
        string.add(wire);
        for (let x = -10; x <= 10; x += 2.5) {
          const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.55, 7, 5), solid(0xff4030, { fog: false }));
          lantern.position.set(x, 8.2, 0);
          string.add(lantern);
        }
        return string;
      },
    });

    acrossRoad(ctx, { every: 70, build: random => archFrame({ post: 0x18142a, beam: pickFrom([0xf030b0, 0x20e0f0, 0xa040ff])(random), trim: pickFrom([0xf0e020, 0x20e0f0])(random) }) });
  },
};
