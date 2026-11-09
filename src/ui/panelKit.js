import { VIEW } from '../config.js';
import { ctxText, textWidth } from '../art/font.js';

// Peças visuais compartilhadas pelas telas de menu.

export const COLOR = {
  panel: '#101016', edge: '#3a3a42', tile: '#55565c', tileHover: '#6c6d74', tileBevel: '#7c7d84', tileDark: '#34343a',
  selected: '#e0a040', text: '#e8e4dc', button: '#7a1414', buttonHover: '#a42020',
  tooltip: '#3e3218', tooltipEdge: '#d8b048', muted: '#b0a080', backdrop: '#14141a', danger: '#f06050',
};

export const MEDALS = ['#f0c840', '#c8d4e4', '#cc8448'];     // ouro, prata e bronze

export const inside = ({ x, y, width, height }, px, py) => px >= x && py >= y && px < x + width && py < y + height;
export const toCss = c => `#${c.toString(16).padStart(6, '0')}`;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// O que a tela desenhou de clicável neste quadro; serve para tocar o som de clique só em cima de algo.
const clickable = [];
export const clearClickable = () => { clickable.length = 0; };
export const markClickable = box => { clickable.push(box); };
export const isClickable = (x, y) => clickable.some(box => inside(box, x, y));

export function outline(ctx, { x, y, width, height }, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, 1);
  ctx.fillRect(x, y + height - 1, width, 1);
  ctx.fillRect(x, y, 1, height);
  ctx.fillRect(x + width - 1, y, 1, height);
}

export function panelBox(ctx, box) {
  ctx.fillStyle = COLOR.panel;
  ctx.fillRect(box.x, box.y, box.width, box.height);
  outline(ctx, box, COLOR.edge);
  ctx.fillStyle = COLOR.edge;
  for (const [x, y] of [[2, 2], [box.width - 4, 2], [2, box.height - 4], [box.width - 4, box.height - 4]]) ctx.fillRect(box.x + x, box.y + y, 2, 2);
}

export function fitImage(ctx, image, box) {
  const scale = Math.min(box.width / image.width, box.height / image.height, 1);
  const w = Math.max(1, Math.round(image.width * scale)), h = Math.max(1, Math.round(image.height * scale));
  ctx.drawImage(image, box.x + Math.round((box.width - w) / 2), box.y + Math.round((box.height - h) / 2), w, h);
}

export function drawColorChip(ctx, x, y, width, height, color) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = color === null || color === undefined ? COLOR.tileDark : toCss(color);
  ctx.fillRect(x + 1, y + 1, width - 2, height - 2);
}

export function drawButton(ctx, box, label, hovered) {
  markClickable(box);
  ctx.fillStyle = hovered ? COLOR.buttonHover : COLOR.button;
  ctx.fillRect(box.x, box.y, box.width, box.height);
  outline(ctx, box, COLOR.edge);
  ctxText(ctx, label, box.x + Math.floor((box.width - textWidth(label)) / 2), box.y + Math.floor((box.height - 7) / 2), COLOR.text);
}

// Peça com miniatura (ou só a cor) e o nome embaixo.
export function drawSlotTile(ctx, slot, { image, color, chipColor, active, hovered }) {
  markClickable(slot);
  ctx.fillStyle = hovered ? COLOR.tileHover : COLOR.tile;
  ctx.fillRect(slot.x, slot.y, slot.width, slot.height);
  ctx.fillStyle = COLOR.tileBevel;
  ctx.fillRect(slot.x, slot.y, slot.width, 1);
  ctx.fillStyle = COLOR.tileDark;
  ctx.fillRect(slot.x, slot.y + slot.height - 11, slot.width, 11);
  outline(ctx, slot, active ? COLOR.selected : COLOR.tileDark);

  if (image) {
    fitImage(ctx, image, { x: slot.x + 3, y: slot.y + 3, width: slot.width - 6, height: slot.height - 16 });
    if (chipColor !== null && chipColor !== undefined) drawColorChip(ctx, slot.x + slot.width - 11, slot.y + 2, 9, 9, chipColor);
  } else {
    drawColorChip(ctx, slot.x + 8, slot.y + 5, slot.width - 16, slot.height - 21, color);
  }
  ctxText(ctx, slot.short, slot.x + Math.floor((slot.width - textWidth(slot.short)) / 2), slot.y + slot.height - 9, COLOR.text);
}

export function drawTooltip(ctx, info, pointerX, y) {
  const width = Math.max(textWidth(info.title), textWidth(info.detail)) + 16, height = 30;
  const x = clamp(Math.round(pointerX - width / 2), 4, VIEW.width - width - 4);
  ctx.fillStyle = COLOR.tooltip;
  ctx.fillRect(x, y, width, height);
  outline(ctx, { x, y, width, height }, COLOR.tooltipEdge);
  ctxText(ctx, info.title, x + 8, y + 5, '#f0d060');
  ctxText(ctx, info.detail, x + 8, y + 17, COLOR.muted);
}

export function pointerOnStage(event, stage) {
  const rect = stage.getBoundingClientRect();
  return { x: (event.clientX - rect.left) / rect.width * VIEW.width, y: (event.clientY - rect.top) / rect.height * VIEW.height };
}
