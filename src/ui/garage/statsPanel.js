import { ctxText, textWidth } from '../../art/font.js';
import { CAR_MAX_HP, CAR_TOUGHNESS, NITRO_DRAIN } from '../../config.js';
import { partStats } from '../../game/carUpgrades.js';
import { upgradeFactor } from '../../game/shop.js';
import { buildWeapon } from '../../game/weaponParts.js';
import { WEAPON_TYPES } from '../../game/weaponTypes.js';
import { clearClickable, COLOR, drawButton, drawHeading, inside, panelBox } from '../panelKit.js';

// Janela da ficha do carro: os números do carro e da arma com tudo o que foi comprado, calculados como na corrida.
// Verde é melhor que o carro (ou a arma) original; vermelho é pior.

const BOX = { x: 190, y: 40, width: 260, height: 280 };
const CLOSE = { x: 250, y: 290, width: 140, height: 22 };
const COLUMN_WIDTH = 220, LEFT = BOX.x + (BOX.width - COLUMN_WIDTH) / 2;
const TOP = BOX.y + 38, ROW = 12, SECTION_GAP = 7;
const GOOD = '#6fe070';

const round = (value, digits = 0) => Number(value.toFixed(digits));
const signed = share => `${Math.round(share * 100) > 0 ? '+' : ''}${Math.round(share * 100)}%`;

// Uma linha: `better` é positivo quando o valor ganha do original, negativo quando perde.
const row = (label, value, better = 0) => ({ label, value, better: Math.abs(better) < 1e-6 ? 0 : better });
// Bônus sobre o original: 0% quando nada foi comprado.
const bonus = (label, share) => row(label, signed(share), share);

function carSection({ upgrades, parts }) {
  const stats = partStats(parts);
  const baseLife = CAR_MAX_HP * CAR_TOUGHNESS;
  const life = baseLife * upgradeFactor('life', upgrades.life);
  const nitroTime = upgradeFactor('nitro', upgrades.nitro) / (NITRO_DRAIN * stats.nitroDrain);
  const rows = [
    row('VIDA (HP)', String(Math.round(life)), life - baseLife),
    bonus('DEFESA FISICA', 1 - stats.crash),
    bonus('DEFESA CONTRA TIRO', 1 - stats.bullet),
    bonus('DANO FISICO', stats.ram - 1),
    row('DURACAO DO NITRO', `${round(nitroTime, 1)}S`, nitroTime - 1 / NITRO_DRAIN),
  ];
  if (stats.blast) rows.push(row('DANO DE EXPLOSAO', String(stats.blast), stats.blast));
  return { title: 'CARRO', rows };
}

function weaponSection({ weaponId, upgrades, weaponParts }) {
  const base = WEAPON_TYPES[weaponId], type = buildWeapon(weaponId, weaponParts?.[weaponId]);
  // A arma larga descarregada: a reserva é o total de balas da corrida (weapon.equip).
  const ammo = Math.ceil(type.reserve * upgradeFactor('ammo', upgrades.ammo));
  return { title: type.label, rows: [
    row('DANO POR TIRO', String(round(type.damage, 1)), type.damage - base.damage),
    row('TIROS POR SEGUNDO', String(round(1 / type.interval, 1)), base.interval - type.interval),
    row('BALAS NA CORRIDA', String(ammo), ammo - base.reserve),
    row('ALCANCE', `${type.range}M`, type.range - base.range),
  ] };
}

export function createStatsPanel({ getEquipment }) {
  function drawSection(ctx, { title, rows }, x, y) {
    ctxText(ctx, title, x, y, COLOR.selected);
    ctx.fillStyle = COLOR.edge;
    ctx.fillRect(x, y + 9, COLUMN_WIDTH, 1);
    y += ROW + 3;
    for (const { label, value, better } of rows) {
      ctxText(ctx, label, x, y, COLOR.muted);
      ctxText(ctx, value, x + COLUMN_WIDTH - textWidth(value), y, better > 0 ? GOOD : better < 0 ? COLOR.danger : COLOR.text);
      y += ROW;
    }
    return y + SECTION_GAP;
  }

  const panel = {
    isOpen: false,
    // Com a janela aberta, ela consome todos os cliques.
    click(x, y) {
      if (inside(CLOSE, x, y) || !inside(BOX, x, y)) panel.isOpen = false;
    },
    draw(ctx, pointer) {
      clearClickable();                              // o que está por trás da janela não recebe clique
      panelBox(ctx, BOX);
      drawHeading(ctx, 'FICHA DO CARRO', BOX.x + 20, BOX.y + 10, { align: 'left' });
      const equipment = getEquipment();
      [carSection(equipment), weaponSection(equipment)].reduce((y, section) => drawSection(ctx, section, LEFT, y), TOP);
      const legend = 'VERDE: MELHOR  VERMELHO: PIOR';
      ctxText(ctx, legend, BOX.x + Math.floor((BOX.width - textWidth(legend)) / 2), CLOSE.y - 14, COLOR.muted);
      drawButton(ctx, CLOSE, 'FECHAR', inside(CLOSE, pointer.x, pointer.y), 'back');
    },
  };
  return panel;
}
