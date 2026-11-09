import { dither } from '../../art/shade.js';
import { layerOf } from './gunPaint.js';

// Desenho das armas com desenho próprio: revólver pesado, sniper, escopeta automática, besta e lança-chamas.
// Mesmas convenções de gunArt.js: o cano aponta para a esquerda, e os pontos são pixels da imagem.

const clamp01 = v => Math.max(0, Math.min(1, v));

export function buildMagnum(custom, m) {
  const W = 72, H = 58, accessory = custom.options.accessory;
  const closedCylinder = phase => layerOf(W, H, r => {
    r.rect(32, 13, 19, 18, m.steel(0.8));
    for (const x of [35, 40, 45, 49]) r.rect(x - 1 + phase, 13, 1, 18, m.metal[0]);
    r.rect(32, 13, 19, 1, m.metal[4]);
    r.rect(32, 30, 19, 1, m.metal[0]);
  });
  const openCylinder = loaded => layerOf(W, H, r => {
    r.line(41, 20, 39, 29, m.metal[1], 4);
    r.disc(40, 26, 10, m.steel(0.8));
    r.ring(40, 26, 10.4, 9.2, m.metal[0]);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4, cx = 40 + Math.cos(a) * 5.6, cy = 26 + Math.sin(a) * 5.6;
      r.disc(cx, cy, 2.6, i < loaded ? 0xd0a040 : 0x08080a);
      if (i < loaded) r.put(cx, cy, 0x8a5a20);
    }
  });
  return {
    size: [W, H], pivot: [48, 34], muzzle: [0, 16], hand: [58, 43], load: [38, 31], eject: [44, 20],
    carry: 'round', casing: 'round', flashSize: 1.7, smoke: 1.6,
    reload: { x: 496, y: 204, angle: 0.8 },
    layers: [
      { image: layerOf(W, H, r => {
        r.poly([[46, 32], [58, 29], [68, 52], [56, 57], [50, 45]], m.wood(0.78, 46));
        for (let i = 0; i < 4; i++) r.line(52 + i * 3, 34 + i * 2, 58 + i * 3, 50 + i * 2, m.grip[0]);
        r.disc(60, 44, 2, m.metal[4]);
      }) },
      { image: layerOf(W, H, r => {
        r.ring(43, 36, 8, 6.6, m.metal[2]);
        r.line(44, 32, 42, 38, m.metal[1], 2);
        r.rect(0, 12, 36, 9, m.steel(0.76));
        r.rect(0, 12, 36, 2, m.metal[4]);
        r.rect(0, 10, 36, 2, m.metal[3]);
        for (let x = 6; x < 32; x += 5) r.rect(x, 10, 2, 1, m.metal[0]);
        r.rect(3, 6, 3, 4, 0xc02818);
        r.rect(4, 21, 28, 5, m.steel(0.5));
        r.rect(4, 21, 28, 1, m.metal[3]);
        r.poly([[30, 9], [56, 9], [58, 33], [46, 35], [32, 30]], m.steel(0.55));
        r.rect(30, 9, 26, 2, m.metal[3]);
        r.disc(51, 27, 1.4, m.metal[4]);
        if (accessory === 'compensator') {
          r.rect(0, 9, 12, 13, m.steel(0.45));
          for (const x of [2, 5, 8]) r.rect(x, 10, 1, 5, 0x000000);
        }
        if (accessory === 'laser') {
          r.rect(8, 26, 18, 5, 0x18181c);
          r.rect(8, 26, 18, 1, 0x4a4a52);
          r.rect(6, 27, 2, 3, 0xe02018);
        }
      }) },
      {
        variants: {
          ...Object.fromEntries([0, 1, 2, 3].map(p => [`closed${p}`, closedCylinder(p)])),
          ...Object.fromEntries([0, 1, 2, 3, 4].map(n => [`open${n}`, openCylinder(n)])),
        },
        pose: p => (p.open > 0.4 ? { variant: `open${Math.min(4, p.ammo)}`, dy: (p.open - 0.4) * 4 } : { variant: `closed${Math.floor(p.spin * 4) % 4}` }),
      },
      {
        image: layerOf(W, H, r => {
          r.poly([[51, 7], [55, 0], [61, 2], [57, 11]], m.metal[1]);
          r.rect(54, 1, 5, 1, m.metal[3]);
        }),
        pose: p => ({ angle: p.hammer * 0.55, px: 55, py: 10 }),
      },
    ],
  };
}

