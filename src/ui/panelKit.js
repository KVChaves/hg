import { VIEW } from '../config.js';
import { ctxText, plotText, textWidth } from '../art/font.js';
import { loadPng, pngNow } from '../cabin/pngPixels.js';

// Peças visuais compartilhadas pelas telas de menu: oficina à luz de lâmpada, café escuro, ferrugem e âmbar.

export const COLOR = {
  panel: '#24150f', edge: '#5a3424', tile: '#43281d', tileHover: '#5e3826', tileBevel: '#6e4430', tileDark: '#2c1a13',
  selected: '#ffb040', text: '#f6e7cf', button: '#a8401c', buttonHover: '#d0562a',
  tooltip: '#3a2014', tooltipEdge: '#ffb040', muted: '#bf9372', backdrop: '#1c100b', danger: '#ff6a4a',
  ink: '#140a07', gold: '#ffd36a', ember: '#e8582a', rust: '#a8461e',
};

// Tons de cada tipo de botão: corpo, brilho de cima, sombra de baixo, contorno e texto (normal e com o ponteiro em cima).
const TONES = {
  normal: {
    idle: { body: '#4a2619', light: '#66361f', shade: '#2e160e', edge: COLOR.ink, text: COLOR.text },
    hover: { body: '#6a3422', light: '#8e4a2e', shade: '#3e1d12', edge: COLOR.ink, text: '#fff4dc' },
  },
  primary: {
    idle: { body: '#ec8f28', light: '#ffcf70', shade: '#a8480f', edge: '#3a1404', text: '#2a1206' },
    hover: { body: '#ffa83a', light: '#ffe49a', shade: '#c0561a', edge: '#3a1404', text: '#1c0a02' },
  },
  danger: {
    idle: { body: '#5a1810', light: '#7a281a', shade: '#360c08', edge: COLOR.ink, text: '#ffd2c0' },
    hover: { body: '#8a2416', light: '#b23a22', shade: '#4e1208', edge: COLOR.ink, text: '#fff0e8' },
  },
};

// Arte de interface antiga (cinza). Fica carregada para quem ainda usa `uiImage`, mas o kit agora desenha tudo em código.
const UI = {
  panel: 'assets/ui/panel.png', button: 'assets/ui/button.png', buttonPressed: 'assets/ui/button-pressed.png',
  cell: 'assets/ui/cell.png', cellHover: 'assets/ui/cell-hover.png', sliderThumb: 'assets/ui/slider-thumb.png',
};
for (const path of Object.values(UI)) loadPng(path).catch(() => {});
export const uiImage = name => pngNow(UI[name]);

// Preenche `box` com a imagem: bordas de `edge` pixels intactas e o miolo repetido (nine-slice).
export function nineSlice(ctx, image, box, edge) {
  const { width: iw, height: ih } = image;
  const e = Math.min(edge, Math.floor(box.width / 2), Math.floor(box.height / 2));
  const xs = [0, e, iw - e, iw], ys = [0, e, ih - e, ih];
  const dx = [box.x, box.x + e, box.x + box.width - e, box.x + box.width], dy = [box.y, box.y + e, box.y + box.height - e, box.y + box.height];
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    const w = dx[i + 1] - dx[i], h = dy[j + 1] - dy[j], sw = xs[i + 1] - xs[i], sh = ys[j + 1] - ys[j];
    if (w <= 0 || h <= 0 || sw <= 0 || sh <= 0) continue;
    // repete o miolo em vez de esticar, para as manchas da textura não alongarem
    for (let ty = 0; ty < h; ty += sh) for (let tx = 0; tx < w; tx += sw) {
      const cw = Math.min(sw, w - tx), ch = Math.min(sh, h - ty);
      ctx.drawImage(image, xs[i], ys[j], cw, ch, dx[i] + tx, dy[j] + ty, cw, ch);
    }
  }
}

export const MEDALS = ['#f0c840', '#c8d4e4', '#cc8448'];     // ouro, prata e bronze

