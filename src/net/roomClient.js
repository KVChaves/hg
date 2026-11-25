// Ligação com o servidor de salas. Guarda a lista de salas e a sala atual; o jogo se pendura nos callbacks.
// `?server=host:porta` na URL permite jogar em um servidor diferente do que entregou a página.

const SERVER_ADDRESS = new URLSearchParams(location.search).get('server') ?? location.host;
const SERVER_ERRORS = {
  full: 'SALA CHEIA', in_progress: 'PARTIDA EM ANDAMENTO', banned: 'VOCE FOI EXPULSO DESTA SALA',
  no_room: 'SALA NAO ENCONTRADA', need_racers: 'ADICIONE UM BOT PARA INICIAR', cannot_create: 'NAO FOI POSSIVEL CRIAR A SALA',
};
export const LEFT_REASONS = { kicked: 'VOCE FOI EXPULSO DA SALA', closed: 'O ADMIN ENCERROU A SALA', lost: 'CONEXAO COM O SERVIDOR PERDIDA' };

export const ROOM_NAME_LENGTH = 20;

const CONFIG_KEY = 'halfgrip.roomConfig';            // a última configuração de sala do admin, para a próxima sala já nascer igual
const RESUME_SECONDS = 20, RESUME_RETRY_MS = 1000, CHAT_KEEP = 30;
const readSavedConfig = () => {
  try { return JSON.parse(localStorage.getItem(CONFIG_KEY)) ?? {}; } catch { return {}; }
};
const saveConfig = config => {
  const kept = Object.fromEntries(Object.entries({ ...readSavedConfig(), ...config }).filter(([key]) => ['bots', 'races', 'backShots'].includes(key)));
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(kept)); } catch { /* sem armazenamento: só não lembra */ }
};

