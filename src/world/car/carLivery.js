import { Raster } from '../../art/raster.js';
import { colorRamp, dither, hash, mix, vnoise } from '../../art/shade.js';
import { rasterText, textWidth } from '../../art/font.js';
import { ATLAS, frontPixel, REGION, rearPixel, sidePixel, topPixel } from './carAtlas.js';
import { CAR_SHAPES } from './carShapes.js';

// Pintura dos carros em pixel art: padrão em blocos, vidros, caixas de roda, luzes e grafismos.

export const WHEEL_POSITIONS_Z = [-1.3, 1.35];
const WHEEL_ARCH_RADIUS = 0.45, WHEEL_ARCH_Y = 0.34;

function glassPalette({ color, level }) {
  const base = mix(color, 0, level);
  return [mix(base, 0, 0.62), mix(base, 0, 0.36), base, mix(base, 0xffffff, 0.12)];
}

// Pinturas dos adversários.
export const LIVERIES = [
  { primary: 0xc4c0b8, secondary: 0x98161e, rimColor: 0xb01820, pattern: 'digital', glyph: 0xe8e4dc },
  { model: 'muscle', primary: 0x1c1f24, secondary: 0x2e8a2a, rimColor: 0x38a030, pattern: 'bands', glyph: 0xb8e040 },
  { model: 'wedge', primary: 0x24487e, secondary: 0xd0d4dc, rimColor: 0xd8d8e0, pattern: 'split', glyph: 0xe8c040 },
  { model: 'hatch', primary: 0xc89a20, secondary: 0x18181c, rimColor: 0xd0a020, pattern: 'bands', glyph: 0x18181c },
  { model: 'wagon', primary: 0x5e2472, secondary: 0xb0b0b8, rimColor: 0xc040d0, pattern: 'digital', glyph: 0xf0e0f8 },
  { model: 'muscle', primary: 0x8a8880, secondary: 0x6a3418, rimColor: 0xa05020, pattern: 'rust', glyph: 0xd8d0c0 },
  { model: 'wedge', primary: 0xd06420, secondary: 0x20140e, rimColor: 0xe07820, pattern: 'flames', glyph: 0xf8e0a0 },
];

const shades = colorRamp;

// Cada padrão diz se o pixel (x, y) da região usa a cor secundária. `region` é 'side' ou 'top'.
export const PATTERNS = {
  plain: () => false,
  digital: (x, y, seed) => vnoise((((x >> 2) << 2) + seed) / 18, ((y >> 1) << 1) / 9) > 0.54,
  bands: (x, y, seed) => Math.sin(((x >> 1) + (y >> 1) * 1.6 + seed) / 7) > 0.45,
  split: (x, y, seed) => (y >> 1) * 2 > 36 + Math.sin((x + seed) / 18) * 4,
  stripe: (x, y, seed, region) => (region === 'top' ? Math.abs(y - 24) < 8 : y > 46 && y < 52),
  checker: (x, y) => (((x >> 3) + (y >> 3)) & 1) === 1,
  rust: (x, y, seed) => vnoise((x + seed) / 7, y / 5) * 0.6 + vnoise((x + seed) / 26, y / 16) * 0.4 > 0.56,
  flames: (x, y, seed) => {
    const lick = Math.sin(x / 6 + seed) * 6 + Math.sin(x / 17) * 7;
    return y > 66 - (x / 256) * 44 + lick;
  },
};

function paintedShade(spec, seed, brightness, region, regionY = 0) {
  const primary = shades(spec.primary), secondary = shades(spec.secondary);
  const isSecondary = PATTERNS[spec.pattern];
  return (x, y) => {
    const palette = isSecondary(x, y - regionY, seed, region) ? secondary : primary;
    const grain = (hash(x >> 1, y >> 1) - 0.5) * 0.3;
    return dither(x, y, brightness(x, y) + grain, palette, 0.6);
  };
}

function polygonFromSide(points) {
  return points.map(([z, y]) => sidePixel(z, y));
}