export const inside = ({ x, y, width, height }, px, py) => px >= x && py >= y && px < x + width && py < y + height;
export const toCss = c => `#${c.toString(16).padStart(6, '0')}`;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// O que a tela desenhou de clicável neste quadro; serve para tocar o som de clique só em cima de algo.
const clickable = [];
export const clearClickable = () => { clickable.length = 0; };
export const markClickable = box => { clickable.push(box); };
export const isClickable = (x, y) => clickable.some(box => inside(box, x, y));
export const clickableAt = (x, y) => clickable.find(box => inside(box, x, y)) ?? null;

const now = () => performance.now() / 1000;

function fill(ctx, color, x, y, width, height) {
  if (width <= 0 || height <= 0) return;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
}

export function outline(ctx, { x, y, width, height }, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, 1);
  ctx.fillRect(x, y + height - 1, width, 1);
  ctx.fillRect(x, y, 1, height);
  ctx.fillRect(x + width - 1, y, 1, height);
}

// Retângulo com os cantos cortados em diagonal (`cut` pixels). As faixas não se sobrepõem, então cores com alfa ficam uniformes.
export function chamferRect(ctx, { x, y, width, height }, cut, color) {
  cut = Math.max(0, Math.min(cut, Math.floor(width / 2), Math.floor(height / 2)));
  ctx.fillStyle = color;
  ctx.fillRect(x + cut, y, width - cut * 2, height);
  for (let i = 0; i < cut; i++) {
    const inset = cut - i;
    ctx.fillRect(x + i, y + inset, 1, height - inset * 2);
    ctx.fillRect(x + width - 1 - i, y + inset, 1, height - inset * 2);
  }
}

const shrink = (box, by) => ({ x: box.x + by, y: box.y + by, width: box.width - by * 2, height: box.height - by * 2 });

// Peça com contorno, corpo, brilho em cima e sombra embaixo: a base de botões e células.
function slab(ctx, box, tone, cut) {
  chamferRect(ctx, box, cut, tone.edge);
  const body = shrink(box, 1), inner = Math.max(0, cut - 1);
  chamferRect(ctx, body, inner, tone.body);
  fill(ctx, tone.light, body.x + inner, body.y, body.width - inner * 2, 1);
  const shadeRows = body.height >= 16 ? 2 : 1;
  fill(ctx, tone.shade, body.x + inner, body.y + body.height - shadeRows, body.width - inner * 2, shadeRows);
}

// Faixa de luz diagonal que atravessa o botão principal de tempos em tempos.
function sheen(ctx, body, speed) {
  const period = body.width + body.height + 60;
  const head = ((now() * speed) % period) - body.height;
  ctx.fillStyle = 'rgba(255, 248, 220, 0.38)';
  for (let row = 0; row < body.height; row++) {
    const left = Math.max(body.x, body.x + head + (body.height - row)), right = Math.min(body.x + body.width, left + 4);
    if (right > left) ctx.fillRect(left, body.y + row, right - left, 1);
  }
}

// Seta em pixels (7 de altura), apontando para `dir` (-1 esquerda, 1 direita).
export function drawChevron(ctx, cx, cy, dir, color) {
  ctx.fillStyle = color;
  for (let row = 0; row < 7; row++) {
    const reach = Math.abs(row - 3);
    ctx.fillRect(dir < 0 ? cx - 2 + reach : cx - reach, cy - 3 + row, 2, 1);
  }
}

// Texto com a parte depois de ": " realçada (ex.: "OLHAR PARA TRAS: SEGURAR").
function labelText(ctx, label, x, y, color, accent, scale = 1) {
  const split = label.lastIndexOf(': ');
  if (split < 0 || !accent) { ctxText(ctx, label, x, y, color, scale); return; }
  const head = label.slice(0, split + 2);
  ctxText(ctx, head, x, y, color, scale);
  ctxText(ctx, label.slice(split + 2), x + textWidth(head, scale), y, accent, scale);
}

const centerX = (box, text, scale = 1) => box.x + Math.floor((box.width - textWidth(text, scale)) / 2);
const centerY = (box, scale = 1) => box.y + Math.floor((box.height - 7 * scale) / 2);

