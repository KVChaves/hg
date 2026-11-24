import { Raster } from '../art/raster.js';
import { dither } from '../art/shade.js';
import { DEPTH, LAYOUT } from './layout.js';
import { Sprite } from './sprite.js';

// Munição de reserva no painel. Cada arma guarda a sua de um jeito.

function plotRound(r, x, y) {
  r.rect(x, y, 3, 3, 0xc08438);
  r.rect(x, y, 1, 3, 0xe0a858);
  r.rect(x, y + 3, 3, 6, 0x9a9088);
  r.rect(x + 2, y + 3, 1, 6, 0x6a625c);
  r.rect(x, y + 9, 3, 2, 0xb88048);
}

function plotShell(r, x, y) {
  r.rect(x, y, 5, 8, 0xa02418);
  r.rect(x, y, 1, 8, 0xd04830);
  r.rect(x + 4, y, 1, 8, 0x641410);
  r.rect(x, y + 8, 5, 3, 0xc09a4a);
}

function plotLongRound(r, x, y) {
  r.rect(x + 1, y, 2, 3, 0xc08438);
  r.rect(x, y + 3, 4, 8, 0xb88048);
  r.rect(x, y + 3, 1, 8, 0xe0a858);
}

function plotMagazine(r, x, y) {
  r.poly([[x, y], [x + 9, y], [x + 8, y + 24], [x + 1, y + 24]], 0x1a1a1e);
  r.rect(x + 1, y, 1, 24, 0x4a4a52);
  r.rect(x + 2, y + 3, 5, 2, 0x34343a);
  r.rect(x + 2, y + 8, 5, 2, 0x34343a);
  r.rect(x + 2, y + 13, 5, 2, 0x34343a);
}

// Flecha incendiária: ponta, trapo enrolado e haste.
function plotBolt(r, x, y) {
  r.rect(x + 1, y + 2, 2, 9, 0x9a8a6a);
  r.poly([[x, y + 2], [x + 4, y + 2], [x + 2, y]], 0xd8d8dc);
  r.rect(x, y + 3, 4, 3, 0x6a4a2a);
  r.rect(x, y + 4, 4, 1, 0x3a2614);
}

// Granada: ogiva verde, faixa amarela e estojo de latão.
function plotGrenade(r, x, y) {
  r.ellipse(x + 3, y + 3, 3, 3, 0x6a7638);
  r.put(x + 2, y + 1, 0x8a9a4a);
  r.rect(x, y + 5, 6, 1, 0xd8b040);
  r.rect(x, y + 6, 6, 5, 0xc8a040);
  r.rect(x, y + 6, 1, 5, 0xe8c060);
}

// Caixa de munição da metralhadora, com a ponta da cinta saindo por cima.
function plotAmmoBox(r, x, y) {
  for (let i = 0; i < 3; i++) r.rect(x + 4 + i * 3, y, 2, 3, 0xd0a040);
  r.rect(x, y + 3, 14, 13, 0x1e2216);
  r.rect(x + 1, y + 4, 12, 11, 0x4c5434);
  r.rect(x + 1, y + 4, 12, 1, 0x667048);
  r.rect(x + 2, y + 9, 10, 2, 0xd8b040);
}

const MAX_RACK_WIDTH = 60;                           // munição extra aperta o suporte em vez de sair do painel

const RACKS = {
  revolver: { roundsPerItem: 1, perRow: 12, stepX: 4, gapY: 13, itemW: 3, itemH: 11, tray: true, plot: plotRound },
  shotgun: { roundsPerItem: 1, perRow: 6, stepX: 7, gapY: 13, itemW: 5, itemH: 11, tray: true, plot: plotShell },
  rifle: { roundsPerItem: 1, perRow: 8, stepX: 5, gapY: 13, itemW: 4, itemH: 11, tray: true, plot: plotLongRound },
  smg: { roundsPerItem: 30, perRow: 2, stepX: 14, gapY: 26, itemW: 9, itemH: 24, tray: false, plot: plotMagazine },
  crossbow: { roundsPerItem: 1, perRow: 8, stepX: 5, gapY: 13, itemW: 4, itemH: 11, tray: true, plot: plotBolt },
  grenade: { roundsPerItem: 1, perRow: 6, stepX: 8, gapY: 13, itemW: 6, itemH: 11, tray: true, plot: plotGrenade },
  heavymg: { roundsPerItem: 50, perRow: 2, stepX: 17, gapY: 18, itemW: 14, itemH: 16, tray: false, plot: plotAmmoBox },
};

export function createAmmoRack(parent) {
  let rack = null, raster = null, base = null, sprite = null, last = -1, perRow = 1, stepX = 1;

  // `reserve` é o máximo que este carro leva, já com a melhoria de munição.
  function setWeapon(type, reserve = type.reserve) {
    sprite?.dispose();
    rack = RACKS[type.id] ?? RACKS[type.family];
    last = -1;

    const items = Math.ceil(reserve / rack.roundsPerItem);
    const rows = Math.ceil(type.reserve / rack.roundsPerItem / rack.perRow);
    perRow = Math.ceil(items / rows);
    stepX = Math.min(rack.stepX, (MAX_RACK_WIDTH - rack.itemW) / Math.max(perRow - 1, 1));
    const W = Math.ceil((perRow - 1) * stepX) + rack.itemW + 2, H = (rows - 1) * rack.gapY + rack.itemH + 1;
    raster = new Raster(W, H);

    if (rack.tray) {
      for (let row = 0; row < rows; row++) {
        const y = row * rack.gapY;
        raster.rect(0, y + 4, W, 5, (px, py) => dither(px, py, 0.5, [0x1a0d09, 0x2c1a12], 1));
        raster.rect(0, y + 4, W, 1, 0x3e281c);
        raster.rect(0, y + 8, W, 1, 0x0c0604);
      }
    }
    base = raster.snapshot();
    sprite = new Sprite(parent, raster.commit(), { ...LAYOUT.ammo, depth: DEPTH.gauges });
  }

  function itemPosition(index) {
    const row = Math.floor(index / perRow);
    return { x: Math.round((index % perRow) * stepX) + 1, y: row * rack.gapY };
  }

  function update(reserve) {
    const items = Math.ceil(reserve / rack.roundsPerItem);
    if (items === last) return;
    last = items;
    raster.restore(base);
    for (let i = 0; i < items; i++) {
      const { x, y } = itemPosition(i);
      rack.plot(raster, x, y);
    }
    raster.commit();
    sprite.refresh();
  }

  // Centro, em pixels da cabine, do item que a mão vai pegar quando restam `reserve` balas.
  function slotFor(reserve, carrying) {
    const items = Math.ceil(reserve / rack.roundsPerItem);
    const { x, y } = itemPosition(Math.max(items - (carrying ? 0 : 1), 0));
    return { x: LAYOUT.ammo.x + x + rack.itemW / 2, y: LAYOUT.ammo.y + y + rack.itemH / 2 };
  }

  return { setWeapon, update, slotFor };
}
