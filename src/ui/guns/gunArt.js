import { Raster } from '../../art/raster.js';
import { colorRamp, dither, hash, vnoise } from '../../art/shade.js';

// Armas desenhadas em partes móveis (mesmos ids de game/weaponTypes.js). Cada camada é uma imagem do
// tamanho da arma, e `pose(p)` diz como ela se move. Todos os pontos são pixels da imagem:
// pivot = eixo das animações, muzzle = saída do tiro, hand = onde a mão segura, load = onde a munição
// entra, eject = de onde saem as cápsulas.

const STEEL = [0x1e1e20, 0x38383c, 0x56585c, 0x7c7e82, 0xa8aaae];
const DARK_STEEL = [0x101012, 0x1e1e22, 0x2e2e34, 0x46464e, 0x62626c];
const WOOD = [0x1a0f0a, 0x2c1a12, 0x42281a, 0x5a3a26, 0x764e30];
const FLASH = [0xff9a30, 0xffd060, 0xfff2b0];

const PATTERN_TEST = {
  none: () => false,
  camo: (x, y) => vnoise(x / 9, y / 6) > 0.55,
  tiger: (x, y) => Math.sin((x + y * 0.6) / 3 + vnoise(x / 14, y / 9) * 4) > 0.55,
  engraved: (x, y) => (x * 3 + y * 5) % 7 === 0 && vnoise(x / 11, y / 7) > 0.4,
  worn: (x, y) => hash(x >> 1, y >> 1) > 0.86,
};
const PATTERN_DEFAULT = { none: 0x000000, camo: 0x4a5a30, tiger: 0xb08020, engraved: 0xd8b860, worn: 0xc0c0c0 };

function materials(base, custom) {
  const metal = custom.colors.metal === null ? base : colorRamp(custom.colors.metal);
  const grip = custom.colors.grip === null ? WOOD : colorRamp(custom.colors.grip);
  const patternRamp = colorRamp(custom.colors.pattern ?? PATTERN_DEFAULT[custom.options.pattern]);
  const isPattern = PATTERN_TEST[custom.options.pattern];
  return {
    metal, grip,
    steel: tone => (x, y) => dither(x, y, tone - (y % 16) / 60, isPattern(x, y) ? patternRamp : metal, 0.8),
    wood: (tone, x0) => (x, y) => dither(x, y, tone - (x - x0) / 120 + ((y >> 1) & 1) * 0.08, grip, 0.9),
    flash: custom.colors.flash === null ? FLASH : [custom.colors.flash, colorRamp(custom.colors.flash)[4], 0xffffff],
  };
}

const layerOf = (width, height, paint) => {
  const r = new Raster(width, height);
  paint(r);
  return r.commit();
};

