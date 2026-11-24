import { CLEAR } from '../../art/raster.js';
import { dither, hash, mix } from '../../art/shade.js';
import { ctxBox, ctxDisc, ctxLine, DARK_STEEL, layerOf } from './gunPaint.js';

// Desenho das armas com desenho próprio: revólver pesado, sniper, escopeta automática, besta, lança-granadas e metralhadora.
// Mesmas convenções de gunArt.js: o cano aponta para a esquerda, e os pontos são pixels da imagem.
// Cada uma tem um mecanismo que só ela tem, para se mover diferente das armas da mesma família.

const clamp01 = v => Math.max(0, Math.min(1, v));
const GOLD = [0x5a3c10, 0x8a6020, 0xc09038, 0xe0b850, 0xf8e088];
const BRASS = 0xd0a040, BRASS_DARK = 0x8a5a20;
const POLISHED = [0x38383c, 0x56585c, 0x7c7e82, 0xa8aaae, 0xd8dade];   // aço polido do ferrolho

// Gira (x, y) em volta de (px, py), como o canvas faz numa camada com `angle`.
const turn = (x, y, px, py, a) => {
  const c = Math.cos(a), s = Math.sin(a), dx = x - px, dy = y - py;
  return [px + dx * c - dy * s, py + dx * s + dy * c];
};

// Revólver pesado de quebrar: a armação abre numa dobradiça, o cano tomba e a estrela extratora cospe as cápsulas.
export function buildMagnum(custom, m) {
  const W = 76, H = 60, accessory = custom.options.accessory;
  const HINGE = [34, 32], BREAK = 0.62;
  const breakPose = p => ({ angle: -p.open * BREAK, px: HINGE[0], py: HINGE[1] });
  const cylinder = phase => layerOf(W, H, r => {
    r.rect(36, 14, 15, 17, m.steel(0.85));
    for (const x of [38, 42, 46, 50]) {
      const fx = x - 4 + phase;
      if (fx >= 36 && fx < 51) { r.rect(fx, 15, 1, 15, m.metal[0]); r.rect(fx + 1, 15, 1, 15, m.metal[4]); }
    }
    r.rect(36, 14, 15, 1, m.metal[4]);
    r.rect(36, 30, 15, 1, m.metal[0]);
    r.rect(50, 14, 1, 17, m.metal[1]);
  });
  const [loadX, loadY] = turn(53, 22, HINGE[0], HINGE[1], -BREAK);
  return {
    size: [W, H], pivot: [50, 35], muzzle: [0, 17], hand: [61, 44], load: [Math.round(loadX), Math.round(loadY)], eject: [50, 14],
    carry: 'round', casing: 'round', flashSize: 1.7, smoke: 1.8, flashStyle: 'ported', ports: [4, 8, 12], portY: 10,
    recoil: { back: 3, up: 14, tilt: 0.48, stiffness: 190, damping: 12 },
    reload: { x: 494, y: 206, angle: 0.75 },
    layers: [
      // cabo de madrepérola com medalhão dourado
      { image: layerOf(W, H, r => {
        r.poly([[50, 32], [61, 29], [72, 53], [60, 59], [54, 46]], (x, y) => dither(x, y, 0.9 - (x - 50) / 50 - (y - 29) / 70, m.grip, 0.9));
        r.line(61, 29, 72, 53, m.grip[4]);
        r.line(54, 46, 60, 59, m.grip[1]);
        r.disc(62, 45, 2.4, GOLD[3]);
        r.put(61, 44, GOLD[4]);
        r.ring(62, 45, 2.6, 2, GOLD[1]);
      }) },
      // armação de baixo: culatra, ponte e guarda-mato
      { image: layerOf(W, H, r => {
        r.ring(45, 38, 7, 5.6, m.metal[2]);
        r.line(46, 34, 44, 40, GOLD[3], 2);
        r.poly([[51, 11], [58, 10], [61, 33], [50, 37], [34, 35], [33, 31], [51, 31]], m.steel(0.55));
        r.rect(51, 11, 7, 1, m.metal[4]);
        r.rect(34, 31, 17, 1, m.metal[0]);
        r.disc(55, 27, 1.4, m.metal[4]);
      }) },
      // cano com nervura ventilada, furos de compensação e mira dourada
      { pose: breakPose, image: layerOf(W, H, r => {
        r.rect(0, 13, 36, 9, m.steel(0.8));
        r.rect(0, 13, 36, 1, m.metal[4]);
        r.rect(0, 21, 36, 1, m.metal[0]);
        r.rect(0, 10, 36, 3, m.metal[3]);
        for (let x = 15; x < 34; x += 4) r.rect(x, 10, 2, 2, m.metal[0]);
        for (const x of [4, 8, 12]) r.rect(x - 1, 10, 2, 3, 0x000000);
        r.rect(1, 5, 4, 5, GOLD[3]);
        r.rect(1, 5, 1, 5, GOLD[4]);
        r.rect(3, 22, 31, 6, m.steel(0.5));
        r.rect(3, 22, 31, 1, m.metal[3]);
        r.rect(3, 27, 31, 1, m.metal[0]);
        r.poly([[33, 10], [37, 10], [37, 33], [33, 34]], m.steel(0.6));
        r.disc(HINGE[0], HINGE[1], 2, m.metal[4]);
        r.put(HINGE[0], HINGE[1], m.metal[1]);
        r.rect(35, 10, 21, 4, m.steel(0.7));
        r.rect(35, 10, 21, 1, m.metal[4]);
        r.rect(54, 10, 3, 3, m.metal[1]);
        if (accessory === 'compensator') {
          r.rect(0, 9, 12, 14, m.steel(0.45));
          for (const x of [3, 6, 9]) r.rect(x, 9, 1, 5, 0x000000);
        }
        if (accessory === 'laser') {
          r.rect(8, 28, 18, 5, 0x18181c);
          r.rect(8, 28, 18, 1, 0x4a4a52);
          r.rect(6, 29, 2, 3, 0xe02018);
        }
      }) },
      {
        variants: Object.fromEntries([0, 1, 2, 3].map(p => [`c${p}`, cylinder(p)])),
        pose: p => ({ ...breakPose(p), variant: `c${Math.floor(p.spin * 4) % 4}` }),
      },
      // Fundo do tambor: aparece quando a arma quebra, com a estrela extratora saltando para fora.
      {
        pose: p => ({ ...breakPose(p), hidden: p.open < 0.12 }),
        paint: (ctx, p) => {
          const rx = 1 + clamp01((p.open - 0.12) / 0.6) * 5, cx = 51 + rx + p.extract * 3, cy = 22.5;
          ctxBox(ctx, m.metal[1], 51, 15, cx - 51, 15);
          for (let dy = -8; dy <= 8; dy++) {
            const half = Math.floor(rx * Math.sqrt(1 - (dy / 8.6) ** 2));
            const edge = Math.abs(dy) === 8 || half === 0;
            ctxBox(ctx, edge ? m.metal[0] : dy < -5 ? m.metal[3] : m.metal[2], cx - half, cy + dy, half * 2 + 1, 1);
          }
          for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 2 + Math.PI / 4, hx = cx + Math.cos(a) * rx * 0.48, hy = cy + Math.sin(a) * 4.4;
            const loaded = i < p.ammo, w = Math.max(1, Math.round(rx * 0.55));
            ctxBox(ctx, loaded ? BRASS : 0x08080a, hx - w / 2, hy - 1.5, w, 3);
            if (loaded) ctxBox(ctx, w > 2 ? BRASS_DARK : 0xf0d070, hx, hy, 1, 1);
          }
          ctxBox(ctx, m.metal[0], cx, cy - 1, 1, 2);
        },
      },
      // trava em estribo: levanta antes de a arma abrir
      {
        image: layerOf(W, H, r => {
          r.poly([[51, 7], [58, 6], [60, 12], [57, 13], [52, 10]], m.metal[2]);
          r.rect(52, 7, 6, 1, m.metal[4]);
        }),
        pose: p => ({ angle: p.latch * 0.7, px: 59, py: 12 }),
      },
      // cão grande, de espora larga
      {
        image: layerOf(W, H, r => {
          r.poly([[55, 9], [57, 0], [65, 1], [66, 4], [60, 13]], m.metal[1]);
          for (let x = 58; x < 65; x += 2) r.put(x, 1, m.metal[4]);
          r.line(57, 3, 59, 10, m.metal[3]);
        }),
        pose: p => ({ angle: p.hammer * 0.6, px: 59, py: 12 }),
      },
    ],
  };
}

