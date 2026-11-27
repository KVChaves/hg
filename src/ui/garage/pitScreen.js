import { ctxText, textWidth } from '../../art/font.js';
import { BUDGET, fitsBudget, loadoutCost, trunkUnits } from '../../game/shop.js';
import { WEAPON_TYPES } from '../../game/weaponTypes.js';
import { partSummary, variantsFor, WEAPON_PART_KEYS, WEAPON_PARTS, weaponPartsCost } from '../../game/weaponParts.js';
import { partIcon } from '../guns/partIcons.js';
import { WEAPON_SHORT } from '../weaponWorkshop.js';
import { createOptionStrip } from '../optionStrip.js';
import { COLOR, drawButton, drawCorners, drawSlotTile, drawTooltip, inside, panelBox } from '../panelKit.js';
import { createUpgradesPanel } from './upgradesPanel.js';

// Ajustes entre as corridas de uma partida: só o que muda o desempenho (arma e peças dela, peças do carro, melhorias e
// bagageiro), tudo à vista numa tela só. A aparência do carro, da cabine e da arma é editada na garagem, fora das partidas.
// Quem controla o tempo, o botão de pronto e as janelas por cima é a garagem (garageScreen.js), que desenha esta tela.

const TILE = { width: 46, height: 42, gapX: 48, gapY: 44 };
const LOW_TILE = { width: 46, height: 34, gapX: 48, gapY: 36 };
const COLUMNS = 3;
const WEAPONS = { x: 6, y: 40, width: 152, height: 16 + Math.ceil(Object.keys(WEAPON_TYPES).length / COLUMNS) * LOW_TILE.gapY + 2 };
const WEAPON_PARTS_PANEL = { x: 6, y: WEAPONS.y + WEAPONS.height + 4, width: 152, height: 16 + Math.ceil(WEAPON_PART_KEYS.length / COLUMNS) * LOW_TILE.gapY + 2 };
const CAR = { x: 482, y: 40, width: 152 };
const STRIP = { x: 164, width: 312, top: 36, bottom: 356 };

const tileAt = (panel, size, index) => ({
  x: panel.x + 6 + (index % COLUMNS) * size.gapX, y: panel.y + 16 + Math.floor(index / COLUMNS) * size.gapY,
  width: size.width, height: size.height,
});

