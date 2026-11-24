import * as THREE from 'three';
import { paintGradient, paintSilhouette } from '../atmosphere.js';
import { track } from '../track.js';
import { alongRoad, EDGE, nearRoad, pickFrom, scatter, solid } from './propKit.js';
import { barGeometry, broadleafTree, bush, coneGeometry, grassTuft, pineTree, shadedPart } from './plants.js';
import { kingsGate } from './finishGates.js';

// Estrada do Rei: estrada de pedra entre campos de grama, aldeias de telhado de palha e moinhos; uma mata fechada
// de curvas onduladas, onde cervos cruzam a pista; carruagens indo devagar pela estrada; e o castelo do rei, em que
// se entra voando pela ponte levadiça (rápido demais, bate na muralha) e se corre por dentro, num pátio estreito de
// duas curvas de 90° (o traçado do castelo e da mata vem de trackShapes.js; a ponte e o portão, de mapLayout.js).

const SHOULDER = 6, SIDE = EDGE + SHOULDER;
const FOREST_MARGIN = 30;                            // a mata começa e termina um pouco antes e depois das curvas

const forestZone = () => track.zones.forest ?? null;
function inForest(d, margin = FOREST_MARGIN) {
  const zone = forestZone();
  if (!zone) return false;
  const total = track.length, offset = ((d - zone.start + margin) % total + total) % total;
  return offset <= zone.length + margin * 2;
}

