import { VIEW } from '../config.js';
import { ctxText, textWidth } from '../art/font.js';
import { BIOMES } from '../world/biomes/index.js';
import { clamp, COLOR, drawHeading, inside, markClickable, outline, panelBox, pointerOnStage, toCss } from './panelKit.js';

// Votação do próximo mapa (multiplayer): um grafo de corridas, como o mapa de percurso do jogo original. As
// corridas já feitas ficam para trás, as próximas são "?" e a de agora mostra as opções para votar.
// A partir da segunda corrida o líder da corrida anterior pode excluir um dos mapas (botão X no canto) e o líder
// de abates tem o voto dobrado (conta 2 e aparece com dois quadradinhos).

const NODE = { width: 100, height: 40 }, VISIBLE_COLUMNS = 5, MARGIN = 18;
const GRAPH = { top: 64, bottom: 292 }, CHOICE_GAP = 66;
const BAR = { x: 120, y: 316, width: 400, height: 8 };
const GOLD = '#f0d060', PLAYER_COLOR = '#f01818', VETO_COLOR = '#e83030', VETO_BUTTON = 11;

const biomeById = id => BIOMES.find(biome => biome.id === id);
const centered = (ctx, text, y, color, scale = 1) => ctxText(ctx, text, Math.round(VIEW.width / 2 - textWidth(text, scale) / 2), y, color, scale);
const rgb = ([r, g, b], shade = 1) => `rgb(${Math.round(r * shade)},${Math.round(g * shade)},${Math.round(b * shade)})`;

