import { ctxText, textWidth } from '../art/font.js';
import { COLOR, drawButton, inside, MEDALS, pointerOnStage } from './panelKit.js';
import { createReadyPanel } from './garage/readyPanel.js';

// Fim da partida: os três primeiros no pódio. Fica aberta até todos darem pronto.

const CENTER = 250, BASE_Y = 270, STEP_WIDTH = 116, FIRST_REST_X = 72, REST_COLUMN = 120, REST_ROW = 14;
const STEPS = [
  { x: CENTER, height: 120, digit: 4 },              // 1º no meio
  { x: CENTER - STEP_WIDTH - 4, height: 90, digit: 3 },
  { x: CENTER + STEP_WIDTH + 4, height: 66, digit: 3 },
];
const SHORT_NAME = 9;                                // nomes até esse tamanho aparecem maiores
const READY_PANEL = { x: 436, top: 70 };
const BUTTON = { x: 436, y: 318, width: 200, height: 28 };
const CONFETTI_COUNT = 90, CONFETTI_COLORS = ['#f0c840', '#d82020', '#2060c0', '#30c060', '#f0ece4', '#f030b0'];

const centeredAt = (ctx, text, x, y, color, scale = 1) => ctxText(ctx, text, Math.round(x - textWidth(text, scale) / 2), y, color, scale);

export function createPodiumScreen({ stage, localName, getRoster, onReady, onKick }) {
  const screen = { isOpen: false };
  const readyPanel = createReadyPanel({ getRoster, onKick });
  let match = null, confirmed = false, pointer = { x: -1, y: -1 };

  addEventListener('mousemove', e => { if (screen.isOpen) pointer = pointerOnStage(e, stage); });
  stage.addEventListener('click', e => {
    if (!screen.isOpen) return;
    const { x, y } = pointerOnStage(e, stage);
    if (readyPanel.click(x, y) || confirmed || !inside(BUTTON, x, y)) return;
    confirmed = true;
    onReady();
  });

  screen.open = finishedMatch => {
    match = finishedMatch;
    confirmed = false;
    screen.isOpen = true;
  };
  screen.close = () => { screen.isOpen = false; };
  screen.readyPanel = readyPanel;

  function drawConfetti(ctx) {
    const time = performance.now() / 1000;
    for (let i = 0; i < CONFETTI_COUNT; i++) {
      const speed = 30 + (i * 37) % 50, x = (i * 97) % 640 + Math.sin(time * 1.5 + i) * 8, y = (time * speed + i * 53) % 370 - 8;
      ctx.fillStyle = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      ctx.fillRect(Math.round(x), Math.round(y), 2 + (i % 2), 2);
    }
  }

  function drawTrophy(ctx, x, y) {
    ctx.fillStyle = MEDALS[0];
    ctx.fillRect(x - 9, y, 18, 12);
    ctx.fillRect(x - 6, y + 12, 12, 4);
    ctx.fillRect(x - 2, y + 16, 4, 6);
    ctx.fillRect(x - 7, y + 22, 14, 3);
    ctx.fillRect(x - 13, y + 2, 4, 2);
    ctx.fillRect(x - 13, y + 2, 2, 7);
    ctx.fillRect(x - 13, y + 8, 5, 2);
    ctx.fillRect(x + 9, y + 2, 4, 2);
    ctx.fillRect(x + 11, y + 2, 2, 7);
    ctx.fillRect(x + 8, y + 8, 5, 2);
    ctx.fillStyle = '#fff4c0';
    ctx.fillRect(x - 6, y + 2, 3, 7);
  }

  function drawStep(ctx, entry, place) {
    const { x, height, digit } = STEPS[place], top = BASE_Y - height, medal = MEDALS[place];
    ctx.fillStyle = COLOR.tileDark;
    ctx.fillRect(x - STEP_WIDTH / 2, top, STEP_WIDTH, height);
    ctx.fillStyle = medal;
    ctx.fillRect(x - STEP_WIDTH / 2, top, STEP_WIDTH, 5);
    centeredAt(ctx, String(place + 1), x, top + 11, medal, digit);
    const statsY = BASE_Y - 24;
    centeredAt(ctx, `${entry.wins}/${entry.silvers}/${entry.bronzes}`, x, statsY, COLOR.text);
    centeredAt(ctx, `${entry.points} PTS  SOMA ${entry.totalPositions}`, x, statsY + 11, COLOR.muted);

    const isLocal = entry.name === localName(), big = entry.name.length <= SHORT_NAME;
    centeredAt(ctx, entry.name, x, top - (big ? 18 : 12), isLocal ? '#ffffff' : medal, big ? 2 : 1);
    if (place === 0) drawTrophy(ctx, x, top - 48);
  }

  screen.draw = ctx => {
    ctx.fillStyle = COLOR.backdrop;
    ctx.fillRect(0, 0, 640, 360);
    drawConfetti(ctx);
    const standings = match.standings(), champion = standings[0];
    centeredAt(ctx, 'PODIO', CENTER, 12, COLOR.selected, 3);
    centeredAt(ctx, champion.name === localName() ? 'VOCE VENCEU A PARTIDA!' : `CAMPEAO: ${champion.name}`, CENTER, 42, MEDALS[0], 2);

    standings.slice(0, 3).forEach((entry, place) => drawStep(ctx, entry, place));
    ctx.fillStyle = COLOR.edge;
    ctx.fillRect(CENTER - STEP_WIDTH * 1.5 - 8, BASE_Y, STEP_WIDTH * 3 + 16, 2);
    standings.slice(3).forEach((entry, i) => {
      const column = i % 3, row = Math.floor(i / 3);
      ctxText(ctx, `${i + 4}. ${entry.name}`, FIRST_REST_X + column * REST_COLUMN, BASE_Y + 12 + row * REST_ROW, COLOR.muted);
    });

    readyPanel.draw(ctx, pointer, READY_PANEL.top, READY_PANEL.x);
    drawButton(ctx, BUTTON, confirmed ? 'AGUARDANDO...' : 'PRONTO', inside(BUTTON, pointer.x, pointer.y));
  };
  return screen;
}