// Sniper de ferrolho: a mão sai do cabo para manobrar o ferrolho, que fica aberto quando a arma esvazia.
export function buildSniper(custom, m) {
  const W = 180, H = 52, accessory = custom.options.accessory;
  const BOLT = [127, 20], KNOB = [136, 30], TRAVEL = 18, LIFT = 1.45;
  const boltShift = p => p.boltBack * TRAVEL;            // o ferrolho corre para trás, rumo à coronha
  const knobAt = p => {
    const [x, y] = turn(KNOB[0], KNOB[1], BOLT[0], BOLT[1], -p.boltLift * LIFT);
    return [x + boltShift(p), y];
  };
  return {
    size: [W, H], pivot: [114, 23], muzzle: [0, 17], hand: [124, 37], load: [116, 18], eject: [118, 17],
    carry: 'round', casing: 'long', flashSize: 1.9, smoke: 1.6, flashStyle: 'brake', brakeSlots: [3, 7, 11],
    recoil: { back: 13, up: 6, tilt: 0.16, stiffness: 130, damping: 11 },
    reload: { x: 498, y: 198, angle: 0.3 },
    handPath: p => ({ point: knobAt(p), weight: p.actionHand }),
    layers: [
      // coronha vazada com apoio de rosto e soleira de borracha
      { image: layerOf(W, H, r => {
        r.poly([[114, 19], [176, 18], [178, 46], [158, 50], [140, 37], [116, 33]], m.wood(0.7, 114));
        r.poly([[140, 27], [160, 25], [160, 38], [151, 41], [143, 34]], CLEAR);
        r.rect(144, 15, 26, 4, m.wood(0.8, 114));
        r.rect(175, 18, 4, 29, m.grip[0]);
        for (let y = 20; y < 46; y += 3) r.put(176, y, m.grip[2]);
        r.poly([[114, 30], [126, 28], [134, 48], [123, 51], [116, 40]], m.wood(0.6, 114));
        for (let i = 0; i < 3; i++) r.line(118 + i * 3, 32, 124 + i * 3, 46, m.grip[0]);
        if (accessory === 'sling') for (let i = 0; i < 9; i++) r.line(120 + i * 5, 43 + i * 0.7, 126 + i * 5, 43 + i * 0.7, i % 2 ? 0x6a5a40 : 0x9a8a60, 2);
      }) },
      { image: layerOf(W, H, r => {
        // cano estriado e freio de boca com janelas
        r.rect(12, 15, 92, 5, (x, y) => dither(x, y, 0.75 - (y - 15) / 8, DARK_STEEL, 0.8));
        for (let x = 22; x < 60; x += 6) r.rect(x, 17, 4, 1, DARK_STEEL[0]);
        r.rect(12, 15, 92, 1, DARK_STEEL[4]);
        r.rect(0, 12, 14, 11, (x, y) => dither(x, y, 0.6 - (y - 12) / 22, DARK_STEEL, 0.8));
        r.rect(0, 12, 14, 1, DARK_STEEL[4]);
        for (const x of [2, 6, 10]) r.rect(x, 13, 2, 9, 0x000000);
        // guarda-mão
        r.rect(54, 20, 52, 6, m.steel(0.5));
        r.rect(54, 20, 52, 1, m.metal[3]);
        for (let x = 58; x < 102; x += 6) r.rect(x, 22, 3, 2, m.metal[0]);
        // caixa da culatra com janela de ejeção
        r.poly([[100, 13], [130, 14], [132, 30], [102, 30]], m.steel(0.62));
        r.rect(100, 13, 30, 2, m.metal[3]);
        r.rect(108, 16, 18, 5, 0x08080a);
        r.poly([[110, 30], [126, 30], [124, 40], [112, 40]], m.steel(0.5));
        r.ring(114, 35, 6, 4.6, m.metal[2]);
        r.line(115, 32, 113, 37, m.metal[1], 2);
        // luneta grande com torres
        r.rect(54, 3, 56, 8, (x, y) => dither(x, y, 0.55 - (y - 3) / 14, DARK_STEEL, 0.8));
        r.rect(54, 3, 56, 1, DARK_STEEL[4]);
        r.poly([[45, 0], [56, 2], [56, 12], [45, 14]], (x, y) => dither(x, y, 0.6 - (y) / 20, DARK_STEEL, 0.8));
        r.disc(47, 7, 3, 0x2a5a88);
        r.disc(46, 6, 1.4, 0x6ab0e8);
        r.poly([[108, 1], [118, 2], [118, 12], [108, 13]], DARK_STEEL[2]);
        r.rect(78, 0, 7, 3, DARK_STEEL[3]);
        r.rect(88, 0, 4, 3, DARK_STEEL[2]);
        r.rect(64, 11, 5, 5, m.metal[1]);
        r.rect(96, 11, 5, 5, m.metal[1]);
        if (accessory === 'bipod') {
          r.line(44, 24, 36, 46, m.metal[2], 2);
          r.line(48, 24, 56, 46, m.metal[1], 2);
          r.rect(40, 23, 12, 3, m.metal[3]);
        }
      }) },
      // Estojo na janela: aparece com o ferrolho para trás (o vazio antes de ejetar, ou a bala nova na recarga).
      {
        pose: p => ({ hidden: p.boltBack < 0.35 || (!p.spent && p.ammo <= 0) }),
        paint: (ctx, p) => {
          ctxBox(ctx, p.spent ? 0xb08030 : BRASS, 110, 17, 12, 3);
          ctxBox(ctx, 0xf0d070, 110, 17, 12, 1);
          if (!p.spent) ctxBox(ctx, 0xb87040, 107, 17, 3, 3);
        },
      },
      {
        image: layerOf(W, H, r => {
          r.rect(106, 16, 24, 5, POLISHED[2]);
          r.rect(106, 16, 24, 1, POLISHED[4]);
          r.rect(106, 20, 24, 1, POLISHED[0]);
          r.rect(124, 17, 2, 3, POLISHED[1]);
        }),
        pose: p => ({ dx: boltShift(p) }),
      },
      // cabo do ferrolho com bola grande
      {
        image: layerOf(W, H, r => {
          r.line(BOLT[0], BOLT[1], KNOB[0] - 1, KNOB[1] - 2, POLISHED[2], 2);
          r.disc(KNOB[0], KNOB[1], 3.4, POLISHED[1]);
          r.disc(KNOB[0] - 0.5, KNOB[1] - 0.5, 2.6, POLISHED[3]);
          r.disc(KNOB[0] - 1, KNOB[1] - 1, 1.2, POLISHED[4]);
        }),
        pose: p => ({ dx: boltShift(p), angle: -p.boltLift * LIFT, px: BOLT[0], py: BOLT[1] }),
      },
      // reflexo da lente de tempos em tempos
      {
        pose: p => ({ hidden: p.t % 3.4 > 0.22 }),
        paint: (ctx, p) => {
          const k = Math.sin((p.t % 3.4) / 0.22 * Math.PI), len = Math.round(1 + k * 4);
          ctxBox(ctx, 0xffffff, 45 - len, 6, len * 2 + 1, 1);
          ctxBox(ctx, 0xffffff, 45, 6 - len, 1, len * 2 + 1);
        },
      },
    ],
  };
}

