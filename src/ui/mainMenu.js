import { MAX_RACERS, VIEW } from '../config.js';
import { ctxText, textWidth } from '../art/font.js';
import { PATCH_NOTES } from './patchNotes.js';
import { saveSettings, SETTINGS_RANGE } from '../game/settings.js';
import { chamferRect, COLOR, drawButton, drawHeading, drawLogo, drawRowStripe, drawRule, drawSlider, inside, markClickable, MEDALS, outline, panelBox, pointerOnStage } from './panelKit.js';

// Menu inicial: Singleplayer, Multiplayer, Garagem, Ranking, Configurações e Sair.

const BUTTON = { x: 24, y: 112, width: 176, height: 30, gap: 8 };
// Jogar em destaque, depois o resto do menu e, por último, sair: altura, largura e escala do texto de cada grupo.
const TIERS = { play: { height: 30, width: 190, scale: 2, gap: 6 }, more: { height: 22, width: 168, scale: 1, gap: 5 }, quit: { height: 18, width: 120, scale: 1, gap: 0 } };
const TIER_GAP = 12;
const PANEL = { x: 130, y: 44, width: 380, height: 272 };
const BACK = { x: 245, y: 278, width: 150, height: 28 };
const SLIDER = { x: 170, width: 300, height: 12, firstY: 88, gap: 38 };
const RANKING_PANEL = { x: 30, y: 28, width: 580, height: 268 };
const RANKING_TABS = [
  { view: 'ranking', label: 'RANKING', x: 230, y: 34, width: 116, height: 22 },
  { view: 'history', label: 'HISTORICO', x: 350, y: 34, width: 116, height: 22 },
  { view: 'legacy', label: 'RANKING ANTIGO', x: 470, y: 34, width: 116, height: 22 },
];
const RANKING_TITLES = { ranking: 'RANKING', history: 'HISTORICO', legacy: 'RANKING ANTIGO' };
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
const LEGACY_COLUMNS = [
  { label: 'JOGADOR', x: 40 }, { label: 'PONTOS', x: 136, color: '#f0c840' }, { label: 'OURO', x: 196, color: '#f0c840' },
  { label: 'PRATA', x: 240, color: '#c8d4e4' }, { label: 'BRONZE', x: 288, color: '#cc8448' }, { label: 'ABATES', x: 342 },
  { label: 'POS MEDIA', x: 396 }, { label: 'PARTIDAS', x: 464 },
];
const HISTORY_COLUMNS = [{ label: 'DATA', x: 14 }, { label: 'BIOMA', x: 82 }, { label: 'VENCEDOR', x: 150 }, { label: 'TEMPO', x: 246 }, { label: 'HUMANOS', x: 290 }];
const MATCH_BUTTON = { x: 46, y: 268, width: 150, height: 24 };
const FILTER_BOX = { x: 46, y: 58, width: 420, height: 12 };
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
const sliderBox = index => ({ x: SLIDER.x, y: SLIDER.firstY + index * SLIDER.gap, width: SLIDER.width, height: SLIDER.height });

