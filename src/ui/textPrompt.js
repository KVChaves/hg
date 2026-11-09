import { ctxText, textWidth } from '../art/font.js';
import { typedCharacter } from './nameField.js';
import { COLOR, drawButton, inside, outline, panelBox } from './panelKit.js';

// Janela que pede um nome: Enter ou o botão confirmam, Esc ou Cancelar desistem.

const CURSOR_BLINK = 400;                            // milissegundos

export function createTextPrompt({ box, title, confirmLabel, maxLength, allowEmpty = false, isActive, onConfirm }) {
  const input = { x: box.x + 50, y: box.y + 94, width: box.width - 100, height: 30 };
  const confirm = { x: input.x, y: box.y + 152, width: 114, height: 26 };
  const cancel = { x: input.x + input.width - 114, y: confirm.y, width: 114, height: 26 };
  let draft = null, hint = '', emptyHint = '';       // `draft` nulo: janela fechada

  const text = () => draft.replace(/ +/g, ' ').trim().slice(0, maxLength).trim();
  const canConfirm = () => allowEmpty || text() !== '';
  const centeredX = (value, scale = 1) => box.x + Math.floor((box.width - textWidth(value, scale)) / 2);

  function submit() {
    if (!canConfirm()) return;
    const value = text();
    draft = null;
    onConfirm(value);
  }

  addEventListener('keydown', e => {
    if (!prompt.isOpen()) return;
    e.preventDefault();
    if (e.key === 'Enter') submit();
    else if (e.key === 'Escape') draft = null;
    else if (e.key === 'Backspace') draft = draft.slice(0, -1);
    else if (draft.length < maxLength) draft += typedCharacter(e.key);
  });

  function drawDisabled(ctx, button, label) {
    ctx.fillStyle = COLOR.tile;
    ctx.fillRect(button.x, button.y, button.width, button.height);
    outline(ctx, button, COLOR.edge);
    ctxText(ctx, label, button.x + Math.floor((button.width - textWidth(label)) / 2), button.y + 9, COLOR.muted);
  }

  const prompt = {
    isOpen: () => draft !== null && isActive(),
    open({ initial = '', hint: topHint = '', emptyHint: belowHint = '' } = {}) {
      draft = initial;
      hint = topHint;
      emptyHint = belowHint;
    },
    cancel() { draft = null; },
    click(x, y) {
      if (inside(confirm, x, y)) submit();
      else if (inside(cancel, x, y)) draft = null;
    },
    draw(ctx, pointer) {
      panelBox(ctx, box);
      ctxText(ctx, title, centeredX(title, 2), box.y + 10, COLOR.selected, 2);
      if (hint) ctxText(ctx, hint, centeredX(hint), input.y - 16, COLOR.muted);
      panelBox(ctx, input);
      outline(ctx, input, COLOR.selected);
      const cursor = Math.floor(performance.now() / CURSOR_BLINK) % 2 === 0 ? '_' : '';
      ctxText(ctx, `${draft}${cursor}`, centeredX(draft), input.y + 11, COLOR.text);
      if (text() === '' && emptyHint) ctxText(ctx, emptyHint, centeredX(emptyHint), input.y + input.height + 10, COLOR.muted);
      if (canConfirm()) drawButton(ctx, confirm, confirmLabel, inside(confirm, pointer.x, pointer.y));
      else drawDisabled(ctx, confirm, confirmLabel);
      drawButton(ctx, cancel, 'CANCELAR', inside(cancel, pointer.x, pointer.y));
    },
  };
  return prompt;
}