export function buildSniper(custom, m) {
  const W = 174, H = 50, accessory = custom.options.accessory;
  const boltShift = p => -p.boltBack * 16;
  return {
    size: [W, H], pivot: [112, 22], muzzle: [0, 17], hand: [122, 35], load: [108, 20], eject: [112, 18],
    carry: 'round', casing: 'long', flashSize: 2, smoke: 1.5,
    reload: { x: 498, y: 198, angle: 0.3 },
    layers: [
      { image: layerOf(W, H, r => {
        r.poly([[112, 18], [172, 20], [173, 44], [154, 48], [134, 34], [114, 31]], m.wood(0.78, 112));
        r.rect(170, 20, 3, 25, m.grip[0]);
        r.poly([[112, 29], [124, 27], [131, 46], [121, 49], [114, 39]], m.wood(0.7, 112));
        for (let i = 0; i < 3; i++) r.line(116 + i * 3, 31, 122 + i * 3, 44, m.grip[0]);
        if (accessory === 'sling') for (let i = 0; i < 9; i++) r.line(118 + i * 5, 41 + i * 0.7, 124 + i * 5, 41 + i * 0.7, i % 2 ? 0x6a5a40 : 0x9a8a60, 2);
      }) },
      { image: layerOf(W, H, r => {
        r.rect(10, 15, 92, 5, m.steel(0.8));
        r.rect(10, 15, 92, 1, m.metal[4]);
        r.rect(0, 13, 12, 9, m.steel(0.5));
        for (const x of [2, 5, 8]) r.rect(x, 14, 1, 7, 0x000000);
        r.rect(52, 20, 54, 5, m.steel(0.45));
        r.rect(52, 20, 54, 1, m.metal[3]);
        for (let x = 56; x < 100; x += 6) r.rect(x, 22, 3, 2, m.metal[0]);
        r.poly([[98, 13], [128, 14], [130, 29], [100, 29]], m.steel(0.62));
        r.rect(98, 13, 30, 2, m.metal[3]);
        r.rect(112, 17, 14, 4, 0x08080a);
        r.poly([[108, 29], [124, 29], [122, 39], [110, 39]], m.steel(0.5));
        r.ring(112, 33, 6, 4.6, m.metal[2]);
        r.line(113, 30, 111, 35, m.metal[1], 2);
        // luneta
        r.rect(56, 3, 52, 7, m.metal[0]);
        r.rect(56, 3, 52, 1, m.metal[3]);
        r.poly([[49, 1], [58, 3], [58, 10], [49, 12]], m.steel(0.6));
        r.disc(51, 6, 2, 0x4a90c8);
        r.rect(106, 2, 8, 9, m.metal[1]);
        r.rect(78, 0, 6, 3, m.metal[2]);
        r.rect(62, 10, 4, 6, m.metal[1]);
        r.rect(94, 10, 4, 6, m.metal[1]);
        if (accessory === 'bipod') {
          r.line(44, 24, 36, 46, m.metal[2], 2);
          r.line(48, 24, 56, 46, m.metal[1], 2);
          r.rect(40, 23, 12, 3, m.metal[3]);
        }
      }) },
      {
        image: layerOf(W, H, r => {
          r.rect(104, 17, 24, 4, m.metal[3]);
          r.rect(104, 17, 24, 1, m.metal[4]);
        }),
        pose: p => ({ dx: boltShift(p) }),
      },
      {
        image: layerOf(W, H, r => {
          r.line(125, 20, 133, 26, m.metal[2], 2);
          r.disc(135, 27.5, 2.8, m.metal[3]);
        }),
        pose: p => ({ dx: boltShift(p), angle: -p.boltLift * 1.4, px: 125, py: 20 }),
      },
    ],
  };
}

