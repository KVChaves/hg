import { VIEW } from '../config.js';
import { ctxText, textWidth } from '../art/font.js';
import { COLOR, MEDALS, panelBox } from './panelKit.js';

// Tabela da partida (segure TAB): classificação da competição e, durante a corrida, a posição de cada piloto agora.
// Aparece em qualquer tela depois que a partida começou, menos nos menus que ainda montam a partida.

const WIDTH = 420, ROW = 14, TOP_ROWS_Y = 52;
const COLUMNS = { position: 10, name: 30, gold: 190, silver: 232, bronze: 280, points: 346, live: 392 };
const PLAYER_COLOR = '#f01818', OTHER_COLOR = '#b8b4a8';

export function createMatchTable({ getMatch, race, localName, isBlocked }) {
  const table = { visible: () => false };

  table.draw = ctx => {
    const match = getMatch();
    if (!match || isBlocked()) return;
    const standings = match.standings();
    const liveRank = new Map((race.order ?? []).map((entry, i) => [entry.name, i + 1]));
    const showLive = race.started && !race.finished;

    const height = TOP_ROWS_Y + 12 + standings.length * ROW + 22;
    const box = { x: Math.round((VIEW.width - WIDTH) / 2), y: Math.round((VIEW.height - height) / 2), width: WIDTH, height };
    ctx.fillStyle = 'rgba(8, 8, 12, 0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    panelBox(ctx, box);

    const title = `PARTIDA: CORRIDA ${match.currentRace} DE ${match.raceCount}`;
    ctxText(ctx, title, box.x + Math.round((WIDTH - textWidth(title, 2)) / 2), box.y + 12, COLOR.selected, 2);

    const headY = box.y + 38;
    ctxText(ctx, 'PILOTO', box.x + COLUMNS.name, headY, COLOR.muted);
    ctxText(ctx, 'OURO', box.x + COLUMNS.gold, headY, MEDALS[0]);
    ctxText(ctx, 'PRATA', box.x + COLUMNS.silver, headY, MEDALS[1]);
    ctxText(ctx, 'BRONZE', box.x + COLUMNS.bronze, headY, MEDALS[2]);
    ctxText(ctx, 'PTS', box.x + COLUMNS.points, headY, COLOR.selected);
    if (showLive) ctxText(ctx, 'PISTA', box.x + COLUMNS.live - 6, headY, COLOR.muted);
    ctx.fillStyle = COLOR.edge;
    ctx.fillRect(box.x + 8, headY + 10, WIDTH - 16, 1);

    standings.forEach((entry, i) => {
      const y = box.y + TOP_ROWS_Y + 12 + i * ROW;
      const mine = entry.name === localName();
      const color = MEDALS[i] ?? (mine ? PLAYER_COLOR : OTHER_COLOR);
      ctxText(ctx, `${i + 1}.`, box.x + COLUMNS.position, y, COLOR.muted);
      ctxText(ctx, entry.name, box.x + COLUMNS.name, y, mine ? PLAYER_COLOR : color);
      ctxText(ctx, String(entry.wins), box.x + COLUMNS.gold + 10, y, COLOR.text);
      ctxText(ctx, String(entry.silvers), box.x + COLUMNS.silver + 12, y, COLOR.text);
      ctxText(ctx, String(entry.bronzes), box.x + COLUMNS.bronze + 15, y, COLOR.text);
      ctxText(ctx, String(entry.points), box.x + COLUMNS.points, y, COLOR.selected);
      if (showLive && liveRank.has(entry.name)) ctxText(ctx, `${liveRank.get(entry.name)}o`, box.x + COLUMNS.live, y, mine ? PLAYER_COLOR : COLOR.text);
    });

    const hint = 'SOLTE TAB PARA FECHAR';
    ctxText(ctx, hint, box.x + Math.round((WIDTH - textWidth(hint)) / 2), box.y + height - 14, COLOR.muted);
  };
  return table;
}
