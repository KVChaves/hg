import { MAX_RACERS, VIEW } from '../config.js';
import { ctxText, textWidth } from '../art/font.js';
import { PATCH_NOTES } from './patchNotes.js';
import { BIOMES } from '../world/biomes/index.js';
import { ACTIONS, codeLabel, defaultBindings, saveSettings, SETTINGS_RANGE } from '../game/settings.js';
import { QUALITY, QUALITY_LEVELS } from '../game/quality.js';
import { WEAPON_TYPES } from '../game/weaponTypes.js';
import { chamferRect, COLOR, drawButton, drawHeading, drawLogo, drawRowStripe, drawRule, drawSlider, inside, markClickable, MEDALS, outline, panelBox, pointerOnStage } from './panelKit.js';

// Menu inicial: Singleplayer, Multiplayer, Garagem, Ranking, Configurações e Sair.

const BUTTON = { x: 24, y: 112, width: 176, height: 30, gap: 8 };
// Jogar em destaque, depois o resto do menu e, por último, sair: altura, largura e escala do texto de cada grupo.
const TIERS = { play: { height: 30, width: 190, scale: 2, gap: 6 }, more: { height: 22, width: 168, scale: 1, gap: 5 }, quit: { height: 18, width: 120, scale: 1, gap: 0 } };
const TIER_GAP = 12;
const PANEL = { x: 130, y: 44, width: 380, height: 272 };
const BACK = { x: 245, y: 278, width: 150, height: 28 };
const SETTINGS_BACK = { x: 170, y: 278, width: 145, height: 28 };
const CONTROLS_BUTTON = { x: 325, y: 278, width: 145, height: 28 };
// Tela de controles: duas colunas de ações, cada uma com dois botões de tecla.
const CONTROLS_ROWS = 8, CONTROLS_COLUMN = { x: [46, 328], firstY: 64, gap: 26, labelWidth: 130, slotWidth: 68, slotGap: 4, height: 18 };
const CONTROLS_BACK = { x: 160, y: 302, width: 150, height: 26 };
const CONTROLS_RESET = { x: 330, y: 302, width: 150, height: 26 };
const slotBox = (index, slot) => ({
  x: CONTROLS_COLUMN.x[Math.floor(index / CONTROLS_ROWS)] + CONTROLS_COLUMN.labelWidth + slot * (CONTROLS_COLUMN.slotWidth + CONTROLS_COLUMN.slotGap),
  y: CONTROLS_COLUMN.firstY + (index % CONTROLS_ROWS) * CONTROLS_COLUMN.gap, width: CONTROLS_COLUMN.slotWidth, height: CONTROLS_COLUMN.height,
});
const SLIDER = { x: 170, width: 300, height: 12, firstY: 88, gap: 38 };
const RANKING_PANEL = { x: 30, y: 28, width: 580, height: 268 };
const RANKING_TABS = [
  { view: 'ranking', label: 'RANKING', x: 230, y: 34, width: 116, height: 22 },
  { view: 'history', label: 'HISTORICO', x: 350, y: 34, width: 116, height: 22 },
  { view: 'stats', label: 'ESTATISTICAS', x: 470, y: 34, width: 116, height: 22 },
];
const RANKING_TITLES = { ranking: 'RANKING', history: 'HISTORICO', stats: 'ESTATISTICAS' };
const RANKING_BACK = { x: 245, y: 302, width: 150, height: 26 };
const RANKING_ROWS = 13;
const HELP_BUTTON = { x: 588, y: 274, width: 16, height: 16 };       // "?" no canto inferior direito do bloco: abre/fecha a explicação da pontuação
const HELP_PANEL = { x: 44, y: 62, width: 552 };
const HELP_LINE = 11;
const HELP_TEXT = [
  { text: 'COMO FUNCIONA A PONTUACAO', kind: 'title' },
  { text: 'CADA CORRIDA RENDE UMA NOTA DE 0 A 1 CONFORME A SUA POSICAO: QUEM CHEGA EM 1 TIRA 1, QUEM CHEGA EM ULTIMO TIRA 0 E OS OUTROS FICAM NO MEIO, PROPORCIONAL AO NUMERO DE CORREDORES.' },
  { text: 'DESEMP. E A MEDIA DAS NOTAS DE TODAS AS SUAS CORRIDAS, NUMA ESCALA DE 0 A 100. 50 E O DESEMPENHO MEDIO.' },
  { text: 'SO GANHA POSICAO NO RANKING QUEM TEM 5 CORRIDAS OU MAIS. ANTES DISSO O JOGADOR APARECE EM CINZA COM O CONTADOR (EX: 3/5), SEM CLASSIFICACAO.' },
  { text: 'A ORDEM E PELO DESEMP. EM EMPATE, GANHA QUEM TEM MAIS VITORIAS E DEPOIS MAIS CORRIDAS.' },
  { text: 'SO CONTAM PARTIDAS ONLINE SEM BOTS E COM PELO MENOS 3 JOGADORES. PODIOS, POS MEDIA, ABATES E PARTIDAS SO INFORMAM, NAO ENTRAM NA NOTA.' },
];
const RANKING_COLUMNS = [
  { label: 'JOGADOR', x: 40 }, { label: 'DESEMP.', x: 140, color: '#f0c840' }, { label: 'CORRIDAS', x: 196 }, { label: 'VITORIAS', x: 258 },
  { label: 'PODIOS', x: 322 }, { label: 'POS MEDIA', x: 372 }, { label: 'ABATES', x: 440 }, { label: 'PARTIDAS', x: 492 },
];
// Estatísticas: seletor de jogador no topo (setas e nome), geral à esquerda, mapas e confrontos à direita.
const STATS_PREV = { x: 46, y: 68, width: 18, height: 16 };
const STATS_NAME = { x: 68, y: 68, width: 150, height: 16 };
const STATS_NEXT = { x: 222, y: 68, width: 18, height: 16 };
const STATS_PAGES = [
  { page: 'general', label: 'GERAL', x: 424, y: 68, width: 48, height: 16 },
  { page: 'combat', label: 'COMBATE', x: 475, y: 68, width: 58, height: 16 },
  { page: 'positions', label: 'POSICOES', x: 536, y: 68, width: 66, height: 16 },
];
const KILL_CAUSE_LABELS = [['shot', 'TIRO'], ['ram', 'PANCADA'], ['fire', 'FOGO'], ['splash', 'EXPLOSAO'], ['other', 'OUTROS']];
const POSITION_COLUMNS = { place: 120, count: 200, share: 270, bar: 330, barWidth: 190 };   // página POSICOES das estatísticas
const BEST_COLOR = '#6fe070';   // estatística em que o jogador é o melhor de todos
const WORST_COLOR = '#ff5a4a';  // e em que é o pior
const STATS_TOP = 98, STATS_LINE = 13, STATS_LEFT = 46, STATS_LEFT_VALUE = 196, STATS_RIGHT = 318, STATS_RIGHT_VALUE = 410;
const biomeLabel = id => BIOMES.find(biome => biome.id === id)?.name ?? String(id || '-').toUpperCase();
const HISTORY_COLUMNS = [{ label: 'DATA', x: 14 }, { label: 'BIOMA', x: 82 }, { label: 'VENCEDOR', x: 150 }, { label: 'TEMPO', x: 246 }, { label: 'HUMANOS', x: 290 }];
const MATCH_BUTTON = { x: 46, y: 268, width: 150, height: 24 };
// Histórico: seletor de jogador (setas e nome; sem filtro mostra TODOS) na faixa entre as abas e a tabela.
const FILTER_PREV = { x: 46, y: 57, width: 18, height: 13 };
const FILTER_NAME = { x: 68, y: 57, width: 150, height: 13 };
const FILTER_NEXT = { x: 222, y: 57, width: 18, height: 13 };
const MATCH_POINTS = [3, 1.5, 1];                    // mesmo peso do campeonato: ouro, prata e bronze
const TITLE_SCALE = 4;
const NOTES_PANEL = { x: 30, y: 28, width: 580, height: 268 };
const NOTES_BACK = { x: 245, y: 302, width: 150, height: 26 };
const NOTES_VIEW = { x: 44, y: 78, width: 552, height: 210 };   // área que rola (o texto é cortado nela)
const NOTES_LINE = 11, NOTES_WRAP = 86;                          // altura da linha e caracteres por linha