export function buildAutoShotgun(custom, m) {
  const W = 108, H = 52, accessory = custom.options.accessory;
  const slideShift = p => -p.bolt * 9;
  return {
    size: [W, H], pivot: [76, 28], muzzle: [0, 11], hand: [86, 37], load: [74, 16], eject: [72, 12],
    carry: 'shell', casing: 'shell', flashSize: 1.9, smoke: 1.8,
    reload: { x: 500, y: 204, angle: 0.25 },
    layers: [
      { image: layerOf(W, H, r => {
        r.poly([[74, 22], [90, 19], [106, 40], [96, 49], [82, 32]], m.wood(0.75, 74));
        for (let i = 0; i < 3; i++) r.line(84 + i * 3, 25 + i, 92 + i * 3, 40 + i, m.grip[0]);
        if (accessory === 'shells') {
          r.poly([[88, 24], [99, 36], [92, 42], [82, 30]], 0x2a1c12);
          for (let i = 0; i < 4; i++) { const x = 84 + i * 3, y = 26 + i * 3.4; r.rect(x, y, 4, 5, 0xa02418); r.rect(x, y + 4, 4, 2, 0xc09a4a); }
        }
        if (accessory === 'strap') for (let i = 0; i < 6; i++) r.line(78 + i * 3, 23 + i * 3, 88 + i * 3, 18 + i * 3, i % 2 ? 0x6a5a40 : 0x9a8a60, 2);
      }) },
      { image: layerOf(W, H, r => {
        r.ring(73, 32, 6, 4.6, m.metal[2]);
        r.line(74, 29, 72, 34, m.metal[1], 2);
        r.rect(0, 9, 68, 7, m.steel(0.8));
        r.rect(0, 8, 68, 1, m.metal[4]);
        for (let x = 8; x < 62; x += 5) r.rect(x, 10, 2, 1, 0x000000);
        r.rect(0, 17, 60, 6, m.steel(0.55));
        r.rect(0, 17, 60, 1, m.metal[3]);
        r.rect(0, 16, 3, 8, m.metal[1]);
        r.rect(4, 5, 3, 4, 0xc02818);
        r.poly([[58, 7], [86, 9], [88, 29], [60, 27]], m.steel(0.6));
        r.rect(58, 7, 28, 2, m.metal[3]);
        r.disc(82, 24, 1.3, m.metal[4]);
      }) },
      {
        image: layerOf(W, H, r => {
          r.poly([[26, 23], [58, 23], [58, 30], [30, 30]], m.wood(0.7, 26));
          for (let x = 32; x < 56; x += 3) r.rect(x, 25, 1, 4, m.grip[1]);
        }),
        pose: p => ({ dx: slideShift(p) }),
      },
      {
        image: layerOf(W, H, r => {
          r.rect(62, 11, 20, 5, m.metal[3]);
          r.rect(62, 11, 20, 1, m.metal[4]);
          r.rect(66, 7, 5, 4, m.metal[1]);
        }),
        pose: p => ({ dx: slideShift(p) }),
      },
      {
        image: layerOf(W, H, r => {
          r.rect(70, 15, 13, 2, m.metal[2]);
          r.rect(70, 15, 13, 1, m.metal[4]);
        }),
        pose: p => ({ angle: -p.open * 0.9, px: 70, py: 16 }),
      },
    ],
  };
}

export function buildCrossbow(custom, m) {
  const W = 120, H = 60, accessory = custom.options.accessory;
  // Arco na vertical: os braços sobem e descem à frente e a corda vai até o gatilho.
  const limbs = level => layerOf(W, H, r => {
    const draw = level / 8, tipX = 5 + draw * 8, latchX = 9 + draw * 46;
    r.line(17, 26, tipX, 3, m.steel(0.62), 3);
    r.line(17, 32, tipX, 55, m.steel(0.62), 3);
    r.line(17, 26, tipX + 1, 3, m.metal[4]);
    r.line(17, 32, tipX + 1, 55, m.metal[1]);
    r.line(tipX, 3, latchX, 29, 0xd8d0b0);
    r.line(tipX, 55, latchX, 29, 0xd8d0b0);
    r.rect(Math.round(latchX) - 1, 27, 3, 5, m.metal[2]);
  });
  return {
    size: [W, H], pivot: [74, 30], muzzle: [8, 29], hand: [84, 43], load: [58, 26], eject: [60, 26],
    carry: 'bolt', casing: 'round', flashSize: 0, smoke: 0,
    reload: { x: 498, y: 200, angle: 0.2 },
    layers: [
      { image: layerOf(W, H, r => {
        r.poly([[14, 26], [88, 25], [114, 38], [109, 53], [90, 47], [62, 37], [14, 33]], m.wood(0.76, 14));
        r.rect(18, 28, 42, 2, 0x120a06);
        r.poly([[72, 33], [84, 31], [92, 53], [82, 57], [76, 45]], m.wood(0.7, 72));
        for (let i = 0; i < 3; i++) r.line(78 + i * 3, 36, 84 + i * 3, 50, m.grip[0]);
        r.ring(11, 30, 6, 4.6, m.metal[2]);
        r.ring(72, 40, 6, 4.6, m.metal[2]);
        r.line(73, 36, 71, 41, m.metal[1], 2);
        r.rect(54, 24, 12, 7, m.metal[2]);
        r.rect(54, 24, 12, 1, m.metal[4]);
        if (accessory === 'scope') {
          r.rect(28, 15, 28, 5, m.metal[0]);
          r.rect(28, 15, 28, 1, m.metal[3]);
          r.rect(32, 20, 3, 6, m.metal[1]);
          r.rect(48, 20, 3, 6, m.metal[1]);
          r.disc(28, 17.5, 2.4, 0x4a90c8);
        }
        if (accessory === 'quiver') {
          r.poly([[44, 34], [70, 38], [68, 44], [44, 40]], 0x2a1c12);
          for (let i = 0; i < 3; i++) { r.line(46 + i * 7, 36 + i, 64 + i * 7, 36 + i, 0x9a8a6a); r.rect(44 + i * 7, 34 + i, 3, 3, 0xc02818); }
        }
      }) },
      { variants: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`d${i}`, limbs(i)])),
        select: p => `d${Math.round(clamp01(p.draw) * 8)}` },
      {
        image: layerOf(W, H, r => {
          r.rect(14, 27, 42, 2, 0x9a8a6a);
          r.rect(14, 27, 42, 1, 0xc8b890);
          r.poly([[7, 25], [17, 25], [17, 31], [7, 31]], 0xc02818);
          r.rect(9, 25, 2, 6, 0xf0c040);
          r.poly([[3, 28], [7, 26], [7, 30]], 0xd8d8dc);
          r.poly([[50, 27], [57, 24], [57, 27]], 0xc84a30);
          r.poly([[50, 29], [57, 29], [57, 33]], 0xc84a30);
        }),
        pose: p => ({ hidden: p.ammo <= 0 }),
      },
    ],
  };
}