// Cada adesivo é desenhado em coordenadas locais, centrado em (0, 0), na escala `k` (1 = tamanho normal).
const DECALS = {
  crosses({ rect, k }) {
    for (const i of [-1, 0, 1]) { rect(i * 11 - 1, -5, 3, 11); rect(i * 11 - 4, -1, 9, 3); }
  },
  number({ text }) { text(); },
  bolt({ poly }) { poly([[2, -10], [-7, 1], [-1, 0], [-6, 11], [7, -2], [1, -1], [7, -10]]); },
  stars({ rect }) {
    for (const i of [-1, 0, 1]) { rect(i * 13 - 1, -5, 3, 11); rect(i * 13 - 5, -1, 11, 3); rect(i * 13 - 3, -3, 7, 7); }
  },
  bars({ poly }) {
    for (let i = 0; i < 4; i++) { const x = (i - 1.5) * 7 - 5.5; poly([[x, 7.5], [x + 8, -7.5], [x + 11, -7.5], [x + 3, 7.5]]); }
  },
  skull({ rect, poly, dark }) {
    poly([[-7, -3], [-5, -8], [5, -8], [7, -3], [7, 2], [4, 2], [4, 7], [-4, 7], [-4, 2], [-7, 2]]);
    dark(-5, -4, 4, 4); dark(1, -4, 4, 4); dark(-1, 1, 2, 2); dark(-2, 4, 1, 3); dark(1, 4, 1, 3);
  },
  flag({ rect, dark }) {
    rect(-10, -9, 2, 19);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) ((i + j) & 1 ? dark : rect)(-7 + i * 5, -9 + j * 5, 5, 5);
  },
  flame({ poly, light }) {
    poly([[0, -11], [5, -4], [7, 3], [0, 10], [-7, 3], [-5, -4], [-1, -5]]);
    light([[0, -2], [3, 3], [0, 8], [-3, 3]]);
  },
  chevrons({ poly }) {
    for (const i of [-1, 0, 1]) poly([[i * 9 - 6, -8], [i * 9, -8], [i * 9 + 6, 0], [i * 9, 8], [i * 9 - 6, 8], [i * 9, 0]]);
  },
};

// Onde cada adesivo ficava antes da escolha de posição (modo "Padrão"): metros na lateral.
const AUTO_SPOT = {
  crosses: { z: 1.5, y: 0.74 }, number: { z: -0.2, y: 0.67 }, bolt: { z: 0.16, y: 0.65 }, stars: { z: 0.5, y: 0.69 }, bars: { z: 1.41, y: 0.7 },
  skull: { z: 0.2, y: 0.68 }, flag: { z: 0.2, y: 0.68 }, flame: { z: 0.2, y: 0.68 }, chevrons: { z: 1.4, y: 0.7 },
};
const SIDE_SPOTS = { door: { z: 0.1, y: 0.68 }, fender: { z: 1.5, y: 0.9 }, nose: { z: -1.5, y: 0.9 } };

function decalSpot(spec) {
  const shape = CAR_SHAPES[spec.model].greenhouse, spot = spec.decalSpot ?? 'auto';
  if (spot === 'roof') return { region: 'top', z: (shape.roofFront.z + shape.roofRear.z) / 2 };
  if (spot === 'hood') return { region: 'top', z: (-2.1 + shape.front.z) / 2 };
  if (spot === 'trunk') return { region: 'top', z: (shape.rear.z + 2.2) / 2 };
  return { region: 'side', ...(SIDE_SPOTS[spot] ?? AUTO_SPOT[spec.decal]) };
}

