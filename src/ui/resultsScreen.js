import { VIEW } from '../config.js';
import { ctxText, textWidth } from '../art/font.js';
import { COLOR, drawButton, drawHeading, inside, MEDALS, panelBox, pointerOnStage } from './panelKit.js';

// Depois de cada corrida: a ordem de chegada e a classificação da competição.

const FINISH = { x: 20, y: 62, width: 200, height: 214 };
const TABLE = { x: 230, y: 62, width: 390, height: 214 };
const BUTTON = { x: 220, y: 318, width: 200, height: 28 };
const FIRST_ROW = 96, ROW_HEIGHT = 21;
const COLUMNS = { position: 12, name: 40, wins: 112, silvers: 156, bronzes: 206, totalPositions: 264, points: 360 };
const TOTAL_HEADER = 'POSICOES TOTAIS';
const OFF_PODIUM = '#8a8780';
const PLAYER_COLOR = '#f01818';

const formatTime = seconds => {
  const whole = Math.floor(seconds), hundredths = Math.floor((seconds - whole) * 100);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
};

const centered = (ctx, text, y, color, scale = 1) => ctxText(ctx, text, Math.round(VIEW.width / 2 - textWidth(text, scale) / 2), y, color, scale);

export function createResultsScreen({ stage, onNext, onFinished, localName, getUpcomingBiome = () => null, getRaceKills = () => new Map() }) {
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

  // Os três primeiros têm a cor da medalha; fora do pódio o jogador continua em destaque.
  const colorOf = (name, position) => MEDALS[position] ?? (name === localName() ? PLAYER_COLOR : OFF_PODIUM);

  function drawFinish(ctx) {
    panelBox(ctx, FINISH);
    ctxText(ctx, 'CHEGADA', FINISH.x + 12, FINISH.y + 12, COLOR.selected);
    ctxText(ctx, 'TEMPO', FINISH.x + FINISH.width - 12 - textWidth('TEMPO'), FINISH.y + 12, COLOR.muted);
    finish.forEach(({ name, time, estimated }, i) => {
      const y = FIRST_ROW + i * ROW_HEIGHT - (finish.length > 7 ? 2 : 0);
      const label = `${formatTime(time)}${estimated ? '*' : ''}`;
      ctxText(ctx, `${i + 1}.`, FINISH.x + 12, y, COLOR.muted);
      ctxText(ctx, name, FINISH.x + 40, y, colorOf(name, i));
      ctxText(ctx, label, FINISH.x + FINISH.width - 12 - textWidth(label), y, COLOR.text);
    });
    if (finish.some(result => result.estimated)) ctxText(ctx, '* AINDA CORRENDO, ESTIMADO', FINISH.x, FINISH.y + FINISH.height + 6, COLOR.muted);
  }

  function drawTable(ctx) {
    panelBox(ctx, TABLE);
    ctxText(ctx, 'CLASSIFICACAO', TABLE.x + 12, TABLE.y + 12, COLOR.selected);
    ctxText(ctx, 'OURO', TABLE.x + COLUMNS.wins, TABLE.y + 12, MEDALS[0]);
    ctxText(ctx, 'PRATA', TABLE.x + COLUMNS.silvers, TABLE.y + 12, MEDALS[1]);
    ctxText(ctx, 'BRONZE', TABLE.x + COLUMNS.bronzes, TABLE.y + 12, MEDALS[2]);
    ctxText(ctx, TOTAL_HEADER, TABLE.x + COLUMNS.totalPositions, TABLE.y + 12, COLOR.muted);
    ctxText(ctx, 'PTS', TABLE.x + COLUMNS.points, TABLE.y + 12, COLOR.selected);
    match.standings().forEach((entry, i) => {
      const y = FIRST_ROW + i * ROW_HEIGHT - (finish.length > 7 ? 2 : 0);
      ctxText(ctx, `${i + 1}.`, TABLE.x + COLUMNS.position, y, COLOR.muted);
      ctxText(ctx, entry.name, TABLE.x + COLUMNS.name, y, colorOf(entry.name, i));
      ctxText(ctx, String(entry.wins), TABLE.x + COLUMNS.wins + 10, y, COLOR.text);
      ctxText(ctx, String(entry.silvers), TABLE.x + COLUMNS.silvers + 12, y, COLOR.text);
      ctxText(ctx, String(entry.bronzes), TABLE.x + COLUMNS.bronzes + 15, y, COLOR.text);
      ctxText(ctx, String(entry.points), TABLE.x + COLUMNS.points, y, COLOR.selected);
      const total = String(entry.totalPositions);
      ctxText(ctx, total, TABLE.x + COLUMNS.totalPositions + Math.floor((textWidth(TOTAL_HEADER) - textWidth(total)) / 2), y, COLOR.text);
    });
  }

  // Quem mais abateu na corrida (empate lista todos); nulo se ninguém abateu.
  function killKing() {
    const entries = [...getRaceKills()].filter(([, kills]) => kills > 0);
    if (!entries.length) return null;
    const most = Math.max(...entries.map(([, kills]) => kills));
    return { names: entries.filter(([, kills]) => kills === most).map(([name]) => name), kills: most };
  }

  screen.draw = ctx => {
    ctx.fillStyle = COLOR.backdrop;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    drawHeading(ctx, `CORRIDA ${match.racesDone} DE ${match.raceCount}`, VIEW.width / 2, 24);
    drawFinish(ctx);
    drawTable(ctx);
    const king = killKing();
    if (king) centered(ctx, `REI DOS ABATES: ${king.names.join(' E ')} - ${king.kills} ${king.kills === 1 ? 'ABATE' : 'ABATES'}`, FINISH.y + FINISH.height + 6, COLOR.gold);
    if (match.isOver) {
      const champion = match.standings()[0].name;
      centered(ctx, champion === localName() ? 'VOCE VENCEU A PARTIDA!' : `CAMPEAO: ${champion}`, 290, '#f0d060', 2);
    }
    const upcoming = !match.isOver && getUpcomingBiome();
    if (upcoming) centered(ctx, `PROXIMO MAPA: ${upcoming}`, 290, '#f0d060', 2);
    if (waitsForHost) centered(ctx, match.isOver ? 'O PODIO ABRE EM INSTANTES' : 'A GARAGEM ABRE EM INSTANTES', BUTTON.y + 10, COLOR.muted);
    else drawButton(ctx, BUTTON, match.isOver ? 'VER PODIO >' : 'PROXIMA CORRIDA >', inside(BUTTON, pointer.x, pointer.y), 'primary');
  };
  return screen;
}
