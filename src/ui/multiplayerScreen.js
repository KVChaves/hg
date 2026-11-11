import { MAX_RACERS, VIEW } from '../config.js';
import { ctxText, textWidth } from '../art/font.js';
import { createNameField } from './nameField.js';
import { ROOM_NAME_LENGTH } from '../net/roomClient.js';
import { COLOR, drawButton, inside, panelBox, pointerOnStage } from './panelKit.js';
import { createTextPrompt } from './textPrompt.js';

// Multiplayer: lista de salas e, dentro de uma sala, os corredores e a configuração do admin.

const PANEL = { x: 60, y: 24, width: 520, height: 312 };
const NAME_BOX = { x: 80, y: 62, width: 150, height: 28 };
const CREATE = { x: 420, y: 64, width: 140, height: 26 };
const BACK = { x: 245, y: 300, width: 150, height: 26 };
const ROOM_ROW = { top: 122, height: 26, count: 6 };
const JOIN_X = 484, JOIN_WIDTH = 76;
const ROOM_PROMPT = { x: 150, y: 70, width: 340, height: 200 };

const ROSTER = { x: 78, top: 66, height: 28 };
const KICK = { x: 262, width: 70, height: 22 };
const CONFIG_X = 356, CONFIG_ROWS = [78, 128], ARROW = 26, VALUE_WIDTH = 50, ARROW_X = 460;
const GARAGE = { x: 368, y: 222, width: 190, height: 26 };
const START = { x: 368, y: 256, width: 190, height: 26 };
const LEAVE = { x: 368, y: 290, width: 190, height: 26 };
const CONFIG_FIELDS = [{ key: 'bots', label: 'BOTS', min: 0 }, { key: 'races', label: 'CORRIDAS', min: 1, max: 10 }];

const centered = (ctx, text, y, color, scale = 1) => ctxText(ctx, text, Math.round(VIEW.width / 2 - textWidth(text, scale) / 2), y, color, scale);