function plotDecal(r, spec) {
  const draw = DECALS[spec.decal];
  if (!draw) return;
  const color = spec.glyph ?? mix(spec.secondary, 0xffffff, 0.75), k = spec.decalScale ?? 1;
  const spot = decalSpot(spec);
  const [ox, oy] = spot.region === 'top' ? topPixel(spot.z, 0) : sidePixel(spot.z, spot.y);
  const px = v => Math.round(v * k);
  const tools = {
    k,
    rect: (x, y, w, h) => r.rect(Math.round(ox + x * k), Math.round(oy + y * k), Math.max(1, px(w)), Math.max(1, px(h)), color),
    dark: (x, y, w, h) => r.rect(Math.round(ox + x * k), Math.round(oy + y * k), Math.max(1, px(w)), Math.max(1, px(h)), 0x101012),
    poly: points => r.poly(points.map(([x, y]) => [ox + x * k, oy + y * k]), color),
    light: points => r.poly(points.map(([x, y]) => [ox + x * k, oy + y * k]), mix(color, 0xffffff, 0.55)),
    text() {
      const scale = Math.max(1, Math.round(2 * k)), label = spec.decalNumber ?? '27';
      rasterText(r, label, Math.round(ox - textWidth(label, scale) / 2), Math.round(oy - 3.5 * scale), color, scale, scale);
    },
  };
  draw(tools);
}

// Posições das janelas e colunas, derivadas da cabine de cada modelo.
function cabinLines({ front, roofFront, roofRear, rear }) {
  const pillar = (roofFront.z + roofRear.z) / 2 - 0.1;
  return { pillar, backOfFront: pillar + 0.12, roofY: roofFront.y - 0.05 };
}

// Friso na lateral, logo abaixo da linha de cintura.
function plotTrim(r, spec) {
  if (!spec.trim || spec.trim === 'none') return;
  const color = spec.trimColor ?? 0xe8e4dc;
  const [ax, ay] = sidePixel(-2.1, 0.5), [bx] = sidePixel(2.1, 0.5);
  if (spec.trim === 'line') r.line(ax, ay, bx, ay, color);
  else if (spec.trim === 'thick') r.line(ax, ay, bx, ay, color, 4);
  else if (spec.trim === 'double') { r.line(ax, ay - 3, bx, ay - 3, color); r.line(ax, ay + 2, bx, ay + 2, color); }
}

function paintSide(r, spec, seed) {
  const { x, y, width, height } = REGION.side;
  const shape = CAR_SHAPES[spec.model], { front, roofFront, roofRear, rear } = shape.greenhouse;
  const { pillar, backOfFront, roofY } = cabinLines(shape.greenhouse);
  const beltPixel = sidePixel(0, shape.beltAt(0))[1];
  r.rect(x, y, width, height, paintedShade(spec, seed, (_, py) => {
    const fromBelt = py - beltPixel;
    if (fromBelt < 0) return 0.82;                     // colunas e teto, mais iluminados
    return 0.74 - fromBelt / 58;
  }, 'side'));

  // vincos da carroceria
  const line = (z0, y0, z1, y1, color) => {
    const [ax, ay] = sidePixel(z0, y0), [bx, by] = sidePixel(z1, y1);
    r.line(ax, ay, bx, by, color);
  };
  const dark = mix(spec.primary, 0, 0.7);
  line(-2.1, 0.72, 2.1, 0.74, mix(spec.primary, 0xffffff, 0.3));
  line(front.z + 0.03, 0.28, front.z + 0.03, front.y, dark);
  line(pillar + 0.06, 0.28, pillar + 0.06, shape.beltAt(pillar), dark);
  line(-2.2, 0.31, 2.2, 0.33, dark);
  line(0.05, 0.84, 0.25, 0.84, 0xa8a8a8);

  // vidros laterais
  const palette = glassPalette(spec.glass);
  const glass = (px, py) => dither(px, py, 0.72 - (py - 8) / 34, palette, 0.15);
  r.poly(polygonFromSide([[front.z + 0.17, front.y + 0.04], [roofFront.z + 0.01, roofY], [pillar, roofY], [pillar, front.y + 0.04]]), glass);
  r.poly(polygonFromSide([[backOfFront, rear.y + 0.03], [backOfFront, roofY], [roofRear.z - 0.03, roofY], [rear.z - 0.23, rear.y + 0.03]]), glass);

  plotTrim(r, spec);
  const decalAtSide = decalSpot(spec).region === 'side';
  if (decalAtSide) plotDecal(r, spec);

  // caixas de roda
  for (const z of WHEEL_POSITIONS_Z) {
    const [cx, cy] = sidePixel(z, WHEEL_ARCH_Y);
    const rx = WHEEL_ARCH_RADIUS / 4.7 * width, ry = WHEEL_ARCH_RADIUS / 1.35 * height;
    r.ellipse(cx, cy, rx, ry, 0x07070a);
  }

  // luzes laterais
  r.poly(polygonFromSide([[2.2, 0.72], [2.2, 0.9], [2.0, 0.92], [2.0, 0.74]]), 0xd81818);
  r.poly(polygonFromSide([[-2.18, 0.64], [-2.18, 0.72], [-1.98, 0.78], [-1.98, 0.7]]), spec.headlight);
}