export function createRoomClient() {
  let socket = null, resumeDeadline = 0;
  const waiting = [];                                // pedidos à espera da conexão (rodam no `welcome`)

  const client = {
    status: 'offline', id: null, rooms: [], room: null, notice: '', ranking: null, history: null, historyPlayers: [], matchRaces: null, stats: null, statsPlayers: null, token: null, chat: [],
    online: null,                                    // jogadores conectados ao servidor (contando este); nulo sem conexão
    onStarted: () => {}, onEnded: () => {}, onGame: () => {}, onRoomChange: () => {}, onLeft: () => {},
    connect, setName, create, join, leave, kick, configure, start, endRace, endMatch, requestRanking, requestHistory, requestMatch, requestStats, sendCombat, sendChat, relay,
    get isAdmin() { return client.room?.hostId === client.id; },
  };

  const send = message => { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); };

  const HANDLERS = {
    welcome(message) {
      if (resumeDeadline) return;                    // reconectando: o servidor devolve o id antigo em `resumed`
      client.id = message.id;
      client.token = message.token;
      client.status = 'online';
      client.notice = '';
      waiting.splice(0).forEach(callback => callback());
    },
    rooms(message) { client.rooms = message.rooms; },
    online(message) { client.online = message.count; },
    ranking(message) { client.ranking = message.players; },
    history(message) {
      if (message.match) client.matchRaces = message.races;
      else { client.history = message.races; client.historyPlayers = message.players ?? []; }
    },
    chat(message) {
      client.chat = [...client.chat, { name: message.name, text: message.text, at: performance.now() }].slice(-CHAT_KEEP);   // `at`: quando chegou, para a mensagem sumir da tela sozinha
      client.onChat?.(message);
    },
    chatlog(message) { client.chat = message.lines.slice(-CHAT_KEEP); },
    resumed(message) {
      resumeDeadline = 0;
      client.id = message.id;
      client.status = 'online';
      client.room = message.room;
      client.chat = (message.chat ?? []).slice(-CHAT_KEEP);
      client.onRoomChange(message.room);
    },
    resume_failed() { giveUp(); },
    stats(message) { client.statsPlayers = message.players; client.stats = message.stats; },
    room(message) {
      const created = client.room === null && message.room.hostId === client.id;
      client.room = message.room;
      if (created) send({ t: 'config', ...readSavedConfig() });     // sala nova do admin nasce com a última configuração
      client.notice = '';
      client.onRoomChange(message.room);
    },
    started(message) {
      client.room = message.room;
      client.onStarted(message.room);
    },
    ended(message) {
      client.room = message.room;
      client.onEnded(message.room);
    },
    left(message) {
      client.room = null;
      client.notice = LEFT_REASONS[message.reason] ?? '';
      client.onLeft(message.reason);
    },
    error(message) { client.notice = SERVER_ERRORS[message.code] ?? 'ERRO NO SERVIDOR'; },
    g(message) { client.onGame(message.from, message.d); },
  };

  // Cada pedido feito antes da conexão abrir espera na fila: o menu pede ranking e histórico juntos.
  function connect(onWelcome) {
    if (client.status === 'online' && socket?.readyState === WebSocket.OPEN) { onWelcome?.(); return; }
    if (onWelcome) waiting.push(onWelcome);
    if (socket && socket.readyState <= WebSocket.OPEN) return;
    client.status = resumeDeadline ? 'reconnecting' : 'connecting';
    socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${SERVER_ADDRESS}/ws`);
    socket.onopen = () => { if (resumeDeadline) send({ t: 'resume', token: client.token }); };
    socket.onmessage = event => {
      const message = JSON.parse(event.data);
      HANDLERS[message.t]?.(message);
    };
    socket.onclose = () => {
      if (resumeDeadline) { retryResume(); return; }
      const wasInRoom = client.room !== null, everConnected = client.status === 'online' || client.status === 'reconnecting';
      if (wasInRoom && client.token) {                // a conexão caiu dentro de uma sala: o servidor guarda a vaga por alguns segundos
        resumeDeadline = Date.now() + RESUME_SECONDS * 1000;
        client.status = 'reconnecting';
        retryResume();
        return;
      }
      client.status = 'offline';
      client.online = null;
      client.room = null;
      client.rooms = [];
      client.notice = everConnected ? LEFT_REASONS.lost : 'SERVIDOR NAO ENCONTRADO. ABRA O JOGO PELO RUN.SH';
      if (wasInRoom) client.onLeft('lost');
    };
  }

  function retryResume() {
    if (Date.now() > resumeDeadline) { giveUp(); return; }
    setTimeout(() => { if (resumeDeadline) connect(); }, RESUME_RETRY_MS);
  }

  function giveUp() {
    resumeDeadline = 0;
    const wasInRoom = client.room !== null;
    client.status = 'offline';
    client.online = null;
    client.room = null;
    client.rooms = [];
    client.notice = LEFT_REASONS.lost;
    socket?.close();
    if (wasInRoom) client.onLeft('lost');
  }

  function setName(name) { send({ t: 'name', name }); }
  // Sem nome, o servidor chama a sala de "Sala de <admin>".
  function create(name = '') { client.notice = ''; send({ t: 'create', name }); }
  function join(room) { client.notice = ''; send({ t: 'join', room }); }
  function leave() { send({ t: 'leave' }); client.room = null; }
  function kick(id) { send({ t: 'kick', id }); }
  function configure(config) { saveConfig(config); send({ t: 'config', ...config }); }
  function start() { send({ t: 'start' }); }
  // Uma corrida terminou: `results` lista todos os pilotos (humanos e bots) na ordem de chegada.
  function endRace(biome, results) { send({ t: 'race', biome, results }); }
  // `results` traz o que cada jogador humano fez na partida, para o histórico do servidor.
  function endMatch(results) { send({ t: 'end', results }); }
  function requestRanking() { connect(() => send({ t: 'ranking' })); }
  function sendCombat(stats) { send({ t: 'combat', stats }); }
  function requestStats(player = '') { client.stats = null; connect(() => send({ t: 'stats', player })); }
  function requestHistory(player = '') { client.history = null; connect(() => send({ t: 'history', player })); }
  function requestMatch(match) { client.matchRaces = null; connect(() => send({ t: 'history', match })); }
  function sendChat(text) { send({ t: 'chat', text }); }
  // Mensagem do jogo para a sala toda ou, com `to`, para um jogador só.
  function relay(data, to) { send({ t: 'g', d: data, ...(to ? { to } : {}) }); }

  return client;
}
