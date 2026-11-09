import { CLEAR, Raster } from '../../art/raster.js';
import { clamp, dither, hash, vnoise } from '../../art/shade.js';

// Volantes. `image` devolve um canvas ou o caminho de um PNG; o centro da imagem é o eixo de giro.
// `gripRadius` é a distância do centro até onde as mãos seguram o aro.

const RIM = [0x0f0806, 0x221612, 0x3b2c26, 0x5a483e, 0x87706a];
const BONE = [0x2a1a14, 0x46302a, 0x63493f, 0x7a5e52, 0x977a6c];
const BLOOD = [0x4a1209, 0x6e1d10, 0x8a2a18];
const WOOD = [0x2c1a10, 0x4a2e1c, 0x6b4729, 0x8a6238, 0xa98050];

function paintBoneWheel() {
  const size = 144, c = size / 2;
  const r = new Raster(size, size);
  const mirror = pts => pts.map(([x, y]) => [size - x, y]);

  // aro trançado
  r.ring(c, c, 68, 55, (x, y) => {
    const dx = x + 0.5 - c, dy = y + 0.5 - c, radius = Math.hypot(dx, dy), angle = Math.atan2(dy, dx);
    const across = (radius - 55) / 13;
    const crown = 1 - Math.abs(across - 0.55) * 2;
    const braid = ((Math.floor((angle + Math.PI) * 62 / Math.PI) + Math.floor(radius / 2)) & 1) ? 0.5 + hash(x, y) * 0.2 : -0.1;
    const top = 0.12 * (-dy / 68);
    if (angle > 1.9 && angle < 2.5 && hash(x, y) > 0.45 && across > 0.15) return BLOOD[Math.floor(hash(y, x) * 3)];
    return dither(x, y, 0.08 + crown * (0.3 + braid) + top + (hash(x, y) - 0.5) * 0.14, RIM, 0.5);
  });

  const boneShade = (x, y) => dither(x, y, 0.72 - (y - 52) / 90 + (vnoise(x / 6, y / 6) - 0.5) * 0.3, BONE, 0.7);

  // asas laterais com furos
  const wing = [[21, 56], [26, 51], [34, 55], [56, 58], [52, 78], [41, 72], [26, 64]];
  r.poly(wing, boneShade);
  r.poly(mirror(wing), boneShade);
  for (const [hx, hy, hr] of [[28, 57, 2.4], [35.5, 61, 2.8], [44, 64, 2.8]]) {
    r.disc(hx, hy, hr, 0x050302);
    r.disc(size - hx, hy, hr, 0x050302);
  }

  // haste inferior
  const neck = [[52, 84], [52, 92], [58, 95], [62, 108], [63, 124], [81, 124], [82, 108], [86, 95], [92, 92], [92, 84]];
  r.poly(neck, boneShade);
  r.poly([[66, 100], [70, 100], [70, 124], [66, 124]], 0x0c0504);
  r.poly([[74, 100], [78, 100], [78, 124], [74, 124]], 0x0c0504);
  r.poly([[53, 87], [59, 85], [60, 92], [55, 95]], 0x0a0504);
  r.poly(mirror([[53, 87], [59, 85], [60, 92], [55, 95]]), 0x0a0504);

  // cubo central
  r.disc(c, 73, 22, (x, y) => dither(x, y, 0.8 - (y - 52) / 70, BONE, 0.6));
  r.ring(c, 73, 16, 9, (x, y) => dither(x, y, 0.3, BONE, 0.7));
  r.disc(c, 73, 8.5, BONE[2]);
  r.ring(c, 73, 9.4, 8.2, BONE[1]);
  r.line(c - 15, 73, c - 9, 73, BONE[1]); r.line(c + 9, 73, c + 15, 73, BONE[1]);
  r.line(c, 58, c, 62, BLOOD[0]);

  // veias vermelhas
  const vein = BLOOD[1];
  r.line(56, 59, 50, 72, vein, 2); r.line(50, 72, 54, 78, BLOOD[0], 1);
  r.line(87, 59, 96, 67, vein, 2); r.line(96, 67, 92, 79, BLOOD[0], 2);
  r.line(54, 86, 62, 94, BLOOD[0], 2); r.line(62, 94, 70, 99, vein, 2); r.line(70, 99, 70, 118, BLOOD[0], 2);
  r.line(82, 93, 88, 89, BLOOD[0]);
  return r.commit();
}

