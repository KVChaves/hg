import { ctxText, textWidth } from '../art/font.js';
import { hslToHex } from '../art/recolor.js';
import { clamp, COLOR, drawColorChip, fitImage, inside, markClickable, outline, panelBox, toCss } from './panelKit.js';

// Faixa de personalização: as opções da peça ativa e, logo abaixo, o seletor de cores e uma paleta de cores prontas.
// Cada "slot" tem { key, options|null, thumbs, hasColor }. Quando as opções não cabem numa linha, viram duas.

const OPTIONS_ROW_HEIGHT = 44, TWO_ROW_HEIGHT = 36, COLOR_ROW_HEIGHT = 28, PRESET_ROW_HEIGHT = 12, ROW_PADDING = 5;
const RESET_WIDTH = 40, GRAYS_WIDTH = 44, THUMB_MARGIN = 4, MAX_TILE = 46, MIN_TILE = 34;

// Cores prontas: metade vibrante, metade clássica de carro (prata, grafite, bege, vinho...).
export const COLOR_PRESETS = [
  0xd01818, 0xf06010, 0xf0c020, 0x80d020, 0x18a040, 0x10c0b0, 0x2070e0, 0x1830a0, 0x7030c0, 0xe040a0,
  0xf4f0e8, 0xb8bcc4, 0x6a6e76, 0x26282e, 0x0c0c0e, 0xd8c8a0, 0x7a4a24, 0x6a1020, 0x2e4a2a, 0xc0a060,
];

const spectrumColor = (u, v) => hslToHex(u, 1, 0.92 - v * 0.86);
const grayColor = u => hslToHex(0, 0, 1 - u);

function paintGradient(width, height, colorAt) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  for (let x = 0; x < width; x++) for (let y = 0; y < height; y++) {
    ctx.fillStyle = toCss(colorAt(x, y));
    ctx.fillRect(x, y, 1, 1);
  }
  return canvas;
}

// `priceOf(slot, id)` devolve o preço (ou null) e `isLocked(slot, id)` diz se a compra não cabe no saldo.
const PRICE_BAND = 9;

function drawPrice(ctx, tile, price, locked) {
  if (locked) {
    ctx.fillStyle = 'rgba(10, 10, 14, 0.62)';
    ctx.fillRect(tile.x + 1, tile.y + 1, tile.width - 2, tile.height - 2);
  }
  ctx.fillStyle = COLOR.tileDark;
  ctx.fillRect(tile.x + 1, tile.y + tile.height - PRICE_BAND - 1, tile.width - 2, PRICE_BAND);
  const label = `R$${price}`;
  ctxText(ctx, label, tile.x + Math.floor((tile.width - textWidth(label)) / 2), tile.y + tile.height - PRICE_BAND, locked ? COLOR.danger : COLOR.text);
}