function resolveStyle(label, style) {
  if (style && style !== 'auto') return style;
  if (label === '<' || label === '>') return 'arrow';
  if (label.startsWith('< ')) return 'back';
  return 'normal';
}

// Botão. `options` pode ser só o estilo ou { style, active, scale, quiet }:
//   normal  — ação comum;  primary — a ação principal da tela;  danger — sair, expulsar, apagar;
//   back    — voltar (rótulos "< ..." viram este sozinhos);  tab — aba (`active` marca a aberta);
//   arrow   — setas "<" e ">" (automático);  menu — item inclinado do menu principal.
// `quiet` deixa o botão apagado até o ponteiro chegar: para ações que se repetem em cada linha de uma lista.
export function drawButton(ctx, box, label, hovered, options) {
  const { style: wanted, active = false, scale = 1, quiet = false } = typeof options === 'string' ? { style: options } : options ?? {};
  const style = resolveStyle(label, wanted);
  markClickable(box);
  if (quiet && !hovered && (style === 'normal' || style === 'danger')) { drawQuiet(ctx, box, label, style); return; }
  ({ back: drawBack, tab: drawTab, arrow: drawArrow, menu: drawMenuItem }[style] ?? drawSlabButton)(ctx, box, label, hovered, { style, active, scale });
}

function drawQuiet(ctx, box, label, style) {
  chamferRect(ctx, box, 1, 'rgba(20, 10, 7, 0.35)');
  ctxText(ctx, label, centerX(box, label), centerY(box), style === 'danger' ? '#b0644c' : COLOR.muted);
}

function drawSlabButton(ctx, box, label, hovered, { style }) {
  const tones = TONES[style] ?? TONES.normal, tone = hovered ? tones.hover : tones.idle;
  const cut = box.height >= 22 ? 2 : 1;
  slab(ctx, box, tone, cut);
  const body = shrink(box, 1);
  if (style === 'primary') sheen(ctx, { x: body.x + 1, y: body.y + 1, width: body.width - 2, height: body.height - 3 }, hovered ? 140 : 70);
  else if (hovered) fill(ctx, style === 'danger' ? COLOR.danger : COLOR.selected, body.x, body.y + cut, 2, body.height - cut * 2);
  const nudge = hovered && style !== 'primary' ? 1 : 0;
  labelText(ctx, label, centerX(box, label) + nudge, centerY(box), tone.text, style === 'normal' ? COLOR.selected : null);
}

function drawBack(ctx, box, label, hovered) {
  const text = label.replace(/^<\s*/, ''), width = textWidth(text) + 10;
  chamferRect(ctx, box, 2, hovered ? 'rgba(58, 28, 16, 0.92)' : 'rgba(20, 10, 7, 0.6)');
  const left = box.x + Math.floor((box.width - width) / 2), y = centerY(box), color = hovered ? COLOR.selected : COLOR.muted;
  drawChevron(ctx, left + 2 - (hovered ? 2 : 0), y + 3, -1, color);
  ctxText(ctx, text, left + 10, y, hovered ? COLOR.text : COLOR.muted);
  if (hovered) fill(ctx, COLOR.selected, left + 10, y + 9, textWidth(text) - 1, 1);
}

function drawTab(ctx, box, label, hovered, { active }) {
  const lit = active || hovered;
  chamferRect(ctx, box, 1, active ? '#4a2619' : hovered ? '#3a1f14' : 'rgba(20, 10, 7, 0.7)');
  if (active) fill(ctx, COLOR.selected, box.x + 1, box.y + box.height - 2, box.width - 2, 2);
  else if (hovered) fill(ctx, COLOR.rust, box.x + 1, box.y + box.height - 1, box.width - 2, 1);
  ctxText(ctx, label, centerX(box, label), centerY(box) - (active ? 1 : 0), active ? COLOR.selected : lit ? COLOR.text : COLOR.muted);
}