const SLIDERS = [
  { key: 'menuMusic', label: 'MUSICA DO MENU' },
  { key: 'music', label: 'MUSICA DA CORRIDA' },
  { key: 'effects', label: 'EFEITOS SONOROS' },
  { key: 'sensitivity', label: 'SENSIBILIDADE DA CAMERA' },
];
// Qualidade gráfica: três botões lado a lado, na linha abaixo do último ajuste.
const QUALITY_ROW = { y: SLIDER.firstY + SLIDERS.length * SLIDER.gap - 4, height: 18, gap: 6 };
const qualityBox = index => {
  const width = (SLIDER.width - QUALITY_ROW.gap * (QUALITY_LEVELS.length - 1)) / QUALITY_LEVELS.length;
  return { x: SLIDER.x + index * (width + QUALITY_ROW.gap), y: QUALITY_ROW.y, width, height: QUALITY_ROW.height };
};
const sliderBox = index => ({ x: SLIDER.x, y: SLIDER.firstY + index * SLIDER.gap, width: SLIDER.width, height: SLIDER.height });

// Jogadores conectados, no canto de cima à direita do menu: ícone de pessoa (pixel art) e o número.
const ONLINE_BADGE = { right: VIEW.width - 12, y: 10, height: 17, padding: 5, gap: 4 };
const PERSON_ICON = ['..###..', '.#####.', '.#####.', '..###..', '.......', '.#####.', '#######', '#######', '#######'];

function drawPerson(ctx, x, y, color) {
  ctx.fillStyle = color;
  PERSON_ICON.forEach((row, j) => [...row].forEach((cell, i) => { if (cell === '#') ctx.fillRect(x + i, y + j, 1, 1); }));
}

