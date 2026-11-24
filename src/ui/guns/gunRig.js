import { buildGunArt } from './gunArt.js';
import { hash } from '../../art/shade.js';
import { ctxBox as box, ctxDisc as disc } from './gunPaint.js';

// Monta a arma a partir das camadas e a desenha numa pose. A origem é o pivô da arma.
// Uma camada pode ter `paint(ctx, pose)`: desenho feito a cada quadro (cordas, ponteiros, brilho de calor),
// nas mesmas coordenadas da imagem e com o mesmo movimento de `pose`.

export const REST_POSE = {
  hammer: 1, hammers: [1, 1], spin: 0, open: 0, bolt: 0, lever: 0, magDrop: 0, ammo: 6, boltLift: 0, boltBack: 0,
  draw: 1, flex: 0, t: 0, latch: 0, extract: 0, drum: 0, heat: 0, crank: 0, actionHand: 0, pump: 0, spent: false, nut: 0,
  rotor: 0, rotorSpeed: 0, belt: 0, beltIndex: 0,
};

// Recuo padrão (mola): quanto a arma vai para trás, sobe e gira a cada tiro, e como ela volta.
export const DEFAULT_RECOIL = { back: 5, up: 9, tilt: 0.26, stiffness: 260, damping: 18, shake: 0 };

export function createGunRig(id, custom) {
  const art = buildGunArt(id, custom);
  const [pivotX, pivotY] = art.pivot;
  art.recoil = { ...DEFAULT_RECOIL, ...art.recoil };

  function draw(ctx, pose) {
    ctx.save();
    ctx.translate(-pivotX, -pivotY);
    for (const layer of art.layers) {
      const t = layer.pose ? layer.pose(pose) : {};
      if (t.hidden) continue;
      ctx.save();
      ctx.translate(t.dx ?? 0, t.dy ?? 0);
      if (t.angle) {
        ctx.translate(t.px, t.py);
        ctx.rotate(t.angle);
        ctx.translate(-t.px, -t.py);
      }
      if (layer.paint) layer.paint(ctx, pose);
      else {
        const key = t.variant ?? layer.select?.(pose);
        ctx.drawImage(key !== undefined ? layer.variants[key] : layer.image, 0, 0);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  const muzzleOrigin = () => [art.muzzle[0] - pivotX, art.muzzle[1] - pivotY];

  // Clarão em cruz irregular; `seed` varia o formato a cada tiro.
  function drawCross(ctx, seed, x, y, size) {
    const [outer, middle, core] = art.flash;
    const long = Math.round((14 + seed * 8) * size), side = Math.round((7 + (1 - seed) * 6) * size);
    box(ctx, outer, x - long, y - 1, long, 3);
    box(ctx, outer, x - Math.round(long * 0.5), y - side, 3, side * 2 + 1);
    box(ctx, middle, x - Math.round(long * 0.7), y - 2, Math.round(long * 0.7), 5);
    box(ctx, middle, x - Math.round(long * 0.45), y - Math.round(side * 0.6), 5, Math.round(side * 1.2) + 1);
    box(ctx, core, x - Math.round(long * 0.4), y - 1, Math.round(long * 0.4), 3);
  }

  // Revólver pesado: além da boca, o fogo escapa para cima pelos furos do cano.
  function drawPorted(ctx, seed, x, y) {
    const [outer, middle, core] = art.flash;
    for (const [i, vx] of (art.ports ?? []).entries()) {
      const h = Math.round(8 + hash(i, seed * 100) * 8), px = vx - pivotX, top = art.portY - pivotY;
      box(ctx, outer, px - 1, top - h, 3, h);
      box(ctx, middle, px, top - h + 2, 1, h - 2);
      box(ctx, core, px, top - 3, 1, 3);
    }
    drawCross(ctx, seed, x, y, art.flashSize);
  }

  // Sniper: o freio de boca joga o fogo para cima e para baixo pelas janelas.
  function drawBrake(ctx, seed, x, y) {
    const [outer, middle, core] = art.flash, s = art.flashSize;
    for (const dir of [-1, 1]) {
      for (const [i, wx] of (art.brakeSlots ?? [3]).entries()) {
        const len = Math.round((7 + hash(i, dir + seed * 50) * 6) * s), bx = wx - pivotX;
        for (let k = 0; k < len; k++) {
          const t = k / len, w = t < 0.5 ? 2 : 1, c = t < 0.25 ? core : t < 0.6 ? middle : outer;
          box(ctx, c, bx - Math.round(k * 0.3), y + dir * (5 + k), w, 1);
        }
      }
    }
    drawCross(ctx, seed, x, y, s * 0.8);
  }

  // Escopeta automática: clarão largo e chumbo riscando em leque.
  function drawScatter(ctx, seed, x, y) {
    const [outer, middle, core] = art.flash, s = art.flashSize;
    for (let i = 0; i < 9; i++) {
      const a = (hash(i, seed * 999) - 0.5) * 0.7, len = (18 + hash(i + 9, seed * 77) * 22) * s, from = 8 * s;
      for (let k = from; k < len; k += 2) box(ctx, k < len * 0.6 ? middle : outer, x - k, y + Math.sin(a) * k, 1, 1);
    }
    disc(ctx, x - 5 * s, y, 6 * s, outer);
    disc(ctx, x - 4 * s, y, 4 * s, middle);
    disc(ctx, x - 3 * s, y, 2 * s, core);
    drawCross(ctx, seed, x, y, s * 0.75);
  }

  // Besta: não tem fogo de pólvora, só o deslocamento de ar e as faíscas do trapo.
  function drawWhoosh(ctx, seed, x, y) {
    const lines = [[-6, 18], [-2, 26], [2, 22], [6, 14]];
    for (const [dy, len] of lines) {
      const l = Math.round(len * (0.8 + seed * 0.4));
      for (let k = 0; k < l; k += 1) if (k % 5 !== 4) box(ctx, k < l / 2 ? 0xe8e4d8 : 0x9a968c, x - 4 - k, y + dy, 1, 1);
    }
    disc(ctx, x - 1, y, 2.5, 0xd8d4c8);
    for (let i = 0; i < 5; i++) box(ctx, i % 2 ? 0xff9a20 : 0xffd060, x - 6 - hash(i, seed * 40) * 24, y + (hash(i + 5, seed * 40) - 0.5) * 12, 1, 1);
  }

  function drawFlash(ctx, seed) {
    if (!art.flashSize) return;
    const [x, y] = muzzleOrigin();
    switch (art.flashStyle) {
      case 'ported': return drawPorted(ctx, seed, x, y);
      case 'brake': return drawBrake(ctx, seed, x, y);
      case 'scatter': return drawScatter(ctx, seed, x, y);
      case 'whoosh': return drawWhoosh(ctx, seed, x, y);
      default: return drawCross(ctx, seed, x, y, art.flashSize);
    }
  }

  // Imagem parada, para miniaturas.
  function snapshot(pose = REST_POSE) {
    const canvas = document.createElement('canvas');
    [canvas.width, canvas.height] = art.size;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.translate(pivotX, pivotY);
    draw(ctx, pose);
    return canvas;
  }

  return { art, draw, drawFlash, snapshot };
}