function drawArrow(ctx, box, label, hovered) {
  slab(ctx, box, hovered ? TONES.normal.hover : TONES.normal.idle, 1);
  const dir = label === '<' ? -1 : 1, cx = box.x + Math.floor(box.width / 2) + (hovered ? dir : 0);
  drawChevron(ctx, cx, box.y + Math.floor(box.height / 2), dir, hovered ? COLOR.selected : COLOR.text);
}

// Item do menu principal: faixa inclinada, texto alinhado à esquerda; com o ponteiro em cima vira âmbar e avança.
function drawMenuItem(ctx, box, label, hovered, { scale }) {
  const slant = Math.floor((box.height - 1) / 3), push = hovered ? 6 : 0;
  const rowLeft = row => box.x + push + Math.floor((box.height - 1 - row) / 3);
  const span = box.width - slant;
  for (let row = 0; row < box.height; row++) {
    const left = rowLeft(row);
    if (hovered) {
      const last = box.height - 1;
      const color = row === 0 || row === last ? COLOR.ink : row <= 2 ? '#ffd27a' : row >= last - 2 ? '#a8480f' : '#f39a2e';
      fill(ctx, color, left, box.y + row, span, 1);
    } else {
      fill(ctx, 'rgba(22, 11, 7, 0.82)', left, box.y + row, span, 1);
      fill(ctx, row < box.height / 2 ? COLOR.ember : COLOR.rust, left, box.y + row, 3, 1);
    }
  }
  const textX = box.x + push + slant + 8, textY = centerY(box, scale);
  if (hovered) {
    ctxText(ctx, label, textX, textY, COLOR.ink, scale);
    const tip = box.x + push + span - 4, cy = box.y + Math.floor(box.height / 2);
    drawChevron(ctx, tip - 8, cy, 1, '#a8480f');
    drawChevron(ctx, tip - 3, cy, 1, COLOR.ink);
  } else {
    ctxText(ctx, label, textX + 1, textY + 1, COLOR.ink, scale);
    ctxText(ctx, label, textX, textY, COLOR.text, scale);
  }
}

// Três riscos inclinados em âmbar, laranja e vermelho: a marca de corrida no canto dos painéis grandes.
function drawSpeedMarks(ctx, x, y) {
  ['#ffb040', '#e8582a', '#a8301a'].forEach((color, i) => {
    ctx.fillStyle = color;
    for (let row = 0; row < 5; row++) ctx.fillRect(x + i * 6 + (4 - row), y + row, 3, 1);
  });
}

export function panelBox(ctx, box) {
  const big = box.width >= 200 && box.height >= 80, cut = big ? 3 : 2;
  chamferRect(ctx, box, cut, COLOR.ink);
  const body = shrink(box, 1), inner = cut - 1;
  chamferRect(ctx, body, inner, COLOR.panel);
  fill(ctx, '#5a3220', body.x + inner, body.y, body.width - inner * 2, 1);            // luz quente na borda de cima
  fill(ctx, '#3a2117', body.x, body.y + inner, 1, body.height - inner * 2);
  fill(ctx, '#170c08', body.x + inner, body.y + body.height - 1, body.width - inner * 2, 1);
  if (big) drawSpeedMarks(ctx, box.x + box.width - 26, box.y + 4);
}

// Riscos inclinados em sequência; `tones` vai de perto do texto para longe.
function drawSlashes(ctx, x, y, height, tones, dir) {
  tones.forEach((color, i) => {
    ctx.fillStyle = color;
    const base = x + dir * i * 5;
    for (let row = 0; row < height; row++) ctx.fillRect(base + Math.floor((height - 1 - row) / 2), y + row, 2, 1);
  });
}

