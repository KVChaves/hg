import { ctxText, textWidth } from '../../art/font.js';
import { CAR_NAME_LENGTH } from '../../game/savedCars.js';
import { clearClickable, COLOR, drawButton, drawHeading, inside, panelBox } from '../panelKit.js';
import { createTextPrompt } from '../textPrompt.js';

// Janela "Meus carros": guarda o carro atual em uma vaga, sempre com um nome, e traz de volta depois.

const BOX = { x: 150, y: 48, width: 340, height: 268 };
const ROW_TOP = 82, ROW_HEIGHT = 32;
const CLOSE = { x: 245, y: 282, width: 150, height: 26 };

export function createSavedCarsPanel({ slotCount, describe, nameOf, isActive, onSave, onLoad, onDelete }) {
  const rows = Array.from({ length: slotCount }, (_, i) => {
    const y = ROW_TOP + i * ROW_HEIGHT;
    return {
      index: i, y,
      save: { x: BOX.x + 142, y, width: 62, height: 24 },
      load: { x: BOX.x + 208, y, width: 50, height: 24 },
      remove: { x: BOX.x + 262, y, width: 64, height: 24 },
    };
  });
  let namingIndex = 0;

  const namePrompt = createTextPrompt({
    box: BOX, title: 'NOME DO CARRO', confirmLabel: 'SALVAR', maxLength: CAR_NAME_LENGTH,
    isActive: () => panel.isOpen && isActive(),
    onConfirm: name => onSave(namingIndex, name),
  });

  function askName(index) {
    namingIndex = index;
    const previous = nameOf(index);
    namePrompt.open({ initial: previous, hint: previous ? `SUBSTITUI ${previous}` : `VAGA ${index + 1}`, emptyHint: 'DIGITE UM NOME PARA SALVAR' });
  }

  const panel = {
    isOpen: false,
    isNaming: () => namePrompt.isOpen(),
    cancelNaming: () => namePrompt.cancel(),
    // Com a janela aberta, ela consome todos os cliques.
    click(x, y) {
      if (namePrompt.isOpen()) { namePrompt.click(x, y); return; }
      if (inside(CLOSE, x, y)) { panel.isOpen = false; return; }
      for (const row of rows) {
        const filled = Boolean(describe(row.index));
        if (inside(row.save, x, y)) { askName(row.index); return; }
        if (filled && inside(row.load, x, y)) { onLoad(row.index); panel.isOpen = false; return; }
        if (filled && inside(row.remove, x, y)) { onDelete(row.index); return; }
      }
    },
    draw(ctx, pointer) {
      clearClickable();                              // o que está por trás da janela não recebe clique
      if (namePrompt.isOpen()) { namePrompt.draw(ctx, pointer); return; }
      panelBox(ctx, BOX);
      const title = 'MEUS CARROS';
      drawHeading(ctx, title, BOX.x + BOX.width / 2, BOX.y + 10);
      for (const row of rows) {
        const info = describe(row.index);
        ctxText(ctx, nameOf(row.index) || `CARRO ${row.index + 1}`, BOX.x + 12, row.y + 3, info ? COLOR.text : COLOR.muted);
        ctxText(ctx, info ?? 'VAZIO', BOX.x + 12, row.y + 14, COLOR.muted);
        drawButton(ctx, row.save, 'SALVAR', inside(row.save, pointer.x, pointer.y), 'primary');
        if (!info) continue;
        drawButton(ctx, row.load, 'USAR', inside(row.load, pointer.x, pointer.y));
        drawButton(ctx, row.remove, 'APAGAR', inside(row.remove, pointer.x, pointer.y), { style: 'danger', quiet: true });
      }
      drawButton(ctx, CLOSE, 'FECHAR', inside(CLOSE, pointer.x, pointer.y), 'back');
    },
  };
  return panel;
}
