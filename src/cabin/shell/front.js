import { Raster, CLEAR } from '../../art/raster.js';
import { clamp, dither, distToLine, fbm, hash, smooth, subQuad, vnoise } from '../../art/shade.js';
import { rasterTiny } from '../../art/font.js';

// Parede frontal da cabine: exatamente o enquadramento da tela (640x360), com o vidro transparente.

const ROOF = [0x120d09, 0x19130e, 0x211a14, 0x2b2219];
const PILLAR = [0x0e0807, 0x160d0a, 0x20130e, 0x2a1a13];
const TRIM = [0x120907, 0x1e130e, 0x2a1d15, 0x382a1e, 0x4a3b2b, 0x5c4c38];
const COWL = [0x130908, 0x221410, 0x33231c, 0x46342a, 0x5a4538];
const DASH_TOP = [0x1a0c0b, 0x2a1513, 0x3a1e1b, 0x4b2825, 0x5c3530, 0x6e443d];
const FACE = [0x020100, 0x070302, 0x0e0504, 0x160908, 0x1f0e0b];
const SILL = [0x170d09, 0x26170f, 0x352217, 0x452e21, 0x553a2b];
const RPILLAR = [0x17100b, 0x2a2115, 0x3b3020, 0x4d412d, 0x60533a];

const RIDGE_LEFT = [188, 247], RIDGE_PEAK = [370, 227], RIDGE_RIGHT = [549, 246];

const lerpLine = (x, [ax, ay], [bx, by]) => ay + (x - ax) * (by - ay) / (bx - ax);
const ridgeY = x => (x < RIDGE_PEAK[0] ? lerpLine(x, RIDGE_LEFT, RIDGE_PEAK) : lerpLine(x, RIDGE_PEAK, RIDGE_RIGHT));
const dashBottomY = x => (x < 360 ? 272 : 272 + (x - 360) * 6 / 193);

function roofShade(x, y) {
  return dither(x, y, 0.2 + 0.55 * fbm(x / 60, y / 24), ROOF, 0.9);
}

function pillarShade(x, y) {
  if (hash(x, y) > 0.994) return 0x2c1f16;                      // pontinhos de poeira
  return dither(x, y, 0.15 + 0.6 * fbm(x / 26, y / 26), PILLAR, 0.9);
}

function faceShade(x, y) {
  const depth = clamp((y - 270) / 90);
  return dither(x, y, 0.62 - 0.5 * depth + (vnoise(x / 18, y / 18) - 0.5) * 0.35, FACE, 1);
}

function trimShade(x, y) {
  const d = distToLine(x, y, 77, 82, 187, 243);               // distância até a borda do vidro
  if (d < 1.4) return 0x1a100b;
  const along = (y - 82) / 161;
  const lit = 0.18 + 0.42 * smooth(along * 1.4) * (1 - d / 16);
  const camo = (vnoise(x / 7, y / 11) - 0.5) * 0.5;
  return dither(x, y, lit + camo, TRIM, 0.8);
}

function cowlOrDashShade(x, y) {
  const d = y + 0.5 - ridgeY(x) - Math.sin(x / 31) * 0.8;
  if (d < 2) return 0x170a09;
  if (d < 4) return dither(x, y, 0.35, [0x1c0d0b, 0x2c1512], 1);
  if (d < 8) return dither(x, y, 0.3 + 0.75 * fbm(x / 13, y / 3.2), COWL, 0.8);
  if (d < 10) return dither(x, y, 0.3, [0x120807, 0x1e0e0c], 0.6);

  const streak = vnoise(x / 38, y / 2.6) - 0.5;
  const light = 0.42 + 0.26 * smooth((x - 200) / 300);
  const edge = dashBottomY(x) - y < 2.5 ? 0.3 : 0;
  return dither(x, y, light + streak * 0.3 + (hash(x, y) - 0.5) * 0.12 - edge, DASH_TOP, 0.6);
}

