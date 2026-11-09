import { ctxText, textWidth } from '../../art/font.js';
import { COLOR, drawButton, inside, panelBox } from '../panelKit.js';

// Online: quem já está pronto na garagem ou no pódio. O admin pode expulsar quem ainda não confirmou.

const WIDTH = 200, X = 220, HEADER = 15, ROW = 13;
const READY_COLOR = '#6fe070';

export function createReadyPanel({ getRoster, onKick }) {
  let box = null, kicks = [];

  return {
    get kickBoxes() { return kicks; },
    contains: (x, y) => Boolean(box) && inside(box, x, y),
    click(x, y) {
      const hit = kicks.find(kick => inside(kick, x, y));
      if (hit) onKick(hit.id);
      return Boolean(hit);
    },
    // `roster` é { canKick, players: [{ id, name, ready, isMe }] }, ou null fora da garagem online.
    draw(ctx, pointer, top, x = X) {
      const roster = getRoster();
      kicks = [];
      box = null;
      if (!roster) return;
      box = { x, y: top, width: WIDTH, height: HEADER + roster.players.length * ROW + 3 };
      panelBox(ctx, box);
      const done = roster.players.filter(player => player.ready).length;
      const title = `PRONTOS ${done}/${roster.players.length}`;
      ctxText(ctx, title, x + Math.floor((WIDTH - textWidth(title)) / 2), top + 4, COLOR.selected);
      roster.players.forEach((player, i) => {
        const y = top + HEADER + i * ROW;
        ctxText(ctx, player.name, x + 6, y + 2, player.isMe ? COLOR.selected : COLOR.text);
        ctxText(ctx, player.ready ? 'PRONTO' : 'AGUARDANDO', x + 82, y + 2, player.ready ? READY_COLOR : COLOR.muted);
        if (!roster.canKick || player.isMe || player.ready) return;
        const kick = { id: player.id, x: x + WIDTH - 56, y: y - 1, width: 52, height: 12 };
        kicks.push(kick);
        drawButton(ctx, kick, 'EXPULSAR', inside(kick, pointer.x, pointer.y));
      });
    },
  };
}
