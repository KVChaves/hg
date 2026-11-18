import * as THREE from 'three';
import { paintGradient } from '../atmosphere.js';
import { paintBlocks, speckle } from './wallPaint.js';
import { acrossRoad, archFrame, EDGE, nearRoad, pickFrom, scatter, solid } from './propKit.js';

// Desfiladeiro de arenito vermelho cortado por um rio lá embaixo. O desafio é o vento: em ciclos de calmaria,
// aviso e rajada ele empurra o carro de lado (as birutas e o HUD mostram para onde). Três pontes pênseis de
// tábua atravessam o cânion sem mureta, e é nelas que a rajada sopra mais: quem não contraesterça cai no rio.
export const WIND_CANYON = {
  id: 'windCanyon', name: 'DESFILADEIRO', music: 'windCanyon',
  challenge: ['RAJADAS DE VENTO EMPURRAM O CARRO: OLHE AS BIRUTAS', 'AS PONTES NAO TEM MURETA. CONTRAESTERCE OU CAI NO RIO'],   // aparece no pop-up de antes da largada
  sky: 0x9cc0dc, fog: [24, 260], cabinTint: 0xf4dcc4,
  // Sobe e desce entre mesas de pedra, com curvas médias e algumas fechadas na beira do cânion.
  shape: { wiggle: 0.22, targetLength: 2500, relief: 26, hillScale: 210, banks: 9, sharpCurves: 3, harmonics: [[2, 0.7], [3, 0.55], [5, 0.2]], stretch: [1.2, 0.85] },
  surface: { grip: 1, side: 0.95, drag: 0.02, offroad: 1.5 },   // terra batida e pedra seca: segura bem, o problema é o vento
  layout: {
    jump: { fallLabel: 'CAIU NO CANION' },
    // Pontes de tábua sem mureta, bem altas sobre o rio. Secas: não escorregam como a de gelo.
    bridge: [
      { length: 140, below: 34, icy: false, style: 'wood', fallLabel: 'CAIU DA PONTE' },
      { length: 120, below: 30, icy: false, style: 'wood', fallLabel: 'CAIU DA PONTE' },
      { length: 105, below: 28, icy: false, style: 'wood', fallLabel: 'CAIU DA PONTE' },
    ],
    // Rajadas em cada ponte e em duas retas na beira do penhasco.
    gusts: { force: 18, period: 7.5, onBridges: true, count: 2, length: 170 },
    hazards: [{ kind: 'rockfall', count: 3 }],
    tunnels: { count: 2, length: [80, 130] },        // túneis escavados na rocha: ali dentro o vento não pega
  },
  ground: {
    base: [178, 96, 60], variation: 18,
    // Camadas de arenito: faixas horizontais de laranja e vinho.
    paint(ctx) {
      for (let y = 0; y < 64; y += 6) { ctx.fillStyle = ['rgba(120,52,30,.35)', 'rgba(220,140,90,.3)', 'rgba(150,70,40,.3)'][y / 6 % 3]; ctx.fillRect(0, y, 64, 2 + Math.random() * 2); }
      ctx.fillStyle = 'rgba(70,40,30,.4)'; for (let i = 0; i < 14; i++) ctx.fillRect(Math.random() * 64, Math.random() * 64, 2, 1);
    },
  },
  road: {
    base: [164, 116, 82], variation: 14, edge: '#f0dcc0', center: '#7a3a1c',
    paint(ctx) {
      ctx.fillStyle = 'rgba(90,50,30,.4)'; ctx.fillRect(13, 0, 4, 64); ctx.fillRect(47, 0, 4, 64);   // trilhas de pneu
      ctx.fillStyle = 'rgba(230,190,150,.4)'; for (let i = 0; i < 20; i++) ctx.fillRect(Math.random() * 64, Math.random() * 64, 2 + Math.random() * 6, 1);   // poeira varrida pelo vento
      ctx.fillStyle = 'rgba(60,34,22,.5)'; for (let i = 0; i < 10; i++) ctx.fillRect(Math.random() * 64, Math.random() * 64, 1, 1);
    },
  },
  // Beira de pedras arredondadas, alternando claras e escuras.
  kerb: {
    paint(ctx, n) {
      ctx.fillStyle = '#8a4a2a'; ctx.fillRect(0, 0, n, n);
      ctx.fillStyle = '#c8885a'; ctx.fillRect(1, 1, n / 2 - 2, n / 2 - 2); ctx.fillRect(n / 2 + 1, n / 2 + 1, n / 2 - 2, n / 2 - 2);
      ctx.fillStyle = '#5a2a18'; ctx.fillRect(0, n / 2 - 1, n, 1);
    },
  },
  gantry: canyonGate,
  tunnel: { wall: '#9a5434', speckle: ['#b8683e', '#7a3e24', '#c88a5a'], rib: 0x5a2a18, portal: 0xc8885a, lines: [{ angle: Math.PI / 2, width: 0.04, color: 0xf0c060 }] },
  // Muro de arrimo de pedra empilhada, com faixas do arenito.
  wall: {
    height: 2.6, tile: 8,
    paint(ctx, w, h) {
      paintBlocks(w, h, 18, 9, (x, y, bw, bh) => {
        ctx.fillStyle = ['#a85a36', '#c06a40', '#8a4a2c', '#b8784a'][Math.floor(Math.random() * 4)];
        ctx.fillRect(x, y, bw - 1, bh - 1);
        ctx.fillStyle = 'rgba(255,220,180,.25)';
        ctx.fillRect(x + 1, y + 1, bw - 4, 1);
      });
      speckle(ctx, w, h, ['#5a2a18', '#e0a878'], 90);
    },
  },
  epic: { ramp: { stone: [0x8a4a2c, 0xa85a36, 0xb86a40, 0x7a3e24], mortar: 0x4a2414, moss: [0xc8885a, 0xd8a070, 0xa86a40] }, abyss: 0x2a7a8a, glow: false, edge: '#f0dcc0', tube: { wall: '#9a5434', speckle: ['#b8683e', '#7a3e24'], rib: 0x5a2a18, portal: 0xc8885a, lines: [] } },
  // Poeira fina carregada pelo vento (main.js empurra as partículas de lado durante a rajada).
  weather: { count: 340, size: 2, fall: 0.6, sway: 2.5, swaySpeed: 1.6, colors: [0xd8a878, 0xc08858, 0xe8c8a0] },

  paintSky(ctx, w, h) {
    paintGradient(ctx, w, h, [[0, '#3a6a9c'], [0.6, '#8ab4d8'], [1, '#e8c8a8']]);
    ctx.fillStyle = 'rgba(255,255,255,.6)';                  // nuvens esticadas pelo vento
    for (let i = 0; i < 9; i++) { const y = 20 + Math.random() * 70, x = Math.random() * w; ctx.fillRect(x, y, 50 + Math.random() * 90, 2); ctx.fillRect(x + 12, y - 2, 30 + Math.random() * 40, 2); }
    // Mesas: morros de topo chato no horizonte, em duas camadas.
    for (const [color, base, top] of [['#b0725a', 0.78, 0.58], ['#8a4a34', 0.86, 0.7]]) {
      ctx.fillStyle = color;
      let x = -20;
      while (x < w) {
        const width = 30 + Math.random() * 70, height = (base - top) * h * (0.5 + Math.random() * 0.6);
        ctx.fillRect(x, base * h - height, width, h);
        ctx.fillRect(x - 6, base * h - height * 0.55, width + 12, h);   // a encosta alarga embaixo
        x += width + 10 + Math.random() * 60;
      }
    }
  },

  addProps(ctx) {
    // Torres de rocha (hoodoos): blocos empilhados que afinam, com uma pedra larga no topo.
    const column = new THREE.CylinderGeometry(1.6, 3.2, 18, 6);
    column.translate(0, 9, 0);
    const cap = new THREE.CylinderGeometry(3, 2.4, 2.4, 6);
    cap.translate(0, 19, 0);
    scatter(ctx, {
      count: 120, clearance: 20, sizeOf: random => [0.7 + random() * 0.8, 0.6 + random() * 1.4, 0.7 + random() * 0.8],
      parts: [{ geometry: column, material: solid(0xffffff), colorOf: pickFrom([0xb8683e, 0xa85a36, 0xc8885a]) }, { geometry: cap, material: solid(0x7a3e24) }],
    });

    // Mesas próximas: blocos enormes de topo chato.
    const mesa = new THREE.CylinderGeometry(24, 30, 30, 7);
    mesa.translate(0, 15, 0);
    const mesaTop = new THREE.CylinderGeometry(24.2, 24.2, 2, 7);
    mesaTop.translate(0, 30, 0);
    scatter(ctx, { count: 26, clearance: 70, sizeOf: random => [0.8 + random(), 0.6 + random() * 0.9, 0.8 + random()], parts: [{ geometry: mesa, material: solid(0xffffff), colorOf: pickFrom([0xa85a36, 0x9a5032, 0xb8683e]) }, { geometry: mesaTop, material: solid(0xc89a6a) }] });

    // Arbustos secos e pedregulhos.
    const bush = new THREE.IcosahedronGeometry(1.2, 0);
    bush.scale(1.2, 0.7, 1.2);
    bush.translate(0, 0.6, 0);
    scatter(ctx, { count: 260, clearance: 11, sizeOf: random => 0.6 + random() * 0.9, parts: [{ geometry: bush, material: solid(0xffffff), colorOf: pickFrom([0x8a7a3a, 0x6a6a30, 0xa08a4a]) }] });
    const boulder = new THREE.DodecahedronGeometry(2, 0);
    nearRoad(ctx, { count: 160, from: EDGE + 1, to: EDGE + 14, sizeOf: random => [0.5 + random(), 0.4 + random() * 0.8, 0.5 + random()], parts: [{ geometry: boulder, material: solid(0xffffff), colorOf: pickFrom([0x9a5032, 0x7a3e24, 0xb8784a]) }] });

    // Cata-ventos de fazenda: torre de treliça e roda de pás que gira mais rápido nas rajadas.
    const tower = new THREE.CylinderGeometry(0.3, 1.4, 12, 4);
    tower.translate(0, 6, 0);
    const towerMaterial = solid(0x6a6460), bladeMaterial = solid(0xd8d0c0), tail = solid(0xc83a2a);
    const wheels = [];
    const { bounds } = ctx;
    for (let n = 0; n < 10; n++) {
      for (let tries = 0; tries < 40; tries++) {
        const x = bounds.minX - 60 + ctx.random() * (bounds.maxX - bounds.minX + 120);
        const z = bounds.minZ - 60 + ctx.random() * (bounds.maxZ - bounds.minZ + 120);
        if (!ctx.spotIsClear(x, z, 22)) continue;
        const group = new THREE.Group(), wheel = new THREE.Group();
        group.add(new THREE.Mesh(tower, towerMaterial));
        for (let b = 0; b < 12; b++) {
          const blade = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.4, 0.08), bladeMaterial), angle = b / 12 * Math.PI * 2;
          blade.position.set(Math.sin(angle) * 1.4, Math.cos(angle) * 1.4, 0);
          blade.rotation.z = -angle;
          wheel.add(blade);
        }
        wheel.position.set(0, 12.4, 0.6);
        const vane = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.4, 2.6), tail);
        vane.position.set(0, 12.4, -1.6);
        group.add(wheel, vane);
        group.position.set(x, ctx.heightAt(x, z), z);
        group.rotation.y = ctx.random() * Math.PI * 2;
        ctx.group.add(group);
        wheels.push({ wheel });
        break;
      }
    }
    ctx.onUpdate(time => { for (const { wheel } of wheels) wheel.rotation.z = time * 3.2; });

    // Bandeirolas esticadas sobre a estrada, tremulando.
    const flagColors = [0xe83a3a, 0xf0c030, 0x3a8ae8, 0x40b050, 0xf0f0f0];
    const flags = [];
    acrossRoad(ctx, {
      every: 150,
      build: random => {
        const arch = archFrame({ height: 9, post: 0x5a3a22, beam: 0x5a3a22 });
        for (let x = -12; x <= 12; x += 2) {
          const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.4), solid(flagColors[Math.floor(random() * flagColors.length)], { side: THREE.DoubleSide }));
          flag.position.set(x, 7.7 - Math.cos(x / 12 * Math.PI / 2) * 0.8, 0);
          arch.add(flag);
          flags.push({ flag, phase: random() * 6 });
        }
        return arch;
      },
    });
    ctx.onUpdate(time => { for (const { flag, phase } of flags) flag.rotation.x = Math.sin(time * 9 + phase) * 0.6; });
  },
};

// Arco de chegada: dois totens de pedra e uma prancha de madeira com bandeirolas.
function canyonGate(g, { postX, span }) {
  const add = (geometry, color, x, y, extra = {}) => {
    const mesh = new THREE.Mesh(geometry, solid(color, extra));
    mesh.position.set(x, y, 0);
    g.add(mesh);
    return mesh;
  };
  for (const s of [-1, 1]) {
    add(new THREE.CylinderGeometry(1, 1.6, 9, 6), 0xa85a36, s * postX, 4.5);
    add(new THREE.CylinderGeometry(1.8, 1.2, 1.2, 6), 0x7a3e24, s * postX, 9.4);
  }
  add(new THREE.BoxGeometry(span, 1.4, 0.4), 0x8a5a32, 0, 8.4);
  add(new THREE.BoxGeometry(span, 0.25, 0.45), 0xf0dcc0, 0, 7.6);
  for (let x = -span / 2 + 1; x < span / 2; x += 1.6) add(new THREE.PlaneGeometry(0.9, 1.1), [0xe83a3a, 0xf0c030, 0x3a8ae8][Math.abs(Math.round(x * 2)) % 3], x, 7, { side: THREE.DoubleSide });
}
