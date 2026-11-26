import { CLEAR, Raster } from '../../art/raster.js';

// Miniaturas das peças de combate (game/weaponParts.js) para a oficina. O desenho é o da peça solta, igual para todas
// as armas; as cores seguem as de gunParts.js (borracha, fita laranja, etiqueta e ponta de cada munição).

const W = 36, H = 26, OUTLINE = 0x0c0806;
const STEEL = [0x2a2a30, 0x4a4c54, 0x70737c, 0x9ca0a8, 0xd0d4da];
const WOOD = [0x2c1a12, 0x4a2e1c, 0x6e4628, 0x946238];
const BRASS = [0x6a4a18, 0xb08030, 0xe0b850, 0xfff0a8];
const RUBBER = [0x121214, 0x26262a, 0x46464e];
const LEATHER = [0x2a1a10, 0x5a3820];
const PULL_TAB = [0x8a2a08, 0xe0601c, 0xffa050];

// Tubo de aço deitado, com luz em cima e sombra embaixo.
function tube(r, x, y, w, h, tones = STEEL) {
  r.rect(x, y, w, h, tones[2]);
  r.rect(x, y, w, 1, tones[4]);
  r.rect(x, y + 1, w, 1, tones[3]);
  r.rect(x, y + h - 2, w, 2, tones[1]);
}

// --- cano (a boca fica à esquerda) ------------------------------------------------------------------------------

const barrelBase = (r, x, w) => {                     // a base, igual em todos: onde o cano entra na arma
  tube(r, x + w, 8, 5, 11, [STEEL[0], STEEL[0], STEEL[1], STEEL[2], STEEL[3]]);
};

const BARREL = {
  stock(r) {
    tube(r, 3, 10, 25, 7);
    r.rect(2, 9, 2, 9, STEEL[1]);
    barrelBase(r, 3, 25);
  },
  compensator(r) {
    tube(r, 14, 10, 14, 7);
    tube(r, 2, 7, 13, 13, [STEEL[0], STEEL[0], STEEL[1], STEEL[2], STEEL[4]]);
    for (const x of [5, 8, 11]) r.rect(x, 8, 2, 6, 0x000000);
    barrelBase(r, 3, 25);
  },
  heavy(r) {
    tube(r, 3, 10, 25, 7);
    tube(r, 5, 6, 23, 15);
    for (let x = 8; x < 26; x += 4) r.rect(x, 9, 2, 9, STEEL[0]);
    r.rect(2, 9, 3, 9, STEEL[1]);
    barrelBase(r, 3, 25);
  },
  short(r) {
    tube(r, 18, 10, 10, 7);
    r.rect(17, 9, 2, 9, STEEL[4]);
    barrelBase(r, 3, 25);
    for (let x = 3; x < 15; x += 4) r.rect(x, 13, 2, 1, 0xe0601c);        // o pedaço que saiu
  },
  wide(r) {                                          // calibre maior: um sino bem aberto
    tube(r, 16, 10, 12, 7);
    r.poly([[2, 3], [17, 9], [17, 18], [2, 24]], STEEL[2]);
    r.line(2, 3, 16, 9, STEEL[4]);
    r.line(2, 24, 16, 18, STEEL[0]);
    r.rect(2, 4, 2, 20, STEEL[1]);
    barrelBase(r, 3, 25);
  },
  choke(r) {
    tube(r, 14, 10, 14, 7);
    r.poly([[3, 6], [15, 9], [15, 18], [3, 21]], STEEL[2]);
    r.line(3, 6, 14, 9, STEEL[4]);
    for (const x of [3, 7, 11]) r.rect(x, 8, 2, 11, STEEL[4]);
    barrelBase(r, 3, 25);
  },
};

// --- empunhadura ------------------------------------------------------------------------------------------------

const GRIP_SHAPE = [[10, 2], [24, 2], [29, 23], [17, 24], [13, 10]];

function gripBody(r, color) {
  r.rect(8, 2, 18, 4, STEEL[2]);
  r.rect(8, 2, 18, 1, STEEL[4]);
  r.poly(GRIP_SHAPE.map(([x, y]) => [x, y + 3 > 24 ? 24 : y + 3]), color);
}

const GRIP = {
  stock(r) {
    gripBody(r, (x, y) => ((x * 2 - y) % 7 === 0 ? WOOD[1] : WOOD[2]));
    r.disc(20, 14, 2, STEEL[3]);
  },
  firm(r) {
    gripBody(r, (x, y) => ((x + y) % 3 === 0 ? RUBBER[2] : RUBBER[1]));
    for (const y of [10, 15, 20]) r.line(13 + (y - 10) / 4, y, 26 + (y - 10) / 4, y - 1, RUBBER[0], 2);   // ressaltos dos dedos
  },
  steady(r) {                                        // apoio: base larga de borracha embaixo do cabo
    gripBody(r, (x, y) => (y > 15 ? ((x + y) % 3 === 0 ? RUBBER[2] : RUBBER[1]) : (x * 2 - y) % 7 === 0 ? WOOD[1] : WOOD[2]));
    r.rect(14, 22, 18, 3, RUBBER[1]);
    r.rect(14, 22, 18, 1, RUBBER[2]);
  },
  light(r) {
    gripBody(r, (x, y) => ((x * 2 - y) % 7 === 0 ? WOOD[2] : WOOD[3]));
    for (const [x, y] of [[17, 8], [19, 13], [21, 18]]) {
      r.rect(x - 1, y, 6, 3, CLEAR);
      r.rect(x, y - 1, 4, 5, CLEAR);
    }
  },
};

