import { ctxText, textWidth } from '../art/font.js';
import { COLOR, inside, outline, pointerOnStage } from './panelKit.js';

// Chat global: todo jogador conectado ao servidor lê todas as mensagens, esteja em sala, em corrida, no menu ou na garagem.
// Fechado, o chat não ocupa a tela: só fica um ícone de mensagem no canto inferior esquerdo quando chega mensagem nova.
// ENTER (ou a tecla escolhida nas configurações, ou um clique no ícone) abre a caixa no mesmo canto e a mensagem é digitada ali mesmo; ENTER com texto envia e a caixa continua aberta;
// fecha com ENTER sem digitar nada, com um clique fora ou com ESC.
// O servidor limpa o texto e limita a frequência; aqui só se desenha e se envia.

const CHAT_LENGTH = 60, LINE_HEIGHT = 11, CURSOR_BLINK = 400, ICON_BLINK = 500;
const AREA = { x: 6, bottom: 354, width: 330, openLines: 8 };
const ICON = { x: 6, y: 330, width: 22, height: 16 };
const PAD = 4;
const TYPABLE = /^[A-Za-z0-9 .,!?:()/+*%-]$/;      // o que a fonte do jogo desenha e o servidor aceita

// O caractere que a tecla digita, sem acento; vazio se não escreve nada aceito.
const typedCharacter = key => {
  const typed = key.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  return TYPABLE.test(typed) ? typed : '';
};

export function createChatBox({ stage, net, canOpen = () => true, isOwn = () => false, openCodes = () => ['Enter'], isRebinding = () => false }) {
  let pointer = { x: -1, y: -1 }, draft = null, readAt = performance.now();   // `draft` nulo: caixa fechada
  addEventListener('mousemove', e => { pointer = pointerOnStage(e, stage); });

  const isOpen = () => draft !== null;
  const openBox = () => {
    if (net.status !== 'online') net.connect();       // quem ainda não conseguiu conectar tenta de novo
    draft = '';
    readAt = performance.now();                        // abrir a caixa é ler: o ícone some
  };
  // ENTER com texto envia e deixa a caixa aberta para a próxima mensagem; ENTER sem nada digitado fecha.
  const submit = () => {
    readAt = performance.now();
    const text = draft.replace(/ +/g, ' ').trim();
    if (text) { net.sendChat(text); draft = ''; }
    else draft = null;
  };

  // Em captura: roda antes das outras telas, então vê se algum campo de texto já estava aberto antes deste ENTER.
  addEventListener('keydown', e => {
    if (isOpen()) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.repeat && (e.key === 'Enter' || e.key === 'Escape')) return;
      if (e.key === 'Enter') submit();
      else if (e.key === 'Escape') draft = null;
      else if (e.key === 'Backspace') draft = draft.slice(0, -1);
      else if (draft.length < CHAT_LENGTH) draft += typedCharacter(e.key);
      return;
    }
    if (!openCodes().includes(e.code) || e.repeat || !canOpen() || isRebinding()) return;
    e.preventDefault();
    e.stopImmediatePropagation();                     // este ENTER só abre o chat: nada mais deve reagir a ele
    openBox();
  }, true);

  function fit(text, width) {
    while (text.length > 1 && textWidth(text) > width) text = text.slice(0, -1);
    return text;
  }

  // Mensagens de outros jogadores que chegaram depois da última vez que a caixa foi aberta.
  const unread = () => net.chat.filter(line => line.at > readAt && !isOwn(line)).length;

  const boxRect = () => {
    const height = (AREA.openLines + 1) * LINE_HEIGHT + PAD * 2 + 2;
    return { x: AREA.x - PAD, y: AREA.bottom - height + PAD, width: AREA.width + PAD * 2, height };
  };

  function drawLine(ctx, line, y) {
    const name = `${line.name}: `;
    ctxText(ctx, name, AREA.x, y, COLOR.selected);
    ctxText(ctx, fit(line.text, AREA.width - textWidth(name)), AREA.x + textWidth(name), y, COLOR.text);
  }

  return {
    isOpen,
    // Clique com a caixa aberta: fora dela fecha sem enviar. Sempre devolve true: o clique não vai para a tela de baixo.
    click(x, y) {
      if (!inside(boxRect(), x, y)) draft = null;
      return true;
    },
    // Clique no ícone de mensagem nova (caixa fechada) abre a caixa.
    clickIcon(x, y) {
      if (isOpen() || !canOpen() || !unread() || !inside(ICON, x, y)) return false;
      openBox();
      return true;
    },
    cancel: () => { draft = null; },
    draw(ctx) {
      const now = performance.now();
      if (!isOpen()) { if (canOpen()) drawIcon(ctx, now); return; }
      const box = boxRect();
      ctx.fillStyle = 'rgba(20, 10, 7, 0.88)';
      ctx.fillRect(box.x, box.y, box.width, box.height);
      outline(ctx, box, COLOR.selected);
      const lines = net.chat.slice(-AREA.openLines), top = box.y + PAD;
      lines.forEach((line, i) => drawLine(ctx, line, top + (AREA.openLines - lines.length + i) * LINE_HEIGHT));
      const inputY = top + AREA.openLines * LINE_HEIGHT + 3;
      ctx.fillStyle = COLOR.selected;
      ctx.fillRect(box.x + 2, inputY - 3, box.width - 4, 1);
      const cursor = Math.floor(now / CURSOR_BLINK) % 2 === 0 ? '_' : '';
      const text = net.status === 'online' ? `> ${draft}${cursor}` : 'SEM CONEXAO COM O SERVIDOR';
      ctxText(ctx, fit(text, AREA.width), AREA.x, inputY, net.status === 'online' ? COLOR.text : COLOR.muted);
    },
  };

  // Envelope em pixels com o número de mensagens novas; pisca devagar para chamar a atenção sem atrapalhar.
  function drawIcon(ctx, now) {
    const count = unread();
    if (!count) return;
    const lit = Math.floor(now / ICON_BLINK) % 2 === 0, { x, y, width, height } = ICON;
    ctx.fillStyle = 'rgba(20, 10, 7, 0.75)';
    ctx.fillRect(x - 2, y - 2, width + 4, height + 4);
    ctx.fillStyle = lit ? COLOR.selected : COLOR.rust;
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = COLOR.ink;                          // aba do envelope: duas diagonais até o meio
    for (let i = 0; i < width / 2 - 1; i++) {
      const drop = Math.round(i * (height / 2 - 2) / (width / 2 - 1));
      ctx.fillRect(x + 1 + i, y + 1 + drop, 1, 1);
      ctx.fillRect(x + width - 2 - i, y + 1 + drop, 1, 1);
    }
    const label = count > 9 ? '9+' : String(count);
    ctxText(ctx, label, x + width + 5, y + 4, COLOR.text);
  }
}
