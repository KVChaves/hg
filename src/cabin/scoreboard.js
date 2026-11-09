import { LAPS } from '../config.js';
import { ctxText, textWidth } from '../art/font.js';
import { DEPTH, LAYOUT } from './layout.js';
import { Sprite } from './sprite.js';

// Placar preso à cabine, pendurado no teto por uma haste.

const WIDTH = 90, BOARD_HEIGHT = 91, STEM_HEIGHT = 20;
const STEM = { x: 34, width: 24 };
const VISIBLE_RACERS = 5;
const FIRST_ROW = STEM_HEIGHT + 11, ROW_HEIGHT = 11, FOOTER_Y = STEM_HEIGHT + BOARD_HEIGHT - 13, MARGIN = 7;

function paintFrame(ctx) {
  ctx.clearRect(0, 0, WIDTH, STEM_HEIGHT + BOARD_HEIGHT);

  ctx.fillStyle = '#1a0f0b';
  ctx.fillRect(STEM.x, 0, STEM.width, STEM_HEIGHT);
  ctx.fillStyle = '#2a1a13';
  ctx.fillRect(STEM.x, 0, 2, STEM_HEIGHT);

  const top = STEM_HEIGHT, h = BOARD_HEIGHT;
  ctx.fillStyle = '#34302c';
  ctx.fillRect(3, top, WIDTH - 6, h);
  ctx.fillRect(0, top + 3, WIDTH, h - 6);
  ctx.fillRect(1, top + 1, WIDTH - 2, h - 2);
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(4, top + 2, WIDTH - 8, h - 4);
  ctx.fillRect(2, top + 4, WIDTH - 4, h - 8);
  ctx.fillRect(3, top + 3, WIDTH - 6, h - 6);
}

// O líder sempre aparece; as outras linhas ficam em volta do jogador, sem sobrar espaço vazio.
function shownPositions(player, total) {
  const others = Math.min(VISIBLE_RACERS - 1, total - 1);
  const first = Math.max(1, Math.min(player - 2, total - others));
  return [0, ...Array.from({ length: others }, (_, i) => first + i)];
}

function paintRows(ctx, race) {
  const shown = shownPositions(race.rank - 1, race.order.length);

  let row = 0, previous = -1;
  for (const i of shown) {
    if (i - previous > 1) ctxText(ctx, '----', MARGIN, FIRST_ROW + row++ * ROW_HEIGHT, '#dddddd');
    const entry = race.order[i];
    const text = `${i + 1}. ${entry.name.slice(0, 10)}`;
    ctxText(ctx, text, MARGIN, FIRST_ROW + row++ * ROW_HEIGHT, entry.isPlayer ? '#f01818' : '#e8e8e8');
    previous = i;
  }
}

export function createScoreboard(parent) {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = STEM_HEIGHT + BOARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  paintFrame(ctx);
  const sprite = new Sprite(parent, canvas, { ...LAYOUT.scoreboard, depth: DEPTH.gauges, legibleWhenReduced: true });

  let lastKey = '';
  return (race, kills) => {
    const key = `${race.order.map(entry => entry.name).join()}|${race.lap}|${kills}`;
    if (key === lastKey) return;
    lastKey = key;

    paintFrame(ctx);
    paintRows(ctx, race);
    ctxText(ctx, `K ${kills}`, MARGIN, FOOTER_Y, '#e8e8e8');
    const laps = `${race.lap} / ${LAPS}`;
    ctxText(ctx, laps, WIDTH - MARGIN - textWidth(laps), FOOTER_Y, '#e8e8e8');
    sprite.refresh();
  };
}
