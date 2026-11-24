import { VIEW } from '../config.js';
import { ctxText, textWidth } from '../art/font.js';
import { COLOR, drawHeading, drawRule, panelBox } from './panelKit.js';
import { drawCount, drawMedal, drawPlaceBadge, drawSkull, drawStandingRow, formatPoints, nameColor, PLAYER_COLOR } from './standingsKit.js';

// Tabela da partida (segure TAB): classificação da competição, abates de cada piloto na partida e, durante a corrida,
// a posição de cada um agora. Aparece em qualquer tela depois que a partida começou, menos nos menus que ainda montam a partida.

const WIDTH = 440, ROW = 16, HEAD_Y = 36, FIRST_ROW_Y = 52;
// Centro de cada coluna (o nome começa em `name`).
const COLUMNS = { place: 18, name: 32, gold: 206, silver: 234, bronze: 262, kills: 302, points: 352, live: 404 };

export function createMatchTable({ getMatch, race, localName, isBlocked, getMatchKills = () => 0 }) {
  const table = { visible: () => false };

  table.draw = ctx => {
    const match = getMatch();
    if (!match || isBlocked()) return;
    const standings = match.standings();
    const liveRank = new Map((race.order ?? []).map((entry, i) => [entry.name, i + 1]));
    const showLive = race.started && !race.finished;

    const height = FIRST_ROW_Y + standings.length * ROW + 24;
    const box = { x: Math.round((VIEW.width - WIDTH) / 2), y: Math.round((VIEW.height - height) / 2), width: WIDTH, height };
    ctx.fillStyle = 'rgba(24, 10, 5, 0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    panelBox(ctx, box);

    drawHeading(ctx, `PARTIDA: CORRIDA ${match.currentRace} DE ${match.raceCount}`, box.x + WIDTH / 2, box.y + 10);

    const headY = box.y + HEAD_Y, at = column => box.x + COLUMNS[column];
    ctxText(ctx, 'PILOTO', at('name'), headY, COLOR.muted);
    [at('gold'), at('silver'), at('bronze')].forEach((x, place) => drawMedal(ctx, x, headY + 3, place));
    drawSkull(ctx, at('kills') - 3, headY, COLOR.text);
    ctxText(ctx, 'PTS', at('points') - Math.floor(textWidth('PTS') / 2) + 1, headY, COLOR.selected);
    if (showLive) ctxText(ctx, 'PISTA', at('live') - Math.floor(textWidth('PISTA') / 2) + 1, headY, COLOR.muted);
    drawRule(ctx, box.x + 8, headY + 11, WIDTH - 16);

    standings.forEach((entry, i) => {
      const top = box.y + FIRST_ROW_Y + i * ROW, y = top + 4, mine = entry.name === localName();
      drawStandingRow(ctx, { x: box.x + 6, y: top, width: WIDTH - 12, height: ROW - 1 }, i, mine);
      drawPlaceBadge(ctx, at('place'), top + 7, i);
      ctxText(ctx, entry.name, at('name'), y, nameColor(i, mine));
      drawCount(ctx, entry.wins, at('gold'), y);
      drawCount(ctx, entry.silvers, at('silver'), y);
      drawCount(ctx, entry.bronzes, at('bronze'), y);
      drawCount(ctx, getMatchKills(entry.name), at('kills'), y, COLOR.text);
      drawCount(ctx, formatPoints(entry.points), at('points'), y, COLOR.selected);
      if (showLive && liveRank.has(entry.name)) {
        const label = `${liveRank.get(entry.name)}o`;
        ctxText(ctx, label, at('live') - Math.floor(textWidth(label) / 2) + 1, y, mine ? PLAYER_COLOR : COLOR.text);
      }
    });

    const hint = 'SOLTE TAB PARA FECHAR';
    ctxText(ctx, hint, box.x + Math.round((WIDTH - textWidth(hint)) / 2), box.y + height - 15, COLOR.muted);
  };
  return table;
}