function paintShipWheel() {
  const size = 176, c = size / 2;
  const r = new Raster(size, size);
  const shade = (x, y) => dither(x, y, 0.55 - (y - c) / 180 + (vnoise(x / 5, y / 5) - 0.5) * 0.35, WOOD, 0.8);

  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, ca = Math.cos(a), sa = Math.sin(a);
    r.line(c + ca * 18, c + sa * 18, c + ca * 70, c + sa * 70, shade, 5);
    r.disc(c + ca * 73, c + sa * 73, 6, shade);
    r.disc(c + ca * 82, c + sa * 82, 5, shade);
    r.disc(c + ca * 73 - 1, c + sa * 73 - 1, 2, WOOD[4]);
  }
  r.ring(c, c, 60, 47, (x, y) => {
    const angle = Math.atan2(y + 0.5 - c, x + 0.5 - c), rope = (Math.floor((angle + Math.PI) * 56 / Math.PI) & 1) ? 0.14 : -0.14;
    return dither(x, y, clamp(0.5 - (y - c) / 180 + rope), WOOD, 0.6);
  });
  r.ring(c, c, 61, 60, WOOD[0]);
  r.ring(c, c, 47, 46, WOOD[0]);
  r.ring(c, c, 22, 17, WOOD[3]);
  r.disc(c, c, 17, shade);
  r.disc(c, c, 9, WOOD[3]);
  r.disc(c, c, 3, WOOD[0]);
  return r.commit();
}

const LEATHER = [0x0a0a0c, 0x18181c, 0x2a2a30, 0x3e3e46, 0x5a5a64];
const CHROME = [0x3a3c42, 0x62666e, 0x8e949c, 0xb8bec6, 0xe4e8ee];

const shadeWith = (palette, c) => (x, y) => dither(x, y, 0.6 - (y - c) / 150, palette, 0.6);

function paintSportWheel() {
  const size = 144, c = size / 2;
  const r = new Raster(size, size);
  r.ring(c, c, 67, 55, (x, y) => dither(x, y, 0.55 - (y - c) / 180, LEATHER, 0.7));
  for (let i = 0; i < 40; i++) {
    const a = i * Math.PI / 20;
    r.put(c + Math.cos(a) * 61, c + Math.sin(a) * 61, 0xc02818);
  }
  for (const a of [Math.PI, 0, Math.PI / 2]) {
    r.line(c + Math.cos(a) * 14, c + Math.sin(a) * 14, c + Math.cos(a) * 56, c + Math.sin(a) * 56, shadeWith(CHROME, c), 11);
    r.line(c + Math.cos(a) * 18, c + Math.sin(a) * 18, c + Math.cos(a) * 52, c + Math.sin(a) * 52, shadeWith(LEATHER, c), 5);
  }
  r.disc(c, c, 21, shadeWith(LEATHER, c));
  r.ring(c, c, 21, 18, CHROME[2]);
  r.disc(c, c, 6, 0xc02818);
  return r.commit();
}

function paintWoodClassicWheel() {
  const size = 144, c = size / 2;
  const r = new Raster(size, size);
  r.ring(c, c, 67, 57, (x, y) => dither(x, y, 0.55 - (y - c) / 180 + (vnoise(x / 3, y / 9) - 0.5) * 0.4, WOOD, 0.7));
  r.ring(c, c, 57.5, 56, WOOD[0]);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    r.line(c + Math.cos(a) * 12, c + Math.sin(a) * 12, c + Math.cos(a) * 58, c + Math.sin(a) * 58, shadeWith(CHROME, c), 7);
    for (const d of [26, 36, 46]) r.disc(c + Math.cos(a) * d, c + Math.sin(a) * d, 1.8, 0x08080a);
  }
  r.disc(c, c, 17, shadeWith(CHROME, c));
  r.disc(c, c, 10, WOOD[2]);
  return r.commit();
}

function paintRacingWheel() {
  const size = 144, c = size / 2, flat = c + 50;
  const r = new Raster(size, size);
  r.ring(c, c, 66, 54, (x, y) => (y > flat ? CLEAR : dither(x, y, 0.5 - (y - c) / 180, LEATHER, 0.7)));
  r.rect(c - 42, flat - 5, 84, 12, shadeWith(LEATHER, c));
  r.rect(c - 5, c - 66, 10, 12, 0xe8c020);                 // marca do centro
  r.poly([[c - 54, c - 12], [c + 54, c - 12], [c + 40, c + 22], [c + 16, flat - 4], [c - 16, flat - 4], [c - 40, c + 22]], shadeWith(LEATHER, c));
  for (const x of [-34, 34]) r.disc(c + x, c + 2, 6, 0xc02818);
  r.disc(c, c + 2, 16, shadeWith(CHROME, c));
  r.disc(c, c + 2, 8, LEATHER[1]);
  return r.commit();
}

export const WHEELS = {
  bone: { name: 'Osso', image: paintBoneWheel, gripRadius: 62 },
  ship: { name: 'Leme de navio', image: paintShipWheel, gripRadius: 54 },
  sport: { name: 'Esportivo', image: paintSportWheel, gripRadius: 61 },
  wood: { name: 'Madeira classica', image: paintWoodClassicWheel, gripRadius: 62 },
  racing: { name: 'Corrida', image: paintRacingWheel, gripRadius: 60 },
};