export function buildFlamethrower(custom, m) {
  const W = 116, H = 76, accessory = custom.options.accessory;
  const longTank = accessory === 'longTank', blue = accessory === 'pilot';
  const flame = (long, outer, inner) => layerOf(W, H, r => {
    r.poly([[11, 19], [12 - long, 22], [11, 25]], outer);
    r.poly([[11, 20.5], [12 - long * 0.55, 22], [11, 23.5]], inner);
  });
  const tankBottom = longTank ? 70 : 62;
  return {
    size: [W, H], pivot: [76, 34], muzzle: [10, 22], hand: [80, 46], load: [54, 58], eject: [56, 20],
    carry: 'canister', casing: 'round', flashSize: 1.3, smoke: 0.3, flashStyle: 'jet',
    reload: { x: 494, y: 196, angle: -0.3 },
    layers: [
      { image: layerOf(W, H, r => {
        r.poly([[66, 34], [78, 31], [88, 56], [76, 62], [70, 48]], (x, y) => dither(x, y, 0.7 - (x - 66) / 50 - (y - 31) / 90, m.grip, 0.9));
        for (let i = 0; i < 4; i++) r.line(71 + i * 2, 36 + i, 77 + i * 2, 54 + i, m.grip[0]);
      }) },
      { image: layerOf(W, H, r => {
        r.rect(12, 19, 46, 7, m.steel(0.7));
        r.rect(12, 19, 46, 1, m.metal[4]);
        for (let x = 18; x < 52; x += 8) r.rect(x, 18, 3, 9, m.metal[1]);
        r.poly([[8, 16], [16, 17], [16, 28], [8, 27]], m.steel(0.5));
        r.rect(12, 14, 32, 2, m.metal[3]);
        r.poly([[56, 14], [88, 16], [90, 36], [60, 36]], m.steel(0.6));
        r.rect(56, 14, 32, 2, m.metal[3]);
        r.disc(70, 25, 5.5, 0xd8d4c8);
        r.ring(70, 25, 5.8, 4.6, m.metal[1]);
        r.line(70, 25, 73, 22, 0xc02818);
        r.disc(81, 22, 3, m.metal[2]);
        r.line(79, 22, 83, 22, m.metal[4]);
        r.line(50, 26, 58, 34, 0x18181c, 2);
        r.ring(72, 40, 6, 4.6, m.metal[2]);
      }) },
      {
        image: layerOf(W, H, r => {
          r.rect(44, 36, 24, tankBottom - 36, (x, y) => dither(x, y, 0.72 - (x - 44) / 50, [0x3a1208, 0x7a2410, 0xb83c18, 0xe05828, 0xf08040], 0.8));
          r.rect(44, 44, 24, 3, 0x18181c);
          r.rect(44, tankBottom - 8, 24, 3, 0x18181c);
          r.rect(48, 32, 16, 4, m.metal[2]);
          r.rect(52, 30, 8, 2, m.metal[3]);
        }),
        pose: p => ({ dy: p.magDrop * 44, hidden: p.magDrop >= 1 }),
      },
      {
        image: layerOf(W, H, r => {
          r.line(70, 37, 69, 43, m.metal[1], 3);
        }),
        pose: p => ({ angle: p.valve * 0.5, px: 70, py: 36 }),
      },
      { variants: { pf0: flame(9, blue ? 0x3060ff : 0xff9a30, blue ? 0xa0d0ff : 0xffe080), pf1: flame(12, blue ? 0x4070ff : 0xff7a20, blue ? 0xc0e0ff : 0xfff0a0) },
        select: p => `pf${Math.floor(p.t * 14) % 2}` },
    ],
  };
}