export function createVoteScreen({ stage, onVote, onVeto = () => {} }) {
  const screen = { isOpen: false };
  let pointer = { x: -1, y: -1 }, state = null, boxes = [], vetoBoxes = [];
  const canVeto = () => state && !state.winner && !state.excluded && state.veto === state.myId;

  addEventListener('mousemove', e => { if (screen.isOpen) pointer = pointerOnStage(e, stage); });
  stage.addEventListener('click', e => {
    if (!screen.isOpen || !state || state.winner) return;
    const { x, y } = pointerOnStage(e, stage);
    const veto = canVeto() && vetoBoxes.find(({ box }) => inside(box, x, y));
    if (veto) { onVeto(veto.id); return; }
    const hit = boxes.find(({ box }) => inside(box, x, y));
    if (hit) onVote(hit.id);
  });
  addEventListener('keydown', e => {
    if (!screen.isOpen || !state || state.winner || e.repeat) return;
    const choice = state.candidates[Number(e.key) - 1];
    if (choice && choice.id !== state.excluded) onVote(choice.id);
  });

  // `candidates`: biomas em votação; `played`: ids já corridos, em ordem; `number`/`total`: corrida de agora e quantas há.
  // `veto`/`double`: ids de quem pode excluir um mapa e de quem tem voto dobrado (com os nomes); `excluded`: mapa já excluído.
  screen.open = ({ candidates, played, number, total, seconds, myId, veto = null, double = null, excluded = null, vetoName = '', doubleName = '' }) => {
    state = { candidates, played, number, total, seconds, timeLeft: seconds, votes: new Map(), names: new Map(), winner: null, myId, veto, double, excluded, vetoName, doubleName };
    screen.isOpen = true;
  };
  screen.close = () => { screen.isOpen = false; state = null; };
  screen.setTime = seconds => { if (state) state.timeLeft = seconds; };
  // `votes`: id do jogador -> id do bioma; `names`: id do jogador -> nome.
  screen.setVotes = (votes, names) => { if (state) { state.votes = votes; state.names = names; } };
  screen.showResult = id => { if (state) state.winner = id; };
  screen.setExcluded = id => { if (state) state.excluded = id; };

  function drawLink(ctx, from, to, color) {
    ctx.fillStyle = color;
    const steps = Math.max(2, Math.round(Math.hypot(to.x - from.x, to.y - from.y) / 6));
    for (let i = 1; i < steps; i++) if (i % 2) ctx.fillRect(Math.round(from.x + (to.x - from.x) * i / steps), Math.round(from.y + (to.y - from.y) * i / steps), 2, 2);
  }

  function drawNode(ctx, center, biome, { dim = false, hovered = false, mine = false, winner = false, unknown = false, excluded = false } = {}) {
    const box = { x: Math.round(center.x - NODE.width / 2), y: Math.round(center.y - NODE.height / 2), width: NODE.width, height: NODE.height };
    ctx.fillStyle = '#000000';
    ctx.fillRect(box.x, box.y, box.width, box.height);
    if (unknown) {
      ctx.fillStyle = '#2a2a32';
      ctx.fillRect(box.x + 1, box.y + 1, box.width - 2, box.height - 2);
      centered(ctx, '?', Math.round(center.y - 7), COLOR.muted, 2);
      ctx.fillStyle = 'rgba(0,0,0,.2)';
    } else {
      const half = Math.floor((box.height - 2) / 2);
      ctx.fillStyle = toCss(biome.sky);
      ctx.fillRect(box.x + 1, box.y + 1, box.width - 2, half);
      ctx.fillStyle = rgb(biome.ground.base, 0.9);
      ctx.fillRect(box.x + 1, box.y + 1 + half, box.width - 2, box.height - 2 - half);
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(box.x + 1, box.y + box.height - 15, box.width - 2, 14);
      ctxText(ctx, biome.name, Math.round(center.x - textWidth(biome.name) / 2), box.y + box.height - 12, '#ffffff');
      if (dim || excluded) { ctx.fillStyle = 'rgba(24,10,5,.55)'; ctx.fillRect(box.x + 1, box.y + 1, box.width - 2, box.height - 2); }
      if (excluded) {                                 // riscado em X, com o aviso no meio
        ctx.fillStyle = VETO_COLOR;
        for (let i = 0; i < box.width - 2; i++) {
          const y = Math.round(i * (box.height - 2) / (box.width - 2));
          ctx.fillRect(box.x + 1 + i, box.y + 1 + y, 1, 1);
          ctx.fillRect(box.x + 1 + i, box.y + box.height - 2 - y, 1, 1);
        }
        const label = 'EXCLUIDO';
        ctx.fillStyle = '#000000';
        ctx.fillRect(Math.round(center.x - textWidth(label) / 2) - 2, Math.round(center.y - 5), textWidth(label) + 4, 10);
        ctxText(ctx, label, Math.round(center.x - textWidth(label) / 2), Math.round(center.y - 3), VETO_COLOR);
      }
    }
    outline(ctx, box, winner ? GOLD : mine ? GOLD : hovered ? COLOR.selected : COLOR.edge);
    if (winner || mine) outline(ctx, { x: box.x - 1, y: box.y - 1, width: box.width + 2, height: box.height + 2 }, winner ? GOLD : '#a88a30');
    return box;
  }

  function drawVotes(ctx, center, id) {
    // O voto dobrado vira dois quadradinhos; o seu fica em vermelho.
    const squares = [...state.votes].filter(([, choice]) => choice === id).flatMap(([player]) => (player === state.double ? [player, player] : [player]));
    const label = squares.length === 1 ? '1 VOTO' : `${squares.length} VOTOS`;
    ctxText(ctx, label, Math.round(center.x - textWidth(label) / 2), Math.round(center.y + NODE.height / 2 + 4), squares.length ? GOLD : COLOR.muted);
    squares.forEach((player, i) => {
      ctx.fillStyle = player === state.myId ? PLAYER_COLOR : '#e8e4dc';
      ctx.fillRect(Math.round(center.x - squares.length * 5 / 2 + i * 5), Math.round(center.y + NODE.height / 2 + 14), 4, 4);
    });
  }

  // Botão X no canto do mapa, para quem pode excluir.
  function drawVetoButton(ctx, box, id) {
    const button = { x: box.x + box.width - VETO_BUTTON - 2, y: box.y + 2, width: VETO_BUTTON, height: VETO_BUTTON };
    const hovered = inside(button, pointer.x, pointer.y);
    ctx.fillStyle = hovered ? VETO_COLOR : '#000000';
    ctx.fillRect(button.x, button.y, button.width, button.height);
    outline(ctx, button, VETO_COLOR);
    ctx.fillStyle = hovered ? '#ffffff' : VETO_COLOR;
    for (let i = 2; i < VETO_BUTTON - 2; i++) { ctx.fillRect(button.x + i, button.y + i, 1, 1); ctx.fillRect(button.x + VETO_BUTTON - 1 - i, button.y + i, 1, 1); }
    markClickable(button);
    vetoBoxes.push({ id, box: button });
  }

  // Quem tem privilégio nesta votação (a partir da segunda corrida).
  function drawPrivileges(ctx) {
    const lines = [];
    if (state.veto) lines.push([state.excluded ? `${state.vetoName} EXCLUIU ${biomeById(state.excluded).name}` : `${state.vetoName} (LIDER DA ULTIMA CORRIDA) PODE EXCLUIR UM MAPA`, VETO_COLOR]);
    if (state.double) lines.push([`${state.doubleName} (LIDER DE ABATES) TEM VOTO DOBRADO`, GOLD]);
    lines.forEach(([text, color], i) => ctxText(ctx, text.toUpperCase(), 16, 58 + i * 10, color));
  }

  screen.draw = ctx => {
    if (!state) return;
    boxes = [];
    vetoBoxes = [];
    ctx.fillStyle = COLOR.backdrop;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    drawHeading(ctx, state.winner ? 'MAPA ESCOLHIDO' : 'VOTE NO PROXIMO MAPA', VIEW.width / 2, 14);
    centered(ctx, `CORRIDA ${state.number} DE ${state.total}`, 38, COLOR.muted);
    panelBox(ctx, { x: 8, y: 52, width: VIEW.width - 16, height: 252 });
    drawPrivileges(ctx);

    const current = state.number - 1, shown = Math.min(VISIBLE_COLUMNS, state.total);
    const first = clamp(current - 1, 0, state.total - shown);
    const left = MARGIN + 8 + NODE.width / 2, span = shown > 1 ? (VIEW.width - 2 * (MARGIN + 8 + NODE.width / 2)) / (shown - 1) : 0;
    const middle = Math.round((GRAPH.top + GRAPH.bottom) / 2) - 4;
    const choices = state.candidates.length, columns = [];

    for (let i = 0; i < shown; i++) {
      const race = first + i, x = Math.round(left + i * span);
      if (race < current) columns.push([{ x, y: middle, biome: biomeById(state.played[race]), kind: 'past' }]);
      else if (race === current) columns.push(state.candidates.map((biome, k) => ({ x, y: Math.round(middle + (k - (choices - 1) / 2) * CHOICE_GAP), biome, kind: 'choice' })));
      else columns.push([{ x, y: middle, kind: 'future' }]);
    }
    for (let i = 0; i + 1 < columns.length; i++) {           // ligações pontilhadas; o caminho já percorrido é claro
      for (const a of columns[i]) for (const b of columns[i + 1]) {
        const chosen = a.kind === 'past' && b.kind === 'past';
        const toWinner = a.kind === 'past' && b.kind === 'choice' && state.winner === b.biome.id;
        drawLink(ctx, { x: a.x + NODE.width / 2, y: a.y }, { x: b.x - NODE.width / 2, y: b.y }, chosen || toWinner ? GOLD : '#5a5a66');
      }
    }
    for (const column of columns) for (const node of column) {
      if (node.kind === 'future') { drawNode(ctx, node, null, { unknown: true }); continue; }
      if (node.kind === 'past') { drawNode(ctx, node, node.biome, { dim: true }); continue; }
      const id = node.biome.id, voted = state.votes.get(state.myId) === id, excluded = state.excluded === id;
      const box = drawNode(ctx, node, node.biome, { hovered: !state.winner && !excluded && inside({ x: node.x - NODE.width / 2, y: node.y - NODE.height / 2, ...NODE }, pointer.x, pointer.y), mine: voted && !state.winner, winner: state.winner === id, dim: Boolean(state.winner) && state.winner !== id, excluded });
      if (!state.winner && !excluded) { markClickable(box); boxes.push({ id, box }); }
      if (canVeto()) drawVetoButton(ctx, box, id);
      if (!excluded) drawVotes(ctx, node, id);
      const key = String(state.candidates.indexOf(node.biome) + 1);
      ctxText(ctx, key, box.x + 3, box.y + 3, COLOR.muted);
    }

    // Tempo: barra que esvazia.
    ctx.fillStyle = '#000000';
    ctx.fillRect(BAR.x, BAR.y, BAR.width, BAR.height);
    const fraction = state.winner ? 0 : clamp(state.timeLeft / state.seconds, 0, 1);
    ctx.fillStyle = fraction > 0.3 ? COLOR.selected : COLOR.danger;
    ctx.fillRect(BAR.x + 1, BAR.y + 1, Math.round((BAR.width - 2) * fraction), BAR.height - 2);
    const caption = state.winner ? biomeById(state.winner).name : `${Math.ceil(Math.max(0, state.timeLeft))}S`;
    centered(ctx, caption, BAR.y + 14, state.winner ? GOLD : COLOR.text);
    if (!state.winner) centered(ctx, canVeto() ? 'CLIQUE NO X PARA EXCLUIR UM MAPA E NO MAPA PARA VOTAR' : 'CLIQUE NUM MAPA (OU TECLAS 1 A 3) - EMPATE: SORTEIO', 334, COLOR.muted);
  };
  return screen;
}