function paintTop(r, spec, seed) {
  const { x, y, width, height } = REGION.top;
  r.rect(x, y, width, height, paintedShade(spec, seed, () => 0.86, 'top', y));

  const rect = (z0, z1, x0, x1, color) => {
    r.poly([topPixel(z0, x0), topPixel(z1, x0), topPixel(z1, x1), topPixel(z0, x1)], color);
  };
  const palette = glassPalette(spec.glass);
  const glass = (px, py) => dither(px, py, 0.5 + (px % 256) / 900, palette, 0.1);
  const { front, roofFront, roofRear, rear } = CAR_SHAPES[spec.model].greenhouse;
  rect(front.z + 0.03, roofFront.z - 0.03, -0.84, 0.84, glass);
  rect(roofRear.z + 0.03, rear.z - 0.03, -0.8, 0.8, glass);

  if (decalSpot(spec).region === 'top') plotDecal(r, spec);

  // capô e porta-malas
  const seam = mix(spec.primary, 0, 0.65);
  for (const side of [-0.72, 0.72]) {
    const [ax, ay] = topPixel(-2.1, side), [bx, by] = topPixel(front.z - 0.05, side);
    r.line(ax, ay, bx, by, seam);
  }
}

const HEADLIGHTS = {
  rect(r, pixel, rect, side, color) {
    rect(side * 0.42, 0.64, side * 0.72, 0.5, color);
    rect(side * 0.5, 0.6, side * 0.62, 0.54, mix(color, 0xffffff, 0.7));
  },
  round(r, pixel, rect, side, color) {
    const [cx, cy] = pixel(side * 0.57, 0.58);
    r.disc(cx, cy, 6, 0x101012);
    r.disc(cx, cy, 5, color);
    r.disc(cx, cy, 2, mix(color, 0xffffff, 0.7));
  },
  twin(r, pixel, rect, side, color) {
    for (const x of [0.46, 0.68]) {
      const [cx, cy] = pixel(side * x, 0.58);
      r.disc(cx, cy, 4, 0x101012);
      r.disc(cx, cy, 3, color);
      r.put(cx, cy, mix(color, 0xffffff, 0.8));
    }
  },
  slim(r, pixel, rect, side, color) {
    rect(side * 0.34, 0.63, side * 0.76, 0.57, color);
    rect(side * 0.5, 0.61, side * 0.68, 0.59, mix(color, 0xffffff, 0.7));
  },
  covered(r, pixel, rect, side, color) {
    rect(side * 0.42, 0.66, side * 0.74, 0.5, 0x0c0c10);
    rect(side * 0.46, 0.62, side * 0.7, 0.57, color);
    for (const x of [0.5, 0.58, 0.66]) rect(side * x, 0.65, side * (x + 0.015), 0.52, 0x0c0c10);
  },
};

