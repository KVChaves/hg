import { ctxText, textWidth } from '../art/font.js';
import { cleanPlayerName, NAME_LENGTH } from '../game/playerProfile.js';
import { COLOR, inside, markClickable, outline, panelBox } from './panelKit.js';

// Campo do nome do piloto. Clique para digitar; Enter ou clique fora confirma, Esc cancela.

const TYPABLE = /^[A-Za-z0-9 ]$/;

// O caractere que a tecla digita, sem acento; vazio se a tecla não escreve nada aceito.
export function typedCharacter(key) {
  const typed = key.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return TYPABLE.test(typed) ? typed : '';
}

export function createNameField({ box, getName, setName, isReadOnly = () => false }) {
  let editing = false, draft = '';

  const stopEditing = commit => {
    if (!editing) return;
    editing = false;
    if (commit) setName(cleanPlayerName(draft));
  };

  addEventListener('keydown', e => {
    if (!editing) return;
    e.preventDefault();
    if (e.key === 'Enter') { stopEditing(true); return; }
    if (e.key === 'Escape') { stopEditing(false); return; }
    if (e.key === 'Backspace') { draft = draft.slice(0, -1); return; }
    if (draft.length < NAME_LENGTH) draft += typedCharacter(e.key);
  });

  return {
    box,
    isEditing: () => editing,
    click(x, y) {
      if (!inside(box, x, y)) { stopEditing(true); return false; }
      if (!isReadOnly() && !editing) { editing = true; draft = getName(); }
      return true;
    },
    draw(ctx, pointer) {
      if (!isReadOnly()) markClickable(box);
      panelBox(ctx, box);
      if (editing || inside(box, pointer.x, pointer.y)) outline(ctx, box, COLOR.selected);
      ctxText(ctx, 'NOME', box.x + 6, box.y + 4, COLOR.muted);
      const cursor = editing && Math.floor(performance.now() / 400) % 2 === 0 ? '_' : '';
      const text = `${editing ? draft : getName()}${cursor}`;
      ctxText(ctx, text, box.x + Math.max(6, Math.floor((box.width - textWidth(text)) / 2)), box.y + 15, isReadOnly() ? COLOR.muted : COLOR.text);
    },
  };
}
