import { MAX_RACERS, VIEW } from '../config.js';
import { ctxText, textWidth } from '../art/font.js';
import { loadRaceResults } from '../game/raceResults.js';
import { saveSettings, SETTINGS_RANGE } from '../game/settings.js';
import { COLOR, drawButton, inside, markClickable, outline, panelBox, pointerOnStage } from './panelKit.js';

// Menu inicial: Singleplayer, Multiplayer, Garagem, Ranking, Configurações e Sair.

const BUTTON = { x: 24, y: 112, width: 176, height: 30, gap: 8 };
const PANEL = { x: 130, y: 44, width: 380, height: 272 };
const BACK = { x: 245, y: 278, width: 150, height: 28 };
const SLIDER = { x: 170, width: 300, height: 12, firstY: 96, gap: 44 };
const RANKING_PANEL = { x: 30, y: 28, width: 580, height: 268 };
const RANKING_TAB = { x: 440, y: 34, width: 160, height: 22 };
const RANKING_BACK = { x: 245, y: 302, width: 150, height: 26 };
const RANKING_ROWS = 13;
const RANKING_COLUMNS = [
  { label: 'JOGADOR', x: 40 }, { label: 'TROFEUS', x: 136, color: '#f0c840' }, { label: 'OURO', x: 196, color: '#f0c840' },
  { label: 'PRATA', x: 240, color: '#c8d4e4' }, { label: 'BRONZE', x: 288, color: '#cc8448' }, { label: 'ABATES', x: 342 },
  { label: 'POS MEDIA', x: 396 }, { label: 'PARTIDAS', x: 464 },
];
const TITLE_SCALE = 4, TITLE_COLOR = '#f0d060';

const SLIDERS = [
  { key: 'menuMusic', label: 'MUSICA DO MENU' },
  { key: 'music', label: 'MUSICA DA CORRIDA' },
  { key: 'effects', label: 'EFEITOS SONOROS' },
  { key: 'sensitivity', label: 'SENSIBILIDADE DA CAMERA' },
];
const sliderBox = index => ({ x: SLIDER.x, y: SLIDER.firstY + index * SLIDER.gap, width: SLIDER.width, height: SLIDER.height });

