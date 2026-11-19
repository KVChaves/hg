import { ctxText, textWidth } from '../../art/font.js';
import { TRAP_TYPES } from '../../game/trapTypes.js';
import { clearClickable, COLOR, drawButton, drawHeading, fitImage, inside, markClickable, panelBox } from '../panelKit.js';
import { trunkItemThumb } from './garageThumbs.js';

// Janela do bagageiro: todos os itens numa lista, cada um com a sua quantidade, preço por unidade e limite próprio.
// O jogador leva qualquer combinação, enquanto couber no saldo.

const BOX = { x: 120, y: 10, width: 400, height: 340 };
const ROW_TOP = 40, ROW_HEIGHT = 28;
const CLOSE = { x: 250, y: 322, width: 140, height: 22 };
const TEXT_WIDTH = 190;

const fitText = (text, width) => {
  if (textWidth(text) <= width) return text;
  let cut = text.length;
  while (cut > 1 && textWidth(`${text.slice(0, cut)}.`) > width) cut--;
  return `${text.slice(0, cut)}.`;
};

export function createTrunkPanel({ getTrunk, canSet, setCount, funds, onClose = () => {} }) {
  const ids = Object.keys(TRAP_TYPES);
  const thumbs = Object.fromEntries(ids.map(id => [id, trunkItemThumb(id)]));
  const rows = ids.map((id, i) => {
    const y = ROW_TOP + i * ROW_HEIGHT;
    return { id, y, minus: { x: BOX.x + 290, y: y + 8, width: 11, height: 10 }, plus: { x: BOX.x + 336, y: y + 8, width: 11, height: 10 } };
  });

  function stepper(ctx, box, label, enabled, pointer) {
    if (enabled) markClickable(box);
    ctx.fillStyle = !enabled ? COLOR.tileDark : inside(box, pointer.x, pointer.y) ? COLOR.buttonHover : COLOR.button;
    ctx.fillRect(box.x, box.y, box.width, box.height);
    ctxText(ctx, label, box.x + 3, box.y + 2, enabled ? COLOR.text : COLOR.muted);
  }

  const panel = {
    isOpen: false,
    // Com a janela aberta, ela consome todos os cliques.
    click(x, y) {
      if (inside(CLOSE, x, y) || !inside(BOX, x, y)) { panel.isOpen = false; onClose(); return; }
      const trunk = getTrunk();
      for (const row of rows) {
        if (inside(row.minus, x, y)) { if (trunk[row.id] > 0) setCount(row.id, trunk[row.id] - 1); return; }
        if (inside(row.plus, x, y)) { if (trunk[row.id] < TRAP_TYPES[row.id].maxCharges) setCount(row.id, trunk[row.id] + 1); return; }
      }
    },
    draw(ctx, pointer) {
      clearClickable();                              // o que está por trás da janela não recebe clique
      panelBox(ctx, BOX);
      drawHeading(ctx, 'BAGAGEIRO', BOX.x + 20, BOX.y + 10, { align: 'left' });
      const balance = `SALDO R$ ${funds()}`;
      ctxText(ctx, balance, BOX.x + BOX.width - 12 - textWidth(balance), BOX.y + 13, COLOR.selected);
      ctxText(ctx, 'ITEM', BOX.x + 40, BOX.y + 24, COLOR.muted);
      ctxText(ctx, 'QUANTIDADE', BOX.x + 286, BOX.y + 24, COLOR.muted);
      ctxText(ctx, 'TOTAL', BOX.x + BOX.width - 12 - textWidth('TOTAL'), BOX.y + 24, COLOR.muted);

      const trunk = getTrunk();
      for (const row of rows) {
        const type = TRAP_TYPES[row.id], count = trunk[row.id], y = row.y;
        if (inside({ x: BOX.x + 6, y, width: BOX.width - 12, height: ROW_HEIGHT }, pointer.x, pointer.y)) {
          ctx.fillStyle = COLOR.tileHover;
          ctx.fillRect(BOX.x + 6, y, BOX.width - 12, ROW_HEIGHT - 2);
        }
        fitImage(ctx, thumbs[row.id], { x: BOX.x + 10, y: y + 2, width: 24, height: 22 });
        ctxText(ctx, type.label, BOX.x + 40, y + 4, count > 0 ? COLOR.selected : COLOR.text);
        const unit = `R$ ${type.price} CADA  MAX ${type.maxCharges}`;
        ctxText(ctx, unit, BOX.x + 40 + TEXT_WIDTH - textWidth(unit), y + 4, COLOR.muted);
        ctxText(ctx, fitText(type.summary, TEXT_WIDTH), BOX.x + 40, y + 15, COLOR.muted);

        stepper(ctx, row.minus, '-', count > 0, pointer);
        const number = String(count);
        ctxText(ctx, number, row.minus.x + row.minus.width + Math.floor((row.plus.x - row.minus.x - row.minus.width - textWidth(number)) / 2), y + 9, count > 0 ? COLOR.selected : COLOR.text);
        stepper(ctx, row.plus, '+', count < type.maxCharges && canSet(row.id, count + 1), pointer);
        const total = count > 0 ? `R$ ${type.price * count}` : '-';
        ctxText(ctx, total, BOX.x + BOX.width - 12 - textWidth(total), y + 9, count > 0 ? COLOR.text : COLOR.muted);
      }
      drawButton(ctx, CLOSE, 'FECHAR', inside(CLOSE, pointer.x, pointer.y), 'back');
    },
  };
  return panel;
}
