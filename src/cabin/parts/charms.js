import { Raster } from '../../art/raster.js';

// Enfeites pendurados no retrovisor. O topo da imagem é o ponto de onde o fio sai.

const CORD = 0x15100c;
const CANVAS = { width: 26, height: 46 };
const cx = 13;

function start(cordLength) {
  const r = new Raster(CANVAS.width, CANVAS.height);
  r.rect(cx, 0, 1, cordLength, CORD);
  return r;
}

function paintCross() {
  const r = start(15);
  const WOOD = 0x6b4a30, LIGHT = 0x9a7a52, DARK = 0x3a2418;
  r.rect(cx - 1, 14, 4, 30, WOOD);
  r.rect(cx - 7, 22, 16, 4, WOOD);
  r.rect(cx - 1, 14, 1, 30, LIGHT);
  r.rect(cx - 7, 22, 16, 1, LIGHT);
  r.rect(cx + 2, 14, 1, 30, DARK);
  r.rect(cx - 7, 25, 16, 1, DARK);
  r.disc(cx + 0.5, 13, 2, 0xc8a040);
  return r.commit();
}

function paintSkull() {
  const r = start(16);
  const BONE = 0xd8d0c0, SHADE = 0x8a8274;
  r.ellipse(cx + 0.5, 25, 8, 8, BONE);
  r.rect(cx - 4, 30, 10, 7, BONE);
  r.rect(cx - 4, 36, 10, 1, SHADE);
  r.disc(cx - 2.5, 25, 2.5, 0x100808);
  r.disc(cx + 3.5, 25, 2.5, 0x100808);
  r.rect(cx - 3, 25, 1, 1, 0xe02018);
  r.rect(cx + 3, 25, 1, 1, 0xe02018);
  r.rect(cx, 29, 1, 2, 0x100808);
  for (const x of [-3, -1, 1, 3, 5]) r.rect(cx + x - 1, 33, 1, 4, SHADE);
  return r.commit();
}

function plotDie(r, x, y, size, pips) {
  r.rect(x, y, size, size, 0xc8201c);
  r.rect(x, y, size, 1, 0xe85a48);
  r.rect(x + size - 1, y, 1, size, 0x701410);
  r.rect(x, y + size - 1, size, 1, 0x701410);
  for (const [px, py] of pips) r.rect(x + px, y + py, 2, 2, 0xf0ece0);
}

function paintDice() {
  const r = start(14);
  r.line(cx, 14, cx - 6, 20, CORD);
  r.line(cx, 14, cx + 6, 26, CORD);
  plotDie(r, cx - 12, 20, 12, [[2, 2], [8, 2], [5, 5], [2, 8], [8, 8]]);
  plotDie(r, cx, 26, 12, [[2, 2], [5, 5], [8, 8]]);
  return r.commit();
}

function paintPine() {
  const r = start(12);
  const GREEN = 0x2a7a34, LIGHT = 0x58b050, DARK = 0x164a20;
  r.poly([[cx + 0.5, 12], [cx + 8, 24], [cx - 7, 24]], GREEN);
  r.poly([[cx + 0.5, 18], [cx + 10, 32], [cx - 9, 32]], GREEN);
  r.poly([[cx + 0.5, 25], [cx + 12, 40], [cx - 11, 40]], GREEN);
  r.line(cx, 13, cx - 7, 24, LIGHT);
  r.line(cx - 1, 25, cx - 10, 39, LIGHT);
  r.line(cx + 2, 26, cx + 12, 39, DARK);
  r.rect(cx - 1, 40, 4, 5, 0x5a3a20);
  return r.commit();
}

function paintHorseshoe() {
  const r = start(14);
  const STEEL = 0xa8aaae, DARK = 0x56585c;
  r.ring(cx + 0.5, 28, 11, 6.5, STEEL);
  for (let y = 28; y < 40; y++) for (let x = 0; x < CANVAS.width; x++) {
    const inner = Math.abs(x + 0.5 - cx - 0.5);
    if (inner >= 6.5 && inner <= 11) r.put(x, y, inner > 9.5 ? DARK : STEEL);
    else r.put(x, y, -1);
  }
  return r.commit();
}

function paintNone() {
  const r = new Raster(CANVAS.width, CANVAS.height);
  r.line(4, 10, 21, 36, 0xc02018, 2);
  r.line(21, 10, 4, 36, 0xc02018, 2);
  return r.commit();
}

export const CHARMS = {
  none: { name: 'Nenhum', image: paintNone, none: true },
  cross: { name: 'Crucifixo', image: paintCross },
  skull: { name: 'Caveira', image: paintSkull },
  dice: { name: 'Dados', image: paintDice },
  pine: { name: 'Pinheirinho', image: paintPine },
  horseshoe: { name: 'Ferradura', image: paintHorseshoe },
};
