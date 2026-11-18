import { Raster } from '../../art/raster.js';
import { mix } from '../../art/shade.js';
import { rasterText, textWidth } from '../../art/font.js';
import { PATTERNS, paintRim } from '../../world/car/carLivery.js';
import { paintTrapIcon } from '../../art/trapIcons.js';
import { createGunRig } from '../guns/gunRig.js';
import { paintNitroBottle, NITRO_SIZE } from '../../cabin/dashboard.js';
import { CAR_SHAPES } from '../../world/car/carShapes.js';

// Miniaturas das opções da garagem.

const W = 40, H = 28;
const CAR_SIDE = [[2, 21], [2, 16], [10, 14], [15, 8], [27, 8], [33, 14], [38, 15], [38, 21]];

function swatch(color) {
  const r = new Raster(W, H);
  r.rect(0, 0, W, H, 0x000000);
  r.rect(1, 1, W - 2, H - 2, color);
  return r.commit();
}

function carSide(r, yOffset = 0, color = 0x9a9aa0) {
  r.poly(CAR_SIDE.map(([x, y]) => [x, y + yOffset]), color);
}

function wheels(r, radius = 4, color = 0x18181c) {
  for (const x of [10, 30]) {
    r.disc(x, 27 - radius, radius, color);
    r.disc(x, 27 - radius, radius - 2, 0x8a8a90);
  }
}

function spoilerThumb(kind) {
  const r = new Raster(W, H);
  carSide(r);
  wheels(r);
  const y = { lip: 12, duck: 13, wing: 9, twin: 7, gt: 4 }[kind];
  if (y !== undefined) {
    r.rect(4, 15 - (15 - y), 2, 15 - y, 0xd0a040);
    r.rect(0, y, 11, 2, 0xd0a040);
    if (kind === 'twin') r.rect(0, y + 3, 11, 2, 0xd0a040);
  }
  return r.commit();
}

// Traseira do carro com o escapamento da variante e a cor da chama que ele solta.
const EXHAUST_THUMB = {
  stock: { xs: [14, 26], size: 2, flame: [0xff7a18, 3] },
  muffled: { xs: [14, 26], size: 3, flame: [0x4a7aff, 2] },
  sport: { xs: [10, 15, 25, 30], size: 1, flame: [0xff6a18, 4] },
  drift: { xs: [20], size: 3, flame: [0x30e070, 5] },
  turbo: { xs: [13, 27], size: 3, flame: [0x3a6aff, 7] },
  explosive: { xs: [13, 27], size: 2, flame: [0xff2810, 8] },
};
function exhaustThumb(option) {
  const r = new Raster(W, H);
  const { xs, size, flame } = EXHAUST_THUMB[option.value] ?? EXHAUST_THUMB.stock;
  r.rect(4, 4, 32, 10, 0x6a6a72);                    // traseira da carroceria
  r.rect(7, 6, 26, 4, 0x2a2e38);                     // vidro traseiro
  r.rect(6, 11, 3, 2, 0xc02020);
  r.rect(31, 11, 3, 2, 0xc02020);                    // lanternas
  r.rect(4, 14, 32, 3, 0x34343a);                    // para-choque
  r.disc(8, 19, 3, 0x18181c);
  r.disc(32, 19, 3, 0x18181c);
  for (const x of xs) {
    r.rect(x - size, 17, size * 2, 3, 0x2a2a2e);     // cano
    r.rect(x - Math.ceil(size / 2), 20, Math.max(1, size), flame[1], flame[0]);   // chama
  }
  return r.commit();
}

