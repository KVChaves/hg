import { ctxText } from '../../art/font.js';
import { fitsBudget, maxUpgradeLevel, UPGRADES, upgradeFactor, upgradePrice } from '../../game/shop.js';
import { COLOR, inside, markClickable, panelBox } from '../panelKit.js';

// Painel das melhorias, com um menos e um mais por linha. Vale para a garagem e para a tela de ajustes entre as corridas.

const ROW_HEIGHT = 12;

const upgradePercent = (id, level) => Math.round((upgradeFactor(id, level) - 1) * 100);

// `x`, `y` e `width` posicionam o painel; as colunas ficam presas à borda direita.
export function createUpgradesPanel({ x, y, width, equipment, onChange }) {
  const box = { x, y, width, height: 14 + Object.keys(UPGRADES).length * ROW_HEIGHT };
  const rows = Object.keys(UPGRADES).map((id, i) => {
    const top = y + 14 + i * ROW_HEIGHT, right = x + width;
    return { id, y: top, minus: { x: right - 34, y: top, width: 11, height: 10 }, plus: { x: right - 18, y: top, width: 11, height: 10 } };
  });

  function stepper(ctx, area, label, enabled, pointer) {
    if (enabled) markClickable(area);
    ctx.fillStyle = !enabled ? COLOR.tileDark : inside(area, pointer.x, pointer.y) ? COLOR.buttonHover : COLOR.button;
    ctx.fillRect(area.x, area.y, area.width, area.height);
    ctxText(ctx, label, area.x + 3, area.y + 2, enabled ? COLOR.text : COLOR.muted);
  }

  return {
    box,
    click(px, py) {
      for (const row of rows) {
        if (inside(row.minus, px, py)) { onChange(row.id, -1); return true; }
        if (inside(row.plus, px, py)) { onChange(row.id, 1); return true; }
      }
      return false;
    },
    draw(ctx, pointer) {
      panelBox(ctx, box);
      ctxText(ctx, 'MELHORIAS', x + 6, y + 4, COLOR.selected);
      for (const row of rows) {
        const level = equipment.upgrades[row.id], next = { ...equipment, upgrades: { ...equipment.upgrades, [row.id]: level + 1 } };
        ctxText(ctx, UPGRADES[row.id].label, x + 6, row.y + 2, COLOR.text);
        for (let pip = 0; pip < maxUpgradeLevel(row.id); pip++) {
          ctx.fillStyle = pip < level ? COLOR.selected : COLOR.tileDark;
          ctx.fillRect(row.minus.x - 20 + pip * 6, row.y + 2, 4, 6);
        }
        stepper(ctx, row.minus, '-', level > 0, pointer);
        stepper(ctx, row.plus, '+', level < maxUpgradeLevel(row.id) && fitsBudget(next), pointer);
      }
    },
    hoverInfo(pointer) {
      const row = rows.find(candidate => inside({ x, y: candidate.y, width, height: ROW_HEIGHT }, pointer.x, pointer.y));
      if (!row) return null;
      const level = equipment.upgrades[row.id], title = `${UPGRADES[row.id].label}: +${upgradePercent(row.id, level)}%`;
      if (level === maxUpgradeLevel(row.id)) return { title, detail: 'NIVEL MAXIMO' };
      return { title, detail: `PROXIMO +${upgradePercent(row.id, level + 1)}% POR R$ ${upgradePrice(row.id, level + 1) - upgradePrice(row.id, level)}` };
    },
  };
}
