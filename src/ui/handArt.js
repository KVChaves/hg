import { Raster } from '../art/raster.js';

// Luvas em pixel art: costas pretas, dedos claros de tela, cruzes nos nós e tira no punho.

const BLACK = 0x08090b;
const EDGE = 0x3a3c40;
const LIGHT = 0xb6aea6;
const DOT = 0x8a827b;
const MARK = 0xa8a29c;

const mesh = (x, y) => ((x & 1) === 0 && (y & 1) === 0 ? DOT : LIGHT);

function plus(r, x, y) {
  r.rect(x - 1, y, 4, 2, MARK);
  r.rect(x, y - 1, 2, 4, MARK);
}

// Punho visto de costas com os dedos para cima. O polegar fica à esquerda (mão direita).
function plotFist(r, oy) {
  const at = pts => pts.map(([x, y]) => [x, y + oy]);

  r.poly(at([[0, 15], [3, 10], [9, 9], [30, 9], [30, 21], [26, 29], [23, 33], [10, 33], [3, 25], [1, 19]]), BLACK);

  // dedos
  for (const [x0, x1] of [[9, 15], [16, 21], [22, 26], [27, 30]]) {
    r.rect(x0, oy + 1, x1 - x0, 9, mesh);
    r.rect(x0, oy, x1 - x0, 1, EDGE);
  }
  for (const x of [15, 21, 26]) r.rect(x, oy + 9, 1, 4, EDGE);

  // polegar
  r.poly(at([[1, 15], [2, 12], [8, 5], [9, 5], [9, 9], [3, 11]]), mesh);

  plus(r, 10, oy + 18); plus(r, 16, oy + 18); plus(r, 22, oy + 18); plus(r, 27, oy + 18);

  // remendo e tira do punho
  r.rect(10, oy + 25, 13, 5, mesh);
  r.rect(9, oy + 33, 15, 3, mesh);
  r.rect(9, oy + 35, 15, 1, EDGE);
}

export function paintRightFist() {
  const r = new Raster(31, 36);
  plotFist(r, 0);
  return r.commit();
}

export function paintLeftFist() {
  const source = paintRightFist();
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  ctx.translate(source.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(source, 0, 0);
  return canvas;
}

// Punho segurando munição acima dos dedos, para a recarga: 'round', 'shell' ou 'magazine'.
export function paintFistHolding(kind) {
  const top = kind === 'magazine' ? 18 : 10;
  const r = new Raster(31, 36 + top);
  if (kind === 'round') {
    r.rect(13, 0, 5, 7, 0xc08438);
    r.rect(13, 0, 1, 7, 0xe0a858);
    r.rect(13, 7, 5, 6, 0x9a9088);
    r.rect(17, 7, 1, 6, 0x6a625c);
  } else if (kind === 'shell') {
    r.rect(12, 0, 7, 9, 0xa02418);
    r.rect(12, 0, 1, 9, 0xd04830);
    r.rect(12, 9, 7, 3, 0xc09a4a);
  } else {
    r.poly([[11, 0], [20, 0], [19, 22], [12, 22]], 0x1a1a1e);
    r.rect(12, 0, 1, 22, 0x4a4a52);
  }
  plotFist(r, top);
  return r.commit();
}

// Mão na coronha, vista pelo lado do revólver: dedos enrolados e indicador no gatilho.
export function paintGunHand(triggerPulled) {
  const r = new Raster(32, 34);

  // palma atrás da coronha
  r.poly([[12, 4], [24, 2], [30, 10], [31, 25], [23, 30], [14, 24]], BLACK);
  r.poly([[24, 2], [30, 10], [31, 25], [30, 25], [29, 11], [23, 3]], EDGE);

  // polegar sobre a armação
  r.poly([[8, 3], [22, 0], [27, 5], [12, 8]], mesh);
  r.line(8, 3, 22, 0, EDGE);

  // indicador no gatilho
  const tip = triggerPulled ? [5, 13] : [2, 10];
  r.line(15, 9, tip[0], tip[1], LIGHT, 3);
  r.line(15, 11, tip[0], tip[1] + 1, DOT);

  // três dedos enrolados na coronha
  [[7, 21, 12], [9, 23, 18], [11, 25, 24]].forEach(([x0, x1, y]) => {
    r.rect(x0, y, x1 - x0, 5, mesh);
    r.rect(x0, y + 5, x1 - x0, 1, BLACK);
    r.rect(x1, y, 1, 5, EDGE);
  });

  plus(r, 26, 14);
  r.rect(23, 27, 7, 3, mesh);
  return r.commit();
}