// Frente do carro com o para-choque da variante.
function bumperThumb(id) {
  const r = new Raster(W, H);
  r.rect(9, 3, 22, 13, 0x6a6a72);                    // carroceria vista de frente
  r.rect(12, 5, 16, 6, 0x2a2e38);                    // para-brisa
  r.rect(10, 12, 4, 2, 0xf0e8b0);
  r.rect(26, 12, 4, 2, 0xf0e8b0);                    // faróis
  r.disc(11, 23, 3, 0x18181c);
  r.disc(29, 23, 3, 0x18181c);
  const dark = 0x34343a, gold = 0xd8b840, steel = 0xa8a8b0;
  if (id === 'stock') r.rect(9, 16, 22, 3, dark);
  if (id === 'sport') {
    r.rect(7, 20, 26, 2, dark);                      // splitter
    r.rect(5, 17, 3, 5, dark);
    r.rect(32, 17, 3, 5, dark);                      // aletas
    r.rect(13, 16, 14, 3, 0x1a1a1e);                 // entrada de ar
    for (const x of [15, 18, 21, 24]) r.rect(x, 16, 1, 3, gold);
  }
  if (id === 'steel') {
    r.rect(6, 15, 28, 2, steel);                     // tubo de cima
    r.rect(6, 20, 28, 2, steel);                     // tubo de baixo
    for (const x of [6, 19, 32]) r.rect(x, 15, 2, 7, steel);
    r.disc(12, 12, 2, gold);
    r.disc(28, 12, 2, gold);                         // faróis auxiliares
    r.rect(14, 22, 12, 2, 0x70747c);                 // protetor de cárter
  }
  if (id === 'explosive') {
    for (const y of [16, 19]) for (const x of [8, 11, 14, 17, 20, 23, 26, 29]) r.rect(x, y, 3, 3, 0xc02424);   // dinamites
    for (const x of [9, 15, 21, 27]) r.rect(x, 14, 1, 2, 0x1a1a1e);                                         // pavios
    r.rect(13, 16, 2, 6, gold);
    r.rect(25, 16, 2, 6, gold);                      // fitas
  }
  if (id === 'ram') {
    r.poly([[5, 21], [35, 21], [35, 17], [5, 17]], dark);
    r.poly([[3, 21], [37, 21], [20, 16]], 0x4a4a52);
    for (const x of [11, 20, 29]) r.poly([[x - 2, 17], [x + 2, 17], [x, 10]], gold);
  }
  if (id === 'absorber') {
    r.rect(4, 15, 32, 8, dark);
    r.disc(5, 19, 4, dark);
    r.disc(34, 19, 4, dark);
    r.rect(5, 17, 30, 1, gold);
    r.rect(5, 20, 30, 1, gold);
    for (const x of [10, 16, 22, 28]) r.rect(x, 17, 1, 4, gold);
    r.rect(4, 18, 2, 1, 0xc02424);
    r.rect(34, 18, 2, 1, 0xc02424);
  }
  return r.commit();
}

// Vidro de frente, no tom da película, com o detalhe da variante.
function glassThumb({ id, value }) {
  const r = new Raster(W, H);
  const pane = mix(0x6c8aa6, 0, value);
  r.poly([[6, 24], [11, 5], [29, 5], [34, 24]], 0x6a6a72);
  r.poly([[9, 22], [13, 7], [27, 7], [31, 22]], pane);
  if (id === 'light') { r.rect(10, 4, 20, 3, 0x1a1a1e); r.rect(7, 8, 2, 14, 0x1a1a1e); r.rect(31, 8, 2, 14, 0x1a1a1e); }   // pala e calhas
  if (id === 'medium') { r.rect(6, 8, 3, 2, 0x1a1a1e); r.rect(31, 8, 3, 2, 0x1a1a1e); r.rect(9, 22, 22, 1, 0xa8a8b0); }
  if (id === 'dark') {                                // barras de reforço cruzadas
    for (let i = 0; i < 16; i++) { r.rect(12 + i, 22 - Math.round(i * 0.9), 1, 2, 0xa8a8b0); r.rect(27 - i, 22 - Math.round(i * 0.9), 1, 2, 0xa8a8b0); }
    r.rect(9, 22, 22, 2, 0xa8a8b0);
  }
  if (id === 'black') { r.poly([[6, 24], [11, 5], [14, 5], [10, 24]], 0x0c0c10); r.poly([[34, 24], [29, 5], [26, 5], [30, 24]], 0x0c0c10); }
  return r.commit();
}

function heightThumb(option) {
  const r = new Raster(W, H);
  const offset = Math.round(-option.value * 30);
  wheels(r);
  carSide(r, offset);
  if (option.id === 'slammed' || option.id === 'low') r.rect(11, 19 + offset, 18, option.id === 'slammed' ? 3 : 2, 0x1a1a1e);   // saia lateral
  if (option.id === 'high' || option.id === 'lifted') {
    r.rect(3, 22 + offset, 6, 2, 0x9aa0aa);          // protetor de cárter
    r.rect(31, 18 + offset, 2, 6, 0x141418);         // para-lama de borracha
  }
  if (option.id === 'lifted') {
    r.rect(15, 6 + offset, 12, 2, 0x1a1a1e);         // barra de faróis
    for (const x of [17, 20, 23, 26]) r.rect(x, 5 + offset, 1, 1, 0xfff2b0);
  }
  return r.commit();
}

