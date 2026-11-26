import { VIEW } from '../config.js';
import { ctxText, textWidth } from '../art/font.js';
import { DRAFT_TIMING, duelTime, pairWinner, roundTime, stageTime } from '../game/weaponDraft.js';
import { WEAPON_TYPES } from '../game/weaponTypes.js';
import { createReadyPanel } from './garage/readyPanel.js';
import { clamp, COLOR, drawButton, drawCorners, drawHeading, fitImage, inside, markClickable, outline, panelBox, pointerOnStage } from './panelKit.js';

// Sorteio de armas do multiplayer (game/weaponDraft.js). Primeiro todos dão OK; depois vem a mesa: uma carta por jogador e a mão de cada um, com o nome,
// apontando para a arma que quer. Depois vem a revelação: quem apontou sozinho leva, as disputas se resolvem no
// mata-mata de pedra, papel e tesoura (uma arma por vez, no meio da tela; os duelos de cada fase correm juntos) e quem perdeu recebe uma das que sobraram.
// A revelação anda pelo relógio que net/onlineMatch.js passa em `setElapsed`, o mesmo em todos os navegadores.

const CARDS = { top: 100, height: 150, gap: 6, maxWidth: 120, side: 8 };
const NAME_ROWS = [52, 61];
const HAND = { tipX: 7, tipY: 30 }, REST_Y = 316, HAND_EASE = 0.35;      // ponta do dedo no desenho; onde a mão parada espera
const KICK_AFTER = 20000, KICK = { y: 343, width: 84, height: 14, gap: 4 };   // ms até o admin poder tirar quem não escolhe
const DUEL = { x: 40, y: 112, width: 560, height: 190 };
const OK_BUTTON = { x: 240, y: 142, width: 160, height: 30 }, ROSTER_TOP = 190;
const SKIN = '#e8b48a', SKIN_SHADE = '#c08060', INK = COLOR.ink;
const PLAYER_COLORS = ['#e83030', '#3080f0', '#40c040', '#f0c020', '#c050e0', '#30d0d0', '#f08030', '#e8e4dc'];
const COUNT_WORDS = ['PEDRA...', 'PAPEL...', 'TESOURA!'];

// Mãos em pixel: o cuff (c) leva a cor do jogador; s é pele, h a sombra e o o contorno.
// A que aponta tem o punho em cima e o dedo para baixo; as do jogo vêm de baixo para cima.
const POINT = [
  '.cccccccc.',
  '.cccccccc.',
  'oooooooooo',
  'osssssssso',
  'osssssssso',
  'oshshshsso',
  'osssssssso',
  '.osssssso.',
  '..osssoo..',
  '..oso.....',
  '..oso.....',
  '..oso.....',
  '..oso.....',
  '..oso.....',
  '...o......',
];
const GESTURES = {
  rock: [
    '............',
    '............',
    '............',
    '............',
    '..oooooooo..',
    '.oshshshsho.',
    '.osssssssso.',
    'oosssssssso.',
    'osossssssso.',
    'oossssssso..',
    '.osssssso...',
    '..cccccc....',
    '..cccccc....',
    '..cccccc....',
  ],
  paper: [
    '...o.o.o....',
    '..osososo...',
    '..osososo...',
    '..osososo.o.',
    '..osososooso',
    '..ossssssoso',
    'o.osssssssso',
    'osossssssso.',
    'oosssssssso.',
    '.osssssssso.',
    '..osssssso..',
    '..cccccc....',
    '..cccccc....',
    '..cccccc....',
  ],
  scissors: [
    '.o....o.....',
    'oso..oso....',
    'oso..oso....',
    '.oso.oso....',
    '.osooso.....',
    '..osssoooo..',
    '.oossssshso.',
    'osossssssso.',
    'oosssssssso.',
    '.osssssssso.',
    '..osssssso..',
    '..cccccc....',
    '..cccccc....',
    '..cccccc....',
  ],
};
const GESTURE_NAMES = { rock: 'PEDRA', paper: 'PAPEL', scissors: 'TESOURA' };
const BYE_REASONS = { leader: 'LIDER CORRIDA', kills: 'LIDER ABATES', draw: 'SORTEIO' };