function buildRevolver(custom, m) {
  const W = 62, H = 54, accessory = custom.options.accessory;
  const closedCylinder = phase => layerOf(W, H, r => {
    r.rect(28, 12, 17, 16, m.steel(0.8));
    for (const x of [31, 35, 39, 43]) r.rect(x - 2 + phase, 12, 1, 16, m.metal[0]);
    r.rect(28, 12, 17, 1, m.metal[4]);
    r.rect(28, 27, 17, 1, m.metal[0]);
  });
  const openCylinder = loaded => layerOf(W, H, r => {
    r.line(36, 18, 34, 26, m.metal[1], 3);
    r.disc(35, 24, 9, m.steel(0.8));
    r.ring(35, 24, 9.4, 8.4, m.metal[0]);
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 - Math.PI / 2, cx = 35 + Math.cos(a) * 5.4, cy = 24 + Math.sin(a) * 5.4;
      r.disc(cx, cy, 2, i < loaded ? 0xd0a040 : 0x08080a);
      if (i < loaded) r.put(cx, cy, 0x8a5a20);
    }
  });

  return {
    size: [W, H], pivot: [43, 32], muzzle: [0, 14], hand: [52, 39], load: [33, 28], eject: [40, 18],
    carry: 'round', casing: 'round', flashSize: 1, smoke: 1,
    reload: { x: 496, y: 204, angle: 0.8 },
    layers: [
      { image: layerOf(W, H, r => {
        r.poly([[41, 30], [52, 27], [61, 46], [50, 53], [45, 42]], (x, y) => dither(x, y, 0.65 - (x - 41) / 40 - (y - 27) / 90, m.grip, 0.9));
        for (let i = 0; i < 4; i++) r.line(47 + i * 2, 33 + i, 51 + i * 2, 46 + i, m.grip[0]);
        r.disc(51, 40, 1.4, m.metal[4]);
      }) },
      { image: layerOf(W, H, r => {
        r.ring(37, 33, 7, 5.6, m.metal[2]);
        r.line(38, 29, 36, 35, m.metal[1], 2);
        r.rect(0, 11, 30, 8, m.steel(0.72));
        r.rect(0, 11, 30, 2, m.metal[4]);
        for (let x = 5; x < 26; x += 5) r.rect(x, 12, 3, 1, m.metal[0]);
        r.rect(0, 10, 3, 10, m.metal[1]);
        r.rect(4, 7, 3, 4, 0xc02818);
        r.rect(6, 20, 21, 3, m.steel(0.5));
        r.rect(6, 20, 21, 1, m.metal[3]);
        r.poly([[26, 8], [50, 8], [52, 30], [42, 32], [28, 28]], m.steel(0.55));
        r.rect(26, 8, 24, 2, m.metal[3]);
        r.disc(47, 26, 1.2, m.metal[4]);
        if (accessory === 'compensator') {
          r.rect(0, 9, 11, 12, m.steel(0.45));
          for (const x of [2, 5, 8]) r.rect(x, 10, 1, 4, 0x000000);
        }
        if (accessory === 'laser') {
          r.rect(8, 23, 17, 5, 0x18181c);
          r.rect(8, 23, 17, 1, 0x4a4a52);
          r.rect(6, 24, 2, 3, 0xe02018);
        }
      }) },
      {
        variants: {
          ...Object.fromEntries([0, 1, 2, 3].map(p => [`closed${p}`, closedCylinder(p)])),
          ...Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(n => [`open${n}`, openCylinder(n)])),
        },
        pose: p => (p.open > 0.4 ? { variant: `open${p.ammo}`, dy: (p.open - 0.4) * 4 } : { variant: `closed${Math.floor(p.spin * 4) % 4}` }),
      },
      {
        image: layerOf(W, H, r => {
          r.poly([[47, 8], [50, 2], [55, 4], [52, 12]], m.metal[1]);
          r.rect(50, 3, 4, 1, m.metal[3]);
        }),
        pose: p => ({ angle: p.hammer * 0.5, px: 50, py: 11 }),
      },
    ],
  };
}

function buildShotgun(custom, m) {
  const W = 100, H = 46, accessory = custom.options.accessory;
  const barrelPose = p => ({ angle: -p.open * 0.5, px: 62, py: 24 });
  return {
    size: [W, H], pivot: [74, 26], muzzle: [0, 14], hand: [84, 33], load: [62, 16], eject: [64, 12],
    carry: 'shell', casing: 'shell', flashSize: 1.7, smoke: 1.8,
    reload: { x: 500, y: 204, angle: 0.25 },
    layers: [
      { image: layerOf(W, H, r => {
        r.poly([[72, 20], [86, 17], [99, 37], [88, 45], [78, 30]], m.wood(0.75, 72));
        for (let i = 0; i < 3; i++) r.line(82 + i * 3, 23 + i, 90 + i * 3, 38 + i, m.grip[0]);
        if (accessory === 'shells') {
          r.poly([[86, 22], [97, 34], [90, 40], [80, 28]], 0x2a1c12);
          for (let i = 0; i < 4; i++) { const x = 82 + i * 3, y = 24 + i * 3.4; r.rect(x, y, 4, 5, 0xa02418); r.rect(x, y + 4, 4, 2, 0xc09a4a); }
        }
        if (accessory === 'strap') for (let i = 0; i < 6; i++) r.line(76 + i * 3, 22 + i * 3, 86 + i * 3, 17 + i * 3, i % 2 ? 0x6a5a40 : 0x9a8a60, 2);
      }) },
      { image: layerOf(W, H, r => {
        r.ring(71, 28, 6, 4.6, m.metal[2]);
        r.line(72, 25, 70, 30, m.metal[1], 2);
        r.poly([[60, 5], [80, 7], [82, 24], [60, 24]], m.steel(0.55));
        r.rect(60, 5, 20, 2, m.metal[3]);
        r.disc(76, 20, 1.3, m.metal[4]);
      }) },
      { pose: barrelPose,
        variants: Object.fromEntries([0, 1, 2].map(n => [`b${n}`, layerOf(W, H, r => {
          r.rect(0, 7, 62, 7, m.steel(0.78));
          r.rect(0, 7, 62, 1, m.metal[4]);
          r.rect(0, 15, 62, 7, m.steel(0.62));
          r.rect(0, 14, 62, 1, m.metal[0]);
          r.rect(0, 6, 3, 17, m.metal[1]);
          r.rect(5, 5, 3, 2, 0xc02818);
          r.poly([[26, 22], [58, 22], [58, 29], [30, 29]], m.wood(0.7, 26));
          for (let x = 32; x < 56; x += 3) r.rect(x, 24, 1, 4, m.grip[1]);
          if (n > 0) r.rect(59, 7, 3, 7, 0xc09a4a);
          if (n > 1) r.rect(59, 15, 3, 7, 0xc09a4a);
        })])),
        select: p => `b${Math.min(2, p.ammo)}`,
      },
      {
        image: layerOf(W, H, r => r.poly([[76, 6], [80, 0], [84, 2], [80, 9]], m.metal[1])),
        pose: p => ({ angle: p.hammers[1] * 0.5, px: 78, py: 8 }),
      },
      {
        image: layerOf(W, H, r => r.poly([[70, 5], [73, 0], [77, 2], [74, 7]], m.metal[1])),
        pose: p => ({ angle: p.hammers[0] * 0.5, px: 72, py: 7 }),
      },
    ],
  };
}