// --- carregador -------------------------------------------------------------------------------------------------

// Pente curvo visto de lado, com a primeira bala aparecendo em cima.
function magazine(r, x, y, h) {
  r.poly([[x, y], [x + 11, y], [x + 8, y + h], [x - 3, y + h]], STEEL[2]);
  r.line(x, y, x - 3, y + h - 1, STEEL[4]);
  for (let k = y + 4; k < y + h - 3; k += 4) r.rect(x + 1, k, 7, 2, STEEL[0]);
  r.rect(x - 4, y + h - 1, 13, 2, STEEL[1]);
  r.rect(x + 1, y - 2, 9, 2, BRASS[2]);
  r.rect(x + 1, y - 2, 2, 2, BRASS[3]);
}

const MAGAZINE = {
  stock(r) { magazine(r, 15, 6, 15); },
  extended(r) {
    magazine(r, 17, 3, 21);
    r.rect(26, 13, 9, 3, 0x78d048);                  // sinal de "mais balas"
    r.rect(29, 10, 3, 9, 0x78d048);
  },
  quick(r) {
    magazine(r, 17, 4, 14);
    r.rect(12, 18, 6, 7, PULL_TAB[1]);
    r.rect(12, 18, 2, 7, PULL_TAB[2]);
    r.rect(14, 20, 2, 3, PULL_TAB[0]);
    for (const [x, y] of [[3, 7], [1, 11], [4, 15]]) r.rect(x, y, 7, 1, PULL_TAB[2]);   // riscos de velocidade
  },
  belt(r) {
    r.rect(2, 13, 32, 8, LEATHER[1]);
    r.rect(2, 13, 32, 1, 0x7a5030);
    r.rect(2, 20, 32, 1, LEATHER[0]);
    for (let x = 4; x < 31; x += 5) {
      r.rect(x, 7, 3, 15, BRASS[1]);
      r.rect(x, 7, 1, 15, BRASS[2]);
      r.rect(x, 5, 3, 3, BRASS[2]);
      r.put(x + 1, 4, BRASS[3]);
      r.rect(x - 1, 15, 5, 3, LEATHER[0]);
    }
  },
};

// --- munição: um cartucho grande em pé, a ponta diz o tipo ------------------------------------------------------

function casing(r) {
  r.rect(13, 12, 10, 12, BRASS[1]);
  r.rect(14, 12, 3, 12, BRASS[2]);
  r.rect(15, 12, 1, 12, BRASS[3]);
  r.rect(21, 12, 2, 12, BRASS[0]);
  r.rect(12, 22, 12, 2, BRASS[2]);
  r.rect(13, 20, 10, 1, BRASS[0]);
}

const AMMO = {
  stock(r) {
    casing(r);
    r.poly([[13, 12], [14, 6], [18, 2], [22, 6], [23, 12]], BRASS[1]);
    r.line(15, 11, 17, 4, BRASS[3]);
  },
  pierce(r) {                                         // ponta preta, longa e afiada
    casing(r);
    r.poly([[13, 12], [18, 0], [23, 12]], 0x26262e);
    r.line(15, 11, 17, 3, 0xd8d8dc);
    r.rect(13, 10, 10, 2, 0x8a8a92);
  },
  hollow(r) {                                         // ponta de cobre, aberta no meio
    casing(r);
    r.poly([[13, 12], [14, 4], [22, 4], [23, 12]], 0xc0602a);
    r.rect(14, 5, 2, 7, 0xe08a4a);
    r.rect(14, 3, 8, 2, 0xe08a4a);
    r.rect(16, 3, 4, 4, 0x1c0a04);
  },
  tar(r) {                                           // flecha de piche: ponta preta pegando fogo
    r.rect(17, 9, 2, 16, 0x8a6a40);
    r.rect(17, 9, 1, 16, 0xb08a58);
    r.rect(15, 21, 6, 4, 0xc02818);
    r.ellipse(18, 7, 4, 4, 0x18120e);
    r.rect(14, 1, 3, 4, 0xff7a20);
    r.rect(19, 0, 3, 5, 0xffb040);
    r.rect(17, 2, 2, 3, 0xffe080);
  },
  impact(r) {                                         // ponta azul arredondada, com as ondas da pancada
    casing(r);
    r.ellipse(18, 9, 5.5, 5.5, 0x2a78d8);
    r.rect(13, 9, 10, 3, 0x2a78d8);
    r.rect(15, 5, 2, 4, 0x9ad0ff);
    for (const [x, dir] of [[8, -1], [28, 1]]) {
      for (const k of [0, 4]) r.line(x + dir * k, 3 + k / 2, x + dir * (k + 2), 8, 0x5aa8ff), r.line(x + dir * (k + 2), 8, x + dir * k, 13 - k / 2, 0x5aa8ff);
    }
  },
};

const ICONS = { barrel: BARREL, grip: GRIP, magazine: MAGAZINE, ammo: AMMO };

// Contorno escuro em volta do que foi pintado, para a miniatura se destacar do fundo do botão.
function outline(r) {
  const painted = r.snapshot();
  const filled = (x, y) => x >= 0 && y >= 0 && x < W && y < H && painted[y * W + x] !== 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!filled(x, y) && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))) r.put(x, y, OUTLINE);
    }
  }
}

const cache = new Map();

// `key` é a peça (barrel, grip, magazine, ammo) e `id` a variante.
export function partIcon(key, id) {
  const name = `${key}.${id}`;
  if (!cache.has(name)) {
    const r = new Raster(W, H);
    ICONS[key][id](r);
    outline(r);
    cache.set(name, r.commit());
  }
  return cache.get(name);
}