// Escopeta automática de tambor: o tambor gira um cartucho a cada tiro e volta um a cada cartucho carregado.
// A capa furada do cano esquenta com a rajada.
export function buildAutoShotgun(custom, m) {
  const W = 112, H = 62, accessory = custom.options.accessory;
  const DRUM = [60, 38], DRUM_R = 13, SLOTS = 6;
  const slideShift = p => -p.bolt * 9;
  const heatColor = h => h < 0.15 ? 0x050506 : h < 0.4 ? mix(0x3a0806, 0xa01808, (h - 0.15) / 0.25) : h < 0.75 ? mix(0xa01808, 0xff6a18, (h - 0.4) / 0.35) : mix(0xff6a18, 0xffe080, (h - 0.75) / 0.25);
  return {
    size: [W, H], pivot: [80, 24], muzzle: [0, 13], hand: [88, 34], load: [74, 36], eject: [72, 12],
    carry: 'shell', casing: 'shell', flashSize: 1.6, smoke: 1.4, flashStyle: 'scatter',
    recoil: { back: 7, up: 7, tilt: 0.18, stiffness: 340, damping: 22, shake: 1 },
    reload: { x: 500, y: 196, angle: -0.15 },
    layers: [
      // coronha vazada e cabo de borracha
      { image: layerOf(W, H, r => {
        r.poly([[88, 10], [110, 12], [110, 30], [104, 32], [92, 22]], m.steel(0.4));
        r.poly([[94, 16], [106, 17], [106, 26], [99, 24]], CLEAR);
        r.rect(108, 11, 3, 21, m.grip[0]);
        r.poly([[78, 22], [90, 20], [98, 44], [87, 48], [82, 34]], m.wood(0.7, 78));
        for (let i = 0; i < 4; i++) r.line(84 + i * 2, 25 + i, 89 + i * 2, 42 + i, m.grip[0]);
        if (accessory === 'strap') for (let i = 0; i < 6; i++) r.line(82 + i * 2.5, 22 + i * 4, 92 + i * 2.5, 19 + i * 4, i % 2 ? 0x6a5a40 : 0x9a8a60, 2);
      }) },
      { image: layerOf(W, H, r => {
        r.ring(78, 28, 6, 4.6, m.metal[2]);
        r.line(79, 25, 77, 30, m.metal[1], 2);
        r.rect(0, 10, 52, 6, m.steel(0.8));
        r.rect(0, 10, 52, 1, m.metal[4]);
        r.rect(0, 9, 3, 9, m.metal[1]);
        // capa furada
        r.rect(8, 7, 42, 12, m.steel(0.55));
        r.rect(8, 7, 42, 1, m.metal[4]);
        r.rect(8, 18, 42, 1, m.metal[0]);
        // caixa da culatra quadrada, com trilho e alça
        r.poly([[48, 5], [92, 6], [93, 25], [48, 26]], m.steel(0.62));
        r.rect(48, 5, 44, 2, m.metal[3]);
        r.rect(54, 1, 34, 2, m.metal[2]);
        for (let x = 55; x < 88; x += 3) r.put(x, 1, m.metal[4]);
        r.rect(56, 3, 3, 2, m.metal[1]);
        r.rect(83, 3, 3, 2, m.metal[1]);
        r.rect(64, 10, 16, 5, 0x08080a);
        r.disc(88, 21, 1.3, m.metal[4]);
        r.rect(4, 4, 3, 3, 0xc02818);
        // suporte do tambor
        r.rect(52, 24, 18, 3, m.metal[1]);
        if (accessory === 'shells') {
          r.rect(14, 19, 30, 6, 0x2a1c12);
          for (let i = 0; i < 6; i++) { r.rect(15 + i * 5, 20, 4, 4, 0xa02418); r.rect(15 + i * 5, 23, 4, 2, 0xc09a4a); }
        }
      }) },
      // furos da capa: escuros parados, vermelhos e amarelos depois de uma rajada
      {
        paint: (ctx, p) => {
          const c = heatColor(p.heat);
          for (let x = 11; x < 48; x += 4) { ctxBox(ctx, c, x, 10, 2, 2); ctxBox(ctx, c, x + 2, 14, 2, 2); }
          if (p.heat > 0.6) for (let i = 0; i < 3; i++) {
            const k = (p.t * 1.6 + i / 3) % 1;
            ctxBox(ctx, 0x8a8680, 14 + i * 12 + Math.sin(k * 7) * 2, 6 - k * 10, 1, 1);
          }
        },
      },
      // tambor visto de lado: cartuchos em volta do eixo, girando
      {
        paint: (ctx, p) => {
          const [cx, cy] = DRUM;
          ctxDisc(ctx, cx, cy, DRUM_R, m.metal[0]);
          ctxDisc(ctx, cx, cy, DRUM_R - 1, m.metal[2]);
          ctxDisc(ctx, cx - 1, cy - 1, DRUM_R - 3, m.metal[3]);
          const base = Math.round(p.drumIndex ?? 0);
          for (let k = 0; k < SLOTS; k++) {
            const a = (k - p.drum) * Math.PI * 2 / SLOTS - Math.PI / 2;
            const sx = cx + Math.cos(a) * 8, sy = cy + Math.sin(a) * 8;
            const loaded = ((k - base) % SLOTS + SLOTS) % SLOTS < p.ammo;
            ctxDisc(ctx, sx, sy, 2.6, loaded ? 0xa02418 : 0x08080a);
            if (loaded) { ctxDisc(ctx, sx, sy, 1.4, 0xc09a4a); ctxBox(ctx, 0xf0d080, sx - 1, sy - 1, 1, 1); }
          }
          ctxDisc(ctx, cx, cy, 2.4, m.metal[1]);
          // chave da mola, que gira junto
          const ka = -p.drum * Math.PI * 2 / SLOTS;
          ctxLine(ctx, m.metal[4], cx - Math.cos(ka) * 3, cy - Math.sin(ka) * 3, cx + Math.cos(ka) * 3, cy + Math.sin(ka) * 3, 2);
        },
      },
      // portinhola de carga atrás do tambor: abre na recarga
      {
        image: layerOf(W, H, r => {
          r.rect(72, 30, 3, 9, m.metal[3]);
          r.rect(72, 30, 1, 9, m.metal[4]);
        }),
        pose: p => ({ angle: p.open * 1.1, px: 73, py: 30 }),
      },
      {
        image: layerOf(W, H, r => {
          r.rect(64, 11, 16, 4, m.metal[3]);
          r.rect(64, 11, 16, 1, m.metal[4]);
          r.rect(72, 7, 5, 4, m.metal[1]);
          r.rect(73, 7, 3, 1, m.metal[4]);
        }),
        pose: p => ({ dx: slideShift(p) }),
      },
    ],
  };
}