// `carSlots` são as peças de desempenho da garagem ({ key, short, label, options, thumbs }); `onChoosePart` compra uma delas.
export function createPitScreen({ equipment, carSlots, weaponSlot, lockedWeapon, onChoosePart, onChooseWeapon, onChooseWeaponPart, onUpgrade, onOpenTrunk, onOpenStats }) {
  const carPanel = { ...CAR, height: 16 + Math.ceil(carSlots.length / COLUMNS) * TILE.gapY + 4 };
  const upgrades = createUpgradesPanel({ x: CAR.x, y: carPanel.y + carPanel.height + 4, width: CAR.width, equipment, onChange: onUpgrade });
  const TRUNK_BUTTON = { x: CAR.x, y: upgrades.box.y + upgrades.box.height + 4, width: CAR.width, height: 34 };
  const STATS_BUTTON = { x: CAR.x, y: TRUNK_BUTTON.y + TRUNK_BUTTON.height + 4, width: CAR.width, height: 22 };

  const weaponTiles = Object.keys(WEAPON_TYPES).map((id, i) => ({ id, short: WEAPON_SHORT[id], ...tileAt(WEAPONS, LOW_TILE, i) }));
  const partSlots = WEAPON_PART_KEYS.map((key, i) => ({
    key, weaponPart: true, short: WEAPON_PARTS[key].short, label: WEAPON_PARTS[key].label, hasColor: false, options: null, thumbs: null,
    ...tileAt(WEAPON_PARTS_PANEL, LOW_TILE, i),
  }));
  const tuningSlots = carSlots.map((slot, i) => ({ ...slot, hasColor: false, source: slot, ...tileAt(carPanel, TILE, i) }));
  const slots = [...partSlots, ...tuningSlots];
  let active = partSlots[0];

  // As peças que a arma aceita mudam de uma arma para outra.
  function refreshPartSlots() {
    for (const slot of partSlots) {
      const variants = variantsFor(slot.key, equipment.weaponId);
      slot.options = Object.fromEntries(variants.map(([id, variant]) => [id, { name: `${variant.name.toUpperCase()}${variant.price ? `  R$ ${variant.price}` : ''}`, detail: partSummary(variant, equipment.weaponId) }]));
      slot.thumbs = Object.fromEntries(variants.map(([id]) => [id, partIcon(slot.key, id)]));
    }
  }

  const currentId = slot => (slot.weaponPart ? equipment.weaponParts[equipment.weaponId][slot.key] : equipment.parts[slot.key]);
  const withWeaponPart = (key, id) => ({ ...equipment, weaponParts: { ...equipment.weaponParts, [equipment.weaponId]: { ...equipment.weaponParts[equipment.weaponId], [key]: id } } });
  const withOption = (slot, id) => (slot.weaponPart ? withWeaponPart(slot.key, id) : { ...equipment, parts: { ...equipment.parts, [slot.key]: id } });

  const strip = createOptionStrip({
    ...STRIP,
    placement: () => 'bottom',
    getSlot: () => active, currentId, currentColor: () => null,
    priceOf: (slot, id) => (slot.weaponPart ? WEAPON_PARTS[slot.key].variants[id].price : slot.options[id].price),
    isLocked: (slot, id) => !fitsBudget(withOption(slot, id)),
    originalSwatch: () => null,
    onChoose: (slot, id) => (slot.weaponPart ? onChooseWeaponPart(withWeaponPart(slot.key, id)) : onChoosePart(slot.source, id)),
    onColor: () => {},
  });

  const weaponPrice = id => WEAPON_TYPES[id].price + weaponPartsCost(id, equipment.weaponParts[id]);   // já com as peças de combate dela
  const canEquip = id => (lockedWeapon() ? id === lockedWeapon() : fitsBudget({ ...equipment, weaponId: id }));

  function hoveredInfo(pointer) {
    const fromUpgrades = upgrades.hoverInfo(pointer);
    if (fromUpgrades) return fromUpgrades;
    refreshPartSlots();
    const fromStrip = strip.hoverInfo(pointer, active.label);
    if (fromStrip) return fromStrip;
    const weapon = weaponTiles.find(tile => inside(tile, pointer.x, pointer.y));
    if (weapon) {
      const type = WEAPON_TYPES[weapon.id];
      if (lockedWeapon() && weapon.id !== lockedWeapon()) return { title: type.label, detail: 'ARMA SORTEADA: NAO DA PARA TROCAR' };
      return { title: `${type.label}  R$ ${weaponPrice(weapon.id)}`, detail: `DANO ${type.damage}  ALCANCE ${type.range}  BALAS ${type.magazine + type.reserve}` };
    }
    const slot = slots.find(candidate => inside(candidate, pointer.x, pointer.y));
    return slot ? { title: `${slot.label}: ${slot.options[currentId(slot)].name}`, detail: slot.options[currentId(slot)].detail } : null;
  }

  return {
    contains: (x, y) => [WEAPONS, WEAPON_PARTS_PANEL, carPanel, upgrades.box, TRUNK_BUTTON, STATS_BUTTON].some(box => inside(box, x, y)) || strip.contains(x, y),
    click(x, y) {
      if (inside(TRUNK_BUTTON, x, y)) { onOpenTrunk(); return; }
      if (inside(STATS_BUTTON, x, y)) { onOpenStats(); return; }
      if (upgrades.click(x, y)) return;
      const weapon = weaponTiles.find(tile => inside(tile, x, y));
      if (weapon) { onChooseWeapon(weapon.id); return; }
      const slot = slots.find(candidate => inside(candidate, x, y));
      if (slot) { active = slot; return; }
      refreshPartSlots();
      strip.click(x, y);
    },
    draw(ctx, pointer) {
      refreshPartSlots();
      panelBox(ctx, WEAPONS);
      ctxText(ctx, 'ARMA', WEAPONS.x + 6, WEAPONS.y + 5, COLOR.selected);
      const thumbs = weaponSlot.thumbs;
      for (const tile of weaponTiles) {
        drawSlotTile(ctx, tile, { image: thumbs[tile.id], chipColor: null, active: tile.id === equipment.weaponId, hovered: inside(tile, pointer.x, pointer.y) });
        if (tile.id !== equipment.weaponId && !canEquip(tile.id)) {
          ctx.fillStyle = 'rgba(10, 10, 14, 0.62)';
          ctx.fillRect(tile.x + 1, tile.y + 1, tile.width - 2, tile.height - 2);
        }
        if (tile.id === lockedWeapon()) drawCorners(ctx, tile, COLOR.gold);
      }

      panelBox(ctx, WEAPON_PARTS_PANEL);
      ctxText(ctx, 'PECAS DA ARMA', WEAPON_PARTS_PANEL.x + 6, WEAPON_PARTS_PANEL.y + 5, COLOR.selected);
      panelBox(ctx, carPanel);
      ctxText(ctx, 'DESEMPENHO', carPanel.x + 6, carPanel.y + 5, COLOR.selected);
      for (const slot of slots) {
        drawSlotTile(ctx, slot, { image: slot.thumbs[currentId(slot)], chipColor: null, active: slot === active, hovered: inside(slot, pointer.x, pointer.y) });
      }

      upgrades.draw(ctx, pointer);
      const items = `${trunkUnits(equipment.trunk)} ITENS`;
      drawButton(ctx, TRUNK_BUTTON, 'BAGAGEIRO', inside(TRUNK_BUTTON, pointer.x, pointer.y));
      ctxText(ctx, items, TRUNK_BUTTON.x + Math.floor((TRUNK_BUTTON.width - textWidth(items)) / 2), TRUNK_BUTTON.y + 23, COLOR.selected);
      drawButton(ctx, STATS_BUTTON, 'FICHA DO CARRO', inside(STATS_BUTTON, pointer.x, pointer.y));
      strip.draw(ctx, pointer);
    },
    drawHover(ctx, pointer) {
      const info = hoveredInfo(pointer);
      if (info) drawTooltip(ctx, info, pointer.x, strip.box().y - 34);
    },
    funds: () => `SALDO R$ ${BUDGET - loadoutCost(equipment)}`,
  };
}