function tireThumb({ id, value: { width, radius } }) {
  const r = new Raster(W, H);
  const outer = 10 * radius + 2, wide = outer * (0.75 + width * 0.25);
  if (id === 'offroad') {                            // garras em volta do pneu
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      r.rect(Math.round(20 + Math.cos(a) * (wide + 1)) - 1, Math.round(14 + Math.sin(a) * (outer + 1)) - 1, 3, 3, 0x0a0a0c);
    }
  }
  r.ellipse(20, 14, wide, outer, 0x18181c);
  if (id === 'big') r.ellipse(20, 14, wide - 3, outer - 3, 0xe07820);          // anel de reforço
  r.ellipse(20, 14, wide - (id === 'big' ? 5 : 2), outer - (id === 'big' ? 5 : 2), 0x18181c);
  if (id === 'wide') r.disc(20, 14, 9, 0xe8e8ec);    // letras brancas
  r.disc(20, 14, id === 'wide' ? 8 : 7, id === 'wide' ? 0x18181c : 0x8a8a90);
  r.disc(20, 14, id === 'wide' ? 6 : 7, 0x8a8a90);
  r.disc(20, 14, 3, 0x3a3a40);
  if (id === 'slim') for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; r.rect(Math.round(20 + Math.cos(a) * (wide + 1)), Math.round(14 + Math.sin(a) * (outer + 1)), 1, 1, 0xc8ccd4); }   // pinos
  return r.commit();
}

function patternThumb(id) {
  const r = new Raster(W, H);
  const check = PATTERNS[id];
  r.rect(0, 0, W, H, (x, y) => (check(x * 4, y * 2.3, 11, 'side') ? 0xa81e20 : 0xc0bcb4));
  return r.commit();
}

function decalThumb(id) {
  const r = new Raster(W, H);
  r.rect(0, 0, W, H, 0x8a2020);
  if (id === 'crosses') {
    for (const x of [8, 18, 28]) {
      r.rect(x, 7, 3, 14, 0xe8e4dc);
      r.rect(x - 3, 12, 9, 3, 0xe8e4dc);
    }
  } else if (id === 'number') {
    r.rect(8, 6, 10, 3, 0xe8e4dc); r.rect(15, 6, 3, 8, 0xe8e4dc); r.rect(8, 12, 10, 3, 0xe8e4dc);
    r.rect(8, 12, 3, 10, 0xe8e4dc); r.rect(8, 19, 10, 3, 0xe8e4dc);
    r.rect(22, 6, 12, 3, 0xe8e4dc); r.rect(31, 6, 3, 16, 0xe8e4dc);
  } else if (id === 'bolt') {
    r.poly([[24, 3], [12, 16], [19, 15], [14, 26], [29, 11], [21, 12]], 0xe8e4dc);
  } else if (id === 'stars') {
    for (const x of [9, 20, 31]) {
      r.rect(x - 1, 9, 3, 11, 0xe8e4dc);
      r.rect(x - 5, 13, 11, 3, 0xe8e4dc);
    }
  } else if (id === 'bars') {
    for (let i = 0; i < 4; i++) r.poly([[7 + i * 7, 23], [14 + i * 7, 5], [18 + i * 7, 5], [11 + i * 7, 23]], 0xe8e4dc);
  } else if (id === 'skull') {
    r.poly([[12, 12], [14, 5], [26, 5], [28, 12], [28, 17], [24, 17], [24, 23], [16, 23], [16, 17], [12, 17]], 0xe8e4dc);
    r.rect(15, 10, 4, 4, 0x101012); r.rect(21, 10, 4, 4, 0x101012); r.rect(19, 16, 2, 2, 0x101012);
  } else if (id === 'flag') {
    r.rect(9, 4, 2, 20, 0xe8e4dc);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) r.rect(12 + i * 5, 5 + j * 5, 5, 5, (i + j) & 1 ? 0x101012 : 0xe8e4dc);
  } else if (id === 'flame') {
    r.poly([[20, 3], [26, 11], [28, 19], [20, 25], [12, 19], [14, 11], [19, 10]], 0xe8e4dc);
    r.poly([[20, 14], [24, 19], [20, 23], [16, 19]], 0xf8f4ec);
  } else if (id === 'chevrons') {
    for (const i of [-1, 0, 1]) r.poly([[20 + i * 9 - 6, 6], [20 + i * 9, 6], [20 + i * 9 + 6, 14], [20 + i * 9, 22], [20 + i * 9 - 6, 22], [20 + i * 9, 14]], 0xe8e4dc);
  } else {
    r.line(8, 6, 32, 22, 0x3a0a0a, 3);
    r.line(32, 6, 8, 22, 0x3a0a0a, 3);
  }
  return r.commit();
}

