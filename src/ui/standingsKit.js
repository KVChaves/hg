import { ctxText, textWidth } from '../art/font.js';
import { COLOR, MEDALS } from './panelKit.js';

// Peças das tabelas de classificação (tela de resultados e tabela do TAB): medalhas, caveira dos abates,
// selo de posição, seta de quem subiu ou caiu e o fundo de cada linha.

export const PLAYER_COLOR = '#f01818';
export const OTHER_COLOR = '#b8b4a8';
export const ZERO_COLOR = '#6a4a38';                 // zeros apagados, para os números que importam saltarem
const MEDAL_RIM = ['#8a6010', '#6a7484', '#7a4420'];
const MEDAL_SHINE = ['#fff0a0', '#ffffff', '#f0b080'];
const RIBBONS = ['#c02818', '#2858a8', '#2a7a3a'];
const UP_COLOR = '#7ad04a', DOWN_COLOR = '#e8582a';

function disc(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  for (let dy = -Math.floor(r); dy <= Math.floor(r); dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    ctx.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
  }
}

// Medalha pequena com fita (cabeçalho das colunas de ouro, prata e bronze). (cx, cy) é o centro do disco.
export function drawMedal(ctx, cx, cy, place) {
  ctx.fillStyle = RIBBONS[place];
  ctx.fillRect(cx - 3, cy - 7, 2, 4);
  ctx.fillRect(cx + 2, cy - 7, 2, 4);
  disc(ctx, cx, cy, 3.6, MEDAL_RIM[place]);
  disc(ctx, cx, cy, 2.6, MEDALS[place]);
  ctx.fillStyle = MEDAL_SHINE[place];
  ctx.fillRect(cx - 1, cy - 2, 1, 1);
}

// Caveira de 7x7 dos abates; (x, y) é o canto de cima.
const SKULL = ['.XXXXX.', 'XXXXXXX', 'X..X..X', 'XXX.XXX', '.XXXXX.', '.X.X.X.'];
export function drawSkull(ctx, x, y, color = COLOR.text) {
  ctx.fillStyle = color;
  SKULL.forEach((row, dy) => [...row].forEach((c, dx) => { if (c === 'X') ctx.fillRect(x + dx, y + dy, 1, 1); }));
}

// Posição: os três primeiros num selo da cor da medalha; os outros só o número. (cx, cy) é o centro.
export function drawPlaceBadge(ctx, cx, cy, place) {
  const label = String(place + 1);
  if (place < 3) {
    disc(ctx, cx, cy, 6.5, MEDAL_RIM[place]);
    disc(ctx, cx, cy, 5.5, MEDALS[place]);
    ctx.fillStyle = MEDAL_SHINE[place];
    ctx.fillRect(cx - 3, cy - 4, 2, 1);
    ctxText(ctx, label, cx - Math.floor(textWidth(label) / 2) + 1, cy - 3, COLOR.ink);
  } else ctxText(ctx, label, cx - Math.floor(textWidth(label) / 2) + 1, cy - 3, COLOR.muted);
}

// Quantas posições o piloto ganhou (positivo) ou perdeu desde a corrida anterior. (x, cy): começo e meio da linha.
export function drawMove(ctx, x, cy, delta) {
  if (!delta) { ctx.fillStyle = ZERO_COLOR; ctx.fillRect(x + 1, cy, 4, 1); return; }
  const color = delta > 0 ? UP_COLOR : DOWN_COLOR;
  ctx.fillStyle = color;
  // Triângulo de 3 linhas: a ponta em cima para quem subiu, embaixo para quem caiu.
  for (let row = 0; row < 3; row++) ctx.fillRect(x + 2 - row, delta > 0 ? cy - 1 + row : cy + 1 - row, 1 + row * 2, 1);
  ctxText(ctx, String(Math.abs(delta)), x + 7, cy - 3, color);
}

// Fundo da linha: listras alternadas e, na do jogador, uma faixa vermelha com a borda acesa.
export function drawStandingRow(ctx, box, index, mine) {
  if (mine) {
    ctx.fillStyle = 'rgba(240, 40, 24, 0.16)';
    ctx.fillRect(box.x, box.y, box.width, box.height);
    ctx.fillStyle = PLAYER_COLOR;
    ctx.fillRect(box.x, box.y, 2, box.height);
  } else if (index % 2 === 0) {
    ctx.fillStyle = 'rgba(255, 180, 110, 0.05)';
    ctx.fillRect(box.x, box.y, box.width, box.height);
  }
}

// Cor do nome: medalha no pódio; fora dele o jogador em vermelho e os outros em cinza.
export const nameColor = (place, mine) => MEDALS[place] ?? (mine ? PLAYER_COLOR : OTHER_COLOR);

// Número centrado numa coluna; zero fica apagado.
export function drawCount(ctx, value, cx, y, color = COLOR.text, scale = 1) {
  const text = String(value);
  ctxText(ctx, text, cx - Math.floor(textWidth(text, scale) / 2) + scale, y, text === '0' ? ZERO_COLOR : color, scale);
}

// Pontos com vírgula, como se escreve no Brasil (1,5).
export const formatPoints = points => String(points).replace('.', ',');