// Besta incendiária: braços que vibram quando a corda solta, manivela que gira para armar
// e flecha com o trapo da ponta pegando fogo.
export function buildCrossbow(custom, m) {
  const W = 124, H = 64, accessory = custom.options.accessory;
  const CRANK = [98, 37];
  const limbPoints = p => {
    const vib = p.flex * Math.sin(p.t * 60) * 3, draw = clamp01(p.draw);
    const tipX = 6 + draw * 8 + vib, latchX = 9 + draw * 46 + p.flex * Math.sin(p.t * 85) * 4;
    return { tipX, latchX };
  };
  return {
    size: [W, H], pivot: [76, 31], muzzle: [8, 30], hand: [86, 44], load: [58, 27], eject: [60, 27],
    carry: 'bolt', casing: 'round', flashSize: 1, smoke: 0.2, flashStyle: 'whoosh',
    recoil: { back: -3, up: -4, tilt: -0.16, stiffness: 150, damping: 8 },
    reload: { x: 498, y: 200, angle: 0.2 },
    layers: [
      { image: layerOf(W, H, r => {
        r.poly([[14, 27], [90, 26], [118, 39], [113, 54], [94, 48], [64, 38], [14, 34]], m.wood(0.76, 14));
        r.rect(14, 27, 76, 1, m.grip[4]);
        r.rect(18, 29, 42, 2, 0x120a06);
        r.poly([[74, 34], [86, 32], [94, 54], [84, 58], [78, 46]], m.wood(0.7, 74));
        for (let i = 0; i < 3; i++) r.line(80 + i * 3, 37, 86 + i * 3, 51, m.grip[0]);
        r.rect(14, 24, 8, 12, m.steel(0.6));
        r.rect(14, 24, 8, 1, m.metal[4]);
        r.ring(74, 41, 6, 4.6, m.metal[2]);
        r.line(75, 37, 73, 42, m.metal[1], 2);
        // catraca da manivela
        r.disc(CRANK[0], CRANK[1], 5.5, m.metal[1]);
        r.disc(CRANK[0], CRANK[1], 4.2, m.metal[3]);
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; r.put(CRANK[0] + Math.cos(a) * 5.5, CRANK[1] + Math.sin(a) * 5.5, m.metal[4]); }
        if (accessory === 'scope') {
          r.rect(28, 16, 28, 5, m.metal[0]);
          r.rect(28, 16, 28, 1, m.metal[3]);
          r.rect(32, 21, 3, 6, m.metal[1]);
          r.rect(48, 21, 3, 6, m.metal[1]);
          r.disc(28, 18.5, 2.4, 0x4a90c8);
        }
        if (accessory === 'quiver') {
          r.poly([[44, 35], [70, 39], [68, 45], [44, 41]], 0x2a1c12);
          for (let i = 0; i < 3; i++) { r.line(46 + i * 7, 37 + i, 64 + i * 7, 37 + i, 0x9a8a6a); r.rect(44 + i * 7, 35 + i, 3, 3, 0xc02818); }
        }
      }) },
      // braços recurvados e corda, redesenhados a cada quadro para vibrar
      {
        paint: (ctx, p) => {
          const { tipX, latchX } = limbPoints(p);
          const lightLimb = m.metal[3], darkLimb = m.metal[1];
          for (const dir of [-1, 1]) {
            const y0 = 30 + dir * 3, midX = 12 + (tipX - 6) * 0.4, midY = 30 + dir * 15, tipY = 30 + dir * 26;
            ctxLine(ctx, darkLimb, 18, y0, midX, midY, 4);
            ctxLine(ctx, darkLimb, midX, midY, tipX, tipY, 3);
            ctxLine(ctx, dir < 0 ? lightLimb : m.metal[2], 18, y0 - 1, midX, midY - 1);
            ctxLine(ctx, dir < 0 ? lightLimb : m.metal[2], midX, midY - 1, tipX, tipY - 1);
            ctxLine(ctx, m.metal[4], tipX - 1, tipY, tipX + 2, tipY + dir * 2, 2);
            ctxLine(ctx, 0xd8d0b0, tipX + 1, tipY, latchX, 30);
          }
          ctxBox(ctx, m.metal[2], latchX - 1, 28, 3, 5);
        },
      },
      // noz da trava: segura a corda e gira quando solta
      {
        image: layerOf(W, H, r => {
          r.rect(54, 24, 12, 8, m.metal[2]);
          r.rect(54, 24, 12, 1, m.metal[4]);
          r.rect(56, 23, 3, 2, m.metal[1]);
        }),
        pose: p => ({ angle: -p.nut * 0.4, px: 60, py: 32 }),
      },
      // flecha incendiária: trapo em chamas atrás da ponta, que tremula enquanto ela está armada
      {
        pose: p => ({ hidden: p.ammo <= 0 }),
        paint: (ctx, p) => {
          ctxBox(ctx, 0x9a8a6a, 14, 28, 42, 2);
          ctxBox(ctx, 0xc8b890, 14, 28, 42, 1);
          ctxBox(ctx, 0xc84a30, 50, 25, 7, 2);
          ctxBox(ctx, 0xc84a30, 50, 30, 7, 2);
          paintBurningTip(ctx, 2, 29, p.t);
        },
      },
      // manivela: gira enquanto a corda é puxada
      {
        paint: (ctx, p) => {
          const [cx, cy] = CRANK, a = p.crank, ex = cx + Math.cos(a) * 9, ey = cy + Math.sin(a) * 9;
          ctxLine(ctx, m.metal[1], cx, cy, ex, ey, 2);
          ctxLine(ctx, m.metal[4], cx, cy - 1, ex, ey - 1);
          ctxDisc(ctx, ex, ey, 2.2, 0x2a1c12);
          ctxBox(ctx, 0x5a3a26, ex - 1, ey - 1, 1, 1);
          ctxDisc(ctx, cx, cy, 1.6, m.metal[4]);
        },
      },
    ],
  };
}