// Silhueta do carro de lado com o ponto onde o adesivo vai.
const SPOT_MARKS = { door: [18, 15], fender: [31, 16], nose: [7, 16], roof: [21, 9], hood: [9, 14], trunk: [32, 14] };
function decalSpotThumb(id) {
  const r = new Raster(W, H);
  r.poly(CAR_SIDE, 0x6a6a74);
  for (const x of [10, 30]) r.disc(x, 22, 4, 0x18181c);
  const mark = SPOT_MARKS[id];
  if (mark) r.rect(mark[0] - 3, mark[1] - 2, 6, 4, 0xe8c040);
  else rasterText(r, 'AUTO', 8, 2, 0xe8c040);
  return r.commit();
}

function decalSizeThumb(value) {
  const r = new Raster(W, H), size = Math.round(10 * value);
  r.rect(0, 0, W, H, 0x8a2020);
  r.rect(Math.round(20 - size / 2), Math.round(14 - size / 2), size, size, 0xe8e4dc);
  return r.commit();
}

function decalNumberThumb(label) {
  const r = new Raster(W, H);
  r.rect(0, 0, W, H, 0x8a2020);
  rasterText(r, label, Math.round(20 - textWidth(label, 2) / 2), 7, 0xe8e4dc, 2);
  return r.commit();
}

function trimThumb(id) {
  const r = new Raster(W, H);
  r.rect(0, 0, W, H, 0x8a2020);
  if (id === 'line') r.rect(0, 14, W, 1, 0xe8e4dc);
  else if (id === 'thick') r.rect(0, 12, W, 4, 0xe8e4dc);
  else if (id === 'double') { r.rect(0, 10, W, 1, 0xe8e4dc); r.rect(0, 16, W, 1, 0xe8e4dc); }
  return r.commit();
}

// Perfil do carro visto de lado.
function modelThumb(id) {
  const r = new Raster(W, H), { stations, greenhouse: { front, roofFront, roofRear, rear } } = CAR_SHAPES[id];
  const toX = z => 20 - z * 8.2, toY = y => 25 - y * 15;
  const outline = [...stations.map(s => [toX(s.z), toY(s.belt)]), [toX(2.2), toY(0.3)], [toX(-2.2), toY(0.3)]];
  r.poly(outline, 0x9a9aa0);
  r.poly([[toX(front.z), toY(front.y)], [toX(roofFront.z), toY(roofFront.y)], [toX(roofRear.z), toY(roofRear.y)], [toX(rear.z), toY(rear.y)]], 0x5a6068);
  for (const z of [-1.3, 1.35]) r.disc(toX(z), 21, 3.5, 0x18181c);
  return r.commit();
}

// Par de faróis de frente, no desenho da opção.
function headlightThumb(shape) {
  const r = new Raster(W, H), color = 0xf4eeb0;
  r.rect(0, 0, W, H, 0x4a4c52);
  for (const cx of [11, 29]) {
    if (shape === 'round') r.disc(cx, 14, 7, color);
    else if (shape === 'twin') { r.disc(cx - 4, 14, 3.4, color); r.disc(cx + 4, 14, 3.4, color); }
    else if (shape === 'slim') r.rect(cx - 8, 13, 16, 3, color);
    else {
      r.rect(cx - 7, 9, 14, 10, color);
      if (shape === 'covered') for (let x = -4; x <= 4; x += 4) r.rect(cx + x, 9, 1, 10, 0x18181c);
    }
  }
  return r.commit();
}