function paintPillarLeft(r) {
  r.poly([[0, 84], [77, 82], [187, 246], [162, 267], [136, 264], [142, 250], [71, 192], [70, 184], [0, 121]], pillarShade);
  r.poly([[64, 82], [77, 82], [187, 243], [177, 250]], trimShade);

  // difusor de ar
  const vent = [[42, 105], [59, 101], [78, 127], [62, 131]];
  r.poly(vent, 0x130b07);
  r.poly(subQuad(vent, 0.12, 0.08, 0.44, 0.92), 0x040201);
  r.poly(subQuad(vent, 0.56, 0.08, 0.88, 0.92), 0x040201);
  r.rect(55, 116, 8, 1, 0xd8d0c8); r.rect(57, 117, 4, 1, 0x8a8078); r.rect(65, 115, 4, 1, 0xe8e0d8);

  // moldura do indicador de vida
  const panel = [[73, 172], [101, 160], [149, 216], [128, 227]];
  r.poly(panel, (x, y) => dither(x, y, 0.5, [0x1e1c14, 0x34322a], 1));
  r.poly(subQuad(panel, 0.06, 0.06, 0.94, 0.95), 0x0d0f08);
  r.poly(subQuad(panel, 0.2, 0.28, 0.92, 0.9), 0x050803);
}

function paintPillarRight(r) {
  r.poly([[640, 183], [549, 246], [563, 250], [640, 207]], (x, y) => {
    const d = distToLine(x, y, 640, 183, 549, 246);
    return dither(x, y, 0.75 - d / 26 + (vnoise(x / 9, y / 9) - 0.5) * 0.3, RPILLAR, 0.8);
  });
  r.poly([[549, 246], [563, 249], [568, 262], [553, 256]], 0x0e0705);
}

function paintDash(r) {
  r.poly([
    RIDGE_LEFT, RIDGE_PEAK, RIDGE_RIGHT, [566, 262], [566, 279], [553, 278], [360, 272],
    [207, 272], [192, 273], [184, 284], [136, 284], [177, 267],
  ], cowlOrDashShade);

  // fios de tinta vermelha do capô aparecendo atrás do painel
  r.line(197, 241, 241, 234, (x, y) => (hash(x, y) > 0.3 ? 0x6e1812 : null));
  r.line(523, 241, 548, 245, (x, y) => (hash(x, y) > 0.3 ? 0x5a1410 : null));

  // sombra sob o painel
  r.line(192, 273, 360, 273, 0x050202);
  r.line(360, 273, 566, 280, 0x050202);
  r.rect(222, 274, 104, 40, 0x050302);
}

function paintSill(r) {
  r.poly([[0, 300], [137, 262], [162, 267], [0, 324]], (x, y) => {
    const patch = vnoise(x / 20, y / 5) - 0.5;
    return dither(x, y, 0.42 + patch * 0.8, SILL, 0.7);
  });
  r.poly([[563, 250], [640, 264], [640, 296], [566, 279]], (x, y) => {
    const patch = vnoise(x / 20, y / 5) - 0.5;
    return dither(x, y, 0.2 + patch * 0.5 - (y - 262) / 120, SILL, 0.7);
  });
}

function paintConsole(r) {
  // coluna escura à esquerda do câmbio e botão do painel
  r.rect(347, 275, 16, 85, 0x030100);
  r.disc(365, 287, 4.5, 0x1a0f0b);
  r.disc(365, 287, 3, 0x0d0705);

  // divisória à direita da grade
  r.rect(456, 280, 2, 80, 0x040201);

  // tapete
  r.poly([[386, 332], [456, 332], [470, 360], [376, 360]], (x, y) => ((x + (y >> 1)) % 3 === 0 ? 0x0c0604 : 0x20110c));
}

// Continuação da frente abaixo da tela, visível ao olhar um pouco para baixo.
export function paintFrontSkirt() {
  const r = new Raster(640, 154);
  r.rect(0, 0, 640, 154, (x, y) => faceShade(x, y + 360));
  r.poly([[376, 0], [470, 0], [512, 154], [334, 154]], (x, y) => ((x + (y >> 1)) % 3 === 0 ? 0x0c0604 : 0x20110c));
  r.rect(347, 0, 16, 154, 0x030100);
  return r.commit();
}

export function paintFront() {
  const r = new Raster(640, 360);
  r.rect(0, 0, 640, 360, faceShade);
  r.poly([[0, 0], [640, 0], [640, 52], [77, 84], [0, 88]], roofShade);

  // vidros (transparentes)
  r.poly([[77, 82], [640, 50], [640, 183], [549, 246], [370, 227], [188, 247]], CLEAR);
  r.poly([[0, 121], [70, 184], [71, 192], [142, 250], [136, 264], [0, 300]], CLEAR);
  r.poly([[640, 207], [563, 250], [640, 264]], CLEAR);

  paintPillarLeft(r);
  paintPillarRight(r);
  paintSill(r);
  paintDash(r);
  paintConsole(r);
  r.line(77, 83, 640, 51, 0x0c0403);                             // sombra sob o teto
  return r.commit();
}
