import * as THREE from 'three';
import { paintGradient, paintSilhouette } from '../atmosphere.js';
import { cutTop, paintBlocks, speckle } from './wallPaint.js';
import { acrossRoad, archFrame, EDGE, nearRoad, pickFrom, scatter, solid } from './propKit.js';
import { desertGate } from './finishGates.js';

// Deserto ao meio-dia: sol forte, estrada de areia compactada, dunas, cactos, mesas de arenito e vento levantando areia.
export const DESERT = {
  id: 'desert', name: 'DESERTO', music: 'desert',
  sky: 0xf0cc90, fog: [20, 230], cabinTint: 0xffe2a8,
  // Retas longas e largas, quase um oval esticado, com dunas como lombadas; areia solta que arrasta e prende fora da pista.
  shape: { wiggle: 0.3, targetLength: 2500, relief: 26, hillScale: 300, banks: 8, sharpCurves: 1, harmonics: [[2, 1], [3, 0.25]], stretch: [1.25, 0.8] },
  surface: { grip: 0.92, side: 0.8, drag: 0.1, top: 0.97, offroad: 2.2 },
  layout: {
    jump: { fallLabel: 'CAIU NA AREIA MOVEDICA' },
    // Mato seco, caravana de camelos, cactos na pista e colunas de arenito que tombam.
    hazards: [{ kind: 'tumbleweeds', count: 2 }, { kind: 'camelCrossing', count: 1 }, { kind: 'cactusPatch', count: 2 }, { kind: 'sandPillar', count: 2 }, { kind: 'rockfall', count: 1 }],
    // Tempestade de areia: um trecho longo em que a neblina quase tapa a pista; só se vê o que está logo à frente.
    bumps: { height: 1.6, length: 110 },
    storm: { length: 320, label: 'AREIA', fog: [3, 30], color: 0xd2a868, wind: 60, grip: 0.85 },
    tunnels: { count: 2, length: [90, 140], open: true },     // arcos naturais de pedra
  },
  ground: {
    base: [222, 184, 112], variation: 14,
    paint(ctx) {
      ctx.fillStyle = 'rgba(176,132,70,.45)'; for (let i = 0; i < 26; i++) ctx.fillRect(Math.random() * 64, Math.random() * 64, 3 + Math.random() * 9, 1);
      ctx.fillStyle = 'rgba(250,222,160,.5)'; for (let i = 0; i < 18; i++) ctx.fillRect(Math.random() * 64, Math.random() * 64, 2, 1);
    },
  },
  road: {
    base: [200, 164, 104], variation: 10, edge: '#f4e4c0', center: '#8a5a2a',
    // Areia batida: marcas de roda fundas, ondulações do vento e pedrinhas.
    paint(ctx) {
      ctx.fillStyle = 'rgba(120,84,40,.45)'; ctx.fillRect(14, 0, 5, 64); ctx.fillRect(45, 0, 5, 64);
      ctx.fillStyle = 'rgba(244,222,170,.5)'; for (let y = 2; y < 64; y += 6) ctx.fillRect(22, y + Math.random() * 3, 20, 1);
      for (let i = 0; i < 18; i++) { ctx.fillStyle = ['#9a7440', '#e8cc94', '#7a5a30'][i % 3]; ctx.fillRect(Math.random() * 64, Math.random() * 64, 1 + Math.random() * 2, 1); }
    },
  },
  // Beira de pedras de arenito assentadas na areia.
  kerb: {
    paint(ctx, n) {
      ctx.fillStyle = '#c8a066'; ctx.fillRect(0, 0, n, n);
      for (const [x, y, w, h, c] of [[0, 1, 7, 6, '#a86a38'], [8, 0, 8, 7, '#b8501c'], [1, 9, 8, 6, '#c88a50'], [10, 9, 6, 7, '#8a5a30']]) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#e4bc84'; ctx.fillRect(x, y, w, 1); }
    },
  },
  gantry: desertGate,
  tunnel: { arch: 'rock', rib: 0xa86a38, leaves: 0xc88a50 },
  // Muro de adobe rachado.
  wall: {
    height: 2.8, tile: 8,
    paint(ctx, w, h) {
      paintBlocks(w, h, 22, 11, (x, y, bw, bh) => {
        ctx.fillStyle = ['#c8955a', '#b8844a', '#d6a56a'][Math.floor(Math.random() * 3)];
        ctx.fillRect(x, y, bw - 1, bh - 1);
        ctx.fillStyle = '#e4bc84';
        ctx.fillRect(x + 1, y + 1, bw - 4, 1);
      });
      speckle(ctx, w, h, ['#8a5a30', '#f0d098'], 90);
      cutTop(ctx, w, x => Math.round(1 + Math.abs(Math.sin(x * 0.2)) * 2));
    },
  },
  epic: { ramp: { stone: [0x8a5a34, 0xa86a38, 0xc88a50, 0x9a6234], mortar: 0x5a3820, moss: [0xc8a050, 0xdcb868, 0xb08c40] }, abyss: 0x7a5a28, glow: false, edge: '#f0d098', tube: { wall: '#c8955a', speckle: ['#a86a38', '#e0b078', '#8a5a30'], rib: 0x8a5a34, portal: 0xd6a56a, lines: [{ angle: Math.PI * 0.5, width: 0.05, color: 0xf0d098 }] } },
  // Areia levantada pelo vento: poucas partículas lentas, balançando bastante.
  weather: { count: 700, size: 2, fall: 1.2, sway: 9, swaySpeed: 1.4, colors: [0xe8c888, 0xd8b070, 0xf4dca8] },

  paintSky(ctx, w, h) {
    paintGradient(ctx, w, h, [[0, '#4a90c8'], [0.55, '#9cc4d8'], [1, '#f0cc90']]);
    ctx.fillStyle = '#fff4c8';                                  // sol
    ctx.beginPath(); ctx.arc(w * 0.7, 28, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.55)';                    // fiapos de nuvem
    for (let i = 0; i < 6; i++) ctx.fillRect(Math.random() * w, 14 + Math.random() * 36, 24 + Math.random() * 30, 2);
    paintSilhouette(ctx, w, h, '#c89a64', 4, 22, 4);            // mesas distantes
    paintSilhouette(ctx, w, h, '#dcb074', 7, 14, 2);            // dunas
  },

  addProps(ctx) {
    // Dunas baixas e largas.
    const dune = new THREE.IcosahedronGeometry(4, 1);
    dune.scale(2.4, 0.55, 1.6);
    scatter(ctx, {
      count: 200, clearance: 14, sizeOf: random => [1 + random() * 1.8, 0.6 + random() * 1.4, 1 + random() * 1.6],
      parts: [{ geometry: dune, material: solid(0xffffff), colorOf: pickFrom([0xe8c486, 0xdcb474, 0xf0d098]) }],
    });

    // Cactos saguaro.
    const stem = new THREE.CylinderGeometry(0.5, 0.6, 6, 7);
    stem.translate(0, 3, 0);
    const armLow = new THREE.CylinderGeometry(0.3, 0.3, 2.2, 6);
    armLow.translate(-1.5, 3.4, 0);
    const armUp = new THREE.CylinderGeometry(0.28, 0.3, 1.8, 6);
    armUp.translate(-1.5, 4.9, 0);
    const armLink = new THREE.BoxGeometry(1.5, 0.55, 0.55);
    armLink.translate(-0.8, 2.5, 0);
    scatter(ctx, {
      count: 260, clearance: 12, sizeOf: random => 0.7 + random() * 0.9,
      parts: [
        { geometry: stem, material: solid(0xffffff), colorOf: pickFrom([0x3a8a3a, 0x2f7a34, 0x4a9a3e]) },
        { geometry: armLink, material: solid(0x3a8a3a) },
        { geometry: armLow, material: solid(0x3a8a3a) },
        { geometry: armUp, material: solid(0x4a9a3e) },
      ],
    });

    // Mesas de arenito: bloco alto em degraus, de cor avermelhada.
    const base = new THREE.CylinderGeometry(9, 12, 12, 7);
    base.translate(0, 6, 0);
    const top = new THREE.CylinderGeometry(8, 9.2, 5, 7);
    top.translate(0, 14.5, 0);
    scatter(ctx, {
      count: 38, clearance: 30, sizeOf: random => [0.7 + random() * 0.9, 0.6 + random() * 1.3, 0.7 + random() * 0.9],
      parts: [
        { geometry: base, material: solid(0xffffff), colorOf: pickFrom([0xb8683a, 0xa85a30, 0xc87a46]) },
        { geometry: top, material: solid(0xd89860) },
      ],
    });

    // Pedras e esqueletos de gado.
    const rock = new THREE.DodecahedronGeometry(2.4, 0);
    scatter(ctx, {
      count: 150, clearance: 11, sizeOf: random => [0.5 + random() * 1.4, 0.4 + random() * 1, 0.5 + random() * 1.4],
      parts: [{ geometry: rock, material: solid(0xffffff), colorOf: pickFrom([0x9a6a44, 0xb08058, 0x84583a]) }],
    });
    const rib = new THREE.TorusGeometry(0.9, 0.12, 4, 8, Math.PI);
    rib.rotateY(Math.PI / 2);
    nearRoad(ctx, { count: 40, from: EDGE + 1, to: EDGE + 14, sizeOf: random => 0.7 + random() * 0.6, parts: [{ geometry: rib, material: solid(0xf0e8d4) }] });

    // Montes de areia colados à beira, fechando a vista.
    const drift = new THREE.IcosahedronGeometry(3, 0);
    drift.scale(1.8, 0.5, 1.2);
    nearRoad(ctx, { count: 260, from: EDGE - 1.5, to: EDGE + 7, sizeOf: random => 0.6 + random(), parts: [{ geometry: drift, material: solid(0xffffff), colorOf: pickFrom([0xe8c486, 0xdcb474, 0xf0d098]) }] });

    // Casinhas de adobe com telhado plano.
    const house = new THREE.BoxGeometry(7, 4.5, 6);
    house.translate(0, 2.25, 0);
    const roof = new THREE.BoxGeometry(7.6, 0.5, 6.6);
    roof.translate(0, 4.75, 0);
    const door = new THREE.BoxGeometry(1.4, 2.4, 6.2);
    door.translate(0, 1.2, 0);
    nearRoad(ctx, { count: 22, from: EDGE + 8, to: EDGE + 24, parts: [{ geometry: house, material: solid(0xd8a868) }, { geometry: roof, material: solid(0xb87c44) }, { geometry: door, material: solid(0x5a3a20) }] });

    // Faixas de bandeirolas coloridas cruzando a pista.
    acrossRoad(ctx, {
      every: 230,
      build: () => {
        const arch = archFrame({ height: 11, post: 0x6a4424, beam: 0x8a5a2a });
        [0xc83a2a, 0xf0c030, 0x2a8ac8, 0x3a9a4a, 0xc83a2a, 0xf0c030].forEach((color, i) => {
          const flag = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 0.1), solid(color));
          flag.position.set(-7.5 + i * 3, 9.8, 0);
          arch.add(flag);
        });
        return arch;
      },
    });
  },
};
