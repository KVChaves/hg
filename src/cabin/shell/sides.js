import { Raster, CLEAR } from '../../art/raster.js';
import { dither, fbm, hash, vnoise } from '../../art/shade.js';

// Paredes laterais e teto, vistos ao virar a cabeça. As emendas continuam a parede frontal.
// Escala: 320 px por unidade. As paredes descem abaixo da tela para o piso nunca aparecer.

export const WALL_SIZE = { width: 640, height: 640 };

const ROOF = [0x0a0705, 0x0e0a07, 0x120d09, 0x17110c];
const POST = [0x070302, 0x0c0503, 0x120805, 0x190e09];
const SILL = [0x170d09, 0x26170f, 0x352217, 0x452e21];
const DOOR = [0x0b0504, 0x130806, 0x1c0d0a, 0x27130e, 0x331a13];
const VINYL = [0x1a0d0a, 0x281410, 0x371d17, 0x47271f];
const STEEL = [0x2a2420, 0x4a403a, 0x6e625a, 0x968a80];

const roof = (x, y) => dither(x, y, 0.2 + 0.55 * fbm(x / 60, y / 24), ROOF, 0.9);
const post = (x, y) => dither(x, y, 0.15 + 0.6 * fbm(x / 26, y / 26), POST, 0.9);
const sill = (x, y) => dither(x, y, 0.42 + (vnoise(x / 20, y / 5) - 0.5) * 0.8, SILL, 0.7);
const door = (x, y) => dither(x, y, 0.62 + 0.4 * (fbm(x / 40, y / 30) - 0.5) - (y - 400) / 330, DOOR, 1);

// Forro da porta. `flip` espelha para o lado do passageiro; a frente do carro fica no lado da emenda.
function paintDoorPanel(r, flip) {
  const fx = x => (flip ? 640 - x : x);
  const poly = (pts, color) => r.poly(pts.map(([x, y]) => [fx(x), y]), color);
  const box = (x, y, w, h, color) => r.rect(flip ? 640 - x - w : x, y, w, h, color);

  r.rect(0, 373, 640, 267, door);
  box(300, 373, 340, 30, sill);

  // costura da borda e divisão entre as portas
  for (let x = 306; x < 636; x += 8) box(x, 406, 5, 1, 0x4e3628);
  box(296, 373, 4, 267, 0x050201);

  // porta do motorista: vinil pregueado
  poly([[316, 412], [632, 412], [632, 446], [316, 446]], (x, y) => dither(x, y, 0.55 + ((y >> 2) & 1) * 0.25 + (vnoise(x / 30, y / 12) - 0.5) * 0.3, VINYL, 0.8));
  box(316, 446, 316, 2, 0x060302);

  // maçaneta
  box(322, 420, 52, 18, 0x0a0504);
  box(326, 424, 44, 10, 0x1e120d);
  poly([[332, 426], [366, 426], [370, 431], [334, 433]], (x, y) => dither(x, y, 0.7 - (y - 426) / 10, STEEL, 0.7));

  // manivela do vidro
  const crankX = fx(586);
  r.disc(crankX, 428, 13, 0x241a15);
  r.disc(crankX, 428, 9, (x, y) => dither(x, y, 0.7 - (y - 419) / 24, STEEL, 0.7));
  poly([[586, 426], [614, 416], [618, 421], [588, 432]], (x, y) => dither(x, y, 0.6, STEEL, 0.7));
  r.disc(fx(617), 417, 5, 0x3a2a22);

  // apoio de braço com vão para a mão
  poly([[400, 456], [628, 450], [634, 486], [408, 492]], (x, y) => dither(x, y, 0.72 - (y - 450) / 60, SILL, 0.8));
  poly([[400, 456], [628, 450], [629, 453], [401, 459]], 0x5a3e2e);
  poly([[470, 464], [556, 462], [558, 476], [472, 478]], 0x060302);

  // alto-falante
  const speakerX = fx(360), speakerY = 482;
  r.disc(speakerX, speakerY, 28, 0x241510);
  r.disc(speakerX, speakerY, 24, (x, y) => ((x ^ y) & 1 ? 0x040201 : 0x24120d));
  r.disc(speakerX, speakerY, 8, 0x140a07);

  // porta-mapas
  poly([[420, 506], [632, 500], [632, 548], [420, 552]], 0x0a0504);
  poly([[424, 516], [628, 511], [628, 548], [424, 552]], (x, y) => dither(x, y, 0.5 + (vnoise(x / 18, y / 8) - 0.5) * 0.5, DOOR, 1));
  poly([[452, 502], [500, 496], [512, 520], [460, 522]], (x, y) => dither(x, y, 0.55 + (hash(x >> 4, y >> 4) - 0.5) * 0.5, [0x4a3a2a, 0x6e5a42, 0x8e7a5a], 1));
  r.line(fx(462), 506, fx(502), 502, 0x3a2c20);
  r.line(fx(466), 512, fx(506), 508, 0x3a2c20);

  // porta traseira: vinil, maçaneta e cinzeiro
  poly([[60, 412], [288, 412], [288, 446], [60, 446]], (x, y) => dither(x, y, 0.5 + ((y >> 2) & 1) * 0.25 + (vnoise(x / 30, y / 12) - 0.5) * 0.3, VINYL, 0.8));
  box(60, 446, 228, 2, 0x060302);
  poly([[96, 460], [282, 456], [286, 488], [100, 492]], (x, y) => dither(x, y, 0.62 - (y - 456) / 60, SILL, 0.8));
  box(226, 420, 44, 16, 0x0a0504);
  poly([[232, 425], [264, 425], [266, 430], [234, 431]], (x, y) => dither(x, y, 0.65, STEEL, 0.7));
  box(112, 500, 40, 18, 0x4a403a);
  box(115, 503, 34, 12, 0x0a0504);

  // parafusos e arranhões
  for (const [x, y] of [[320, 414], [628, 414], [320, 444], [628, 444], [64, 414], [284, 414]]) box(x, y, 2, 2, 0x6e625a);
  for (let i = 0; i < 26; i++) {
    const x = fx(70 + hash(i, 3) * 550), y = 455 + hash(i, 9) * 120, len = 10 + hash(i, 5) * 30;
    r.line(x, y, x + len, y + hash(i, 7) * 6 - 3, hash(i, 1) > 0.75 ? 0x5a1a10 : 0x331e16);
  }
}