// Ponta de flecha incendiária com o trapo em chamas; (x, y) é a ponta. Também serve à mão que leva a flecha.
export function paintBurningTip(ctx, x, y, t) {
  ctxLine(ctx, 0xd8d8dc, x, y, x + 4, y - 3);
  ctxLine(ctx, 0xd8d8dc, x, y, x + 4, y + 2);
  ctxBox(ctx, 0xa8a8b0, x + 2, y - 1, 3, 2);
  ctxBox(ctx, 0x6a4a2a, x + 5, y - 3, 8, 6);
  for (let i = 0; i < 3; i++) ctxBox(ctx, 0x3a2614, x + 6 + i * 3, y - 3, 1, 6);
  ctxBox(ctx, 0x8a6a40, x + 5, y - 3, 8, 1);
  const frame = Math.floor(t * 14);
  for (let i = 0; i < 4; i++) {
    const h = 4 + Math.floor(hash(frame, i) * 7), fx = x + 5 + i * 2, sway = hash(frame, i + 9) > 0.5 ? 1 : 0;
    ctxBox(ctx, 0xd83a10, fx + sway, y - 3 - h, 2, h);
    ctxBox(ctx, 0xff9a20, fx + sway, y - 2 - Math.ceil(h * 0.6), 1, Math.ceil(h * 0.6));
    ctxBox(ctx, 0xffe080, fx, y - 4, 1, 1);
  }
  if (hash(frame, 20) > 0.6) ctxBox(ctx, 0xffd060, x + 6 + Math.floor(hash(frame, 21) * 6), y - 11 - Math.floor(hash(frame, 22) * 3), 1, 1);
}

