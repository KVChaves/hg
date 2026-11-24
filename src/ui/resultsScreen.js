import { VIEW } from '../config.js';
import { ctxText, textWidth } from '../art/font.js';
import { COLOR, drawButton, drawHeading, drawRule, inside, panelBox, pointerOnStage } from './panelKit.js';
import { drawCount, drawMedal, drawMove, drawPlaceBadge, drawSkull, drawStandingRow, formatPoints, nameColor } from './standingsKit.js';

// Depois de cada corrida: a ordem de chegada (com a diferença para o vencedor e os abates da corrida) e a classificação
// da partida (medalhas, abates na partida, pontos e quantas posições cada um ganhou ou perdeu nesta corrida).

const FINISH = { x: 16, y: 50, width: 214, height: 228 };
const TABLE = { x: 238, y: 50, width: 386, height: 228 };
const BUTTON = { x: 220, y: 322, width: 200, height: 28 };
const HEAD = 12, RULE = 24, FIRST_ROW = 30, ROW_HEIGHT = 24;
// Centro de cada coluna da classificação (o nome começa em `name`).
const COLUMNS = { place: 14, move: 26, name: 46, gold: 182, silver: 212, bronze: 242, kills: 288, points: 346 };

const formatTime = seconds => {
  const whole = Math.floor(seconds), hundredths = Math.floor((seconds - whole) * 100);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
};
// Diferença para o vencedor: segundos com centésimos e, passando de um minuto, minutos também.
const formatGap = seconds => `+${seconds >= 60 ? formatTime(seconds) : seconds.toFixed(2)}`;

const centered = (ctx, text, y, color, scale = 1) => ctxText(ctx, text, Math.round(VIEW.width / 2 - textWidth(text, scale) / 2), y, color, scale);
const rowTop = (panel, i) => panel.y + FIRST_ROW + i * ROW_HEIGHT;

