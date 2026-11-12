import { LAPS } from '../config.js';
import { ctxText, textWidth } from '../art/font.js';
import { DEPTH, LAYOUT } from './layout.js';
import { Sprite } from './sprite.js';

// Placar preso à cabine, pendurado no teto por uma haste.

const WIDTH = 90, BOARD_HEIGHT = 105, STEM_HEIGHT = 20;
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
  return row;                                        // quantas linhas ficaram ocupadas (com os "----" entre elas)
}

const AHEAD_COLOR = '#f0a040', BEHIND_COLOR = '#60c0f0', DIM = '#4a463c', MAX_METERS = 999;

// Faixa (cuja altura `top` o placar calcula conforme as linhas usadas) com a distância em metros até o piloto logo à frente (seta para cima) e o logo atrás (seta para baixo).
function paintRivals(ctx, rivals, top) {
  ctx.fillStyle = '#2a2822';
  ctx.fillRect(MARGIN, top - 2, WIDTH - MARGIN * 2, 1);
  [[MARGIN, 'ahead', AHEAD_COLOR, true], [WIDTH / 2 + 3, 'behind', BEHIND_COLOR, false]].forEach(([x, key, color, up]) => {
    const rival = rivals?.[key];
    ctx.fillStyle = rival ? color : DIM;
    // Seta de 7x7 pixels: triângulo para cima ou para baixo.
    for (let row = 0; row < 4; row++) {
      const width = 1 + row * 2, y = up ? top + 1 + row : top + 7 - 1 - row;
      ctx.fillRect(x + 3 - row, y, width, 1);
    }
    ctx.fillRect(x + 2, up ? top + 5 : top + 1, 3, 3);
    const text = rival ? `${Math.min(MAX_METERS, Math.round(Math.abs(rival.meters)))}M` : '--';
    ctxText(ctx, text, x + 10, top + 1, rival ? color : DIM);
  });
}

export function createScoreboard(parent) {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = STEM_HEIGHT + BOARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  paintFrame(ctx);
  const sprite = new Sprite(parent, canvas, { ...LAYOUT.scoreboard, depth: DEPTH.gauges, legibleWhenReduced: true });

  let lastKey = '';
  return (race, kills, rivals) => {
    const meters = rival => (rival ? Math.min(MAX_METERS, Math.round(Math.abs(rival.meters))) : '-');
    const key = `${race.order.map(entry => entry.name).join()}|${race.lap}|${kills}|${meters(rivals?.ahead)}|${meters(rivals?.behind)}`;
    if (key === lastKey) return;
    lastKey = key;

    paintFrame(ctx);
    const rows = paintRows(ctx, race);
    paintRivals(ctx, rivals, FIRST_ROW + rows * ROW_HEIGHT + 3);   // sempre logo abaixo da última linha, sem cobrir nenhum nome
    ctxText(ctx, `K ${kills}`, MARGIN, FOOTER_Y, '#e8e8e8');
    const laps = `${race.lap} / ${LAPS}`;
    ctxText(ctx, laps, WIDTH - MARGIN - textWidth(laps), FOOTER_Y, '#e8e8e8');
    sprite.refresh();
  };
}