// Lança-granadas de bomba: cano grosso, mira de escada e tubo com janela mostrando as granadas.
// Depois de cada tiro a mão larga o cabo, puxa a bomba (cospe o estojo) e volta.
export function buildGrenadeLauncher(custom, m) {
  const W = 120, H = 56, accessory = custom.options.accessory;
  const PUMP_TRAVEL = 12, PUMP_GRIP = [42, 28];
  const pumpShift = p => p.pump * PUMP_TRAVEL;
  const GRENADE = [0x2a3018, 0x4a5428, 0x6a7638, 0x8a9a4a];
  return {
    size: [W, H], pivot: [84, 22], muzzle: [0, 14], hand: [92, 32], load: [60, 30], eject: [68, 10],
    carry: 'grenade', casing: 'grenade', flashSize: 1.3, smoke: 2.4,
    recoil: { back: 9, up: 11, tilt: 0.34, stiffness: 170, damping: 12 },
    reload: { x: 498, y: 200, angle: -0.35 },
    handPath: p => ({ point: [PUMP_GRIP[0] + pumpShift(p), PUMP_GRIP[1]], weight: p.actionHand }),
    layers: [
      // coronha de tubo e cabo
      { image: layerOf(W, H, r => {
        r.line(88, 10, 116, 12, m.metal[1], 3);
        r.line(92, 26, 116, 22, m.metal[1], 3);
        r.rect(114, 9, 5, 17, m.grip[0]);
        r.rect(114, 9, 1, 17, m.grip[3]);
        r.poly([[82, 22], [94, 20], [102, 44], [90, 48], [86, 34]], m.wood(0.72, 82));
        for (let i = 0; i < 4; i++) r.line(87 + i * 2, 25 + i, 92 + i * 2, 42 + i, m.grip[0]);
        if (accessory === 'bandolier') {
          r.line(96, 11, 108, 24, 0x3a2a18, 4);
          for (let i = 0; i < 3; i++) { const x = 98 + i * 4, y = 13 + i * 4.5; r.disc(x, y, 2.4, GRENADE[2]); r.put(x - 1, y - 1, GRENADE[3]); r.rect(x - 2, y + 1, 4, 1, 0xd8b040); }
        }
      }) },
      { image: layerOf(W, H, r => {
        r.ring(80, 30, 6, 4.6, m.metal[2]);
        r.line(81, 27, 79, 32, m.metal[1], 2);
        // cano grosso com boca larga
        r.rect(4, 8, 54, 12, m.steel(0.75));
        r.rect(4, 8, 54, 1, m.metal[4]);
        r.rect(4, 19, 54, 1, m.metal[0]);
        r.rect(0, 6, 5, 16, m.steel(0.5));
        r.rect(0, 6, 5, 1, m.metal[4]);
        r.rect(0, 10, 2, 8, 0x050506);
        for (let x = 10; x < 54; x += 9) r.rect(x, 9, 1, 10, m.metal[1]);
        r.rect(7, 2, 3, 6, m.metal[2]);
        r.rect(7, 2, 3, 1, 0xf0c040);
        // mira de escada
        r.rect(44, 0, 2, 8, m.metal[1]);
        r.rect(51, 0, 2, 8, m.metal[1]);
        for (let y = 1; y < 8; y += 2) r.rect(44, y, 9, 1, m.metal[3]);
        r.rect(46, 0, 5, 1, 0xf0c040);
        // tubo das granadas com janela
        r.rect(8, 21, 50, 8, m.steel(0.45));
        r.rect(8, 21, 50, 1, m.metal[3]);
        r.rect(9, 23, 21, 4, 0x08080a);
        // caixa da culatra com janela de ejeção e portinhola de carga
        r.poly([[56, 5], [90, 6], [92, 28], [56, 29]], m.steel(0.6));
        r.rect(56, 5, 34, 2, m.metal[3]);
        r.rect(62, 9, 14, 6, 0x08080a);
        r.rect(56, 27, 10, 2, m.metal[0]);
        r.disc(88, 22, 1.3, m.metal[4]);
        // faixa de alerta na boca
        for (let x = 0; x < 5; x += 2) r.rect(x, 20, 1, 2, 0xf0c040);
      }) },
      // granadas no tubo: uma por munição, vistas pela janela
      {
        paint: (ctx, p) => {
          for (let i = 0; i < Math.min(3, p.ammo); i++) {
            const x = 23 - i * 7;
            ctxBox(ctx, GRENADE[2], x, 23, 6, 4);
            ctxBox(ctx, GRENADE[3], x, 23, 6, 1);
            ctxBox(ctx, 0xd8b040, x + 4, 23, 2, 4);
            ctxBox(ctx, GRENADE[0], x, 26, 6, 1);
          }
        },
      },
      // bomba (guarda-mão) que corre no tubo
      {
        image: layerOf(W, H, r => {
          r.poly([[31, 19], [53, 19], [53, 32], [33, 32]], m.wood(0.68, 31));
          for (let x = 35; x < 51; x += 3) r.rect(x, 22, 1, 8, m.grip[1]);
          r.rect(31, 19, 22, 1, m.grip[4]);
          if (accessory === 'foregrip') {
            r.poly([[38, 32], [46, 32], [45, 46], [39, 46]], m.steel(0.45));
            r.rect(38, 32, 1, 14, m.metal[3]);
          }
        }),
        pose: p => ({ dx: pumpShift(p) }),
      },
      // ferrolho que aparece na janela quando a bomba vem para trás
      {
        image: layerOf(W, H, r => {
          r.rect(62, 10, 14, 4, m.metal[3]);
          r.rect(62, 10, 14, 1, m.metal[4]);
        }),
        pose: p => ({ dx: pumpShift(p) * 0.9 }),
      },
    ],
  };
}