// Título de tela: sombra ferrugem; centralizado, ganha riscos de corrida dos dois lados; à esquerda, um sublinhado em brasa.
export function drawHeading(ctx, text, x, y, { scale = 2, align = 'center', color = COLOR.selected } = {}) {
  const width = textWidth(text, scale) - scale, left = align === 'center' ? Math.round(x - width / 2) : x;
  ctxText(ctx, text, left + 1, y + 1, '#6a2410', scale);
  ctxText(ctx, text, left, y, color, scale);
  const height = 7 * scale;
  if (align === 'center') {
    const tones = [COLOR.selected, COLOR.ember, COLOR.rust], markHeight = height - 2, reach = Math.floor((markHeight - 1) / 2);
    drawSlashes(ctx, left - 10 - reach, y + 1, markHeight, tones, -1);
    drawSlashes(ctx, left + width + 8, y + 1, markHeight, tones, 1);
  } else {
    fill(ctx, COLOR.selected, left, y + height + 3, 18, 2);
    fill(ctx, COLOR.ember, left + 20, y + height + 3, 8, 2);
    fill(ctx, COLOR.rust, left + 30, y + height + 3, 4, 2);
  }
}

// Linha de tabela: listras leves para guiar o olho e realce âmbar com o ponteiro em cima.
export function drawRowStripe(ctx, box, index, hovered = false) {
  if (hovered) {
    fill(ctx, 'rgba(255, 150, 60, 0.16)', box.x, box.y, box.width, box.height);
    fill(ctx, COLOR.selected, box.x, box.y, 2, box.height);
  } else if (index % 2 === 0) fill(ctx, 'rgba(255, 180, 110, 0.05)', box.x, box.y, box.width, box.height);
}

// Fio fino sob o cabeçalho de uma tabela.
export function drawRule(ctx, x, y, width) {
  fill(ctx, '#4a2a1c', x, y, width, 1);
  fill(ctx, COLOR.rust, x, y, Math.min(24, width), 1);
}

// Controle deslizante: trilho fundo, preenchimento em brasa e um pino creme.
export function drawSlider(ctx, box, t, hovered = false) {
  t = clamp(t, 0, 1);
  chamferRect(ctx, box, 1, COLOR.ink);
  const track = shrink(box, 1);
  fill(ctx, '#2a170f', track.x, track.y, track.width, track.height);
  fill(ctx, '#1c0e09', track.x, track.y, track.width, 1);
  const filled = Math.round(track.width * t);
  fill(ctx, '#b8401e', track.x, track.y, filled, track.height);
  fill(ctx, '#ec8f28', track.x, track.y, filled, Math.ceil(track.height / 2));
  fill(ctx, '#ffcf70', track.x, track.y, filled, 1);
  const knob = { x: box.x + Math.round((box.width - 8) * t), y: box.y - 3, width: 8, height: box.height + 6 };
  chamferRect(ctx, knob, 1, COLOR.ink);
  chamferRect(ctx, shrink(knob, 1), 1, hovered ? '#fff4dc' : COLOR.text);
  fill(ctx, hovered ? COLOR.ember : '#c09070', knob.x + 3, knob.y + 3, 2, knob.height - 6);
}

export function fitImage(ctx, image, box) {
  const scale = Math.min(box.width / image.width, box.height / image.height, 1);
  const w = Math.max(1, Math.round(image.width * scale)), h = Math.max(1, Math.round(image.height * scale));
  ctx.drawImage(image, box.x + Math.round((box.width - w) / 2), box.y + Math.round((box.height - h) / 2), w, h);
}

export function drawColorChip(ctx, x, y, width, height, color) {
  ctx.fillStyle = COLOR.ink;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = color === null || color === undefined ? COLOR.tileDark : toCss(color);
  ctx.fillRect(x + 1, y + 1, width - 2, height - 2);
}

// Cantoneiras âmbar nos quatro cantos: marca a peça escolhida sem fechar uma moldura inteira.
export function drawCorners(ctx, { x, y, width, height }, color = COLOR.selected, size = 4) {
  ctx.fillStyle = color;
  for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + width - 1, y, -1, 1], [x, y + height - 1, 1, -1], [x + width - 1, y + height - 1, -1, -1]]) {
    ctx.fillRect(dx > 0 ? cx : cx - size + 1, cy, size, 1);
    ctx.fillRect(cx, dy > 0 ? cy : cy - size + 1, 1, size);
  }
}