function drawBitmap(ctx, rows, x, y, scale, cuff) {
  const tones = { o: INK, s: SKIN, h: SKIN_SHADE, c: cuff };
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const color = tones[row[i]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x + i * scale, y + j * scale, scale, scale);
    }
  });
}

// Quebra `text` em linhas de até `max` caracteres, palavra por palavra.
function wrap(text, max) {
  const lines = [];
  for (const word of text.split(' ')) {
    const last = lines[lines.length - 1];
    if (last !== undefined && last.length + 1 + word.length <= max) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word.slice(0, max));
  }
  return lines;
}
const fit = (text, max) => (text.length > max ? text.slice(0, Math.max(1, max)) : text);
const centered = (ctx, text, cx, y, color, scale = 1) => ctxText(ctx, text, Math.round(cx - textWidth(text, scale) / 2), y, color, scale);

// `thumbOf(id)`: miniatura da arma; `onPick(id)`: o jogador apontou para uma arma; `onPoint(x, y)`: a mão dele andou;
// `onConfirm`: deu OK para começar. `getRoster` e `onKick` são os do painel de prontos da garagem: o admin pode expulsar
// quem não dá OK ou não escolhe.
export function createWeaponDraftScreen({ stage, thumbOf, onPick, onPoint = () => {}, onConfirm, getRoster, onKick }) {
  const screen = { isOpen: false };
  let pointer = { x: -1, y: -1 }, state = null, cards = [], kicks = [];
  const readyPanel = createReadyPanel({ getRoster, onKick });
  const confirmed = () => Boolean(getRoster()?.players.find(player => player.isMe)?.ready);

  addEventListener('mousemove', e => {
    if (!screen.isOpen) return;
    pointer = pointerOnStage(e, stage);
    if (state && !state.gate && state.players.includes(state.myId)) onPoint(pointer.x, pointer.y);
  });
  stage.addEventListener('click', e => {
    if (!screen.isOpen || !state) return;
    const { x, y } = pointerOnStage(e, stage);
    if (state.gate) {
      if (readyPanel.click(x, y)) return;
      if (inside(OK_BUTTON, x, y) && !confirmed()) onConfirm();
      return;
    }
    const kick = kicks.find(candidate => inside(candidate, x, y));
    if (kick) { onKick(kick.id); return; }
    if (!canPick()) return;
    const card = cards.find(candidate => inside(candidate, x, y));
    if (card && !ownerOf(card.id)) onPick(card.id);
  });
  addEventListener('keydown', e => {
    if (!screen.isOpen || !canPick() || e.repeat) return;
    const id = state.offer[Number(e.key) - 1];
    if (id && !ownerOf(id)) onPick(id);
  });
  const canPick = () => state && !state.gate && !state.result && state.players.includes(state.myId) && !(state.myId in state.taken);
  const ownerOf = weaponId => Object.keys(state.taken).find(id => state.taken[id] === weaponId);   // quem já ganhou a arma

  // `offer`: armas na mesa; `players`: ids de quem escolhe (em ordem: define a cor de cada um); `names`: id -> nome.
  screen.open = ({ offer, players, names, myId, number, total, priority = {} }) => {
    state = {
      offer, players, names, myId, number, total, priority, present: players, round: 1, taken: {}, picks: new Map(), result: null, elapsed: 0,
      cursors: new Map(), since: performance.now(),
      thumbs: Object.fromEntries(offer.map(id => [id, thumbOf(id)])),
      colors: new Map(players.map((id, i) => [id, PLAYER_COLORS[i % PLAYER_COLORS.length]])),
    };
    screen.isOpen = true;
  };
  // Rodada `round`: `taken` é quem já ganhou arma; os outros voltam a apontar.
  screen.nextRound = (round, taken) => {
    if (state) Object.assign(state, { round, taken: { ...taken }, picks: new Map(), result: null, elapsed: 0, since: performance.now() });
  };
  screen.setPlayers = present => { if (state) state.present = present; };   // quem saiu leva a mão embora
  screen.setCursor = (id, x, y) => {
    if (!state?.cursors || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const hand = state.cursors.get(id);
    if (hand) Object.assign(hand, { toX: x, toY: y });
    else state.cursors.set(id, { x, y, toX: x, toY: y });
  };
  // Espera antes da mesa: as armas só aparecem depois que todos derem OK.
  screen.openGate = ({ myId, number, total }) => {
    state = { gate: true, myId, number, total };
    screen.isOpen = true;
  };
  screen.close = () => { screen.isOpen = false; state = null; };
  screen.setPicks = (picks, names) => { if (state) { state.picks = new Map(picks); if (names) state.names = names; } };
  screen.setNames = names => { if (state) state.names = names; };
  // Resultado da rodada: { assigned: { id: arma } só dos vencedores, duels: [{ w, rounds, winner }], picks: Map id -> arma }.
  screen.showResult = ({ assigned, duels, picks }) => {
    if (!state) return;
    let t = DRAFT_TIMING.intro;
    const segments = duels.map(duel => { const start = t; t += duelTime(duel); return { duel, start, end: t }; });
    state.picks = new Map(picks);
    state.result = { assigned, duels, segments, finalAt: t, contested: new Set(duels.map(duel => duel.w)) };
  };
  screen.setElapsed = seconds => { if (state) state.elapsed = seconds; };

  const nameOf = id => state.names.get(id) ?? '?';
  const colorOf = id => state.colors.get(id) ?? PLAYER_COLORS[7];
  const label = id => WEAPON_TYPES[id].label;

  function layoutCards() {
    const count = state.offer.length;
    const width = Math.min(CARDS.maxWidth, Math.floor((VIEW.width - 2 * CARDS.side - (count - 1) * CARDS.gap) / count));
    const left = Math.round((VIEW.width - (count * width + (count - 1) * CARDS.gap)) / 2);
    cards = state.offer.map((id, i) => ({ id, index: i, x: left + i * (width + CARDS.gap), y: CARDS.top, width, height: CARDS.height }));
  }

  // Em qual carta cada mão está presa. Quem não está preso a nenhuma tem a mão solta, seguindo o mouse do dono: quem
  // ainda não escolheu e, na revelação, quem perdeu a disputa.
  function dockedWeapon(player) {
    if (player in state.taken) return state.taken[player];
    const pick = state.picks.get(player);
    if (!state.result) return pick;
    const { assigned, segments } = state.result;
    const segment = segments.find(candidate => candidate.duel.w === pick);
    if (!segment) return assigned[player] === pick ? pick : undefined;
    return state.elapsed < segment.end || segment.duel.winner === player ? pick : undefined;
  }

  function drawCard(ctx, card, { hovered, mine, owned }) {
    const type = WEAPON_TYPES[card.id], { x, y, width, height } = card;
    ctx.fillStyle = INK;
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = hovered ? COLOR.tileHover : COLOR.tile;
    ctx.fillRect(x + 1, y + 1, width - 2, height - 2);
    ctx.fillStyle = COLOR.tileBevel;
    ctx.fillRect(x + 1, y + 1, width - 2, 1);
    ctx.fillStyle = COLOR.tileDark;
    ctx.fillRect(x + 3, y + 4, width - 6, 44);
    const thumb = state.thumbs[card.id];
    if (thumb) fitImage(ctx, thumb, { x: x + 4, y: y + 5, width: width - 8, height: 42 });
    ctxText(ctx, String(card.index + 1), x + 4, y + 5, COLOR.muted);

    const chars = Math.floor((width - 6) / 6);
    let line = y + 53;
    for (const text of wrap(type.label, chars)) { ctxText(ctx, text, x + 4, line, mine ? COLOR.gold : COLOR.selected); line += 9; }
    line += 2;
    for (const text of wrap(type.summary, chars)) {
      if (line > y + height - 48) break;
      ctxText(ctx, text, x + 4, line, COLOR.muted);
      line += 9;
    }
    const stats = [[`R$ ${type.price}`, COLOR.gold], [fit(`DANO ${type.damage}`, chars), COLOR.text], [fit(`ALC ${type.range}`, chars), COLOR.text], [fit(`BALAS ${type.magazine + type.reserve}`, chars), COLOR.text]];
    stats.forEach(([text, color], i) => ctxText(ctx, text, x + 4, y + height - 42 + i * 10, color));

    if (owned) outline(ctx, card, COLOR.gold);
    if (mine) drawCorners(ctx, { x: x - 2, y: y - 2, width: width + 4, height: height + 4 }, COLOR.gold, 6);
    else if (hovered) outline(ctx, card, COLOR.selected);
  }

  // Uma mão com o dedo em (`tipX`, `tipY`) e o nome do dono em cima, sublinhado na cor dele.
  function drawHand(ctx, player, tipX, tipY, name, nameY) {
    drawBitmap(ctx, POINT, tipX - HAND.tipX, tipY - HAND.tipY, 2, colorOf(player));
    const left = clamp(Math.round(tipX - textWidth(name) / 2), 2, VIEW.width - 2 - textWidth(name));   // nas bordas o nome não é cortado
    ctx.fillStyle = colorOf(player);
    ctx.fillRect(left - 1, nameY + 7, textWidth(name), 1);
    ctxText(ctx, name, left, nameY, player === state.myId ? COLOR.gold : COLOR.text);
  }

  // Mãos presas numa carta, lado a lado, com os nomes em duas fileiras para caberem.
  function drawDocked(ctx, card, players) {
    const count = players.length;
    players.forEach((player, k) => {
      const room = count > 1 ? Math.floor((2 * card.width) / count / 6) : Math.floor((card.width + 24) / 6);
      const name = fit(nameOf(player).toUpperCase(), Math.max(3, room));
      drawHand(ctx, player, Math.round(card.x + card.width * (k + 0.5) / count), card.y - 1, name, NAME_ROWS[count > 1 ? k % 2 : 1]);
    });
  }

  // Mãos soltas: a minha acompanha o mouse na hora; as dos outros deslizam até a última posição recebida. Antes de
  // alguém mexer o mouse, a mão dele espera embaixo da mesa, cada uma no seu lugar.
  function drawFreeHands(ctx, players) {
    const mine = players.includes(state.myId);
    for (const player of [...players.filter(id => id !== state.myId), ...(mine ? [state.myId] : [])]) {   // a minha por cima
      const slot = state.players.indexOf(player);
      let at = { x: Math.round(VIEW.width * (slot + 0.5) / state.players.length), y: REST_Y };
      if (player === state.myId) {
        if (pointer.x >= 0) at = pointer;
      } else {
        const hand = state.cursors.get(player);
        if (hand) {
          hand.x += (hand.toX - hand.x) * HAND_EASE;
          hand.y += (hand.toY - hand.y) * HAND_EASE;
          at = hand;
        }
      }
      const tipX = clamp(Math.round(at.x), HAND.tipX, VIEW.width - 14), tipY = clamp(Math.round(at.y), HAND.tipY + 10, VIEW.height - 1);
      drawHand(ctx, player, tipX, tipY, fit(nameOf(player).toUpperCase(), 12), tipY - HAND.tipY - 10);
    }
  }

  // Um jogador do mata-mata: a mão, o nome e o gesto mostrado; apagado quando já caiu.
  function drawFighter(ctx, player, cx, width, scale, { gesture, bob = 0, dim = false, winner = false, note = null }) {
    ctx.globalAlpha = dim ? 0.35 : 1;
    drawBitmap(ctx, GESTURES[gesture], cx - 6 * scale, DUEL.y + 118 - 14 * scale - bob, scale, colorOf(player));
    centered(ctx, fit(nameOf(player).toUpperCase(), Math.floor(width / 6)), cx, DUEL.y + 124, player === state.myId ? COLOR.gold : COLOR.text);
    if (note) centered(ctx, fit(note, Math.floor((width + 6) / 6)), cx, DUEL.y + 136, COLOR.muted);
    ctx.globalAlpha = 1;
    if (winner) drawCorners(ctx, { x: cx - Math.floor(width / 2), y: DUEL.y + 54, width, height: 94 }, COLOR.gold, 6);
  }

  // Disputa no meio da tela: uma fase do mata-mata por vez. Em cada duelo as mãos balançam no "pedra, papel, tesoura"
  // e mostram o gesto; quem passa direto espera do lado.
  function drawDuel(ctx, segment) {
    const { duel } = segment;
    let local = state.elapsed - segment.start, index = 0;
    while (index < duel.stages.length - 1 && local >= stageTime(duel.stages[index])) local -= stageTime(duel.stages[index++]);
    const stage = duel.stages[index], final = index === duel.stages.length - 1;
    panelBox(ctx, DUEL);
    centered(ctx, `DISPUTA: ${label(duel.w)}`, VIEW.width / 2, DUEL.y + 10, COLOR.gold, 2);
    const phaseName = final ? (duel.stages.length > 1 ? 'FINAL' : 'DUELO') : `MATA-MATA - FASE ${index + 1} DE ${duel.stages.length}`;
    centered(ctx, phaseName, VIEW.width / 2, DUEL.y + 34, COLOR.text);

    let round = -1, roundLocal = 0;
    if (local >= DRAFT_TIMING.stageIntro) {
      round = Math.min(stage.rounds.length - 1, Math.floor((local - DRAFT_TIMING.stageIntro) / roundTime()));
      roundLocal = local - DRAFT_TIMING.stageIntro - round * roundTime();
    }
    const ended = local >= DRAFT_TIMING.stageIntro + stage.rounds.length * roundTime();
    const shaking = round >= 0 && !ended && roundLocal < DRAFT_TIMING.shake;
    const bob = shaking ? Math.round(Math.abs(Math.sin((roundLocal / DRAFT_TIMING.shake) * Math.PI * 3)) * 8) : 0;

    // Cada duelo ocupa duas colunas e quem passa direto, uma.
    const units = stage.pairs.length * 2 + (stage.bye ? 1 : 0);
    const unit = Math.min(130, Math.floor((DUEL.width - 20) / units)), scale = units > 5 ? 3 : 4;
    let x = Math.round(VIEW.width / 2 - (units * unit) / 2);
    const winners = [];
    for (const pair of stage.pairs) {
      // A última rodada deste duelo até agora: um duelo já resolvido para de jogar enquanto os outros desempatam.
      let last = round;
      while (last >= 0 && !(pair[0] in stage.rounds[last])) last--;
      const live = last === round && round >= 0, hidden = round < 0 || (live && shaking);
      const winner = hidden ? null : pairWinner(pair, stage.rounds[last]);
      if (winner) winners.push(winner);
      pair.forEach((player, side) => drawFighter(ctx, player, x + unit * side + Math.floor(unit / 2), unit - 6, scale, {
        gesture: hidden ? 'rock' : stage.rounds[last][player], bob: live ? bob : 0, dim: Boolean(winner) && winner !== player, winner: winner === player,
        note: hidden ? null : GESTURE_NAMES[stage.rounds[last][player]],
      }));
      centered(ctx, !hidden && !winner ? 'EMPATE' : 'X', x + unit, DUEL.y + 44, !hidden && !winner ? COLOR.danger : COLOR.muted);
      x += unit * 2;
    }
    if (stage.bye) {
      centered(ctx, 'PASSA', x + Math.floor(unit / 2), DUEL.y + 44, COLOR.selected);
      drawFighter(ctx, stage.bye, x + Math.floor(unit / 2), unit - 6, scale, { gesture: 'rock', note: BYE_REASONS[stage.why] });
    }

    let caption;
    if (round < 0) caption = 'PEDRA, PAPEL E TESOURA!';
    else if (shaking) caption = COUNT_WORDS[Math.min(2, Math.floor((roundLocal / DRAFT_TIMING.shake) * 3))];
    else if (ended && final) caption = `${nameOf(duel.winner).toUpperCase()} FICA COM A ${label(duel.w)}`;
    else if (winners.length < stage.pairs.length) caption = 'EMPATE! DE NOVO';
    else caption = `${[...winners, ...(stage.bye ? [stage.bye] : [])].map(id => nameOf(id).toUpperCase()).join(', ')} AVANCAM`;
    centered(ctx, fit(caption, 88), VIEW.width / 2, DUEL.y + DUEL.height - 24, ended && final ? COLOR.gold : COLOR.text, caption.length * 12 < DUEL.width - 20 ? 2 : 1);
  }

  // Depois de um tempo esperando, o admin ganha um botão por jogador que ainda não escolheu.
  function drawKicks(ctx) {
    const roster = getRoster();
    if (!roster?.canKick || performance.now() - state.since < KICK_AFTER) return;
    const missing = roster.players.filter(player => !player.ready && !player.isMe);
    const left = Math.round((VIEW.width - missing.length * (KICK.width + KICK.gap) + KICK.gap) / 2);
    missing.forEach((player, i) => {
      const box = { id: player.id, x: left + i * (KICK.width + KICK.gap), y: KICK.y, width: KICK.width, height: KICK.height };
      kicks.push(box);
      drawButton(ctx, box, `TIRAR ${fit(player.name.toUpperCase(), 7)}`, inside(box, pointer.x, pointer.y), { style: 'danger', quiet: true });
    });
  }

  function drawFooter(ctx) {
    if (!state.result) {
      const missing = state.present.filter(id => !(id in state.taken) && !state.picks.has(id)).map(id => nameOf(id).toUpperCase());
      if (missing.length) centered(ctx, fit(`FALTA ESCOLHER: ${missing.join(', ')}`, 100), VIEW.width / 2, 262, COLOR.muted);
      const hint = !state.players.includes(state.myId) ? 'VOCE ENTROU AGORA: ESCOLHA SUA ARMA NA GARAGEM'
        : state.myId in state.taken ? `SUA ARMA: ${label(state.taken[state.myId])} - ESPERE OS OUTROS`
          : state.round > 1 ? 'VOCE PERDEU A DISPUTA: ESCOLHA OUTRA ARMA'
            : `CLIQUE NUMA ARMA (TECLAS 1 A ${state.offer.length}) - SE MAIS DE UM QUISER, PEDRA, PAPEL E TESOURA`;
      centered(ctx, fit(hint, 104), VIEW.width / 2, 330, canPick() ? COLOR.gold : COLOR.muted);
      drawKicks(ctx);
      return;
    }
    if (state.elapsed < state.result.finalAt) return;
    const mine = state.result.assigned[state.myId] ?? state.taken[state.myId];
    if (mine) centered(ctx, `SUA ARMA: ${label(mine)}`, VIEW.width / 2, 264, COLOR.gold, 2);
    else if (state.players.includes(state.myId)) centered(ctx, 'VOCE VAI ESCOLHER DE NOVO', VIEW.width / 2, 264, COLOR.danger, 2);
    else centered(ctx, 'ESCOLHA SUA ARMA NA GARAGEM', VIEW.width / 2, 264, COLOR.text, 2);
  }

  function drawGate(ctx) {
    drawHeading(ctx, 'ESCOLHA DE ARMAS', VIEW.width / 2, 40);
    centered(ctx, `CORRIDA ${state.number} DE ${state.total}`, VIEW.width / 2, 64, COLOR.muted);
    centered(ctx, 'CADA UM APONTA PARA A ARMA QUE QUER', VIEW.width / 2, 92, COLOR.text);
    centered(ctx, 'SE MAIS DE UM QUISER A MESMA: MATA-MATA DE PEDRA, PAPEL E TESOURA', VIEW.width / 2, 104, COLOR.text);
    centered(ctx, 'COM NUMERO IMPAR PASSA DIRETO O LIDER DA CORRIDA, DEPOIS O DE ABATES', VIEW.width / 2, 114, COLOR.muted);
    const done = confirmed();
    centered(ctx, done ? 'ESPERANDO OS OUTROS...' : 'A ESCOLHA COMECA QUANDO TODOS DEREM OK', VIEW.width / 2, 124, done ? COLOR.gold : COLOR.muted);
    drawButton(ctx, OK_BUTTON, done ? 'PRONTO' : 'OK', !done && inside(OK_BUTTON, pointer.x, pointer.y), done ? 'auto' : 'primary');
    readyPanel.draw(ctx, pointer, ROSTER_TOP);
  }

  screen.draw = ctx => {
    if (!state) return;
    if (state.gate) {
      ctx.fillStyle = COLOR.backdrop;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      drawGate(ctx);
      return;
    }
    layoutCards();
    ctx.fillStyle = COLOR.backdrop;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    drawHeading(ctx, state.result ? 'SORTEIO DAS ARMAS' : state.round > 1 ? 'ESCOLHAM DE NOVO' : 'ESCOLHA SUA ARMA', VIEW.width / 2, 12);
    centered(ctx, `CORRIDA ${state.number} DE ${state.total} - AS ARMAS GIRAM: TODAS APARECEM ANTES DE REPETIR`, VIEW.width / 2, 34, COLOR.muted);

    kicks = [];
    // Quem tem prioridade para passar direto no mata-mata (não existe antes da primeira corrida).
    const priority = [[state.priority.leader, 'CORRIDA'], [state.priority.killer, 'ABATES']].filter(([id]) => id && state.present.includes(id));
    if (priority.length) centered(ctx, fit(`PASSA DIRETO: ${priority.map(([id, why]) => `${nameOf(id).toUpperCase()} (LIDER ${why})`).join(', DEPOIS ')}`, 104), VIEW.width / 2, 43, COLOR.selected);

    const result = state.result;
    const active = result?.segments.find(segment => state.elapsed >= segment.start && state.elapsed < segment.end);
    const byCard = new Map(state.offer.map(id => [id, []])), free = [];
    for (const player of state.players) {
      if (!state.present.includes(player)) continue;
      const weaponId = dockedWeapon(player);
      if (weaponId) byCard.get(weaponId)?.push(player);
      else free.push(player);
    }
    for (const card of cards) {
      const players = byCard.get(card.id), owner = ownerOf(card.id);
      // Decidida nesta rodada: a disputa acabou ou, sem disputa, alguém ganhou.
      const decided = Boolean(result) && (result.contested.has(card.id)
        ? result.segments.some(segment => segment.duel.w === card.id && state.elapsed >= segment.end)
        : Object.values(result.assigned).includes(card.id));
      const winner = owner ?? (decided ? Object.keys(result.assigned).find(id => result.assigned[id] === card.id) : undefined);
      const mine = winner ? winner === state.myId : !result && state.picks.get(state.myId) === card.id;
      const clickable = canPick() && !owner;
      if (clickable) markClickable(card);
      drawCard(ctx, card, { hovered: clickable && inside(card, pointer.x, pointer.y), mine, owned: Boolean(winner) });
      if (owner) { ctx.fillStyle = 'rgba(24,10,5,.5)'; ctx.fillRect(card.x + 1, card.y + 1, card.width - 2, card.height - 2); }   // de rodada anterior: fora da disputa
      drawDocked(ctx, card, players);
      if (result && !decided && result.contested.has(card.id)) centered(ctx, 'DISPUTA!', card.x + card.width / 2, card.y + card.height + 4, Math.floor(state.elapsed * 4) % 2 ? COLOR.danger : COLOR.gold);
    }
    drawFooter(ctx);
    if (active) drawDuel(ctx, active);
    else drawFreeHands(ctx, free);
  };
  return screen;
}