export const KINGS_ROAD = {
  id: 'kingsRoad', name: 'ESTRADA DO REI', music: 'kingsRoad',
  challenge: ['PONTE LEVADICA: RAPIDO DEMAIS VOCE BATE NA MURALHA', 'TIRE O PE ANTES DA PONTE E VOE PELO PORTAO DO CASTELO'],
  sky: 0xb8d4e8, fog: [34, 320], cabinTint: 0xfff0d8,
  // Volta larga de campo aberto; o castelo e a mata ondulada entram por cima dela (trackShapes.js).
  shape: {
    wiggle: 0.18, targetLength: 2600, relief: 9, hillScale: 200, sharpCurves: 1, harmonics: [[2, 0.8], [3, 0.4]], shoulder: SHOULDER,
    castle: { approach: 134, inside: [60, 50, 50] },   // corrida + rampa (40) + fosso (24); pátio: reta, curva, reta, curva, reta
    waves: { amplitude: 8, wavelength: 120, length: 480, zone: 'forest' },
  },
  surface: { grip: 1, side: 0.95, drag: 0.01, offroad: 1.3 },   // pedra assentada segura quase como asfalto
  layout: {
    castle: { fallLabel: 'CAIU NO FOSSO' },
    hazards: [{ kind: 'deerCrossing', count: 2 }, { kind: 'carriage', count: 6 }],
    tunnels: { count: 0 },
  },
  ground: {
    base: [88, 142, 58], variation: 18,
    paint(ctx) {
      for (const color of ['#6aa040', '#4a8030', '#7ab84a']) { ctx.fillStyle = color; for (let i = 0; i < 40; i++) ctx.fillRect(Math.random() * 64, Math.random() * 64, 1, 2 + Math.random() * 2); }
      for (const color of ['#f0e060', '#ffffff', '#e070a0']) { ctx.fillStyle = color; for (let i = 0; i < 5; i++) ctx.fillRect(Math.random() * 64, Math.random() * 64, 1, 1); }   // florzinhas
    },
  },
  // Pedras retangulares assentadas em fiadas desencontradas, com rejunte de terra e grama nas frestas.
  road: {
    base: [132, 126, 116], variation: 8, edge: null, center: null,
    paint(ctx) {
      for (let row = 0; row < 8; row++) {
        let x = row % 2 ? -4 : 0;
        while (x < 64) {
          const w = 6 + Math.floor(Math.random() * 5), k = Math.floor(Math.random() * 34) - 17;
          ctx.fillStyle = `rgb(${138 + k},${132 + k},${120 + k})`;
          ctx.fillRect(x + 1, row * 8 + 1, w - 1, 7);
          ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(x + 1, row * 8 + 1, w - 1, 1);   // quina de cima clara
          ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x + 1, row * 8 + 7, w - 1, 1);
          x += w;
        }
      }
      ctx.fillStyle = 'rgba(90,120,60,.7)'; for (let i = 0; i < 14; i++) ctx.fillRect(Math.random() * 64, Math.floor(Math.random() * 8) * 8, 2, 1);   // grama no rejunte
      ctx.fillStyle = 'rgba(60,50,40,.35)'; ctx.fillRect(14, 0, 4, 64); ctx.fillRect(46, 0, 4, 64);   // gasto das rodas
    },
  },
  // Meio-fio de blocos de pedra com tufos de grama.
  kerb: {
    paint(ctx, n) {
      ctx.fillStyle = '#5a5650'; ctx.fillRect(0, 0, n, n);
      for (let y = 0; y < n; y += 8) { ctx.fillStyle = '#9a948a'; ctx.fillRect(1, y + 1, n - 2, 6); ctx.fillStyle = '#b8b2a6'; ctx.fillRect(1, y + 1, n - 2, 1); }
      ctx.fillStyle = '#5a8a34'; for (let i = 0; i < 5; i++) ctx.fillRect(Math.random() * n, Math.random() * n, 2, 1);
    },
  },
  gantry: kingsGate,
  wall: null,                                        // sem muro: grama, cercas e a mata fecham a pista
  epic: {
    ramp: { stone: [0x6a6660, 0x7a766e, 0x8a857c, 0x5a5650], mortar: 0x3a3630, moss: [0x5a7a3a, 0x6a8a44] },
    abyss: 0x3a6a72, glow: false, edge: '#e8d8a8',
    tube: { wall: '#7a766e', speckle: ['#5a5650'], rib: 0x4a4640, portal: 0x6a6660, lines: [] },
  },
  // Aparência do castelo (world/castle.js).
  castle: {
    stone: { stone: [0x8a857c, 0x9a948a, 0xa8a296, 0x7a766e], mortar: 0x4a4640, moss: [0x6a8a44, 0x7a9a4a] },
    base: { stone: [0x6a6660, 0x7a766e, 0x5a5650, 0x706c64], mortar: 0x3a3630, moss: [0x4a6a34, 0x3a5a2a, 0x5a7a3a] },
    roof: 0x2a3a8a, flag: 0xc82a2a, parapet: 0x9a948a,
    floor: { light: '#e8e0cc', dark: '#5a6070', grout: '#3a3a42', carpet: '#a01a1a', trim: '#e0b030' },
    banners: [['#a01a1a', '#e0b030'], ['#1a3a8a', '#e8e0cc']],
  },
  // Pólen e penugem de dente-de-leão boiando no sol da manhã.
  weather: { count: 160, size: 2, fall: 0.5, sway: 3, swaySpeed: 0.9, colors: [0xfff4c0, 0xffffff, 0xe8f4b0] },

  paintSky(ctx, w, h) {
    paintGradient(ctx, w, h, [[0, '#4a7ad0'], [0.55, '#9ac4ea'], [0.85, '#e8e4cc'], [1, '#b8d4e8']]);
    ctx.fillStyle = '#fff6d8';
    ctx.beginPath(); ctx.arc(w * 0.72, h * 0.22, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.75)';                       // nuvens de algodão
    for (let i = 0; i < 9; i++) {
      const x = Math.random() * w, y = 20 + Math.random() * h * 0.3, r = 8 + Math.random() * 10;
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(x + k * r * 0.8, y + Math.sin(k) * 3, r, r * 0.6, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    paintSilhouette(ctx, w, h, '#7a9ab0', 9, 22, 8);                // serras ao longe
    // Silhueta de um castelo distante na serra.
    ctx.fillStyle = '#6a88a0';
    const cx = w * 0.22, base = h * 0.5 - 6;
    ctx.fillRect(cx - 18, base - 10, 36, 10);
    for (const [x, tw, th] of [[-20, 6, 18], [14, 6, 18], [-4, 8, 26]]) {
      ctx.fillRect(cx + x, base - th, tw, th);
      ctx.beginPath(); ctx.moveTo(cx + x - 1, base - th); ctx.lineTo(cx + x + tw / 2, base - th - 7); ctx.lineTo(cx + x + tw + 1, base - th); ctx.fill();
    }
    paintSilhouette(ctx, w, h, '#5a8a50', 15, 12, 3);               // colinas verdes
  },

  addProps(ctx) {
    const GREENS = [0x3a7a2a, 0x4a8a34, 0x2e6a26, 0x5a9a3a, 0x6a9a30];
    const oaks = [broadleafTree({ colors: GREENS }), broadleafTree({ height: 8, crown: 3.9, colors: GREENS }), broadleafTree({ height: 6, crown: 3, bark: 0x4a3018, colors: GREENS })];
    const pine = pineTree({ colors: [0x1e4a26, 0x24522a, 0x1a3e22] });
    const zone = forestZone(), outside = d => !inForest(d), treeSize = random => 0.8 + random() * 0.7;

    // Mata fechada: árvores coladas no acostamento e muitas atrás, nos dois lados das curvas.
    if (zone) {
      const wide = { start: zone.start - FOREST_MARGIN, length: zone.length + FOREST_MARGIN * 2 };
      oaks.forEach(parts => nearRoad(ctx, { count: 260, from: SIDE, to: SIDE + 34, sizeOf: treeSize, parts, zone: wide }));
      nearRoad(ctx, { count: 220, from: SIDE + 1, to: SIDE + 34, sizeOf: random => 0.8 + random() * 0.6, parts: pine, zone: wide });
      nearRoad(ctx, { count: 260, from: SIDE, to: SIDE + 8, sizeOf: random => 0.7 + random() * 0.6, parts: bush({ colors: [0x2e6a26, 0x3a7a2a, 0x4a6a24] }), zone: wide });
    }
    // Campo aberto: árvores soltas e bosques longe da estrada.
    oaks.forEach(parts => scatter(ctx, { count: 90, clearance: SIDE + 12, sizeOf: treeSize, parts }));
    scatter(ctx, { count: 70, clearance: SIDE + 16, sizeOf: random => 0.8 + random() * 0.7, parts: pine });
    oaks.forEach(parts => nearRoad(ctx, { count: 25, from: SIDE + 8, to: SIDE + 30, sizeOf: treeSize, parts, where: outside }));

    // Muita grama: fileira de tufos na beira do acostamento, capim e flores no campo.
    const grass = grassTuft({ blades: 16, height: 1.3, colors: [0x5a9a3a, 0x6aaa44, 0x4a8a30, 0x7ab84a] });
    alongRoad(ctx, { every: 2.5, offset: SIDE, sizeOf: random => 0.9 + random() * 0.5, parts: grass });
    nearRoad(ctx, { count: 1100, from: SIDE, to: SIDE + 26, sizeOf: random => 0.6 + random() * 0.8, parts: grass });
    const flower = new THREE.IcosahedronGeometry(0.28, 0);
    flower.translate(0, 0.5, 0);
    nearRoad(ctx, { count: 500, from: SIDE, to: SIDE + 22, sizeOf: random => 0.7 + random() * 0.8, parts: [{ geometry: flower, material: solid(0xffffff), colorOf: pickFrom([0xf0e060, 0xffffff, 0xe070a0, 0x9a70e0, 0xf08a30]) }], where: outside });

    // Cerca de madeira na beira do campo (a mata não tem).
    const post = new THREE.BoxGeometry(0.22, 1.4, 0.22);
    post.translate(0, 0.7, 0);
    const rail = new THREE.BoxGeometry(0.1, 0.14, 4.1);
    const railLow = rail.clone().translate(0, 0.55, 0), railHigh = rail.clone().translate(0, 1.1, 0);
    alongRoad(ctx, { every: 4, offset: SIDE + 1.4, parts: [{ geometry: post, material: solid(0x6a4a2a) }, { geometry: railLow, material: solid(0x7a5a34) }, { geometry: railHigh, material: solid(0x7a5a34) }], where: outside });

    // Mastros com flâmulas do rei de tempos em tempos.
    const mast = new THREE.CylinderGeometry(0.09, 0.12, 7, 5);
    mast.translate(0, 3.5, 0);
    const pennant = new THREE.ConeGeometry(0.6, 2.6, 3);
    pennant.rotateZ(Math.PI / 2);
    pennant.translate(1.3, 6.2, 0);
    alongRoad(ctx, { every: 90, offset: SIDE + 0.6, parts: [{ geometry: mast, material: solid(0x4a3a2a) }, { geometry: pennant, material: solid(0xffffff), colorOf: pickFrom([0xa01a1a, 0x1a3a8a, 0xe0b030]) }], where: outside });

    // Fardos de feno e casas de aldeia (taipa branca, vigas escuras e telhado de palha).
    const hay = [{ geometry: new THREE.CylinderGeometry(1.1, 1.1, 1.6, 10).rotateZ(Math.PI / 2).translate(0, 1.1, 0), color: 0xd8b858 }];
    scatter(ctx, { count: 50, clearance: SIDE + 6, sizeOf: random => 0.8 + random() * 0.4, parts: [shadedPart(hay)] });
    const roof = coneGeometry([0, 3.6, 0], 5.4, 3.6, 4);
    roof.rotateY(Math.PI / 4);
    roof.scale(1, 1, 0.75);
    const cottage = shadedPart([
      { geometry: new THREE.BoxGeometry(7, 3.6, 5.2).translate(0, 1.8, 0), color: 0xe8dcc0 },
      { geometry: new THREE.BoxGeometry(7.1, 0.3, 5.3).translate(0, 3.5, 0), color: 0x4a3420 },
      { geometry: new THREE.BoxGeometry(0.3, 3.6, 5.3).translate(-3.4, 1.8, 0), color: 0x4a3420 },
      { geometry: new THREE.BoxGeometry(0.3, 3.6, 5.3).translate(3.4, 1.8, 0), color: 0x4a3420 },
      { geometry: roof, color: 0xc8a050 },
      { geometry: new THREE.BoxGeometry(1.2, 1.8, 0.1).translate(1.2, 0.9, 2.62), color: 0x5a3a20 },   // porta
      { geometry: new THREE.BoxGeometry(0.9, 2.4, 0.9).translate(-2.2, 6, -0.8), color: 0x7a706a },   // chaminé
    ]);
    nearRoad(ctx, { count: 26, from: SIDE + 10, to: SIDE + 40, sizeOf: random => 0.9 + random() * 0.3, parts: [cottage], where: outside });
    scatter(ctx, { count: 30, clearance: SIDE + 20, sizeOf: random => 0.9 + random() * 0.3, parts: [cottage] });

    // Dois moinhos de vento com as pás girando.
    addWindmills(ctx, 2);
  },
};

// Moinho: torre de pedra afinando, telhado cônico e quatro pás de madeira que giram devagar.
function addWindmills(ctx, wanted) {
  const tower = shadedPart([
    { geometry: new THREE.CylinderGeometry(2.4, 3.4, 11, 8).translate(0, 5.5, 0), color: 0xd8d0c0 },
    { geometry: coneGeometry([0, 11, 0], 3.2, 4, 8), color: 0x8a4a2a },
    { geometry: new THREE.BoxGeometry(1.2, 2, 0.2).translate(0, 1, 3.1), color: 0x5a3a20 },
  ]);
  const sail = shadedPart([
    { geometry: new THREE.BoxGeometry(0.3, 7, 0.2).translate(0, 3.5, 0), color: 0x6a4a2a },
    { geometry: new THREE.BoxGeometry(1.6, 5.6, 0.08).translate(0.95, 4.1, 0), color: 0xe8e0d0 },
  ]);
  const rotors = [];
  for (let tries = 0, built = 0; tries < 200 && built < wanted; tries++) {
    const d = ctx.random() * track.length, side = ctx.random() < 0.5 ? -1 : 1, lateral = side * (SIDE + 30 + ctx.random() * 40);
    const i = Math.floor(d / track.step) % track.count, x = track.px[i] - track.tz[i] * lateral, z = track.pz[i] + track.tx[i] * lateral;
    if (!ctx.spotIsClear(x, z, SIDE + 24) || inForest(d, 120)) continue;
    const group = new THREE.Group(), y = ctx.heightAt(x, z);
    group.position.set(x, y, z);
    group.rotation.y = Math.atan2(track.px[i] - x, track.pz[i] - z);   // a porta e as pás viradas para a estrada
    group.add(new THREE.Mesh(tower.geometry, tower.material));
    const rotor = new THREE.Group();
    rotor.position.set(0, 10, 3.4);
    for (let k = 0; k < 4; k++) {
      const blade = new THREE.Mesh(sail.geometry, sail.material);
      blade.rotation.z = k * Math.PI / 2;
      rotor.add(blade);
    }
    group.add(rotor);
    ctx.group.add(group);
    rotors.push(rotor);
    built++;
  }
  ctx.onUpdate(time => { for (const rotor of rotors) rotor.rotation.z = time * 0.6; });
}