function paintCaps(r, spec) {
  const shade = shades(spec.primary);

  // traseira
  const rearRect = (x0, y0, x1, y1, color) => {
    r.poly([rearPixel(x0, y0), rearPixel(x1, y0), rearPixel(x1, y1), rearPixel(x0, y1)], color);
  };
  rearRect(-1, 1.5, 1, 0.15, (x, y) => dither(x, y, 0.42, shade, 0.7));
  rearRect(-0.84, 0.92, 0.84, 0.68, 0x0c0c10);
  for (const side of [-1, 1]) {
    const inner = side * 0.34, outer = side * 0.8;
    rearRect(inner, 0.9, outer, 0.7, 0xc01414);
    rearRect(side * 0.48, 0.86, side * 0.7, 0.75, 0xff4030);
  }
  rearRect(-0.26, 0.58, 0.26, 0.45, 0xb8b4a8);
  rearRect(-0.9, 0.42, 0.9, 0.34, 0x101012);

  // frente
  const frontRect = (x0, y0, x1, y1, color) => {
    r.poly([frontPixel(x0, y0), frontPixel(x1, y0), frontPixel(x1, y1), frontPixel(x0, y1)], color);
  };
  frontRect(-1, 1.5, 1, 0.15, (x, y) => dither(x, y, 0.5, shade, 0.7));
  frontRect(-0.5, 0.56, 0.5, 0.42, 0x08080a);
  for (const side of [-1, 1]) HEADLIGHTS[spec.headlightShape](r, frontPixel, frontRect, side, spec.headlight);
}

export function paintLivery(spec, seed) {
  const r = new Raster(ATLAS.width, ATLAS.height);
  paintSide(r, spec, seed);
  paintTop(r, spec, seed);
  paintCaps(r, spec);
  r.rect(REGION.solid.x, REGION.solid.y, REGION.solid.width, REGION.solid.height, spec.spoilerColor ?? mix(spec.secondary, 0, 0.2));
  return r.commit();
}

// Aros: friso na cor escolhida e miolo conforme o estilo.
export function paintRim(style, color) {
  const size = 32, c = size / 2;
  const r = new Raster(size, size);
  r.disc(c, c, c, 0x0a0a0c);
  r.ring(c, c, 15, 13.6, color);
  r.disc(c, c, 13, style === 'disc' || style === 'deep' ? mix(color, 0, 0.45) : 0x16181a);

  if (style === 'spokes') {
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      r.line(c + Math.cos(a) * 5, c + Math.sin(a) * 5, c + Math.cos(a) * 12, c + Math.sin(a) * 12, i % 2 ? 0x5a605c : 0x868c86);
    }
  } else if (style === 'star') {
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5 - Math.PI / 2;
      r.line(c + Math.cos(a) * 4, c + Math.sin(a) * 4, c + Math.cos(a) * 13, c + Math.sin(a) * 13, 0x9aa49c, 3);
    }
  } else if (style === 'mesh') {
    for (let i = -12; i <= 12; i += 4) {
      r.line(c + i - 12, c - 12, c + i + 12, c + 12, 0x6a706c);
      r.line(c + i + 12, c - 12, c + i - 12, c + 12, 0x6a706c);
    }
    r.ring(c, c, 18, 13, 0x0a0a0c);
    r.ring(c, c, 15, 13.6, color);
  } else if (style === 'turbine') {
    for (let i = 0; i < 9; i++) {
      const a = i * Math.PI * 2 / 9;
      r.line(c + Math.cos(a) * 4, c + Math.sin(a) * 4, c + Math.cos(a + 0.7) * 13, c + Math.sin(a + 0.7) * 13, 0x9aa49c, 2);
    }
  } else if (style === 'deep') {
    r.ring(c, c, 12, 9.5, 0x9aa49c);
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5;
      r.disc(c + Math.cos(a) * 7, c + Math.sin(a) * 7, 1.4, 0x08080a);
    }
  } else {
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      r.disc(c + Math.cos(a) * 9, c + Math.sin(a) * 9, 1.6, 0x08080a);
    }
  }
  r.disc(c, c, 5.5, 0x9aa49c);
  r.disc(c, c, 2, 0x5a605c);
  return r.commit();
}
