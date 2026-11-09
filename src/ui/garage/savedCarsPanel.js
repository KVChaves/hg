import { ctxText, textWidth } from '../../art/font.js';
import { clearClickable, COLOR, drawButton, inside, panelBox } from '../panelKit.js';

// Janela "Meus carros": guarda o carro atual em uma vaga e traz de volta depois.

const BOX = { x: 150, y: 48, width: 340, height: 268 };
const ROW_TOP = 82, ROW_HEIGHT = 32;
const CLOSE = { x: 245, y: 282, width: 150, height: 26 };

export function createSavedCarsPanel({ slotCount, describe, onSave, onLoad, onDelete }) {
  const rows = Array.from({ length: slotCount }, (_, i) => {
    const y = ROW_TOP + i * ROW_HEIGHT;
    return {
      index: i, y,
      save: { x: BOX.x + 142, y, width: 62, height: 24 },
      load: { x: BOX.x + 208, y, width: 50, height: 24 },
      remove: { x: BOX.x + 262, y, width: 64, height: 24 },
    };
  });

  const panel = {
    isOpen: false,
    // Com a janela aberta, ela consome todos os cliques.
    click(x, y) {
      if (inside(CLOSE, x, y)) { panel.isOpen = false; return; }
      for (const row of rows) {
        const filled = Boolean(describe(row.index));
        if (inside(row.save, x, y)) { onSave(row.index); return; }
        if (filled && inside(row.load, x, y)) { onLoad(row.index); panel.isOpen = false; return; }
        if (filled && inside(row.remove, x, y)) { onDelete(row.index); return; }
      }
    },
    draw(ctx, pointer) {
      clearClickable();                              // o que está por trás da janela não recebe clique
      panelBox(ctx, BOX);
      const title = 'MEUS CARROS';
      ctxText(ctx, title, BOX.x + Math.floor((BOX.width - textWidth(title, 2)) / 2), BOX.y + 10, COLOR.selected, 2);
      for (const row of rows) {
        const info = describe(row.index);
        ctxText(ctx, `CARRO ${row.index + 1}`, BOX.x + 12, row.y + 3, info ? COLOR.text : COLOR.muted);
        ctxText(ctx, info ?? 'VAZIO', BOX.x + 12, row.y + 14, COLOR.muted);
        drawButton(ctx, row.save, 'SALVAR', inside(row.save, pointer.x, pointer.y));
        if (!info) continue;
        drawButton(ctx, row.load, 'USAR', inside(row.load, pointer.x, pointer.y));
        drawButton(ctx, row.remove, 'APAGAR', inside(row.remove, pointer.x, pointer.y));
      }
      drawButton(ctx, CLOSE, 'FECHAR', inside(CLOSE, pointer.x, pointer.y));
    },
  };
  return panel;
}
