// Ligação com o servidor de salas. Guarda a lista de salas e a sala atual; o jogo se pendura nos callbacks.
// `?server=host:porta` na URL permite jogar em um servidor diferente do que entregou a página.

const SERVER_ADDRESS = new URLSearchParams(location.search).get('server') ?? location.host;
const SERVER_ERRORS = {
  full: 'SALA CHEIA', in_progress: 'PARTIDA EM ANDAMENTO', banned: 'VOCE FOI EXPULSO DESTA SALA',
  no_room: 'SALA NAO ENCONTRADA', cannot_create: 'NAO FOI POSSIVEL CRIAR A SALA',
};
export const LEFT_REASONS = { kicked: 'VOCE FOI EXPULSO DA SALA', closed: 'O ADMIN ENCERROU A SALA', lost: 'CONEXAO COM O SERVIDOR PERDIDA' };

export function createRoomClient() {
  let socket = null;

  const client = {
    status: 'offline', id: null, rooms: [], room: null, notice: '', ranking: null,
    onStarted: () => {}, onEnded: () => {}, onGame: () => {}, onRoomChange: () => {}, onLeft: () => {},
    connect, setName, create, join, leave, kick, configure, start, endMatch, requestRanking, relay,
    get isAdmin() { return client.room?.hostId === client.id; },
  };

  const send = message => { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); };

  const HANDLERS = {
    welcome(message) {
      client.id = message.id;
      client.status = 'online';
      client.onWelcome?.();
    },
    rooms(message) { client.rooms = message.rooms; },
    ranking(message) { client.ranking = message.players; },
    room(message) {
      client.room = message.room;
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

  function connect(onWelcome) {
    client.onWelcome = onWelcome;
    if (socket && socket.readyState <= WebSocket.OPEN) {
      if (client.status === 'online') onWelcome?.();
      return;
    }
    client.status = 'connecting';
    socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${SERVER_ADDRESS}/ws`);
    socket.onmessage = event => {
      const message = JSON.parse(event.data);
      HANDLERS[message.t]?.(message);
    };
    socket.onclose = () => {
      const wasInRoom = client.room !== null, everConnected = client.status === 'online';
      client.status = 'offline';
      client.room = null;
      client.rooms = [];
      client.notice = everConnected ? LEFT_REASONS.lost : 'SERVIDOR NAO ENCONTRADO. ABRA O JOGO PELO RUN.SH';
      if (wasInRoom) client.onLeft('lost');
    };
  }

  function setName(name) { send({ t: 'name', name }); }
  function create() { client.notice = ''; send({ t: 'create' }); }
  function join(room) { client.notice = ''; send({ t: 'join', room }); }
  function leave() { send({ t: 'leave' }); client.room = null; }
  function kick(id) { send({ t: 'kick', id }); }
  function configure(config) { send({ t: 'config', ...config }); }
  function start() { send({ t: 'start' }); }
  // `results` traz o que cada jogador humano fez na partida, para o histórico do servidor.
  function endMatch(results) { send({ t: 'end', results }); }
  function requestRanking() { connect(() => send({ t: 'ranking' })); }
  // Mensagem do jogo para a sala toda ou, com `to`, para um jogador só.
  function relay(data, to) { send({ t: 'g', d: data, ...(to ? { to } : {}) }); }

  return client;
}