function buildSmg(custom, m) {
  const W = 86, H = 64, accessory = custom.options.accessory;
  const longMag = accessory === 'longMag';
  return {
    size: [W, H], pivot: [56, 30], muzzle: [0, 16], hand: [64, 42], load: [42, 60], eject: [54, 14],
    carry: 'magazine', casing: 'round', flashSize: accessory === 'suppressor' ? 0.35 : 0.85, smoke: accessory === 'suppressor' ? 0.25 : 0.5,
    reload: { x: 494, y: 196, angle: -0.3 },
    layers: [
      { image: layerOf(W, H, r => {
        r.poly([[53, 26], [66, 25], [76, 50], [64, 55], [57, 38]], (x, y) => dither(x, y, 0.7 - (x - 53) / 50 - (y - 25) / 90, m.grip, 0.9));
        for (let i = 0; i < 3; i++) r.line(60 + i * 3, 30, 67 + i * 3, 50, m.grip[0]);
        r.ring(52, 33, 6, 4.6, m.metal[3]);
        r.line(53, 30, 51, 35, m.metal[2], 2);
        r.rect(8, 14, 16, 5, m.steel(0.6));
        r.rect(0, 12, 9, 9, m.steel(0.8));
        for (const x of [2, 5]) r.rect(x, 13, 1, 7, 0x000000);
        r.rect(14, 8, 3, 6, m.metal[2]);
        r.poly([[22, 9], [72, 9], [74, 26], [22, 27]], m.steel(0.75));
        r.rect(22, 9, 50, 2, m.metal[3]);
        r.rect(46, 14, 14, 4, 0x08080a);
        for (let x = 26; x < 44; x += 4) r.rect(x, 13, 2, 8, m.metal[0]);
        r.poly([[22, 22], [36, 22], [36, 30], [24, 30]], m.wood(0.7, 22));
        if (accessory === 'suppressor') {
          r.rect(0, 11, 24, 11, m.steel(0.4));
          r.rect(0, 11, 24, 1, m.metal[3]);
          for (let x = 3; x < 22; x += 4) r.rect(x, 12, 1, 9, m.metal[0]);
        }
      }) },
      {
        image: layerOf(W, H, r => {
          r.rect(58, 11, 8, 8, m.metal[3]);
          r.rect(60, 13, 4, 4, m.metal[1]);
          r.rect(62, 7, 3, 5, m.metal[4]);
        }),
        pose: p => ({ dx: p.bolt * 8 }),
      },
      {
        image: layerOf(W, H, r => {
          const end = longMag ? 63 : 56;
          r.poly([[37, 26], [50, 26], [47, end], [36, end]], m.steel(0.6));
          r.rect(37, 28, 2, end - 30, m.metal[3]);
          for (let y = 32; y < end - 3; y += 6) r.rect(40, y, 7, 2, m.metal[0]);
        }),
        pose: p => ({ dy: p.magDrop * 34, hidden: p.magDrop >= 1 }),
      },
    ],
  };
}