export function createResultsScreen({ stage, onNext, onFinished, localName, getUpcomingBiome = () => null, getRaceKills = () => new Map(), getMatchKills = () => 0 }) {
  const screen = { isOpen: false };
  let pointer = { x: -1, y: -1 }, match = null, finish = [], queued = null, waitsForHost = false;

  addEventListener('mousemove', e => { if (screen.isOpen) pointer = pointerOnStage(e, stage); });
  stage.addEventListener('click', e => {
    if (!screen.isOpen || waitsForHost) return;
    const { x, y } = pointerOnStage(e, stage);
    if (!inside(BUTTON, x, y) || queued) return;
    // Trocar de tela só no próximo quadro evita que este clique acione também a tela seguinte.
    queued = () => { screen.isOpen = false; (match.isOver ? onFinished : onNext)(); };
  });

  screen.update = () => {
    if (!queued) return;
    queued();
    queued = null;
  };

  // `finishResults` traz { name, time, estimated } na ordem de chegada da corrida que acabou.
  // Online quem avança é o admin, então a tela não tem botão.
  screen.open = (currentMatch, finishResults, options = {}) => {
    match = currentMatch;
    finish = finishResults;
    waitsForHost = Boolean(options.waitsForHost);
    screen.isOpen = true;
  };
  screen.close = () => { screen.isOpen = false; };

  const isMine = name => name === localName();

  function drawPanelHeader(ctx, panel, title) {
    panelBox(ctx, panel);
    ctxText(ctx, title, panel.x + 10, panel.y + HEAD, COLOR.selected);
    drawRule(ctx, panel.x + 8, panel.y + RULE, panel.width - 16);
  }

  // Chegada: posição, piloto, abates nesta corrida e tempo (o vencedor com o tempo, os outros com a diferença para ele).
  function drawFinish(ctx) {
    drawPanelHeader(ctx, FINISH, 'CHEGADA');
    const right = FINISH.x + FINISH.width - 10, killsX = FINISH.x + 122;
    drawSkull(ctx, killsX, FINISH.y + HEAD, COLOR.muted);
    ctxText(ctx, 'TEMPO', right - textWidth('TEMPO'), FINISH.y + HEAD, COLOR.muted);
    const kills = getRaceKills(), winnerTime = finish[0]?.time ?? 0;
    finish.forEach(({ name, time, estimated }, i) => {
      const top = rowTop(FINISH, i), y = top + 8, mine = isMine(name);
      drawStandingRow(ctx, { x: FINISH.x + 4, y: top, width: FINISH.width - 8, height: ROW_HEIGHT - 2 }, i, mine);
      drawPlaceBadge(ctx, FINISH.x + 14, top + 11, i);
      ctxText(ctx, name, FINISH.x + 28, y, nameColor(i, mine));
      if (kills.get(name)) drawCount(ctx, kills.get(name), killsX + 3, y, COLOR.text);
      const label = `${i === 0 ? formatTime(time) : formatGap(time - winnerTime)}${estimated ? '*' : ''}`;
      ctxText(ctx, label, right - textWidth(label), y, i === 0 ? COLOR.gold : estimated ? COLOR.muted : COLOR.text);
    });
    if (finish.some(result => result.estimated)) ctxText(ctx, '* AINDA CORRENDO, ESTIMADO', FINISH.x, FINISH.y + FINISH.height + 6, COLOR.muted);
  }

  // Classificação da partida: posição, quanto subiu ou caiu, piloto, medalhas, abates na partida e pontos.
  function drawTable(ctx) {
    drawPanelHeader(ctx, TABLE, 'CLASSIFICACAO');
    const at = column => TABLE.x + COLUMNS[column], headY = TABLE.y + HEAD;
    [at('gold'), at('silver'), at('bronze')].forEach((x, place) => drawMedal(ctx, x, headY + 3, place));
    drawSkull(ctx, at('kills') - 15, headY, COLOR.text);
    ctxText(ctx, 'ABATES', at('kills') - 6, headY, COLOR.text);
    ctxText(ctx, 'PTS', at('points') - Math.floor(textWidth('PTS') / 2) + 1, headY, COLOR.selected);
    const before = match.standingsBefore?.(), placeBefore = before && new Map(before.map((entry, i) => [entry.name, i]));
    match.standings().forEach((entry, i) => {
      const top = rowTop(TABLE, i), y = top + 8, mine = isMine(entry.name);
      drawStandingRow(ctx, { x: TABLE.x + 4, y: top, width: TABLE.width - 8, height: ROW_HEIGHT - 2 }, i, mine);
      drawPlaceBadge(ctx, at('place'), top + 11, i);
      if (placeBefore?.has(entry.name)) drawMove(ctx, at('move'), top + 11, placeBefore.get(entry.name) - i);
      ctxText(ctx, entry.name, at('name'), y, nameColor(i, mine));
      drawCount(ctx, entry.wins, at('gold'), y);
      drawCount(ctx, entry.silvers, at('silver'), y);
      drawCount(ctx, entry.bronzes, at('bronze'), y);
      drawCount(ctx, getMatchKills(entry.name), at('kills'), y);
      // Pontos grandes; zero fica pequeno e apagado, para não pesar.
      if (entry.points) drawCount(ctx, formatPoints(entry.points), at('points'), top + 4, COLOR.selected, 2);
      else drawCount(ctx, 0, at('points'), y);
    });
  }

  // Quem mais abateu na corrida (empate lista todos); nulo se ninguém abateu.
  function killKing() {
    const entries = [...getRaceKills()].filter(([, kills]) => kills > 0);
    if (!entries.length) return null;
    const most = Math.max(...entries.map(([, kills]) => kills));
    return { names: entries.filter(([, kills]) => kills === most).map(([name]) => name), kills: most };
  }

  // Rei dos abates da corrida, embaixo da classificação, entre duas caveiras.
  function drawKillKing(ctx, king) {
    const text = `REI DOS ABATES: ${king.names.join(' E ')} - ${king.kills} ${king.kills === 1 ? 'ABATE' : 'ABATES'}`;
    const x = Math.round(TABLE.x + TABLE.width / 2 - textWidth(text) / 2), y = TABLE.y + TABLE.height + 6;
    drawSkull(ctx, x - 12, y, COLOR.gold);
    ctxText(ctx, text, x, y, COLOR.gold);
    drawSkull(ctx, x + textWidth(text) + 4, y, COLOR.gold);
  }

  screen.draw = ctx => {
    ctx.fillStyle = COLOR.backdrop;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    drawHeading(ctx, `CORRIDA ${match.racesDone} DE ${match.raceCount}`, VIEW.width / 2, 24);
    drawFinish(ctx);
    drawTable(ctx);
    const king = killKing();
    if (king) drawKillKing(ctx, king);
    if (match.isOver) {
      const champion = match.standings()[0].name;
      centered(ctx, champion === localName() ? 'VOCE VENCEU A PARTIDA!' : `CAMPEAO: ${champion}`, 300, '#f0d060', 2);
    }
    const upcoming = !match.isOver && getUpcomingBiome();
    if (upcoming) centered(ctx, `PROXIMO MAPA: ${upcoming}`, 300, '#f0d060', 2);
    if (waitsForHost) centered(ctx, match.isOver ? 'O PODIO ABRE EM INSTANTES' : 'A GARAGEM ABRE EM INSTANTES', BUTTON.y + 10, COLOR.muted);
    else drawButton(ctx, BUTTON, match.isOver ? 'VER PODIO >' : 'PROXIMA CORRIDA >', inside(BUTTON, pointer.x, pointer.y), 'primary');
  };
  return screen;
}