function nitroThumb(option) {
  const r = new Raster(NITRO_SIZE.width, NITRO_SIZE.height);
  paintNitroBottle(r, option.palette, option.style);
  return r.commit();
}

function hoodThumb(id) {
  const r = new Raster(W, H);
  r.rect(0, 0, W, H, 0x4a4c52);
  r.rect(0, 22, W, 6, 0x34363c);
  const light = 0xe0dccf, dark = 0x101014;
  if (id === 'skull') {
    r.disc(20, 11, 8, light);
    r.rect(14, 16, 12, 6, light);
    r.disc(17, 11, 2.2, dark);
    r.disc(23, 11, 2.2, dark);
    r.rect(19, 15, 2, 2, dark);
    for (const x of [15, 19, 23]) r.rect(x, 18, 2, 3, dark);
  } else if (id === 'blower') {
    r.rect(10, 14, 20, 8, 0x8a2020);
    r.rect(13, 6, 14, 8, 0x9a9aa0);
    r.rect(15, 8, 4, 4, dark);
    r.rect(21, 8, 4, 4, dark);
  } else if (id === 'scoop') {
    r.poly([[8, 22], [12, 12], [28, 12], [32, 22]], light);
    r.rect(14, 15, 12, 4, dark);
  } else if (id === 'horns') {
    r.rect(14, 18, 12, 4, 0x6a6a6a);
    r.poly([[16, 20], [4, 4], [12, 19]], light);
    r.poly([[24, 20], [36, 4], [28, 19]], light);
  } else if (id === 'star') {
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * Math.PI * 0.4;
      r.poly([[20, 13], [20 + Math.cos(a - 0.5) * 5, 13 + Math.sin(a - 0.5) * 5], [20 + Math.cos(a) * 11, 13 + Math.sin(a) * 11], [20 + Math.cos(a + 0.5) * 5, 13 + Math.sin(a + 0.5) * 5]], light);
    }
  } else if (id === 'target') {
    r.ring(20, 13, 11, 8.5, light);
    r.ring(20, 13, 5.5, 3, light);
    r.rect(19, 1, 2, 24, light);
    r.rect(8, 12, 24, 2, light);
  }
  return r.commit();
}

const EXTERIOR = {
  body: option => modelThumb(option.value),
  headlight: option => headlightThumb(option.value),
  hood: option => hoodThumb(option.value),
  pattern: option => patternThumb(option.value),
  decal: option => decalThumb(option.value),
  decalSpot: option => decalSpotThumb(option.value),
  decalSize: option => decalSizeThumb(option.value),
  decalNumber: option => decalNumberThumb(option.value),
  trim: option => trimThumb(option.value),
  spoiler: option => spoilerThumb(option.value),
  height: option => heightThumb(option),
  bumper: option => bumperThumb(option.value),
  exhaust: exhaustThumb,
  tire: option => tireThumb(option),
  rim: option => paintRim(option.value, 0xb01820),
  glass: option => glassThumb(option),
};

// Peças feitas de PNG viram um canvas que se preenche quando a imagem carrega (1x1 até lá).
const pngCanvases = new Map();
function canvasFromPng(path) {
  if (!pngCanvases.has(path)) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const image = new Image();
    image.onload = () => {
      canvas.width = image.width;
      canvas.height = image.height;
      canvas.getContext('2d').drawImage(image, 0, 0);
    };
    image.src = path;
    pngCanvases.set(path, canvas);
  }
  return pngCanvases.get(path);
}

const resolveImage = option => {
  const image = typeof option.image === 'function' ? option.image() : option.image;
  return typeof image === 'string' ? canvasFromPng(image) : image;
};

const INTERIOR = {
  wheel: resolveImage,
  shifter: resolveImage,
  charm: resolveImage,
  nitro: nitroThumb,
  health: option => {
    const meter = option.create(null);
    meter.draw(1);
    return meter.canvas;
  },
};

export const weaponThumb = (id, custom) => createGunRig(id, custom).snapshot();
export const trunkItemThumb = id => paintTrapIcon(id);

export function emptyTrunkThumb() {
  const r = new Raster(W, H);
  r.rect(13, 7, 14, 14, 0x34343a);
  r.rect(15, 9, 10, 10, 0x55565c);
  return r.commit();
}

export const exteriorThumb = (key, option) => EXTERIOR[key](option);
export const interiorThumb = (key, option) => INTERIOR[key](option);