const formatTime = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export function createMainMenu({ stage, settings, net, onSingleplayer, onMultiplayer, onGarage, onSettingChange, onEffectsPreview, onQuit }) {
  let page = 'main', helpOpen = false, notesScroll = 0, pointer = { x: -1, y: -1 }, dragging = null, queued = null, view = 'ranking', selectedRace = null, viewingMatch = null, historyFilter = null;

  const screen = { isOpen: true };

  function setPage(next) {
    if (next === 'ranking') {
      view = 'ranking';
      selectedRace = viewingMatch = historyFilter = null;
      net.requestRanking();
      net.requestHistory();
      net.requestLegacy();
    }
    page = next;
    helpOpen = false;
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
    if (!screen.isOpen || page !== 'notes') return;
    e.preventDefault();
    notesScroll = Math.max(0, Math.min(notesMax(), notesScroll + Math.sign(e.deltaY) * NOTES_LINE * 3));
  }, { passive: false });
  stage.addEventListener('click', e => {
    if (!screen.isOpen) return;
    const { x, y } = pointerOnStage(e, stage);
    if (page === 'main') entries.find(entry => inside(entry, x, y))?.action();
    else if (page === 'notes' && inside(NOTES_BACK, x, y)) setPage('main');
    else if (page === 'ranking' && RANKING_TABS.some(tab => inside(tab, x, y))) {
      view = RANKING_TABS.find(tab => inside(tab, x, y)).view;
      selectedRace = viewingMatch = null;
      helpOpen = false;
    } else if (page === 'ranking' && view === 'ranking' && inside(HELP_BUTTON, x, y)) {
      helpOpen = !helpOpen;
    } else if (inside(page === 'ranking' ? RANKING_BACK : BACK, x, y)) {
      if (page === 'ranking' && viewingMatch) viewingMatch = null;        // voltar fecha, um nível por vez: partida, corrida, lista
      else if (page === 'ranking' && selectedRace) selectedRace = null;
      else setPage('main');
    } else if (page === 'ranking' && view === 'history') clickHistory(x, y);
  });

  function setHistoryFilter(name) {
    historyFilter = name;
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
    if (historyFilter && inside(FILTER_BOX, x, y)) { setHistoryFilter(null); return; }
    const index = (net.history ?? []).slice(0, RANKING_ROWS).findIndex((_, i) => inside(historyRowBox(i), x, y));
    if (index >= 0) selectedRace = net.history[index];
  }

  // Logo inclinado e, embaixo, a faixa de corrida em três tons.
  function drawTitle(ctx) {
    drawLogo(ctx, 'CTI RACERS 2', BUTTON.x, 46, TITLE_SCALE);
    const y = 46 + 7 * TITLE_SCALE + 8, width = textWidth('CTI RACERS 2', TITLE_SCALE);
    [[COLOR.selected, 0, width], [COLOR.ember, 4, width - 30], [COLOR.rust, 8, width - 70]].forEach(([color, dy, length], i) => {
      ctx.fillStyle = color;
      ctx.fillRect(BUTTON.x + i * 6, y + dy, length, 2);
    });
  }

  function drawBack(ctx, label = '< VOLTAR') {
    drawButton(ctx, BACK, label, inside(BACK, pointer.x, pointer.y));
  }

  function heading(ctx, text) {
    drawHeading(ctx, text, VIEW.width / 2, PANEL.y + 14);
  }

  function drawMain(ctx) {
    drawTitle(ctx);
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
    drawBack(ctx);
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
      drawRowStripe(ctx, { x: RANKING_PANEL.x + 8, y: y - 4, width: RANKING_PANEL.width - 16, height: 16 }, i);
      ctxText(ctx, unranked ? `${row.races}/${row.minRaces}` : `${i + 1}.`, RANKING_PANEL.x + 14, y, unranked ? COLOR.muted : MEDALS[i] ?? COLOR.selected);
      ctxText(ctx, row.name, RANKING_PANEL.x + 40, y, unranked ? COLOR.muted : COLOR.text);
      cells(row).forEach((value, column) => ctxText(ctx, String(value), RANKING_PANEL.x + columns[column + 1].x, y, unranked ? COLOR.muted : COLOR.text));
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

  // Histórico do multiplayer: as corridas mais recentes, com o vencedor e a posição de cada humano.
  function drawHistory(ctx) {
    panelBox(ctx, RANKING_PANEL);
    if (viewingMatch) return drawMatchSummary(ctx);
    if (selectedRace) return drawRaceDetail(ctx, selectedRace);
    const top = RANKING_PANEL.y + 44;
    if (historyFilter) {
      markClickable(FILTER_BOX);
      ctxText(ctx, `SO CORRIDAS DE ${historyFilter.toUpperCase()}  (CLIQUE AQUI PARA LIMPAR)`, FILTER_BOX.x, FILTER_BOX.y + 2, inside(FILTER_BOX, pointer.x, pointer.y) ? COLOR.selected : COLOR.muted);
    }
    HISTORY_COLUMNS.forEach(({ label, x }) => ctxText(ctx, label, RANKING_PANEL.x + x, top, COLOR.muted));
    drawRule(ctx, RANKING_PANEL.x + 8, top + 10, RANKING_PANEL.width - 16);
    const races = net.history;
    const message = net.status === 'offline' ? 'SERVIDOR NAO ENCONTRADO' : !races ? 'CARREGANDO...' : races.length ? '' : 'NENHUMA CORRIDA ONLINE AINDA';
    if (message) ctxText(ctx, message, Math.round(VIEW.width / 2 - textWidth(message) / 2), top + 60, COLOR.text);
    (races ?? []).slice(0, RANKING_ROWS).forEach((race, i) => {
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
  }

  function drawRanking(ctx) {
    if (view === 'history') drawHistory(ctx);
    else {
      panelBox(ctx, RANKING_PANEL);
      if (view === 'legacy') {
        drawPlayerTable(ctx, LEGACY_COLUMNS, net.legacy, row => [Number(row.points).toString(), row.gold, row.silver, row.bronze, row.kills, row.average.toFixed(1), row.matches], 'NENHUM REGISTRO ANTIGO');
      } else {
        drawPlayerTable(ctx, RANKING_COLUMNS, net.ranking, row => [row.rating.toFixed(1), row.races, row.wins, `${row.podiumRate}%`, row.average.toFixed(1), row.kills, row.matches], 'NENHUMA CORRIDA RANKEADA AINDA');
      }
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

  const pages = { main: drawMain, settings: drawSettings, ranking: drawRanking, notes: drawNotes, bye: drawBye };
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