export function createMultiplayerScreen({ stage, net, getName, setName, onBack, onGarage, isWaiting }) {
  const screen = { isOpen: false };
  let pointer = { x: -1, y: -1 }, queued = null;

  const nameField = createNameField({ box: NAME_BOX, getName, setName: name => { setName(name); net.setName(name); } });

  const roomPrompt = createTextPrompt({
    box: ROOM_PROMPT, title: 'NOME DA SALA', confirmLabel: 'CRIAR', maxLength: ROOM_NAME_LENGTH, allowEmpty: true,
    isActive: () => screen.isOpen,
    onConfirm: name => net.create(name),
  });

  const joinButton = index => ({ x: JOIN_X, y: ROOM_ROW.top + index * ROOM_ROW.height + 2, width: JOIN_WIDTH, height: ROOM_ROW.height - 6 });
  const kickButton = index => ({ ...KICK, y: ROSTER.top + index * ROSTER.height + 1 });
  const arrows = CONFIG_FIELDS.flatMap((field, row) => [
    { field, step: -1, label: '<', x: ARROW_X, y: CONFIG_ROWS[row] - 6, width: ARROW, height: 22 },
    { field, step: 1, label: '>', x: ARROW_X + ARROW + VALUE_WIDTH, y: CONFIG_ROWS[row] - 6, width: ARROW, height: 22 },
  ]);

  const isOpenRoomFull = room => room.players >= MAX_RACERS;

  function clickBrowse(x, y) {
    if (nameField.click(x, y)) return;
    if (inside(BACK, x, y)) { queued = () => { screen.isOpen = false; onBack(); }; return; }
    if (net.status !== 'online') return;
    if (inside(CREATE, x, y)) { roomPrompt.open({ emptyHint: `EM BRANCO FICA SALA DE ${getName()}` }); return; }
    net.rooms.slice(0, ROOM_ROW.count).forEach((room, i) => {
      if (inside(joinButton(i), x, y) && !isOpenRoomFull(room)) net.join(room.id);
    });
  }

  
  function clickRoom(x, y) {
    const { room } = net;
    if (inside(LEAVE, x, y)) { net.leave(); return; }
    if (inside(GARAGE, x, y)) { queued = () => { screen.isOpen = false; onGarage(); }; return; }   // a sala continua aberta
    if (!net.isAdmin) return;
    if (inside(START, x, y)) { net.start(); return; }
    const arrow = arrows.find(candidate => inside(candidate, x, y));
    if (arrow) { net.configure({ [arrow.field.key]: room.config[arrow.field.key] + arrow.step }); return; }   // o servidor limita ao que cabe na sala
    room.players.forEach((player, i) => {
      if (player.id !== net.id && inside(kickButton(i), x, y)) net.kick(player.id);
    });
    // Expulsar um bot libera a vaga; os bots são iguais na lista, então sai um deles.
    for (let i = room.players.length; i < room.players.length + room.config.bots; i++) {
      if (inside(kickButton(i), x, y)) { net.configure({ bots: room.config.bots - 1 }); return; }
    }
  }

  addEventListener('mousemove', e => { if (screen.isOpen) pointer = pointerOnStage(e, stage); });
  stage.addEventListener('click', e => {
    if (!screen.isOpen) return;
    const { x, y } = pointerOnStage(e, stage);
    if (roomPrompt.isOpen()) roomPrompt.click(x, y);
    else if (net.room) clickRoom(x, y);
    else clickBrowse(x, y);
  });

  screen.open = notice => {
    roomPrompt.cancel();
    screen.isOpen = true;
    if (notice) net.notice = notice;
    net.connect(() => net.setName(getName()));
  };
  screen.close = () => { screen.isOpen = false; };
  screen.isTyping = () => nameField.isEditing() || roomPrompt.isOpen();
  screen.update = () => {
    if (!queued) return;
    queued();
    queued = null;
  };

  function drawNotice(ctx, y) {
    if (net.notice) centered(ctx, net.notice, y, COLOR.danger);
  }

  function drawBrowse(ctx) {
    centered(ctx, 'MULTIPLAYER', PANEL.y + 12, COLOR.selected, 2);
    nameField.draw(ctx, pointer);
    if (net.status === 'online') drawButton(ctx, CREATE, 'CRIAR SALA', inside(CREATE, pointer.x, pointer.y));
    else if (net.status === 'connecting') ctxText(ctx, 'CONECTANDO...', CREATE.x, CREATE.y + 9, COLOR.muted);

    ctxText(ctx, 'SALAS ABERTAS', PANEL.x + 20, ROOM_ROW.top - 14, COLOR.muted);
    if (!net.rooms.length && net.status === 'online') centered(ctx, 'NENHUMA SALA. CRIE A SUA!', ROOM_ROW.top + 50, COLOR.text);
    net.rooms.slice(0, ROOM_ROW.count).forEach((room, i) => {
      const y = ROOM_ROW.top + i * ROOM_ROW.height + 7, button = joinButton(i), full = isOpenRoomFull(room);
      ctxText(ctx, room.name, PANEL.x + 20, y, COLOR.text);
      ctxText(ctx, `${room.players}/${room.cars}`, PANEL.x + 300, y, full ? COLOR.danger : COLOR.muted);
      if (room.phase === 'playing') ctxText(ctx, 'EM JOGO', PANEL.x + 340, y, COLOR.selected);
      if (full) ctxText(ctx, 'CHEIA', button.x + 20, y, COLOR.danger);
      else drawButton(ctx, button, 'ENTRAR', inside(button, pointer.x, pointer.y));
    });
    drawNotice(ctx, BACK.y - 16);
    drawButton(ctx, BACK, '< MENU', inside(BACK, pointer.x, pointer.y));
  }

  function drawRoster(ctx, room) {
    for (let i = 0; i < MAX_RACERS; i++) {
      const y = ROSTER.top + i * ROSTER.height + 7, player = room.players[i];
      const isBot = !player && i < room.players.length + room.config.bots;
      ctxText(ctx, `${i + 1}.`, ROSTER.x, y, COLOR.muted);
      if (player) {
        ctxText(ctx, player.name, ROSTER.x + 24, y, player.id === net.id ? COLOR.selected : COLOR.text);
        if (player.id === room.hostId) ctxText(ctx, 'ADMIN', ROSTER.x + 110, y, COLOR.selected);
        if (net.isAdmin && player.id !== net.id) drawButton(ctx, kickButton(i), 'EXPULSAR', inside(kickButton(i), pointer.x, pointer.y));
      } else {
        ctxText(ctx, isBot ? 'BOT' : 'VAGA LIVRE', ROSTER.x + 24, y, COLOR.muted);
        if (isBot && net.isAdmin) drawButton(ctx, kickButton(i), 'EXPULSAR', inside(kickButton(i), pointer.x, pointer.y));
      }
    }
  }

  function drawConfig(ctx, room) {
    CONFIG_FIELDS.forEach((field, row) => {
      const y = CONFIG_ROWS[row], value = String(room.config[field.key]);
      ctxText(ctx, field.label, CONFIG_X, y, COLOR.text);
      ctxText(ctx, value, ARROW_X + ARROW + Math.round((VALUE_WIDTH - textWidth(value)) / 2), y, COLOR.selected);
    });
    if (net.isAdmin) for (const arrow of arrows) drawButton(ctx, arrow, arrow.label, inside(arrow, pointer.x, pointer.y));
    const bots = room.config.bots;
    ctxText(ctx, `${room.players.length} JOGADORES E ${bots} BOTS`, CONFIG_X, 172, COLOR.muted);
    if (isWaiting()) {
      ctxText(ctx, 'PARTIDA EM ANDAMENTO', START.x + 12, START.y - 72, COLOR.selected);
      ctxText(ctx, 'VOCE ENTRA QUANDO A', START.x + 12, START.y - 60, COLOR.text);
      ctxText(ctx, 'CORRIDA ACABAR', START.x + 12, START.y - 48, COLOR.text);
    } else if (net.isAdmin) drawButton(ctx, START, 'INICIAR PARTIDA', inside(START, pointer.x, pointer.y));
    else ctxText(ctx, 'AGUARDANDO O ADMIN', START.x + 42, START.y + 9, COLOR.muted);
    drawButton(ctx, GARAGE, 'GARAGEM', inside(GARAGE, pointer.x, pointer.y));
    drawButton(ctx, LEAVE, net.isAdmin ? 'ENCERRAR SALA' : 'SAIR DA SALA', inside(LEAVE, pointer.x, pointer.y));
  }

  screen.draw = ctx => {
    panelBox(ctx, PANEL);
    if (roomPrompt.isOpen()) { roomPrompt.draw(ctx, pointer); return; }
    const { room } = net;
    if (!room) { drawBrowse(ctx); return; }
    centered(ctx, room.name, PANEL.y + 12, COLOR.selected, 2);
    drawRoster(ctx, room);
    drawConfig(ctx, room);
  };
  return screen;
}