const formatTime = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export function createMainMenu({ stage, settings, net, getName = () => '', onSingleplayer, onMultiplayer, onGarage, onSettingChange, onEffectsPreview, onQuit }) {
  let page = 'main', helpOpen = false, notesScroll = 0, pointer = { x: -1, y: -1 }, dragging = null, rebinding = null, swallowClick = false, queued = null, view = 'ranking', selectedRace = null, viewingMatch = null, historyFilter = null, historyScroll = 0, statsPlayer = null, statsPage = 'general';

  const screen = { isOpen: true, isRebinding: () => rebinding !== null };

  function setPage(next) {
    if (next === 'ranking') {
      view = 'ranking';
      selectedRace = viewingMatch = historyFilter = null;
      historyScroll = 0;
      net.requestRanking();
      net.requestHistory();
    }
    page = next;
    helpOpen = false;
    rebinding = null;
  }

  let nextY = BUTTON.y - 10, lastTier = null;
  const entries = [
    // Trocar de tela só no próximo quadro evita que este clique acione também a tela seguinte.
    { tier: 'play', label: 'SINGLEPLAYER', action: () => { queued = () => { screen.isOpen = false; onSingleplayer(); }; } },
    { tier: 'play', label: 'MULTIPLAYER', action: () => { queued = () => { screen.isOpen = false; onMultiplayer(); }; } },
    { tier: 'more', label: 'GARAGEM', action: () => { queued = () => { screen.isOpen = false; onGarage(); }; } },
    { tier: 'more', label: 'RANKING', action: () => setPage('ranking') },
    { tier: 'more', label: 'PATCH NOTES', action: () => { notesScroll = 0; setPage('notes'); } },
    { tier: 'more', label: 'CONFIGURACOES', action: () => setPage('settings') },
    { tier: 'quit', label: 'SAIR', action: () => { setPage('bye'); onQuit(); } },
  ].map(entry => {
    const tier = TIERS[entry.tier];
    if (lastTier && lastTier !== entry.tier) nextY += TIER_GAP;
    const box = { ...entry, x: BUTTON.x, y: nextY, width: tier.width, height: tier.height, scale: tier.scale };
    nextY += tier.height + tier.gap;
    lastTier = entry.tier;
    return box;
  });

  function dragTo(x) {
    const { key } = SLIDERS[dragging], [low, high] = SETTINGS_RANGE[key];
    const t = Math.max(0, Math.min(1, (x - SLIDER.x) / SLIDER.width));
    settings[key] = low + (high - low) * t;
    onSettingChange(key, settings[key]);
  }

  // Trocar uma tecla: o próximo botão (teclado ou mouse) vira o novo; ESC cancela e BACKSPACE/DELETE deixa o espaço vazio.
  // Se a tecla já era de outra ação, as duas trocam de lugar.
  function assignBinding(code) {
    const { action, slot } = rebinding, { bindings } = settings, previous = bindings[action][slot];
    rebinding = null;
    if (code) for (const other of ACTIONS) other && bindings[other.id].forEach((used, i) => {
      if (used === code && !(other.id === action && i === slot)) bindings[other.id][i] = previous;
    });
    bindings[action][slot] = code;
    saveSettings(settings);
  }
  addEventListener('keydown', e => {
    if (!rebinding) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat) return;
    if (e.code === 'Escape') rebinding = null;
    else assignBinding(e.code === 'Backspace' || e.code === 'Delete' ? '' : e.code);
  }, true);
  addEventListener('mousedown', e => {
    if (!rebinding) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    swallowClick = true;                             // o clique que vem depois não deve apertar o botão que estiver embaixo
    assignBinding(`Mouse${e.button}`);
  }, true);

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
  stage.addEventListener('wheel', e => {
    if (!screen.isOpen) return;
    const history = page === 'ranking' && view === 'history' && !selectedRace && !viewingMatch;
    if (page !== 'notes' && !history) return;
    e.preventDefault();
    if (history) historyScroll = Math.max(0, Math.min(historyMax(), historyScroll + Math.sign(e.deltaY) * 3));
    else notesScroll = Math.max(0, Math.min(notesMax(), notesScroll + Math.sign(e.deltaY) * NOTES_LINE * 3));
  }, { passive: false });
  stage.addEventListener('click', e => {
    if (!screen.isOpen) return;
    if (swallowClick) { swallowClick = false; return; }
    const { x, y } = pointerOnStage(e, stage);
    if (page === 'main') entries.find(entry => inside(entry, x, y))?.action();
    else if (page === 'settings' && QUALITY_LEVELS.some((_, i) => inside(qualityBox(i), x, y))) {
      settings.quality = QUALITY_LEVELS.find((_, i) => inside(qualityBox(i), x, y));
      onSettingChange('quality', settings.quality);
      saveSettings(settings);
    }
    else if (page === 'settings' && inside(CONTROLS_BUTTON, x, y)) setPage('controls');
    else if (page === 'settings' && inside(SETTINGS_BACK, x, y)) setPage('main');
    else if (page === 'controls') clickControls(x, y);
    else if (page === 'notes' && inside(NOTES_BACK, x, y)) setPage('main');
    else if (page === 'ranking' && RANKING_TABS.some(tab => inside(tab, x, y))) {
      view = RANKING_TABS.find(tab => inside(tab, x, y)).view;
      selectedRace = viewingMatch = null;
      helpOpen = false;
      if (view === 'stats') showStats(net.stats?.name ?? statsPlayer ?? getName());
    } else if (page === 'ranking' && view === 'ranking' && inside(HELP_BUTTON, x, y)) {
      helpOpen = !helpOpen;
    } else if (inside(page === 'ranking' ? RANKING_BACK : BACK, x, y)) {
      if (page === 'ranking' && viewingMatch) viewingMatch = null;        // voltar fecha, um nível por vez: partida, corrida, lista
      else if (page === 'ranking' && selectedRace) selectedRace = null;
      else setPage('main');
    } else if (page === 'ranking' && view === 'history') clickHistory(x, y);
    else if (page === 'ranking' && view === 'stats') clickStats(x, y);
    else if (page === 'ranking' && view === 'ranking' && !helpOpen) {
      const row = (net.ranking ?? []).slice(0, RANKING_ROWS).find((_, i) => inside(historyRowBox(i), x, y));
      if (row) { view = 'stats'; showStats(row.name); }              // clicar num jogador abre as estatísticas dele
    }
  });

  function showStats(name) {
    statsPlayer = name;
    net.requestStats(name ?? '');
  }

  // Setas trocam o jogador, dando a volta na lista; clicar no nome volta para você.
  function clickStats(x, y) {
    const page = STATS_PAGES.find(box => inside(box, x, y));
    if (page) { statsPage = page.page; return; }
    const players = net.statsPlayers ?? [], current = net.stats?.name ?? statsPlayer ?? '';
    if (inside(STATS_NAME, x, y) && getName()) { showStats(getName()); return; }
    const step = inside(STATS_PREV, x, y) ? -1 : inside(STATS_NEXT, x, y) ? 1 : 0;
    if (!step || !players.length) return;
    const index = players.findIndex(name => name.toLowerCase() === current.toLowerCase());
    showStats(players[((index < 0 ? 0 : index + step) % players.length + players.length) % players.length]);
  }

  function clickControls(x, y) {
    if (inside(CONTROLS_BACK, x, y)) { setPage('settings'); return; }
    if (inside(CONTROLS_RESET, x, y)) { Object.assign(settings.bindings, defaultBindings()); saveSettings(settings); rebinding = null; return; }
    ACTIONS.forEach(({ id }, index) => [0, 1].forEach(slot => { if (inside(slotBox(index, slot), x, y)) rebinding = { action: id, slot }; }));
  }

  function setHistoryFilter(name) {
    historyFilter = name;
    historyScroll = 0;
    selectedRace = null;
    net.requestHistory(name ?? '');
  }

  function clickHistory(x, y) {
    if (viewingMatch) return;
    if (selectedRace) {
      if (selectedRace.match && inside(MATCH_BUTTON, x, y)) { viewingMatch = selectedRace.match; net.requestMatch(viewingMatch); return; }
      const racer = selectedRace.racers.slice(0, MAX_RACERS).find((candidate, i) => candidate.human && inside(detailNameBox(i), x, y));
      if (racer) setHistoryFilter(racer.name);                          // clicar num nome filtra o histórico por ele
      return;
    }
    if (historyFilter && inside(FILTER_NAME, x, y)) { setHistoryFilter(null); return; }
    const step = inside(FILTER_PREV, x, y) ? -1 : inside(FILTER_NEXT, x, y) ? 1 : 0;
    if (step) { stepHistoryFilter(step); return; }
    const index = visibleRaces().findIndex((_, i) => inside(historyRowBox(i), x, y));
    if (index >= 0) selectedRace = visibleRaces()[index];
  }

  // As setas percorrem TODOS e cada jogador do histórico, dando a volta.
  function stepHistoryFilter(step) {
    const options = [null, ...net.historyPlayers];
    if (options.length < 2) return;
    const index = Math.max(0, options.findIndex(name => name?.toLowerCase() === historyFilter?.toLowerCase()));
    setHistoryFilter(options[(index + step + options.length) % options.length]);
  }

  const historyMax = () => Math.max(0, (net.history?.length ?? 0) - RANKING_ROWS);
  const visibleRaces = () => (net.history ?? []).slice(historyScroll, historyScroll + RANKING_ROWS);

  // Logo inclinado e, embaixo, a faixa de corrida em três tons.
  function drawTitle(ctx) {
    drawLogo(ctx, 'CTI RACERS 2', BUTTON.x, 46, TITLE_SCALE);
    const y = 46 + 7 * TITLE_SCALE + 8, width = textWidth('CTI RACERS 2', TITLE_SCALE);
    [[COLOR.selected, 0, width], [COLOR.ember, 4, width - 30], [COLOR.rust, 8, width - 70]].forEach(([color, dy, length], i) => {
      ctx.fillStyle = color;
      ctx.fillRect(BUTTON.x + i * 6, y + dy, length, 2);
    });
  }

  function drawBack(ctx, label = '< VOLTAR', box = BACK) {
    drawButton(ctx, box, label, inside(box, pointer.x, pointer.y));
  }

  function heading(ctx, text) {
    drawHeading(ctx, text, VIEW.width / 2, PANEL.y + 14);
  }

  // Sem conexão o ícone fica apagado e o número vira um traço.
  function drawOnlineCount(ctx) {
    const online = net.status === 'online' && Number.isFinite(net.online);
    const label = online ? String(net.online) : '-', color = online ? COLOR.selected : COLOR.muted;
    const { right, y, height, padding, gap } = ONLINE_BADGE, iconWidth = PERSON_ICON[0].length;
    const width = padding * 2 + iconWidth + gap + textWidth(label), x = right - width;
    chamferRect(ctx, { x, y, width, height }, 2, COLOR.edge);
    chamferRect(ctx, { x: x + 1, y: y + 1, width: width - 2, height: height - 2 }, 1, COLOR.panel);
    drawPerson(ctx, x + padding, y + (height - PERSON_ICON.length) / 2 | 0, color);
    ctxText(ctx, label, x + padding + iconWidth + gap, y + (height - 7) / 2 | 0, online ? COLOR.text : COLOR.muted);
  }

  function drawMain(ctx) {
    drawTitle(ctx);
    drawOnlineCount(ctx);
    for (const entry of entries) {
      const hovered = inside(entry, pointer.x, pointer.y);
      if (entry.tier === 'quit') drawButton(ctx, entry, entry.label, hovered, 'danger');
      else drawButton(ctx, entry, entry.label, hovered, { style: 'menu', scale: entry.scale });
    }
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
      drawSlider(ctx, box, t, dragging === i || inside({ ...box, y: box.y - 6, height: box.height + 12 }, pointer.x, pointer.y));
    });
    ctxText(ctx, 'QUALIDADE GRAFICA', SLIDER.x, QUALITY_ROW.y - 14, COLOR.text);
    QUALITY_LEVELS.forEach((level, i) => {
      const box = qualityBox(i);
      drawButton(ctx, box, QUALITY[level].label, inside(box, pointer.x, pointer.y), { style: 'tab', active: settings.quality === level });
    });
    drawBack(ctx, '< VOLTAR', SETTINGS_BACK);
    drawButton(ctx, CONTROLS_BUTTON, 'CONTROLES', inside(CONTROLS_BUTTON, pointer.x, pointer.y));
  }

  function drawControls(ctx) {
    panelBox(ctx, RANKING_PANEL);
    drawHeading(ctx, 'CONTROLES', VIEW.width / 2, RANKING_PANEL.y + 14);
    ACTIONS.forEach(({ id, label }, index) => {
      const first = slotBox(index, 0);
      ctxText(ctx, label, first.x - CONTROLS_COLUMN.labelWidth, first.y + 6, COLOR.text);
      [0, 1].forEach(slot => {
        const box = slotBox(index, slot), waiting = rebinding?.action === id && rebinding.slot === slot;
        const text = waiting ? (Math.floor(performance.now() / 400) % 2 ? '...' : 'APERTE') : codeLabel(settings.bindings[id][slot]);
        drawButton(ctx, box, text, inside(box, pointer.x, pointer.y), { style: 'tab', active: waiting });
      });
    });
    const hint = rebinding ? 'APERTE UMA TECLA OU BOTAO DO MOUSE. ESC CANCELA, BACKSPACE LIMPA.' : 'CLIQUE NUM BOTAO E APERTE A NOVA TECLA. CADA ACAO TEM DUAS TECLAS.';
    ctxText(ctx, hint, Math.round(VIEW.width / 2 - textWidth(hint) / 2), RANKING_PANEL.y + RANKING_PANEL.height - 26, COLOR.muted);
    drawBack(ctx, '< VOLTAR', CONTROLS_BACK);
    drawButton(ctx, CONTROLS_RESET, 'RESTAURAR PADRAO', inside(CONTROLS_RESET, pointer.x, pointer.y));
  }

  // Tabela de jogadores: `cells` devolve o texto de cada coluna (menos a do nome) de uma linha.
  function drawPlayerTable(ctx, columns, rows, cells, emptyMessage) {
    const top = RANKING_PANEL.y + 44;
    columns.forEach(({ label, x, color }) => ctxText(ctx, label, RANKING_PANEL.x + x, top, color ?? COLOR.muted));
    drawRule(ctx, RANKING_PANEL.x + 8, top + 10, RANKING_PANEL.width - 16);
    const message = net.status === 'offline' ? 'SERVIDOR NAO ENCONTRADO' : !rows ? 'CARREGANDO...' : rows.length ? '' : emptyMessage;
    if (message) ctxText(ctx, message, Math.round(VIEW.width / 2 - textWidth(message) / 2), top + 60, COLOR.text);
    (rows ?? []).slice(0, RANKING_ROWS).forEach((row, i) => {
      const y = top + 16 + i * 16;
      const unranked = row.ranked === false;       // poucas partidas: aparece, mas sem posição
      const box = { x: RANKING_PANEL.x + 8, y: y - 4, width: RANKING_PANEL.width - 16, height: 16 };
      markClickable(box);                          // clicar abre as estatísticas do jogador
      drawRowStripe(ctx, box, i, !helpOpen && inside(box, pointer.x, pointer.y));
      ctxText(ctx, unranked ? `${row.races}/${row.minRaces}` : `${i + 1}.`, RANKING_PANEL.x + 14, y, unranked ? COLOR.muted : MEDALS[i] ?? COLOR.selected);
      ctxText(ctx, row.name, RANKING_PANEL.x + 40, y, unranked ? COLOR.muted : COLOR.text);
      cells(row).forEach((value, column) => {
        const { x, color } = columns[column + 1];
        ctxText(ctx, String(value), RANKING_PANEL.x + x, y, unranked ? COLOR.muted : color ?? COLOR.text);
      });
    });
  }

  // Quando a corrida terminou, no fuso de quem olha o ranking.
  function formatDate(iso) {
    const date = new Date(iso), two = value => String(value).padStart(2, '0');
    return Number.isNaN(date.getTime()) ? '-' : `${two(date.getDate())}/${two(date.getMonth() + 1)} ${two(date.getHours())}:${two(date.getMinutes())}`;
  }

  function fit(text, width) {
    while (text.length > 1 && textWidth(text) > width) text = text.slice(0, -1);
    return text;
  }

  const historyRowBox = i => ({ x: RANKING_PANEL.x + 8, y: RANKING_PANEL.y + 44 + 16 + i * 16 - 4, width: RANKING_PANEL.width - 16, height: 16 });
  const detailNameBox = i => ({ x: RANKING_PANEL.x + 62, y: RANKING_PANEL.y + 44 + 42 + i * 18 - 4, width: 150, height: 16 });

  // Detalhe de uma corrida do histórico: a posição e o tempo de cada piloto. Clicar num nome filtra o histórico por ele.
  function drawRaceDetail(ctx, race) {
    const left = RANKING_PANEL.x + 16, top = RANKING_PANEL.y + 44;
    ctxText(ctx, `${formatDate(race.at)}   ${String(race.biome || '-').toUpperCase()}   SALA ${race.room}${race.n ? `   CORRIDA ${race.n}` : ''}`, left, top, COLOR.muted);
    ctxText(ctx, 'POS', left, top + 24, COLOR.muted);
    ctxText(ctx, 'JOGADOR', left + 50, top + 24, COLOR.muted);
    ctxText(ctx, 'TEMPO', left + 200, top + 24, COLOR.muted);
    race.racers.slice(0, MAX_RACERS).forEach((racer, i) => {
      const y = top + 42 + i * 18, color = racer.position === 1 ? COLOR.selected : COLOR.text, box = detailNameBox(i);
      if (racer.human) {
        markClickable(box);
        if (inside(box, pointer.x, pointer.y)) drawRowStripe(ctx, box, i, true);
      }
      ctxText(ctx, `${racer.position}`, left, y, color);
      ctxText(ctx, fit(racer.name + (racer.human ? '' : ' (SAIU)'), 140), left + 50, y, color);
      ctxText(ctx, racer.time == null ? '-' : formatTime(racer.time), left + 200, y, color);
    });
    ctxText(ctx, 'CLIQUE NO NOME PARA VER AS CORRIDAS DO JOGADOR', left, MATCH_BUTTON.y - 12, COLOR.muted);
    if (race.match) drawButton(ctx, MATCH_BUTTON, 'VER A PARTIDA', inside(MATCH_BUTTON, pointer.x, pointer.y));
  }

  // Resultado de uma partida: a posição de cada jogador em cada corrida e os pontos de medalha somados.
  function drawMatchSummary(ctx) {
    const left = RANKING_PANEL.x + 16, top = RANKING_PANEL.y + 44, races = net.matchRaces;
    if (!races) { ctxText(ctx, net.status === 'online' ? 'CARREGANDO...' : 'SERVIDOR NAO ENCONTRADO', left, top + 40, COLOR.text); return; }
    ctxText(ctx, `${races.length} CORRIDAS   SALA ${races[0]?.room ?? '-'}`, left, top, COLOR.muted);
    const totals = new Map();
    races.forEach(race => race.racers.forEach(racer => {
      const entry = totals.get(racer.name) ?? { name: racer.name, positions: [], points: 0 };
      entry.positions.push(racer.position);
      entry.points += MATCH_POINTS[racer.position - 1] ?? 0;
      totals.set(racer.name, entry);
    }));
    ctxText(ctx, 'JOGADOR', left + 24, top + 24, COLOR.muted);
    ctxText(ctx, 'POSICOES', left + 150, top + 24, COLOR.muted);
    ctxText(ctx, 'PONTOS', left + 470, top + 24, COLOR.muted);
    [...totals.values()].sort((a, b) => b.points - a.points).slice(0, MAX_RACERS).forEach((entry, i) => {
      const y = top + 42 + i * 18, color = i === 0 ? COLOR.selected : COLOR.text;
      ctxText(ctx, `${i + 1}.`, left, y, color);
      ctxText(ctx, fit(entry.name, 120), left + 24, y, color);
      ctxText(ctx, fit(entry.positions.join('  '), 300), left + 150, y, color);
      ctxText(ctx, String(entry.points), left + 470, y, color);
    });
  }

  // Histórico do multiplayer: todas as corridas, a mais nova primeiro, com o vencedor e a posição de cada humano.
  function drawHistory(ctx) {
    panelBox(ctx, RANKING_PANEL);
    if (viewingMatch) return drawMatchSummary(ctx);
    if (selectedRace) return drawRaceDetail(ctx, selectedRace);
    const top = RANKING_PANEL.y + 44;
    historyScroll = Math.min(historyScroll, historyMax());
    drawHistoryFilter(ctx);
    HISTORY_COLUMNS.forEach(({ label, x }) => ctxText(ctx, label, RANKING_PANEL.x + x, top, COLOR.muted));
    drawRule(ctx, RANKING_PANEL.x + 8, top + 10, RANKING_PANEL.width - 16);
    const races = net.history;
    const message = net.status === 'offline' ? 'SERVIDOR NAO ENCONTRADO' : !races ? 'CARREGANDO...' : races.length ? '' : 'NENHUMA CORRIDA ONLINE AINDA';
    if (message) ctxText(ctx, message, Math.round(VIEW.width / 2 - textWidth(message) / 2), top + 60, COLOR.text);
    visibleRaces().forEach((race, i) => {
      const y = top + 16 + i * 16, winner = race.racers[0], humans = race.racers.filter(racer => racer.human);
      const cells = [
        formatDate(race.at), String(race.biome || '-').toUpperCase(), winner?.name ?? '-',
        winner?.time == null ? '-' : formatTime(winner.time), humans.map(racer => `${racer.position} ${racer.name}`).join('  '),
      ];
      const box = historyRowBox(i), hovered = inside(box, pointer.x, pointer.y);
      markClickable(box);
      drawRowStripe(ctx, box, i, hovered);
      cells.forEach((value, column) => {
        const { x } = HISTORY_COLUMNS[column], next = HISTORY_COLUMNS[column + 1]?.x ?? RANKING_PANEL.width - 8;
        ctxText(ctx, fit(value, next - x - 6), RANKING_PANEL.x + x, y, column === 0 ? COLOR.muted : COLOR.text);
      });
    });
    if (historyMax() > 0) {   // barra de rolagem
      const trackTop = top + 12, trackHeight = RANKING_ROWS * 16, thumb = Math.max(16, trackHeight * RANKING_ROWS / races.length);
      ctx.fillStyle = COLOR.rust;
      ctx.fillRect(RANKING_PANEL.x + RANKING_PANEL.width - 6, Math.round(trackTop + (trackHeight - thumb) * historyScroll / historyMax()), 3, Math.round(thumb));
    }
  }

  function drawHistoryFilter(ctx) {
    drawButton(ctx, FILTER_PREV, '<', inside(FILTER_PREV, pointer.x, pointer.y), { style: 'arrow' });
    drawButton(ctx, FILTER_NEXT, '>', inside(FILTER_NEXT, pointer.x, pointer.y), { style: 'arrow' });
    const hovered = Boolean(historyFilter) && inside(FILTER_NAME, pointer.x, pointer.y);
    if (historyFilter) markClickable(FILTER_NAME);
    drawRowStripe(ctx, FILTER_NAME, 0, hovered);
    const shown = fit(historyFilter?.toUpperCase() ?? 'TODOS', FILTER_NAME.width - 8);
    ctxText(ctx, shown, Math.round(FILTER_NAME.x + FILTER_NAME.width / 2 - textWidth(shown) / 2), FILTER_NAME.y + 3, COLOR.selected);
    const total = net.history?.length ?? 0;
    const count = !total ? '' : historyMax() ? `${historyScroll + 1}-${historyScroll + visibleRaces().length} DE ${total}   RODA DO MOUSE ROLA` : `${total} ${total === 1 ? 'CORRIDA' : 'CORRIDAS'}`;
    const hint = hovered ? 'CLIQUE PARA VER TODOS' : count;
    ctxText(ctx, hint, FILTER_NEXT.x + FILTER_NEXT.width + 10, FILTER_NAME.y + 3, COLOR.muted);
  }

  // Estatísticas de um jogador (só partidas rankeadas), com setas para ver as dos outros.
  function drawStats(ctx) {
    panelBox(ctx, RANKING_PANEL);
    const stats = net.stats, players = net.statsPlayers;
    const message = net.status === 'offline' ? 'SERVIDOR NAO ENCONTRADO' : !players ? 'CARREGANDO...' : !players.length ? 'NENHUMA CORRIDA RANKEADA AINDA' : '';
    if (message) { ctxText(ctx, message, Math.round(VIEW.width / 2 - textWidth(message) / 2), RANKING_PANEL.y + 104, COLOR.text); return; }

    const name = stats?.name ?? statsPlayer ?? '';
    const index = players.findIndex(player => player.toLowerCase() === name.toLowerCase());
    drawButton(ctx, STATS_PREV, '<', inside(STATS_PREV, pointer.x, pointer.y), { style: 'arrow' });
    drawButton(ctx, STATS_NEXT, '>', inside(STATS_NEXT, pointer.x, pointer.y), { style: 'arrow' });
    markClickable(STATS_NAME);
    const nameHover = inside(STATS_NAME, pointer.x, pointer.y);
    drawRowStripe(ctx, STATS_NAME, 0, nameHover);
    const shown = fit(name.toUpperCase(), STATS_NAME.width - 8);
    ctxText(ctx, shown, Math.round(STATS_NAME.x + STATS_NAME.width / 2 - textWidth(shown) / 2), STATS_NAME.y + 5, COLOR.selected);
    const hint = nameHover && getName() ? 'CLIQUE PARA VER AS SUAS' : `${index + 1}/${players.length}   SETAS TROCAM O JOGADOR`;
    ctxText(ctx, hint, STATS_NEXT.x + STATS_NEXT.width + 10, STATS_NAME.y + 5, COLOR.muted);
    drawRule(ctx, RANKING_PANEL.x + 8, STATS_TOP - 10, RANKING_PANEL.width - 16);
    for (const box of STATS_PAGES) drawButton(ctx, box, box.label, inside(box, pointer.x, pointer.y), { style: 'tab', active: box.page === statsPage });
    if (!stats) { ctxText(ctx, 'CARREGANDO...', STATS_LEFT, STATS_TOP + 20, COLOR.text); return; }
    if (statsPage === 'combat') { drawCombatStats(ctx, stats.combat, stats.best?.combat, stats.worst?.combat); return; }
    if (statsPage === 'positions') { drawPositionStats(ctx, stats.positions); return; }

    const percent = (part, whole) => (whole ? `${Math.round(100 * part / whole)}%` : '-');
    const rankColor = rankColors(stats.best?.general, stats.worst?.general);
    const general = [
      ['DESEMPENHO', stats.rating == null ? '-' : stats.rating.toFixed(1), 'rating'],
      ['CORRIDAS', stats.races, 'races'],
      ['VITORIAS', `${stats.wins}  (${percent(stats.wins, stats.races)})`, 'wins'],
      ['PODIOS', stats.podiumRate == null ? '-' : `${stats.podiumRate}%`, 'podiumRate'],
      ['POSICAO MEDIA', stats.average == null ? '-' : stats.average.toFixed(2), 'average'],
      ['ABATES', stats.kills, 'kills'],
      ['ABATES POR CORRIDA', stats.races ? (stats.kills / stats.races).toFixed(1) : '-', 'killsPerRace'],
      ['MAIOR SEQ. DE VITORIAS', stats.winStreak, 'winStreak'],
      ['MAIOR SEQ. DE PODIOS', stats.podiumStreak, 'podiumStreak'],
      ['ATRAS DO 1o (MEDIA)', stats.gap == null ? '-' : `${stats.gap.toFixed(1)} S`, 'gap'],
    ];
    ctxText(ctx, 'GERAL', STATS_LEFT, STATS_TOP, COLOR.selected);
    general.forEach(([label, value, key], i) => {
      const y = STATS_TOP + (i + 1) * STATS_LINE;
      ctxText(ctx, label, STATS_LEFT, y, COLOR.muted);
      ctxText(ctx, String(value), STATS_LEFT_VALUE, y, rankColor(key) ?? COLOR.text);
    });

    const mapLine = (row, detail) => (row ? fit(`${biomeLabel(row.biome)}  ${detail(row)}`, RANKING_PANEL.x + RANKING_PANEL.width - 12 - STATS_RIGHT_VALUE) : '-');
    const maps = [
      ['MELHOR MAPA', mapLine(stats.bestMap, row => row.rating.toFixed(0))],
      ['PIOR MAPA', mapLine(stats.worstMap, row => row.rating.toFixed(0))],
      ['MAIS JOGADO', mapLine(stats.mostPlayed, row => `${row.races}X`)],
    ];
    ctxText(ctx, 'MAPAS', STATS_RIGHT, STATS_TOP, COLOR.selected);
    maps.forEach(([label, value], i) => {
      const y = STATS_TOP + (i + 1) * STATS_LINE;
      ctxText(ctx, label, STATS_RIGHT, y, COLOR.muted);
      ctxText(ctx, value, STATS_RIGHT_VALUE, y, COLOR.text);
    });

    const duelTop = STATS_TOP + 5 * STATS_LINE;
    ctxText(ctx, 'CONFRONTO DIRETO', STATS_RIGHT, duelTop, COLOR.selected);
    ctxText(ctx, 'ADVERSARIO', STATS_RIGHT, duelTop + STATS_LINE, COLOR.muted);
    ctxText(ctx, 'JUNTOS', STATS_RIGHT_VALUE, duelTop + STATS_LINE, COLOR.muted);
    ctxText(ctx, 'NA FRENTE', STATS_RIGHT_VALUE + 56, duelTop + STATS_LINE, COLOR.muted);
    if (!stats.rivals.length) ctxText(ctx, '-', STATS_RIGHT, duelTop + 2 * STATS_LINE, COLOR.text);
    stats.rivals.forEach((rival, i) => {
      const y = duelTop + (i + 2) * STATS_LINE, ahead = rival.ahead * 2 > rival.races, behind = rival.ahead * 2 < rival.races;
      ctxText(ctx, fit(rival.name, STATS_RIGHT_VALUE - STATS_RIGHT - 8), STATS_RIGHT, y, COLOR.text);
      ctxText(ctx, String(rival.races), STATS_RIGHT_VALUE, y, COLOR.text);
      ctxText(ctx, `${rival.ahead} X ${rival.races - rival.ahead}`, STATS_RIGHT_VALUE + 56, y, ahead ? BEST_COLOR : behind ? WORST_COLOR : COLOR.text);
    });

    const footer = `SO PARTIDAS RANKEADAS${stats.last ? `   ULTIMA CORRIDA ${formatDate(stats.last)}` : ''}`;
    ctxText(ctx, footer, STATS_LEFT, RANKING_PANEL.y + RANKING_PANEL.height - 14, COLOR.muted);
  }

  // Página POSICOES: quantas vezes o jogador chegou em cada posição e que parte das corridas dele isso representa.
  function drawPositionStats(ctx, positions = []) {
    const total = positions.reduce((sum, count) => sum + count, 0);
    if (!total) {
      const message = 'SEM CORRIDAS NO HISTORICO AINDA';
      ctxText(ctx, message, Math.round(VIEW.width / 2 - textWidth(message) / 2), STATS_TOP + 50, COLOR.text);
      return;
    }
    const { place, count: countX, share, bar, barWidth } = POSITION_COLUMNS, most = Math.max(...positions);
    [['POSICAO', place], ['VEZES', countX], ['% DAS CORRIDAS', share]].forEach(([label, x]) => ctxText(ctx, label, x, STATS_TOP + 4, COLOR.muted));
    drawRule(ctx, place, STATS_TOP + 14, bar + barWidth - place);
    positions.forEach((times, i) => {
      const y = STATS_TOP + 22 + i * 17, color = times ? COLOR.text : COLOR.muted;
      drawRowStripe(ctx, { x: place - 6, y: y - 5, width: bar + barWidth - place + 12, height: 17 }, i);
      ctxText(ctx, `${i + 1}o`, place, y, MEDALS[i] ?? color);
      ctxText(ctx, String(times), countX, y, color);
      ctxText(ctx, `${(100 * times / total).toFixed(1)}%`, share, y, color);
      ctx.fillStyle = MEDALS[i] ?? COLOR.rust;
      ctx.fillRect(bar, y, Math.round(barWidth * times / most), 7);
    });
    const footer = `${total} ${total === 1 ? 'CORRIDA' : 'CORRIDAS'}   SO PARTIDAS RANKEADAS`;
    ctxText(ctx, footer, STATS_LEFT, RANKING_PANEL.y + RANKING_PANEL.height - 14, COLOR.muted);
  }

  // Cor de uma estatística em que o jogador é o melhor ou o pior de todos (undefined nas outras).
  function rankColors(best = [], worst = []) {
    return key => (best.includes(key) ? BEST_COLOR : worst.includes(key) ? WORST_COLOR : undefined);
  }

  // Linhas de rótulo, valor e chave opcional (a da comparação de melhor e pior). Linha com `header` vira título da seção.
  function drawStatLines(ctx, lines, x, valueX, rankColor = () => undefined) {
    lines.forEach((line, i) => {
      if (!line) return;
      const y = STATS_TOP + i * STATS_LINE;
      if (line.header) { ctxText(ctx, line.header, x, y, COLOR.selected); return; }
      ctxText(ctx, line[0], x, y, COLOR.muted);
      ctxText(ctx, String(line[1]), valueX, y, rankColor(line[2]) ?? COLOR.text);
    });
  }

  // Página COMBATE: tiro, armadilhas e liderança à esquerda; vítimas, carrascos e forma do abate à direita.
  function drawCombatStats(ctx, combat, best, worst) {
    const rankColor = rankColors(best, worst);
    if (!combat || (!combat.races && !combat.leadRaces)) {
      ['SEM DADOS DE COMBATE AINDA', 'CONTA A PARTIR DAS PROXIMAS CORRIDAS RANKEADAS'].forEach((text, i) =>
        ctxText(ctx, text, Math.round(VIEW.width / 2 - textWidth(text) / 2), STATS_TOP + 50 + i * 14, i ? COLOR.muted : COLOR.text));
      return;
    }
    const percent = (part, whole) => (whole ? `${Math.round(100 * part / whole)}%` : '-');
    const { races, leadRaces, favoriteWeapon } = combat;
    const favorite = favoriteWeapon ? fit(`${WEAPON_TYPES[favoriteWeapon.id]?.label ?? favoriteWeapon.id.toUpperCase()} ${favoriteWeapon.races}X`, STATS_RIGHT - STATS_LEFT_VALUE - 6) : '-';
    drawStatLines(ctx, [
      { header: 'TIRO E ABATES' },
      ['ABATES', combat.kills, 'kills'],
      ['ABATES PARA TRAS', combat.kills ? `${combat.backKills ?? 0}  (${percent(combat.backKills ?? 0, combat.kills)})` : '-', 'backKills'],
      ['MORTES', combat.deaths, 'deaths'],
      ['ABATES POR MORTE', combat.deaths ? (combat.kills / combat.deaths).toFixed(2) : combat.kills ? 'INVICTO' : '-', 'killDeath'],
      ['MIRA', combat.shots ? `${percent(combat.hits, combat.shots)}  (${combat.hits}/${combat.shots})` : '-', 'accuracy'],
      ['ARMA FAVORITA', favorite],
      ['ARMADILHAS SOLTAS', combat.trapsPlaced, 'trapsPlaced'],
      ['PEGARAM ALGUEM', combat.trapsPlaced ? `${combat.trapsScored}  (${percent(combat.trapsScored, combat.trapsPlaced)})` : '-', 'trapsScored'],
      ['CAIU EM ARMADILHA', combat.caught, 'caught'],
      { header: 'LIDERANCA' },
      ['TEMPO NA FRENTE', combat.leadShare == null ? '-' : `${combat.leadShare}%`, 'leadShare'],
      ['MEDIA POR CORRIDA', combat.leadAverage == null ? '-' : `${combat.leadAverage.toFixed(1)} S`, 'leadAverage'],
      ['PERDEU A PONTA', leadRaces ? `${combat.leadLost}  (${(combat.leadLost / leadRaces).toFixed(1)}/CORRIDA)` : '-', 'leadLost'],
    ], STATS_LEFT, STATS_LEFT_VALUE, rankColor);

    const people = list => [0, 1, 2].map(i => (list[i]
      ? [fit(list[i].name, STATS_RIGHT_VALUE - STATS_RIGHT + 40), `${list[i].count}X`]
      : i === 0 ? ['-', ''] : null));
    drawStatLines(ctx, [
      { header: 'VITIMAS FAVORITAS' }, ...people(combat.victims), null,
      { header: 'CARRASCOS' }, ...people(combat.killers), null,
      { header: 'FORMA DO ABATE' },
    ], STATS_RIGHT, STATS_RIGHT_VALUE + 60);
    const causes = KILL_CAUSE_LABELS.map(([id, label]) => `${label} ${combat.causes?.[id] ?? 0}`);
    ctxText(ctx, causes.slice(0, 3).join('   '), STATS_RIGHT, STATS_TOP + 11 * STATS_LINE, COLOR.text);
    ctxText(ctx, causes.slice(3).join('   '), STATS_RIGHT, STATS_TOP + 12 * STATS_LINE, COLOR.text);

    const streakY = STATS_TOP + 13 * STATS_LINE;
    ctxText(ctx, 'MAIOR SEQ. NA CORRIDA', STATS_RIGHT, streakY, COLOR.muted);
    ctxText(ctx, String(combat.killStreak ?? 0), STATS_RIGHT_VALUE + 100, streakY, rankColor('killStreak') ?? COLOR.text);

    const footer = `${races} ${races === 1 ? 'CORRIDA' : 'CORRIDAS'} COM DADOS DE COMBATE   SO PARTIDAS RANKEADAS`;
    ctxText(ctx, footer, STATS_LEFT, RANKING_PANEL.y + RANKING_PANEL.height - 14, COLOR.muted);
  }

  function drawRanking(ctx) {
    if (view === 'history') drawHistory(ctx);
    else if (view === 'stats') drawStats(ctx);
    else {
      panelBox(ctx, RANKING_PANEL);
      drawPlayerTable(ctx, RANKING_COLUMNS, net.ranking, row => [row.rating.toFixed(1), row.races, row.wins, `${row.podiumRate}%`, row.average.toFixed(1), row.kills, row.matches], 'NENHUMA CORRIDA RANKEADA AINDA');
    }
    drawHeading(ctx, view === 'history' ? (viewingMatch ? 'PARTIDA' : selectedRace ? 'CORRIDA' : 'HISTORICO') : RANKING_TITLES[view], RANKING_PANEL.x + 22, RANKING_PANEL.y + 12, { align: 'left' });
    for (const tab of RANKING_TABS) drawButton(ctx, tab, tab.label, inside(tab, pointer.x, pointer.y), { style: 'tab', active: tab.view === view });
    drawButton(ctx, RANKING_BACK, '< VOLTAR', inside(RANKING_BACK, pointer.x, pointer.y));
    if (view === 'ranking') drawHelp(ctx);
  }

  // Botão "?" e, aberto por clique (outro clique fecha), o quadro que explica a pontuação.
  const helpLines = HELP_TEXT.flatMap(({ text, kind }) => kind === 'title'
    ? [{ text, kind }]
    : wrap(text, 80).map((line, i) => ({ text: i ? `   ${line}` : `- ${line}`, kind: 'item' })));
  function drawHelp(ctx) {
    const hovered = inside(HELP_BUTTON, pointer.x, pointer.y);
    markClickable(HELP_BUTTON);
    chamferRect(ctx, HELP_BUTTON, 3, hovered || helpOpen ? COLOR.selected : COLOR.rust);
    chamferRect(ctx, { x: HELP_BUTTON.x + 1, y: HELP_BUTTON.y + 1, width: HELP_BUTTON.width - 2, height: HELP_BUTTON.height - 2 }, 2, COLOR.tile);
    ctxText(ctx, '?', HELP_BUTTON.x + 6, HELP_BUTTON.y + 5, hovered || helpOpen ? COLOR.selected : COLOR.text);
    if (!helpOpen) return;
    const box = { ...HELP_PANEL, height: helpLines.length * HELP_LINE + 16 };
    panelBox(ctx, box);
    outline(ctx, box, COLOR.tooltipEdge);
    helpLines.forEach(({ text, kind }, i) => ctxText(ctx, text, box.x + 12, box.y + 9 + i * HELP_LINE, kind === 'title' ? COLOR.selected : COLOR.text));
  }

  // Quebra o texto em linhas de no máximo NOTES_WRAP caracteres.
  function wrap(text, limit = NOTES_WRAP) {
    const lines = [];
    let line = '';
    for (const word of text.split(' ')) {
      if (line && (line + ' ' + word).length > limit) { lines.push(line); line = word; }
      else line = line ? `${line} ${word}` : word;
    }
    return [...lines, line];
  }

  // Linhas já quebradas: { text, kind } com kind = title | item | cont | gap.
  const noteLines = PATCH_NOTES.flatMap(({ title, items }) => [
    { text: title, kind: 'title' },
    ...items.flatMap(item => wrap(item).map((text, i) => ({ text, kind: i ? 'cont' : 'item' }))),
    { text: '', kind: 'gap' },
  ]);
  const notesMax = () => Math.max(0, noteLines.length * NOTES_LINE - NOTES_VIEW.height);

  function drawNotes(ctx) {
    panelBox(ctx, NOTES_PANEL);
    drawHeading(ctx, 'PATCH NOTES', NOTES_PANEL.x + 22, NOTES_PANEL.y + 12, { align: 'left' });
    ctxText(ctx, 'DESDE O ULTIMO COMMIT   (RODA DO MOUSE ROLA)', NOTES_PANEL.x + 22, NOTES_PANEL.y + 34, COLOR.muted);
    ctx.save();
    ctx.beginPath();
    ctx.rect(NOTES_VIEW.x, NOTES_VIEW.y, NOTES_VIEW.width, NOTES_VIEW.height);
    ctx.clip();
    noteLines.forEach(({ text, kind }, i) => {
      const y = NOTES_VIEW.y + i * NOTES_LINE - notesScroll;
      if (y < NOTES_VIEW.y - NOTES_LINE || y > NOTES_VIEW.y + NOTES_VIEW.height) return;
      if (kind === 'title') ctxText(ctx, text, NOTES_VIEW.x, y, COLOR.selected);
      else if (kind === 'item') { ctxText(ctx, '-', NOTES_VIEW.x + 4, y, COLOR.ember); ctxText(ctx, text, NOTES_VIEW.x + 16, y, COLOR.text); }
      else if (kind === 'cont') ctxText(ctx, text, NOTES_VIEW.x + 16, y, COLOR.text);
    });
    ctx.restore();
    if (notesMax() > 0) {   // barra de rolagem
      const trackHeight = NOTES_VIEW.height, thumb = Math.max(16, trackHeight * NOTES_VIEW.height / (noteLines.length * NOTES_LINE));
      ctx.fillStyle = COLOR.rust;
      ctx.fillRect(NOTES_VIEW.x + NOTES_VIEW.width + 4, NOTES_VIEW.y + (trackHeight - thumb) * notesScroll / notesMax(), 3, thumb);
    }
    drawButton(ctx, NOTES_BACK, '< VOLTAR', inside(NOTES_BACK, pointer.x, pointer.y));
  }

  function drawBye(ctx) {
    panelBox(ctx, PANEL);
    heading(ctx, 'ATE LOGO');
    const message = 'PODE FECHAR ESTA ABA';
    ctxText(ctx, message, Math.round(VIEW.width / 2 - textWidth(message) / 2), PANEL.y + 110, COLOR.text);
    drawBack(ctx);
  }

  const pages = { main: drawMain, settings: drawSettings, controls: drawControls, ranking: drawRanking, notes: drawNotes, bye: drawBye };
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