function buildRifle(custom, m) {
  const W = 138, H = 40, accessory = custom.options.accessory;
  return {
    size: [W, H], pivot: [88, 18], muzzle: [0, 11], hand: [96, 26], load: [82, 13], eject: [84, 10],
    carry: 'round', casing: 'long', flashSize: 1.4, smoke: 1.2,
    handFollowsLever: 6,
    reload: { x: 500, y: 200, angle: 0.35 },
    layers: [
      { image: layerOf(W, H, r => {
        r.poly([[92, 11], [136, 14], [137, 33], [124, 36], [96, 24]], m.wood(0.8, 92));
        r.rect(134, 14, 3, 20, m.grip[0]);
        for (let i = 0; i < 4; i++) r.line(100 + i * 6, 13, 106 + i * 6, 28, m.grip[1]);
        if (accessory === 'sling') {
          r.rect(126, 18, 6, 2, 0x6a4a2a);
          r.line(128, 20, 112, 38, 0x4a3218, 2);
          r.line(112, 38, 60, 30, 0x4a3218, 2);
        }
      }) },
      { image: layerOf(W, H, r => {
        r.rect(0, 9, 74, 5, m.steel(0.72));
        r.rect(0, 9, 74, 1, m.metal[4]);
        r.rect(4, 15, 62, 3, m.steel(0.55));
        r.rect(0, 8, 2, 7, m.metal[1]);
        r.rect(12, 5, 3, 4, 0xc02818);
        r.rect(58, 5, 5, 4, m.metal[1]);
        r.poly([[40, 15], [70, 15], [70, 23], [44, 23]], m.wood(0.65, 40));
        for (let x = 46; x < 68; x += 4) r.rect(x, 17, 2, 4, m.grip[1]);
        r.poly([[70, 7], [94, 8], [96, 23], [70, 23]], m.steel(0.65));
        r.rect(70, 7, 24, 2, m.metal[4]);
        r.rect(76, 11, 12, 5, m.metal[0]);
        r.disc(90, 19, 1.2, m.metal[4]);
        if (accessory === 'scope') {
          r.rect(70, 0, 28, 5, m.metal[0]);
          r.rect(70, 0, 28, 1, m.metal[3]);
          r.rect(66, 0, 4, 6, m.metal[1]);
          r.rect(98, 0, 4, 6, m.metal[1]);
          r.rect(76, 5, 3, 3, m.metal[1]);
          r.rect(90, 5, 3, 3, m.metal[1]);
        }
      }) },
      {
        image: layerOf(W, H, r => {
          r.rect(78, 11, 10, 4, m.metal[3]);
          r.rect(78, 11, 10, 1, m.metal[4]);
        }),
        pose: p => ({ dx: p.lever * 9 }),
      },
      {
        image: layerOf(W, H, r => {
          r.ring(86, 28, 7, 5.4, m.metal[2]);
          r.rect(78, 21, 16, 2, m.metal[2]);
          r.line(87, 23, 85, 28, m.metal[1], 2);
        }),
        pose: p => ({ angle: p.lever * 0.75, px: 78, py: 22 }),
      },
      {
        image: layerOf(W, H, r => r.poly([[92, 7], [96, 1], [100, 3], [96, 10]], m.metal[1])),
        pose: p => ({ angle: p.hammer * 0.5, px: 94, py: 9 }),
      },
    ],
  };
}

const BUILDERS = { revolver: buildRevolver, shotgun: buildShotgun, smg: buildSmg, rifle: buildRifle };
const BASE_METAL = { revolver: STEEL, shotgun: STEEL, smg: DARK_STEEL, rifle: STEEL };

export function buildGunArt(id, custom) {
  const m = materials(BASE_METAL[id], custom);
  return { ...BUILDERS[id](custom, m), flash: m.flash };
}