export function createOptionStrip({ x, width, top, bottom, placement, getSlot, currentId, currentColor, originalSwatch, priceOf = () => null, isLocked = () => false, onChoose, onColor }) {
  const pickerHeight = COLOR_ROW_HEIGHT - 2;
  const PICKER_WIDTH = width - 6 - RESET_WIDTH - 6 - 2 - GRAYS_WIDTH - 6;      // o espectro ocupa o que sobra, sem vazar da faixa
  const spectrum = paintGradient(PICKER_WIDTH, pickerHeight, (px, py) => spectrumColor(px / PICKER_WIDTH, py / pickerHeight));
  const grays = paintGradient(GRAYS_WIDTH, pickerHeight, px => grayColor(px / (GRAYS_WIDTH - 1)));
  const markers = new Map();
  let picking = null, pendingColor;

  // Quantas linhas e colunas as opções da peça usam: uma linha enquanto as miniaturas não ficam estreitas demais.
  function grid(slot) {
    const count = Object.keys(slot.options).length, usable = width - 8;
    const rows = Math.floor(usable / count) >= MIN_TILE ? 1 : 2, columns = Math.ceil(count / rows);
    return { rows, columns, tileWidth: Math.min(MAX_TILE, Math.floor(usable / columns)), rowHeight: rows === 1 ? OPTIONS_ROW_HEIGHT : TWO_ROW_HEIGHT };
  }

  function layout() {
    const slot = getSlot();
    const { rows, rowHeight } = slot.options ? grid(slot) : { rows: 0, rowHeight: 0 };
    const optionsHeight = slot.options ? rows * rowHeight + (rows - 1) * 2 + ROW_PADDING : 0;
    const colorHeight = slot.hasColor ? COLOR_ROW_HEIGHT + 3 + PRESET_ROW_HEIGHT + ROW_PADDING : 0;
    const height = ROW_PADDING + optionsHeight + colorHeight;
    const y = placement(slot) === 'top' ? (typeof top === 'function' ? top() : top) : bottom - height;
    const box = { x, y, width, height };
    const colorY = y + ROW_PADDING + optionsHeight;
    const reset = { x: x + 6, y: colorY, width: RESET_WIDTH, height: COLOR_ROW_HEIGHT };
    const picker = { x: reset.x + RESET_WIDTH + 6, y: colorY + 1, width: PICKER_WIDTH, height: pickerHeight };
    const gray = { x: picker.x + PICKER_WIDTH + 2, y: colorY + 1, width: GRAYS_WIDTH, height: pickerHeight };
    const presetY = colorY + COLOR_ROW_HEIGHT + 3, presetWidth = Math.floor((width - 12) / COLOR_PRESETS.length);
    const presetX = x + Math.round((width - presetWidth * COLOR_PRESETS.length) / 2);
    const presets = COLOR_PRESETS.map((color, i) => ({ color, x: presetX + i * presetWidth, y: presetY, width: presetWidth - 1, height: PRESET_ROW_HEIGHT }));
    return { box, y, reset, picker, gray, presets };
  }

  function tiles() {
    const slot = getSlot();
    if (!slot.options) return [];
    const { box, y } = layout(), ids = Object.keys(slot.options), { columns, tileWidth, rowHeight } = grid(slot);
    return ids.map((id, i) => {
      const row = Math.floor(i / columns), inRow = Math.min(columns, ids.length - row * columns);
      const startX = box.x + Math.round((box.width - tileWidth * inRow) / 2);
      return { id, x: startX + (i % columns) * tileWidth, y: y + ROW_PADDING + row * (rowHeight + 2), width: tileWidth - 2, height: rowHeight };
    });
  }

  function pick(zone, px, py) {
    const slot = getSlot(), { picker, gray } = layout(), area = zone === 'spectrum' ? picker : gray;
    const u = clamp((px - area.x) / area.width, 0, 0.999), v = clamp((py - area.y) / area.height, 0, 0.999);
    markers.set(slot.key, { zone, u, v });
    pendingColor = zone === 'spectrum' ? spectrumColor(u, v) : grayColor(u);
  }

  return {
    box: () => layout().box,
    contains: (px, py) => inside(layout().box, px, py),

    pointerDown(px, py) {
      if (!getSlot().hasColor) return false;
      const { picker, gray } = layout();
      picking = inside(picker, px, py) ? 'spectrum' : inside(gray, px, py) ? 'gray' : null;
      if (picking) pick(picking, px, py);
      return Boolean(picking);
    },
    pointerMove(px, py) {
      if (!picking) return false;
      pick(picking, px, py);
      return true;
    },
    pointerUp() { picking = null; },

    click(px, py) {
      const slot = getSlot();
      if (slot.hasColor && inside(layout().reset, px, py)) {
        markers.delete(slot.key);
        onColor(slot, null);
        return true;
      }
      const preset = slot.hasColor && layout().presets.find(candidate => inside(candidate, px, py));
      if (preset) {
        markers.delete(slot.key);
        onColor(slot, preset.color);
        return true;
      }
      const tile = tiles().find(candidate => inside(candidate, px, py));
      if (tile) onChoose(slot, tile.id);
      return Boolean(tile);
    },

    // No máximo uma repintura por quadro enquanto o jogador arrasta.
    applyPending() {
      if (pendingColor === undefined) return;
      onColor(getSlot(), pendingColor);
      pendingColor = undefined;
    },

    draw(ctx, pointer) {
      const slot = getSlot(), { box, reset, picker, gray } = layout();
      panelBox(ctx, box);

      for (const tile of tiles()) {
        markClickable(tile);
        ctx.fillStyle = inside(tile, pointer.x, pointer.y) ? COLOR.tileHover : COLOR.tile;
        ctx.fillRect(tile.x, tile.y, tile.width, tile.height);
        outline(ctx, tile, tile.id === currentId(slot) ? COLOR.selected : COLOR.tileDark);
        const price = priceOf(slot, tile.id), priceBand = price === null ? 0 : PRICE_BAND;
        fitImage(ctx, slot.thumbs[tile.id], { x: tile.x + THUMB_MARGIN, y: tile.y + THUMB_MARGIN, width: tile.width - THUMB_MARGIN * 2, height: tile.height - THUMB_MARGIN * 2 - priceBand });
        if (price !== null) drawPrice(ctx, tile, price, isLocked(slot, tile.id));
      }

      if (!slot.hasColor) return;
      [reset, picker, gray].forEach(markClickable);
      ctx.fillStyle = inside(reset, pointer.x, pointer.y) ? COLOR.tileHover : COLOR.tile;
      ctx.fillRect(reset.x, reset.y, reset.width, reset.height);
      outline(ctx, reset, COLOR.tileDark);
      drawColorChip(ctx, reset.x + 4, reset.y + 3, reset.width - 8, 12, currentColor(slot) ?? originalSwatch(slot));
      ctxText(ctx, 'ORIG.', reset.x + 5, reset.y + 18, COLOR.text);

      const selected = currentColor(slot);
      for (const preset of layout().presets) {
        markClickable(preset);
        drawColorChip(ctx, preset.x, preset.y, preset.width, preset.height, preset.color);
        if (preset.color === selected) outline(ctx, { x: preset.x - 1, y: preset.y - 1, width: preset.width + 2, height: preset.height + 2 }, COLOR.selected);
        else if (inside(preset, pointer.x, pointer.y)) outline(ctx, preset, '#ffffff');
      }

      ctx.drawImage(spectrum, picker.x, picker.y);
      outline(ctx, picker, COLOR.tileDark);
      ctx.drawImage(grays, gray.x, gray.y);
      outline(ctx, gray, COLOR.tileDark);

      const marker = markers.get(slot.key);
      if (marker) {
        const area = marker.zone === 'spectrum' ? picker : gray;
        const mx = Math.floor(area.x + marker.u * area.width), my = Math.floor(area.y + marker.v * area.height);
        outline(ctx, { x: mx - 3, y: my - 3, width: 7, height: 7 }, '#000000');
        outline(ctx, { x: mx - 2, y: my - 2, width: 5, height: 5 }, '#ffffff');
      }
    },

    // Texto de ajuda para o que está sob o ponteiro; `label` é o nome da peça.
    hoverInfo(pointer, label) {
      const slot = getSlot();
      if (slot.hasColor) {
        const { reset, picker, gray } = layout();
        if (inside(reset, pointer.x, pointer.y)) return { title: 'Cor original', detail: label };
        if (inside(picker, pointer.x, pointer.y) || inside(gray, pointer.x, pointer.y)) return { title: 'Clique ou arraste', detail: `Cor: ${label}` };
        if (layout().presets.some(preset => inside(preset, pointer.x, pointer.y))) return { title: 'Cor pronta', detail: `Cor: ${label}` };
      }
      const tile = tiles().find(candidate => inside(candidate, pointer.x, pointer.y));
      return tile ? { title: slot.options[tile.id].name, detail: slot.options[tile.id].detail ?? label } : null;
    },
  };
}