const formatTime = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export function createMainMenu({ stage, settings, net, onSingleplayer, onMultiplayer, onGarage, onSettingChange, onEffectsPreview, onQuit }) {
  let page = 'main', pointer = { x: -1, y: -1 }, dragging = null, queued = null, results = [], showingOnline = true;

  const screen = { isOpen: true };

  function setPage(next) {
    if (next === 'ranking') {
      results = loadRaceResults();
      showingOnline = true;
      net.requestRanking();
    }
    page = next;
  }

  const entries = [
    // Trocar de tela só no próximo quadro evita que este clique acione também a tela seguinte.
    { label: 'SINGLEPLAYER', action: () => { queued = () => { screen.isOpen = false; onSingleplayer(); }; } },
    { label: 'MULTIPLAYER', action: () => { queued = () => { screen.isOpen = false; onMultiplayer(); }; } },
    { label: 'GARAGEM', action: () => { queued = () => { screen.isOpen = false; onGarage(); }; } },
    { label: 'RANKING', action: () => setPage('ranking') },
    { label: 'CONFIGURACOES', action: () => setPage('settings') },
    { label: 'SAIR', action: () => { setPage('bye'); onQuit(); } },
  ].map((entry, i) => ({ ...entry, x: BUTTON.x, y: BUTTON.y + i * (BUTTON.height + BUTTON.gap), width: BUTTON.width, height: BUTTON.height }));

  function dragTo(x) {
    const { key } = SLIDERS[dragging], [low, high] = SETTINGS_RANGE[key];
    const t = Math.max(0, Math.min(1, (x - SLIDER.x) / SLIDER.width));
    settings[key] = low + (high - low) * t;
    onSettingChange(key, settings[key]);
  }

  addEventListener('mousemove', e => {
    if (!screen.isOpen) return;
    pointer = pointerOnStage(e, stage);
    if (dragging !== null) dragTo(pointer.x);
  });
  stage.addEventListener('mousedown', e => {
    if (!screen.isOpen || page !== 'settings') return;
    const { x, y } = pointerOnStage(e, stage);
    const index = SLIDERS.findIndex((_, i) => {
      const box = sliderBox(i);
      return inside({ ...box, y: box.y - 6, height: box.height + 12 }, x, y);
    });
    if (index < 0) return;
    dragging = index;
    dragTo(x);
  });
  addEventListener('mouseup', () => {
    if (dragging === null) return;
    if (SLIDERS[dragging].key === 'effects') onEffectsPreview();
    dragging = null;
    saveSettings(settings);
  });
  stage.addEventListener('click', e => {
    if (!screen.isOpen) return;
    const { x, y } = pointerOnStage(e, stage);
    if (page === 'main') entries.find(entry => inside(entry, x, y))?.action();
    else if (page === 'ranking' && inside(RANKING_TAB, x, y)) showingOnline = !showingOnline;
    else if (inside(page === 'ranking' ? RANKING_BACK : BACK, x, y)) setPage('main');
  });

  function drawTitle(ctx) {
    ctxText(ctx, 'CTI RACERS', BUTTON.x + 2, 52, '#000000', TITLE_SCALE);
    ctxText(ctx, 'CTI RACERS', BUTTON.x, 50, TITLE_COLOR, TITLE_SCALE);
  }

  function drawBack(ctx, label = '< VOLTAR') {
    drawButton(ctx, BACK, label, inside(BACK, pointer.x, pointer.y));
  }

  function heading(ctx, text) {
    ctxText(ctx, text, Math.round(VIEW.width / 2 - textWidth(text, 2) / 2), PANEL.y + 14, COLOR.selected, 2);
  }

  function drawMain(ctx) {
    drawTitle(ctx);
    for (const entry of entries) drawButton(ctx, entry, entry.label, inside(entry, pointer.x, pointer.y));
  }

  function drawSettings(ctx) {
    panelBox(ctx, PANEL);
    heading(ctx, 'CONFIGURACOES');
    SLIDERS.forEach(({ key, label }, i) => {
      const box = sliderBox(i), [low, high] = SETTINGS_RANGE[key], t = (settings[key] - low) / (high - low);
      markClickable(box);
      const percent = `${Math.round(settings[key] * 100)}%`;
      ctxText(ctx, label, box.x, box.y - 14, COLOR.text);
      ctxText(ctx, percent, box.x + box.width - textWidth(percent), box.y - 14, COLOR.selected);
      ctx.fillStyle = COLOR.tileDark;
      ctx.fillRect(box.x, box.y, box.width, box.height);
      ctx.fillStyle = COLOR.button;
      ctx.fillRect(box.x, box.y, Math.round(box.width * t), box.height);
      outline(ctx, box, COLOR.edge);
      ctx.fillStyle = COLOR.selected;
      ctx.fillRect(box.x + Math.round((box.width - 6) * t), box.y - 3, 6, box.height + 6);
    });
    drawBack(ctx);
  }

  function drawOnlineRanking(ctx) {
    panelBox(ctx, RANKING_PANEL);
    ctxText(ctx, 'RANKING', RANKING_PANEL.x + 16, RANKING_PANEL.y + 12, COLOR.selected, 2);
    const top = RANKING_PANEL.y + 44;
    RANKING_COLUMNS.forEach(({ label, x, color }) => ctxText(ctx, label, RANKING_PANEL.x + x, top, color ?? COLOR.muted));
    const rows = net.ranking;
    const message = net.status === 'offline' ? 'SERVIDOR NAO ENCONTRADO' : !rows ? 'CARREGANDO...' : rows.length ? '' : 'NENHUMA PARTIDA ONLINE AINDA';
    if (message) ctxText(ctx, message, Math.round(VIEW.width / 2 - textWidth(message) / 2), top + 60, COLOR.text);
    (rows ?? []).slice(0, RANKING_ROWS).forEach((row, i) => {
      const y = top + 16 + i * 16;
      ctxText(ctx, `${i + 1}.`, RANKING_PANEL.x + 14, y, COLOR.selected);
      ctxText(ctx, row.name, RANKING_PANEL.x + 40, y, COLOR.text);
      [row.trophies, row.gold, row.silver, row.bronze, row.kills, row.average.toFixed(1), row.matches].forEach((value, column) => {
        ctxText(ctx, String(value), RANKING_PANEL.x + RANKING_COLUMNS[column + 1].x, y, COLOR.text);
      });
    });
  }

  function drawRanking(ctx) {
    if (showingOnline) {
      drawOnlineRanking(ctx);
      drawButton(ctx, RANKING_TAB, 'MINHAS CORRIDAS', inside(RANKING_TAB, pointer.x, pointer.y));
      drawButton(ctx, RANKING_BACK, '< VOLTAR', inside(RANKING_BACK, pointer.x, pointer.y));
      return;
    }
    panelBox(ctx, PANEL);
    heading(ctx, 'MINHAS CORRIDAS');
    const columns = [PANEL.x + 24, PANEL.x + 90, PANEL.x + 190, PANEL.x + 290], top = PANEL.y + 44;
    ['', 'POSICAO', 'TEMPO', 'ABATES'].forEach((label, i) => ctxText(ctx, label, columns[i], top, COLOR.muted));
    if (!results.length) ctxText(ctx, 'NENHUMA CORRIDA CONCLUIDA', Math.round(VIEW.width / 2 - textWidth('NENHUMA CORRIDA CONCLUIDA') / 2), top + 60, COLOR.text);
    results.forEach(({ position, racers = MAX_RACERS, time, kills }, i) => {
      const y = top + 16 + i * 17;
      ctxText(ctx, String(i + 1), columns[0], y, COLOR.selected);
      ctxText(ctx, `${position} DE ${racers}`, columns[1], y, COLOR.text);
      ctxText(ctx, formatTime(time), columns[2], y, COLOR.text);
      ctxText(ctx, String(kills), columns[3], y, COLOR.text);
    });
    drawButton(ctx, RANKING_TAB, 'MULTIPLAYER', inside(RANKING_TAB, pointer.x, pointer.y));
    drawButton(ctx, RANKING_BACK, '< VOLTAR', inside(RANKING_BACK, pointer.x, pointer.y));
  }

  function drawBye(ctx) {
    panelBox(ctx, PANEL);
    heading(ctx, 'ATE LOGO');
    const message = 'PODE FECHAR ESTA ABA';
    ctxText(ctx, message, Math.round(VIEW.width / 2 - textWidth(message) / 2), PANEL.y + 110, COLOR.text);
    drawBack(ctx);
  }

  const pages = { main: drawMain, settings: drawSettings, ranking: drawRanking, bye: drawBye };
  screen.draw = ctx => pages[page](ctx);
  screen.update = () => {
    if (!queued) return;
    queued();
    queued = null;
  };
  screen.open = () => {
    screen.isOpen = true;
    page = 'main';
  };
  return screen;
}