// Célula das listas de peças: fundo de madeira escura; a escolhida ganha borda âmbar.
export function drawCell(ctx, box, { hovered = false, active = false } = {}) {
  chamferRect(ctx, box, 1, active ? COLOR.selected : COLOR.ink);
  const body = shrink(box, 1);
  fill(ctx, hovered ? COLOR.tileHover : COLOR.tile, body.x, body.y, body.width, body.height);
  fill(ctx, hovered ? '#7a4a32' : COLOR.tileBevel, body.x, body.y, body.width, 1);
  if (active) drawCorners(ctx, shrink(box, 2), '#fff0c8', 3);
}

// Peça com miniatura (ou só a cor) e o nome embaixo.
export function drawSlotTile(ctx, slot, { image, color, chipColor, active, hovered }) {
  markClickable(slot);
  drawCell(ctx, slot, { hovered, active });
  fill(ctx, active ? '#5a2a14' : 'rgba(20, 10, 7, 0.6)', slot.x + 1, slot.y + slot.height - 11, slot.width - 2, 10);

  if (image) {
    fitImage(ctx, image, { x: slot.x + 3, y: slot.y + 3, width: slot.width - 6, height: slot.height - 16 });
    if (chipColor !== null && chipColor !== undefined) drawColorChip(ctx, slot.x + slot.width - 11, slot.y + 2, 9, 9, chipColor);
  } else {
    drawColorChip(ctx, slot.x + 8, slot.y + 5, slot.width - 16, slot.height - 21, color);
  }
  ctxText(ctx, slot.short, centerX(slot, slot.short), slot.y + slot.height - 9, active ? COLOR.selected : COLOR.text);
}

export function drawTooltip(ctx, info, pointerX, y) {
  const width = Math.max(textWidth(info.title), textWidth(info.detail)) + 16, height = 30;
  const x = clamp(Math.round(pointerX - width / 2), 4, VIEW.width - width - 4), box = { x, y, width, height };
  chamferRect(ctx, box, 2, COLOR.tooltipEdge);
  chamferRect(ctx, shrink(box, 1), 1, COLOR.tooltip);
  ctxText(ctx, info.title, x + 8, y + 5, COLOR.gold);
  ctxText(ctx, info.detail, x + 8, y + 17, COLOR.muted);
}

// Logo inclinado (itálico em pixels), com contorno escuro, sombra ferrugem e preenchimento de ouro a laranja.
// São milhares de pixels: desenha uma vez numa tela própria e depois só copia.
const logos = new Map();
function paintLogo(text, scale) {
  const height = 7 * scale, lean = py => Math.floor((height - py) / (scale * 1.5)), pad = 2;
  const canvas = document.createElement('canvas');
  canvas.width = textWidth(text, scale) + lean(0) + pad + 4;
  canvas.height = height + pad + 4;
  const ctx = canvas.getContext('2d');
  const bands = ['#fff2b8', '#ffd36a', '#ffb040', '#f08a28', '#e0601c'];
  const plot = (dx, dy, color) => plotText(text, (px, py) => {
    ctx.fillStyle = typeof color === 'function' ? color(py) : color;
    ctx.fillRect(pad + px + lean(py) + dx, pad + py + dy, 1, 1);
  }, scale);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [3, 3], [2, 3], [3, 2]]) plot(dx, dy, COLOR.ink);
  plot(2, 2, '#8a2a10');
  plot(0, 0, py => bands[Math.min(bands.length - 1, Math.floor(py / height * bands.length))]);
  return { canvas, pad };
}

export function drawLogo(ctx, text, x, y, scale = 4) {
  const key = `${scale}:${text}`;
  if (!logos.has(key)) logos.set(key, paintLogo(text, scale));
  const { canvas, pad } = logos.get(key);
  ctx.drawImage(canvas, x - pad, y - pad);
}

export function pointerOnStage(event, stage) {
  const rect = stage.getBoundingClientRect();
  return { x: (event.clientX - rect.left) / rect.width * VIEW.width, y: (event.clientY - rect.top) / rect.height * VIEW.height };
}