export function paintLeftWall() {
  const r = new Raster(WALL_SIZE.width, WALL_SIZE.height);
  r.rect(0, 0, 640, 640, post);
  r.rect(0, 0, 640, 116, roof);

  r.poly([[640, 151], [640, 373], [410, 373], [410, 132], [500, 118]], CLEAR);      // janela do motorista
  r.poly([[330, 132], [330, 366], [150, 350], [92, 216], [132, 132]], CLEAR);       // janela traseira
  r.line(640, 151, 500, 118, 0x2a1d15, 2);
  r.line(410, 132, 410, 373, 0x2a1d15, 2);
  r.line(330, 132, 330, 366, 0x2a1d15, 2);
  paintDoorPanel(r, false);
  return r.commit();
}

export function paintRightWall() {
  const r = new Raster(WALL_SIZE.width, WALL_SIZE.height);
  r.rect(0, 0, 640, 640, post);
  r.rect(0, 0, 640, 64, roof);

  r.poly([[0, 62], [192, 66], [0, 228]], CLEAR);                                   // resto do para-brisa
  r.poly([[0, 228], [0, 249], [226, 86], [196, 68]],
    (x, y) => dither(x, y, 0.55 + (vnoise(x / 9, y / 9) - 0.5) * 0.4, [0x17100b, 0x2a2115, 0x3b3020, 0x4d412d], 0.8));
  r.poly([[0, 249], [226, 86], [272, 92], [272, 373], [120, 373], [0, 328]], CLEAR); // janela do passageiro
  r.poly([[342, 110], [342, 366], [492, 350], [548, 216], [510, 110]], CLEAR);       // janela traseira
  r.line(272, 92, 272, 373, 0x2a1d15, 2);
  r.line(342, 110, 342, 366, 0x2a1d15, 2);
  paintDoorPanel(r, true);
  r.poly([[0, 328], [120, 373], [0, 373]], sill);
  return r.commit();
}

export function paintCeiling() {
  const r = new Raster(320, 256);
  r.rect(0, 0, 320, 256, roof);
  return r.commit();
}
