import * as THREE from 'three';
import { paintGradient, paintSilhouette } from '../atmosphere.js';
import { speckle } from './wallPaint.js';
import { acrossRoad, alongRoad, archFrame, EDGE, nearRoad, pickFrom, scatter, solid } from './propKit.js';

// Planície de sal branco ao entardecer, onde se tentam recordes de velocidade. O desafio é dosar a velocidade:
// placas de turbo espalhadas em faixas sorteadas jogam o carro acima da máxima, mas as retas longas terminam em
// grampos fechados. E o salto sobre a lagoa de salmoura tem um vão enorme: só passa quem pega a placa de turbo
// antes da rampa (ou chega de nitro, ou no vácuo de alguém). Quem erra cai na lagoa.
export const SALT_FLATS = {
  id: 'saltFlats', name: 'SALAR DO RECORDE', music: 'saltFlats',
  challenge: ['PLACAS DE TURBO JOGAM O CARRO A 152 KM/H', 'O SALTO E LONGO DEMAIS: PEGUE O TURBO DA RAMPA OU NITRO'],   // aparece no pop-up de antes da largada
  sky: 0xf2c4cc, fog: [40, 420], cabinTint: 0xfff0ee,
  // Retas compridíssimas e grampos nas pontas: um oval esticado e achatado.
  shape: { wiggle: 0.12, targetLength: 2700, relief: 2, hillScale: 300, sharpCurves: 3, harmonics: [[2, 0.6], [3, 0.3]], stretch: [1.55, 0.58] },
  surface: { grip: 1.04, side: 0.82, top: 1.04, accel: 1.02, offroad: 1 },   // sal duro: rápido, mas a traseira escapa
  layout: {
    // Vão de 72 m: na máxima (125 km/h) o carro cai antes da outra margem; pede ~130. A placa da rampa leva a 152 km/h.
    jump: { gap: 72, boost: true, below: 2.5, fallLabel: 'CAIU NA SALMOURA' },
    boosts: { count: 7, half: 2.4 },
    hazards: [{ kind: 'roadworks', count: 2 }, { kind: 'tumbleweeds', count: 2 }],   // cones da cronometragem e mato seco
    tunnels: { count: 0, length: [0, 0] },           // no salar não há onde se esconder
  },
  ground: {
    base: [238, 234, 232], variation: 8,
    // Crosta de sal em placas hexagonais, com bordas levantadas.
    paint(ctx) {
      ctx.fillStyle = 'rgba(190,180,186,.6)';
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
          const cx = col * 14 + (row % 2) * 7, cy = row * 13;
          ctx.fillRect(cx, cy, 8, 1); ctx.fillRect(cx - 3, cy + 1, 1, 6); ctx.fillRect(cx + 10, cy + 1, 1, 6); ctx.fillRect(cx, cy + 7, 8, 1);
        }
      }
      ctx.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 24; i++) ctx.fillRect(Math.random() * 64, Math.random() * 64, 1, 1);
    },
  },
  road: {
    base: [212, 206, 206], variation: 6, edge: '#e83a5a', center: '#6a6478',
    // Sal compactado pelas máquinas, com marcas de pneu escuras.
    paint(ctx) {
      ctx.fillStyle = 'rgba(80,70,80,.22)'; for (let i = 0; i < 6; i++) ctx.fillRect(Math.random() * 64, 0, 2, 64);
      ctx.fillStyle = 'rgba(255,255,255,.6)'; for (let i = 0; i < 18; i++) ctx.fillRect(Math.random() * 64, Math.random() * 64, 2 + Math.random() * 4, 1);
    },
  },
  kerb: ['#e83a5a', '#f8f4f0'],
  gantry: saltGate,
  tunnel: { wall: '#d8d0d0', speckle: ['#c8c0c4', '#e8e4e4'], rib: 0xe83a5a, portal: 0x1a1a1a, lines: [{ angle: Math.PI / 2, width: 0.05, color: 0x30f0ff }] },
  // Barreira baixa de lona listrada, a da cronometragem.
  wall: {
    height: 1.3, tile: 8,
    paint(ctx, w, h) {
      for (let x = 0; x < w; x += 16) {
        ctx.fillStyle = x % 32 ? '#f8f4f0' : '#e83a5a';
        ctx.fillRect(x, 0, 16, h);
      }
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, w, 2); ctx.fillRect(0, h - 3, w, 3);
      speckle(ctx, w, h, ['#c8c0c0', '#d02848'], 40);
    },
  },
  // Rampa de aço com faixas de perigo, sobre a lagoa rosada de salmoura.
  epic: { ramp: { stone: [0x6a6e78, 0x7a7e88, 0x8a8e98, 0x5a5e68], mortar: 0x2a2c32, moss: [0x9a9ea8, 0xb0b4be, 0xf0c030] }, abyss: 0xd87a9a, glow: false, edge: '#30f0ff', tube: { wall: '#d8d0d0', speckle: ['#c8c0c4'], rib: 0xe83a5a, portal: 0x1a1a1a, lines: [] } },
  // Cristais de sal faiscando no ar.
  weather: { count: 140, size: 1, fall: -0.3, sway: 0.6, swaySpeed: 0.9, colors: [0xffffff, 0xffe4ec, 0xfff8d8] },

  paintSky(ctx, w, h) {
    paintGradient(ctx, w, h, [[0, '#4a3a7a'], [0.45, '#c87aa8'], [0.8, '#f8b898'], [1, '#f2c4cc']]);
    ctx.fillStyle = '#fff0c8';                                  // sol baixo, enorme
    ctx.beginPath(); ctx.arc(w * 0.3, h * 0.74, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,200,.35)';
    ctx.beginPath(); ctx.arc(w * 0.3, h * 0.74, 34, 0, Math.PI * 2); ctx.fill();
    paintSilhouette(ctx, w, h, '#7a5a8a', 6, 18, 6);            // cordilheira distante, azulada
    // O sal molhado espelha o céu logo acima do horizonte.
    ctx.fillStyle = 'rgba(255,220,230,.5)';
    for (let x = 0; x < w; x += 2) ctx.fillRect(x, h - 8 - Math.sin(x * 0.2) * 1.5, 2, 1);
  },

  addProps(ctx) {
    // Montes de sal colhido, em fileiras.
    const pile = new THREE.ConeGeometry(2.4, 2.2, 6);
    pile.translate(0, 1.1, 0);
    scatter(ctx, { count: 260, clearance: 16, sizeOf: random => 0.6 + random() * 0.9, parts: [{ geometry: pile, material: solid(0xffffff), colorOf: pickFrom([0xf8f6f4, 0xece6e4, 0xf4ecec]) }] });

    // Poças de salmoura rosa e espelhos d'água refletindo o céu.
    const pool = new THREE.CylinderGeometry(6, 6, 0.08, 10);
    pool.translate(0, 0.04, 0);
    scatter(ctx, { count: 70, clearance: 14, sizeOf: random => [0.6 + random() * 2.2, 1, 0.5 + random() * 1.4], parts: [{ geometry: pool, material: solid(0xffffff), colorOf: pickFrom([0xe8a0b8, 0xd8b0d8, 0xf0c8c8, 0xa8c8e8]) }] });

    // Acampamento das equipes: trailers e tendas na beira.
    const trailer = new THREE.BoxGeometry(3, 2.6, 7);
    trailer.translate(0, 1.6, 0);
    const stripe = new THREE.BoxGeometry(3.05, 0.4, 7.05);
    stripe.translate(0, 1.8, 0);
    nearRoad(ctx, { count: 30, from: EDGE + 8, to: EDGE + 26, parts: [{ geometry: trailer, material: solid(0xffffff), colorOf: pickFrom([0xe8e0d8, 0xd8d0c8, 0xf0e8e0]) }, { geometry: stripe, material: solid(0xffffff), colorOf: pickFrom([0xe83a5a, 0x3a8ae8, 0xf0a020]) }] });
    const tent = new THREE.ConeGeometry(3, 3, 4);
    tent.rotateY(Math.PI / 4);
    tent.translate(0, 1.5, 0);
    nearRoad(ctx, { count: 40, from: EDGE + 6, to: EDGE + 22, parts: [{ geometry: tent, material: solid(0xffffff), colorOf: pickFrom([0xf0c030, 0xe83a5a, 0x3a8ae8, 0xf8f4f0]) }] });

    // Placas de velocidade ao longo das retas.
    const post = new THREE.BoxGeometry(0.15, 2.4, 0.15);
    post.translate(0, 1.2, 0);
    const board = new THREE.BoxGeometry(1.6, 1, 0.1);
    board.translate(0, 2.7, 0);
    alongRoad(ctx, { every: 60, offset: EDGE + 1.5, parts: [{ geometry: post, material: solid(0x3a3a3a) }, { geometry: board, material: solid(0xffffff), colorOf: pickFrom([0xf8f4f0, 0x1a1a1a]) }] });

    // Torres de cronometragem com luz que pisca.
    const tower = new THREE.BoxGeometry(2.4, 9, 2.4);
    tower.translate(0, 4.5, 0);
    const cabin = new THREE.BoxGeometry(4, 2.4, 4);
    cabin.translate(0, 10.2, 0);
    const beacon = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    beacon.translate(0, 11.8, 0);
    const beaconMaterial = solid(0x30f0ff, { fog: false });
    nearRoad(ctx, { count: 8, from: EDGE + 6, to: EDGE + 14, parts: [{ geometry: tower, material: solid(0x8a8e98) }, { geometry: cabin, material: solid(0x2a2c32) }, { geometry: beacon, material: beaconMaterial }] });
    ctx.onUpdate(time => { beaconMaterial.color.setHex(Math.floor(time * 2) % 2 ? 0x30f0ff : 0xf040c0); });

    // Pórticos de cronometragem sobre a pista, com painel de luzes.
    acrossRoad(ctx, {
      every: 280,
      build: () => {
        const arch = archFrame({ height: 8, post: 0x2a2c32, beam: 0x1a1a1a, trim: 0xe83a5a });
        for (let x = -8; x <= 8; x += 2) {
          const light = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.3), solid(x % 4 ? 0x30f0ff : 0xf0c030, { fog: false }));
          light.position.set(x, 8, 0.5);
          arch.add(light);
        }
        return arch;
      },
    });
  },
};

// Arco de chegada: quadriculado preto e branco de bandeira de largada, com placar de recorde.
function saltGate(g, { postX, span }) {
  const add = (w, h, d, x, y, color, extra = {}) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), solid(color, extra));
    mesh.position.set(x, y, 0);
    g.add(mesh);
  };
  for (const s of [-1, 1]) add(0.9, 9, 0.9, s * postX, 4.5, 0x2a2c32);
  const squares = Math.round(span / 1.2);
  for (let i = 0; i < squares; i++) for (let row = 0; row < 2; row++) add(span / squares, 0.7, 0.4, -span / 2 + (i + 0.5) * span / squares, 8.6 + row * 0.7, (i + row) % 2 ? 0x1a1a1a : 0xf8f4f0);
  add(6, 1.4, 0.5, 0, 10.8, 0x1a1a1a);
  add(5.4, 0.8, 0.55, 0, 10.8, 0x30f0ff, { fog: false });
}
