import * as THREE from 'three';
import { paintGradient, paintSilhouette } from '../atmosphere.js';
import { alongRoad, EDGE, nearRoad, overRoad, scatter, solid } from './propKit.js';
import { reedClump, swampCypress } from './plants.js';

// Pântano à noite, debaixo de uma tempestade elétrica, entre as torres de uma usina abandonada. A corrida toda é
// no escuro, de farol aceso, com lama que arrasta. O desafio são os raios (game/lightning.js): um círculo azul
// aparece no chão à frente de um carro e se enche; quando enche, o raio cai, tira vida, faz o carro rodar e deixa
// sem nitro. Os relâmpagos clareiam a pista por um instante. Debaixo das copas (os túneis abertos) não cai raio.
// Acostamento largo (metros a mais de cada lado): o limite da pista e o começo do juncal ficam em SIDE.
const SHOULDER = 6, SIDE = EDGE + SHOULDER;

export const STORM_SWAMP = {
  id: 'stormSwamp', name: 'PANTANO ELETRICO', music: 'stormSwamp',
  challenge: ['LUZ AZUL NO CHAO: VAI CAIR UM RAIO. SAIA DALI!', 'O RAIO TIRA VIDA E O NITRO. SOB AS COPAS NAO CAI RAIO'],   // aparece no pop-up de antes da largada
  sky: 0x121824, fog: [5, 95], cabinTint: 0x8a9ab8,
  night: true,                                       // faróis acesos a corrida toda (main.js)
  lightning: { interval: [3.3, 6], warning: 1.35, radius: 3.6, damage: 0.18, emp: 2.5 },
  // Estrada sinuosa e quase plana entre os canais, com ondulações de lama.
  shape: { wiggle: 0.28, targetLength: 2100, relief: 5, hillScale: 130, shoulder: SHOULDER, sharpCurves: 3, harmonics: [[3, 0.6], [4, 0.5], [6, 0.25]] },
  surface: { grip: 0.9, side: 0.75, drag: 0.05, top: 0.98, offroad: 2.2 },
  layout: {
    jump: { fallLabel: 'CAIU NO BREJO', below: 1.2 },
    hazards: [{ kind: 'leaningTree', count: 3 }, { kind: 'animalCrossing', count: 1 }],
    bumps: { height: 0.8, length: 50 },
    // Atoleiro: a água do brejo cobre a estrada num trecho e a lama quase não segura.
    storm: { length: 240, label: 'ATOLEIRO', color: 0x1e2a22, fog: [3, 30], wind: 6, grip: 0.58, flooded: true, waterColor: '#2a4a32' },
    tunnels: { count: 3, length: [70, 110], open: true },   // copas de ciprestes: abrigo dos raios
  },
  ground: {
    base: [38, 48, 34], variation: 16,
    paint(ctx) {
      ctx.fillStyle = 'rgba(20,34,30,.7)'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(Math.random() * 64, Math.random() * 64, 4 + Math.random() * 6, 2 + Math.random() * 3, 0, 0, Math.PI * 2); ctx.fill(); }   // poças
      ctx.fillStyle = 'rgba(90,120,60,.5)'; for (let i = 0; i < 30; i++) ctx.fillRect(Math.random() * 64, Math.random() * 64, 1, 2 + Math.random() * 2);   // capim
    },
  },
  road: {
    base: [70, 60, 46], variation: 18, edge: null, center: null,
    // Lama com poças que refletem o céu, marcas fundas de pneu e capim pisado nas beiradas; sem faixa pintada.
    paint(ctx) {
      ctx.fillStyle = 'rgba(30,24,18,.55)'; ctx.fillRect(12, 0, 5, 64); ctx.fillRect(46, 0, 5, 64);
      ctx.fillStyle = 'rgba(80,100,130,.45)'; for (let i = 0; i < 5; i++) ctx.fillRect(Math.random() * 56, Math.random() * 60, 4 + Math.random() * 8, 2 + Math.random() * 3);
      ctx.fillStyle = 'rgba(120,100,70,.4)'; for (let i = 0; i < 16; i++) ctx.fillRect(Math.random() * 64, Math.random() * 64, 2, 1);
      ctx.fillStyle = 'rgba(70,90,50,.6)'; for (let i = 0; i < 18; i++) ctx.fillRect(Math.random() < 0.5 ? Math.random() * 7 : 57 + Math.random() * 7, Math.random() * 64, 1, 2);
    },
  },
  // Beira de troncos podres com musgo.
  kerb: {
    paint(ctx, n) {
      ctx.fillStyle = '#3a2c1e'; ctx.fillRect(0, 0, n, n);
      ctx.fillStyle = '#4e3c28'; ctx.fillRect(0, 2, n, 4); ctx.fillRect(0, 10, n, 4);
      ctx.fillStyle = '#5a7a3a'; for (let i = 0; i < 6; i++) ctx.fillRect(Math.random() * n, Math.random() * n, 2 + Math.random() * 3, 1);
    },
  },
  gantry: swampGate,
  tunnel: { rib: 0x2a2218, leaves: 0x2a3a24 },
  // Sem muro: o juncal fecha a pista (o limite de colisão continua no mesmo lugar, junto da primeira fileira de juncos).
  wall: null,
  epic: { ramp: { stone: [0x3a3428, 0x4a4234, 0x2e2a20, 0x44402e], mortar: 0x1a1810, moss: [0x4a6a30, 0x6a8a40, 0x3a5a2a] }, abyss: 0x1e3a2a, glow: false, edge: '#a8b878', tube: { wall: '#3a3428', speckle: ['#4a6a30'], rib: 0x2a2218, portal: 0x4a4234, lines: [] } },
  // Chuva forte caindo em traços.
  weather: { count: 680, streak: 2.6, fall: 48, sway: 0.2, swaySpeed: 1, colors: [0x8aa0c0] },

  paintSky(ctx, w, h) {
    paintGradient(ctx, w, h, [[0, '#06080e'], [0.6, '#141c2c'], [1, '#121824']]);
    // Nuvens pesadas, com bordas iluminadas por dentro.
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * w, y = 10 + Math.random() * h * 0.5, r = 14 + Math.random() * 26;
      ctx.fillStyle = 'rgba(30,38,56,.8)'; ctx.beginPath(); ctx.ellipse(x, y, r * 1.8, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(80,110,160,.18)'; ctx.fillRect(x - r, y + r * 0.45, r * 2, 1);
    }
    // Raios parados no céu, ao longe.
    ctx.fillStyle = '#c8e0ff';
    for (let bolt = 0; bolt < 3; bolt++) {
      let x = 60 + Math.random() * (w - 120), y = 30;
      while (y < h * 0.78) { const nx = x + (Math.random() * 10 - 5), ny = y + 4 + Math.random() * 6; for (let k = 0; k < 6; k++) ctx.fillRect(x + (nx - x) * k / 6, y + (ny - y) * k / 6, 1, 1); x = nx; y = ny; }
    }
    paintSilhouette(ctx, w, h, '#0a0e0c', 14, 12, 4);          // mata do pântano no horizonte
  },

  addProps(ctx) {
    // Ciprestes mortos: tronco que alarga no pé, galhos secos e barba-de-velho pendurada.
    const CYPRESS = [0x24321e, 0x2a3a24, 0x1e2a1a, 0x30402a];
    const cypresses = [swampCypress({ colors: CYPRESS }), swampCypress({ height: 14, colors: CYPRESS }), swampCypress({ height: 10, colors: CYPRESS })];
    cypresses.forEach(parts => scatter(ctx, { count: 140, clearance: SIDE, sizeOf: random => 0.75 + random() * 0.6, parts }));
    cypresses.forEach(parts => nearRoad(ctx, { count: 40, from: SIDE + 3, to: SIDE + 16, sizeOf: random => 0.7 + random() * 0.5, parts }));

    // Juncos e taboas: fileira cerrada logo depois do acostamento (a borda da pista, no lugar da cerca) e juncal atrás.
    const reeds = reedClump({ colors: [0x4a5a2a, 0x5a6a34, 0x3a4a22, 0x52602e] });
    alongRoad(ctx, { every: 2, offset: SIDE, sizeOf: random => 0.85 + random() * 0.5, parts: reeds });
    nearRoad(ctx, { count: 700, from: SIDE, to: SIDE + 10, sizeOf: random => 0.6 + random() * 0.7, parts: reeds });

    // Torres de transmissão da usina abandonada, com bobinas que faíscam: atraem os raios do céu.
    const mast = new THREE.CylinderGeometry(0.4, 2.2, 26, 4);
    mast.translate(0, 13, 0);
    const arm = new THREE.BoxGeometry(9, 0.5, 0.5);
    arm.translate(0, 22, 0);
    const coil = new THREE.CylinderGeometry(1, 1, 2.4, 8);
    coil.translate(0, 27.2, 0);
    const coilMaterial = solid(0x70d8ff, { fog: false });
    nearRoad(ctx, { count: 22, from: SIDE + 10, to: SIDE + 30, parts: [{ geometry: mast, material: solid(0x3a4048) }, { geometry: arm, material: solid(0x3a4048) }, { geometry: coil, material: coilMaterial }] });
    ctx.onUpdate(time => { coilMaterial.color.setHex(Math.random() < 0.12 ? 0xffffff : Math.floor(time * 5) % 2 ? 0x70d8ff : 0x2a6a9a); });

    // Palafitas com a janela acesa.
    const hut = new THREE.BoxGeometry(6, 3.6, 5);
    hut.translate(0, 4.4, 0);
    const stilts = new THREE.BoxGeometry(5.4, 2.6, 4.4);
    stilts.translate(0, 1.3, 0);
    const roof = new THREE.ConeGeometry(5, 2.4, 4);
    roof.rotateY(Math.PI / 4);
    roof.translate(0, 7.4, 0);
    const litWindow = new THREE.BoxGeometry(6.1, 1, 1.4);
    litWindow.translate(0, 4.6, 0);
    nearRoad(ctx, { count: 18, from: SIDE + 10, to: SIDE + 26, parts: [{ geometry: stilts, material: solid(0x1e1a14) }, { geometry: hut, material: solid(0x4a3a28) }, { geometry: roof, material: solid(0x3a3a34) }, { geometry: litWindow, material: solid(0xffb850, { fog: false }) }] });

    // Cogumelos fosforescentes entre os juncos da beira: a única luz fixa da pista.
    const glowCap = new THREE.SphereGeometry(0.55, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2);
    glowCap.translate(0, 0.5, 0);
    const glowStem = new THREE.CylinderGeometry(0.12, 0.16, 0.5, 4);
    glowStem.translate(0, 0.25, 0);
    alongRoad(ctx, { every: 20, offset: SIDE - 0.6, sizeOf: random => 0.7 + random() * 0.8, parts: [{ geometry: glowStem, material: solid(0xb8c8a0) }, { geometry: glowCap, material: solid(0x6af0c8, { fog: false }) }] });

    // Vaga-lumes e fogos-fátuos flutuando sobre a pista.
    const wisp = new THREE.BoxGeometry(0.25, 0.25, 0.25);
    const wispMaterial = solid(0xb8ff60, { fog: false });
    overRoad(ctx, { count: 160, height: [1, 6], lateral: SIDE, parts: [{ geometry: wisp, material: wispMaterial }] });
    ctx.onUpdate(time => { wispMaterial.color.setHex(Math.floor(time * 1.7) % 2 ? 0xb8ff60 : 0x6aa830); });
  },
};

// Arco de chegada: dois postes de madeira com isoladores e um cabo de faixa, iluminados por lâmpadas azuis.
function swampGate(g, { postX, span }) {
  const add = (geometry, color, x, y, extra = {}) => {
    const mesh = new THREE.Mesh(geometry, solid(color, extra));
    mesh.position.set(x, y, 0);
    g.add(mesh);
  };
  for (const s of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.45, 0.6, 10, 6), 0x3a2c1e, s * postX, 5);
    add(new THREE.BoxGeometry(3, 0.35, 0.35), 0x2a2218, s * postX, 9.2);
    for (const k of [-1, 1]) add(new THREE.CylinderGeometry(0.18, 0.18, 0.6, 6), 0x70d8ff, s * postX + k * 1.2, 9.6, { fog: false });
  }
  add(new THREE.BoxGeometry(span, 1.3, 0.3), 0x2a3a24, 0, 8.1);
  add(new THREE.BoxGeometry(span, 0.25, 0.35), 0x70d8ff, 0, 7.4, { fog: false });
}