// Metralhadora de canos giratórios: seis canos em volta do eixo, redesenhados a cada quadro conforme giram
// (os de trás mais escuros), caixa de munição pendurada embaixo com a cinta subindo para a culatra,
// capa de alimentação que abre na recarga e alavanca de armar puxada no fim dela. Os canos esquentam na rajada.
export function buildGatling(custom, m) {
  const W = 128, H = 66, accessory = custom.options.accessory;
  const AXIS = 18, SPREAD = 4.5, BARRELS = 6, BARREL_END = 64, COVER_HINGE = [88, 8];
  const BOX = { x: 64, y: 36, w: 24, h: 22 }, BOX_DROP = 34;
  const OLIVE = [0x1e2216, 0x343a24, 0x4c5434, 0x667048, 0x828c5c];
  const heatColor = (base, h) => (h < 0.2 ? base : h < 0.6 ? mix(base, 0xa82810, (h - 0.2) / 0.4) : mix(0xa82810, 0xffa040, (h - 0.6) / 0.4));
  // Um elo da cinta: bala de latão deitada, com a ponta para a esquerda.
  const round = (ctx, x, y) => {
    ctxBox(ctx, 0xb87040, x, y, 2, 3);
    ctxBox(ctx, BRASS, x + 2, y, 4, 3);
    ctxBox(ctx, 0xf0d070, x + 2, y, 4, 1);
    ctxBox(ctx, 0x3a3a3e, x + 6, y, 1, 3);
  };
  return {
    size: [W, H], pivot: [94, 26], muzzle: [0, AXIS], hand: [104, 40], load: [76, 44], eject: [82, 32],
    carry: 'ammobox', casing: 'round', flashSize: 1.25, smoke: 0.9,
    recoil: { back: 3, up: 3, tilt: 0.05, stiffness: 420, damping: 28, shake: 1 },
    reload: { x: 494, y: 202, angle: -0.22 },
    layers: [
      // cabo e chapa de trás
      { image: layerOf(W, H, r => {
        r.poly([[96, 28], [108, 26], [118, 50], [107, 56], [100, 40]], m.wood(0.7, 96));
        for (let i = 0; i < 4; i++) r.line(102 + i * 2, 31 + i, 107 + i * 2, 48 + i, m.grip[0]);
        r.rect(108, 8, 5, 24, m.steel(0.45));
        r.rect(108, 8, 1, 24, m.metal[4]);
        r.rect(113, 12, 3, 16, m.metal[1]);
      }) },
      // seis canos girando: os de trás primeiro e mais escuros, os da frente por cima, com brilho em cima
      {
        paint: (ctx, p) => {
          const barrels = [];
          for (let k = 0; k < BARRELS; k++) {
            const a = (k + p.rotor) * Math.PI * 2 / BARRELS;
            barrels.push({ y: AXIS + Math.sin(a) * SPREAD, depth: Math.cos(a) });
          }
          barrels.sort((a, b) => a.depth - b.depth);
          const blur = clamp01((p.rotorSpeed - 8) / 10);       // girando muito rápido, os canos viram um borrão
          for (const { y, depth } of barrels) {
            const tone = Math.round(clamp01(depth * 0.5 + 0.5) * 3), top = Math.round(y - 1);
            const body = m.metal[tone], light = m.metal[Math.min(4, tone + 1)];
            ctxBox(ctx, body, 3, top, BARREL_END - 3, 3);
            if (depth > 0.3) ctxBox(ctx, light, 3, top, BARREL_END - 3, 1);
            ctxBox(ctx, heatColor(body, p.heat), 3, top, 10, 3);
            ctxBox(ctx, 0x050506, 1, top + 1, 2, 1);
          }
          if (blur > 0) for (let x = 8; x < BARREL_END; x += 7) ctxBox(ctx, mix(m.metal[2], m.metal[3], blur), x, AXIS - 5, 2, 11);
        },
      },
      // braçadeiras, eixo, culatra, motor e alça
      { image: layerOf(W, H, r => {
        for (const [x, w] of [[2, 4], [30, 4]]) {
          r.rect(x, AXIS - 7, w, 15, m.steel(0.65));
          r.rect(x, AXIS - 7, w, 1, m.metal[4]);
          r.rect(x, AXIS + 7, w, 1, m.metal[0]);
        }
        r.rect(58, AXIS - 8, 8, 17, m.steel(0.55));
        r.rect(58, AXIS - 8, 8, 1, m.metal[4]);
        // culatra
        r.poly([[64, 6], [108, 6], [108, 34], [64, 34]], m.steel(0.6));
        r.rect(64, 6, 44, 2, m.metal[3]);
        r.rect(64, 33, 44, 1, m.metal[0]);
        for (let x = 70; x < 104; x += 6) r.rect(x, 22, 3, 8, m.metal[1]);
        // motor que gira os canos
        r.rect(88, 14, 14, 8, m.steel(0.8));
        r.rect(88, 14, 14, 1, m.metal[4]);
        for (let x = 90; x < 102; x += 3) r.rect(x, 15, 1, 6, m.metal[1]);
        r.disc(84, 18, 3, m.metal[2]);
        r.disc(84, 18, 1.4, m.metal[4]);
        // alça de carregar
        r.rect(72, 0, 26, 2, m.metal[2]);
        r.rect(72, 0, 26, 1, m.metal[4]);
        r.rect(72, 2, 3, 4, m.metal[1]);
        r.rect(95, 2, 3, 4, m.metal[1]);
        // guarda-mato e boca da cinta
        r.ring(98, 36, 6, 4.6, m.metal[2]);
        r.line(99, 33, 97, 38, m.metal[1], 2);
        r.rect(70, 32, 12, 4, 0x08080a);
        r.disc(104, 28, 1.3, m.metal[4]);
        if (accessory === 'shield') {
          r.poly([[44, 0], [56, 0], [58, 38], [44, 36]], m.steel(0.5));
          r.rect(44, 0, 12, 1, m.metal[4]);
          r.rect(56, 0, 2, 38, m.metal[0]);
          r.rect(48, 12, 6, 10, 0x08080a);
          for (const y of [3, 32]) r.disc(50, y, 1, m.metal[4]);
        }
        if (accessory === 'bipod') {
          r.rect(36, AXIS + 6, 8, 3, m.metal[3]);
          r.line(38, AXIS + 8, 28, 50, m.metal[2], 2);
          r.line(42, AXIS + 8, 50, 50, m.metal[1], 2);
        }
      }) },
      // capa de alimentação: abre para cima na dobradiça de trás durante a recarga
      {
        image: layerOf(W, H, r => {
          r.rect(64, 6, 24, 4, m.steel(0.75));
          r.rect(64, 6, 24, 1, m.metal[4]);
          r.rect(64, 9, 24, 1, m.metal[0]);
          r.rect(66, 4, 4, 2, m.metal[2]);
        }),
        pose: p => ({ angle: p.open * 0.9, px: COVER_HINGE[0], py: COVER_HINGE[1] }),
      },
      // alavanca de armar ao lado da culatra
      {
        image: layerOf(W, H, r => {
          r.rect(96, 9, 8, 3, m.metal[3]);
          r.rect(102, 8, 3, 5, m.metal[1]);
          r.rect(102, 8, 3, 1, m.metal[4]);
        }),
        pose: p => ({ dx: p.bolt * 9 }),
      },
      // caixa de munição com a cinta subindo para a culatra; cai e volta inteira na recarga
      {
        pose: p => ({ dy: p.magDrop * BOX_DROP, hidden: p.magDrop >= 1 }),
        paint: (ctx, p) => {
          const { x, y, w, h } = BOX;
          ctxBox(ctx, OLIVE[0], x, y, w, h);
          ctxBox(ctx, OLIVE[2], x + 1, y + 1, w - 2, h - 2);
          ctxBox(ctx, OLIVE[3], x + 1, y + 1, w - 2, 1);
          ctxBox(ctx, OLIVE[1], x + 1, y + h - 3, w - 2, 2);
          ctxBox(ctx, 0xd8b040, x + 3, y + 8, w - 6, 2);
          ctxBox(ctx, OLIVE[4], x + w - 6, y + 3, 3, 3);
          ctxBox(ctx, OLIVE[0], x + 6, y - 2, 8, 2);
          // Cinta: um elo a cada 3 pixels, andando um elo por tiro; no fim da munição ela acaba antes da boca.
          const shift = (p.belt % 1) * 3, links = Math.min(4, p.ammo);
          for (let i = 0; i < links; i++) round(ctx, 72, y - 1 - i * 3 + shift);
        },
      },
    ],
  };
}
