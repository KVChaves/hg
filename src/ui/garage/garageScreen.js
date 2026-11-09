import { ctxText, textWidth } from '../../art/font.js';
import { PARTS } from '../../cabin/parts/index.js';
import { saveEquipment } from '../../game/equipment.js';
import { loadSavedCars, SAVED_CAR_SLOTS, storeSavedCars } from '../../game/savedCars.js';
import { BUDGET, fitsBudget, loadoutCost, maxUpgradeLevel, UPGRADES, upgradeFactor, upgradePrice } from '../../game/shop.js';
import { MAX_TRAP_SLOTS, TRAP_TYPES } from '../../game/trapTypes.js';
import { WEAPON_TYPES } from '../../game/weaponTypes.js';
import { CAR_SLOTS, loadCarSelection, resolveCarSpec, saveCarSelection } from '../../world/car/carOptions.js';
import { createNameField } from '../nameField.js';
import { createOptionStrip } from '../optionStrip.js';
import { COLOR, drawButton, drawSlotTile, drawTooltip, inside, markClickable, panelBox, pointerOnStage } from '../panelKit.js';
import { createGarageScene } from './garageScene.js';
import { createReadyPanel } from './readyPanel.js';
import { createSavedCarsPanel } from './savedCarsPanel.js';
import { emptyTrunkThumb, exteriorThumb, interiorThumb, trunkItemThumb, weaponThumb } from './garageThumbs.js';

// Garagem antes da corrida: à esquerda o interior e o equipamento, à direita o exterior. Ao clicar numa
// peça, a faixa mostra as opções dela e, quando houver, o seletor de cores.

const TILE = { width: 46, height: 42, gapX: 48, gapY: 44 };
const LEFT = { x: 6, y: 40, width: 106, columns: 2 };
const RIGHT = { x: 484, y: 40, width: 152, columns: 3 };
const EQUIPMENT = { x: 6, y: 196, width: 106, columns: 2 };
const UPGRADE_PANEL = { x: 6, y: 306, width: 106, height: 50 };
const UPGRADE_ROW = 12, NO_FUNDS_TIME = 1.2;
const QUANTITY_SIZE = { width: 220, height: 20 };
const NAME_BOX = { x: 528, y: 6, width: 106, height: 28 };
const SAVED_CARS_BUTTON = { x: 528, y: 284, width: 106, height: 22 };
const NEXT_BUTTON = { x: 240, y: 6, width: 160, height: 26 };
const MENU_BUTTON = { x: 118, y: 6, width: 116, height: 26 };
const WORKSHOP_BUTTON = { x: 406, y: 6, width: 116, height: 26 };
const INTERIOR_SHORT = { wheel: 'VOLANTE', shifter: 'CAMBIO', nitro: 'NITRO', health: 'VIDA', charm: 'ENFEITE', cabinColor: 'COR' };
const COLOR_ONLY_INTERIOR = new Set(['cabinColor']);
const ORIGINAL_SWATCH = { nitro: 0x8c251a, cabinColor: 0x4b2825 };   // amostra quando a peça está na cor original

// Opções de arma e do bagageiro: `name` e `detail` aparecem ao passar o mouse.
const weaponOptions = () => Object.fromEntries(Object.values(WEAPON_TYPES).map(type => [type.id, {
  name: `${type.label}: ${type.summary}`, detail: `R$ ${type.price}  DANO ${type.damage}  ALCANCE ${type.range}  BALAS ${type.magazine + type.reserve}`,
}]));
const trunkOptions = () => ({
  none: { name: 'VAZIO', detail: 'Sem item nesta vaga' },
  ...Object.fromEntries(Object.values(TRAP_TYPES).map(type => [type.id, { name: `${type.label}: ${type.summary}`, detail: `R$ ${type.price} CADA  ATE ${type.maxCharges} UNIDADES` }])),
});

export function createGarageScreen({ stage, cabin, customs, equipment, getName, setName, getReadyRoster, onKickPlayer, onProceed, onBetweenRacesEnd, onBack, onOpenWorkshop }) {
  const carSelection = loadCarSelection();
  const carScene = createGarageScene(resolveCarSpec(carSelection));

  const makeSlot = (group, key, index, panel, short, thumbOf, options, hasColor) => ({
    group, key, short, options, hasColor,
    thumbs: options ? Object.fromEntries(Object.entries(options).map(([id, option]) => [id, thumbOf(key, option)])) : null,
    x: panel.x + 6 + (index % panel.columns) * TILE.gapX,
    y: panel.y + 16 + Math.floor(index / panel.columns) * TILE.gapY,
    width: TILE.width, height: TILE.height,
  });

  const slots = [
    ...Object.keys(PARTS).map((key, i) => makeSlot('interior', key, i, LEFT, INTERIOR_SHORT[key], interiorThumb, COLOR_ONLY_INTERIOR.has(key) ? null : PARTS[key].options, true)),
    ...Object.keys(CAR_SLOTS).map((key, i) => makeSlot('exterior', key, i, RIGHT, CAR_SLOTS[key].short, exteriorThumb, CAR_SLOTS[key].options ?? null, CAR_SLOTS[key].colorDefault !== undefined)),
  ];

  const equipmentSlots = [
    { key: 'weapon', short: 'ARMA', label: 'Arma', options: weaponOptions(), thumbOf: id => weaponThumb(id, customs[id]) },
    ...Array.from({ length: MAX_TRAP_SLOTS }, (_, i) => ({
      key: `trunk${i}`, short: `ITEM ${i + 1}`, label: 'Bagageiro', trunkIndex: i, options: trunkOptions(),
      thumbOf: id => (id === 'none' ? emptyTrunkThumb() : trunkItemThumb(id)),
    })),
  ].map((slot, i) => ({
    ...slot, group: 'equipment', hasColor: false, thumbs: null,
    x: EQUIPMENT.x + 6 + (i % EQUIPMENT.columns) * TILE.gapX,
    y: EQUIPMENT.y + 16 + Math.floor(i / EQUIPMENT.columns) * TILE.gapY,
    width: TILE.width, height: TILE.height,
  }));
  slots.push(...equipmentSlots);

  // As miniaturas das armas mudam quando elas são personalizadas na oficina.
  function refreshEquipmentThumbs() {
    for (const slot of equipmentSlots) slot.thumbs = Object.fromEntries(Object.keys(slot.options).map(id => [id, slot.thumbOf(id)]));
  }
  refreshEquipmentThumbs();

  const leftRows = Math.ceil(Object.keys(PARTS).length / LEFT.columns);
  const rightRows = Math.ceil(Object.keys(CAR_SLOTS).length / RIGHT.columns);
  const leftPanel = { ...LEFT, height: 16 + leftRows * TILE.gapY + 4 };
  const rightPanel = { ...RIGHT, height: 16 + rightRows * TILE.gapY + 4 };
  const equipmentPanel = { ...EQUIPMENT, height: 16 + Math.ceil(equipmentSlots.length / EQUIPMENT.columns) * TILE.gapY + 4 };

  const upgradeRows = Object.keys(UPGRADES).map((id, i) => {
    const y = UPGRADE_PANEL.y + 14 + i * UPGRADE_ROW;
    return { id, y, minus: { x: UPGRADE_PANEL.x + 72, y, width: 11, height: 10 }, plus: { x: UPGRADE_PANEL.x + 88, y, width: 11, height: 10 } };
  });

  let active = slots.find(slot => slot.key === 'body');
  let browsing = false, browseDone = null;           // aberta só para personalizar (menu ou sala), sem corrida; `browseDone` diz para onde voltar
  let noFunds = 0, betweenRaces = 0;                 // segundos que restam do intervalo; 0 fora dele
  let waitsForHost = false, waiting = false;         // online: o intervalo termina quando o admin largar
  const nameField = createNameField({ box: NAME_BOX, getName, setName });
  const readyPanel = createReadyPanel({ getRoster: getReadyRoster, onKick: onKickPlayer });

  const savedCars = loadSavedCars();
  const savedCarsPanel = createSavedCarsPanel({
    slotCount: SAVED_CAR_SLOTS,
    describe: index => {
      const saved = savedCars[index];
      return saved && `${WEAPON_TYPES[saved.equipment.weaponId].label}  R$ ${loadoutCost(saved.equipment)}`;
    },
    nameOf: index => savedCars[index]?.name ?? '',
    isActive: () => screen.isOpen,
    onSave: (index, name) => {
      savedCars[index] = { name, selection: structuredClone(carSelection), cabin: structuredClone(cabin.loadout), equipment: structuredClone(equipment) };
      storeSavedCars(savedCars);
    },
    onLoad: index => useSavedCar(savedCars[index]),
    onDelete: index => {
      savedCars[index] = null;
      storeSavedCars(savedCars);
    },
  });

  function useSavedCar(saved) {
    Object.assign(carSelection.options, saved.selection.options);
    Object.assign(carSelection.colors, saved.selection.colors);
    refreshCar();
    for (const kind of Object.keys(PARTS)) {
      cabin.setPart(kind, saved.cabin[kind]);
      cabin.setPartColor(kind, saved.cabin.colors[kind]);
    }
    if (fitsBudget(saved.equipment)) {
      Object.assign(equipment, structuredClone(saved.equipment));
      saveEquipment(equipment);
    } else {
      noFunds = NO_FUNDS_TIME;                       // os preços mudaram: leva só a aparência
    }
  }
  let pointer = { x: -1, y: -1 }, dragging = false;

  const screen = { isOpen: false, get view() { return active.group === 'interior' ? 'cabin' : 'car'; } };

  function currentId(slot) {
    if (slot.group === 'interior') return cabin.loadout[slot.key];
    if (slot.group === 'exterior') return carSelection.options[slot.key];
    return slot.key === 'weapon' ? equipment.weaponId : equipment.trapIds[slot.trunkIndex] ?? 'none';
  }
  const currentColor = slot => (slot.group === 'interior' ? cabin.loadout.colors[slot.key] : carSelection.colors[slot.key]);
  const labelOf = slot => (slot.label ?? (slot.group === 'interior' ? PARTS[slot.key].label : CAR_SLOTS[slot.key].label));

  function refreshCar() {
    carScene.apply(resolveCarSpec(carSelection));
    saveCarSelection(carSelection);
  }

  // Como ficaria a compra com essa escolha. Um item só cabe em uma vaga: escolher um que já está em outra troca os dois.
  function withChoice(slot, id) {
    if (slot.key === 'weapon') return { ...equipment, weaponId: id };
    const trapIds = [...equipment.trapIds], trapCounts = [...equipment.trapCounts], here = slot.trunkIndex;
    if (id === 'none') {
      trapIds[here] = null;
      trapCounts[here] = 0;
    } else if (trapIds[here] !== id) {
      const other = trapIds.indexOf(id);
      if (other >= 0) {
        [trapIds[other], trapIds[here]] = [trapIds[here], trapIds[other]];
        [trapCounts[other], trapCounts[here]] = [trapCounts[here], trapCounts[other]];
      } else {
        trapIds[here] = id;
        trapCounts[here] = 1;
      }
    }
    return { ...equipment, trapIds, trapCounts };
  }

  function purchase(next) {
    if (!fitsBudget(next)) { noFunds = NO_FUNDS_TIME; return false; }
    Object.assign(equipment, next);
    saveEquipment(equipment);
    return true;
  }

  const chooseEquipment = (slot, id) => purchase(withChoice(slot, id));

  function changeUpgrade(id, delta) {
    const level = equipment.upgrades[id] + delta;
    if (level < 0 || level > maxUpgradeLevel(id)) return;
    purchase({ ...equipment, upgrades: { ...equipment.upgrades, [id]: level } });
  }

  function changeQuantity(slotIndex, delta) {
    const id = equipment.trapIds[slotIndex], count = equipment.trapCounts[slotIndex] + delta;
    if (!id || count < 1 || count > TRAP_TYPES[id].maxCharges) return;
    const trapCounts = [...equipment.trapCounts];
    trapCounts[slotIndex] = count;
    purchase({ ...equipment, trapCounts });
  }

  // Seletor de quantidade logo acima da faixa, quando a vaga ativa do bagageiro tem item.
  function quantityControl() {
    if (active.trunkIndex === undefined || !equipment.trapIds[active.trunkIndex]) return null;
    const box = strip.box(), x = box.x + Math.floor((box.width - QUANTITY_SIZE.width) / 2), y = box.y - QUANTITY_SIZE.height - 3;
    return { panel: { x, y, ...QUANTITY_SIZE }, minus: { x: x + 72, y: y + 5, width: 11, height: 10 }, plus: { x: x + 110, y: y + 5, width: 11, height: 10 }, slotIndex: active.trunkIndex };
  }

  function drawQuantity(ctx) {
    const control = quantityControl();
    if (!control) return;
    const { panel, minus, plus, slotIndex } = control, id = equipment.trapIds[slotIndex], count = equipment.trapCounts[slotIndex], type = TRAP_TYPES[id];
    const trapCounts = [...equipment.trapCounts];
    trapCounts[slotIndex] = count + 1;
    panelBox(ctx, panel);
    ctxText(ctx, 'QUANTIDADE', panel.x + 8, panel.y + 7, COLOR.selected);
    drawStepper(ctx, minus, '-', count > 1, inside(minus, pointer.x, pointer.y));
    const number = String(count);
    ctxText(ctx, number, minus.x + minus.width + Math.floor((plus.x - minus.x - minus.width - textWidth(number)) / 2), panel.y + 7, COLOR.text);
    drawStepper(ctx, plus, '+', count < type.maxCharges && fitsBudget({ ...equipment, trapCounts }), inside(plus, pointer.x, pointer.y));
    const total = `TOTAL R$ ${type.price * count}`;
    ctxText(ctx, total, panel.x + panel.width - 8 - textWidth(total), panel.y + 7, COLOR.text);
  }

  // Quantas unidades a vaga leva, no canto da miniatura.
  function drawTrunkCount(ctx, slot) {
    const count = equipment.trapCounts[slot.trunkIndex];
    if (!count) return;
    const label = `x${count}`;
    ctx.fillStyle = COLOR.tileDark;
    ctx.fillRect(slot.x + slot.width - textWidth(label) - 3, slot.y + 2, textWidth(label) + 1, 9);
    ctxText(ctx, label, slot.x + slot.width - textWidth(label) - 2, slot.y + 3, COLOR.selected);
  }

  const priceOfEquipment = (slot, id) => {
    if (slot.group !== 'equipment') return null;
    if (slot.key === 'weapon') return WEAPON_TYPES[id].price;
    return id === 'none' ? 0 : TRAP_TYPES[id].price;
  };

  function choose(slot, id) {
    if (slot.group === 'equipment') {
      chooseEquipment(slot, id);
    } else if (slot.group === 'interior') {
      cabin.setPart(slot.key, id);
    } else {
      carSelection.options[slot.key] = id;
      refreshCar();
    }
  }

  // `color` nulo volta à cor original da peça.
  function setColor(slot, color) {
    if (slot.group === 'interior') {
      cabin.setPartColor(slot.key, color);
    } else {
      carSelection.colors[slot.key] = color ?? CAR_SLOTS[slot.key].colorDefault;
      refreshCar();
    }
  }

  // No interior a faixa fica no alto para não cobrir o volante; o enfeite pende do retrovisor, então nele vai para baixo.
  const stripPlacement = slot => (slot.group === 'interior' && slot.key !== 'charm' ? 'top' : 'bottom');

  const strip = createOptionStrip({
    x: 118, width: 362, top: 36, bottom: 356,
    placement: stripPlacement,
    getSlot: () => active, currentId, currentColor,
    priceOf: priceOfEquipment,
    isLocked: (slot, id) => slot.group === 'equipment' && !fitsBudget(withChoice(slot, id)),
    originalSwatch: slot => ORIGINAL_SWATCH[slot.key],
    onChoose: choose, onColor: setColor,
  });

  const overQuantity = (x, y) => { const control = quantityControl(); return Boolean(control) && inside(control.panel, x, y); };
  const overUi = (x, y) => savedCarsPanel.isOpen || readyPanel.contains(x, y) || inside(NAME_BOX, x, y) || inside(SAVED_CARS_BUTTON, x, y) || overQuantity(x, y) || inside(UPGRADE_PANEL, x, y) || inside(equipmentPanel, x, y) || inside(WORKSHOP_BUTTON, x, y) || inside(leftPanel, x, y) || inside(rightPanel, x, y) || strip.contains(x, y) || inside(NEXT_BUTTON, x, y) || inside(MENU_BUTTON, x, y);

  addEventListener('mousemove', e => {
    if (!screen.isOpen) return;
    pointer = pointerOnStage(e, stage);
    if (!strip.pointerMove(pointer.x, pointer.y) && dragging) carScene.rotateBy(e.movementX * 0.012);
  });
  stage.addEventListener('mousedown', e => {
    if (!screen.isOpen) return;
    const { x, y } = pointerOnStage(e, stage);
    if (strip.pointerDown(x, y) || screen.view !== 'car' || overUi(x, y)) return;
    dragging = true;
    carScene.setDragging(true);
  });
  addEventListener('mouseup', () => {
    dragging = false;
    strip.pointerUp();
    carScene.setDragging(false);
  });
  stage.addEventListener('click', e => {
    if (!screen.isOpen) return;
    const { x, y } = pointerOnStage(e, stage);
    if (savedCarsPanel.isOpen) { savedCarsPanel.click(x, y); return; }
    if (nameField.click(x, y)) return;
    if (readyPanel.click(x, y)) return;
    if (inside(SAVED_CARS_BUTTON, x, y)) { savedCarsPanel.isOpen = true; return; }
    if (inside(NEXT_BUTTON, x, y)) {
      if (betweenRaces > 0 && !waitsForHost) stage.requestPointerLock();   // o navegador só captura o mouse dentro de um clique
      screen.proceed();
      return;
    }
    if (betweenRaces <= 0 && !waiting && !browsing && inside(MENU_BUTTON, x, y)) { screen.isOpen = false; onBack(); return; }
    if (inside(WORKSHOP_BUTTON, x, y)) { screen.isOpen = false; onOpenWorkshop(equipment.weaponId); return; }
    const control = quantityControl();
    if (control && inside(control.minus, x, y)) { changeQuantity(control.slotIndex, -1); return; }
    if (control && inside(control.plus, x, y)) { changeQuantity(control.slotIndex, 1); return; }
    for (const row of upgradeRows) {
      if (inside(row.minus, x, y)) { changeUpgrade(row.id, -1); return; }
      if (inside(row.plus, x, y)) { changeUpgrade(row.id, 1); return; }
    }
    const slot = slots.find(candidate => inside(candidate, x, y));
    if (slot) { active = slot; return; }
    strip.click(x, y);
  });

  const upgradePercent = (id, level) => Math.round((upgradeFactor(id, level) - 1) * 100);

  function upgradeInfo(row) {
    const level = equipment.upgrades[row.id], { label } = UPGRADES[row.id];
    const title = `${label}: +${upgradePercent(row.id, level)}%`;
    if (level === maxUpgradeLevel(row.id)) return { title, detail: 'NIVEL MAXIMO' };
    return { title, detail: `PROXIMO +${upgradePercent(row.id, level + 1)}% POR R$ ${upgradePrice(row.id, level + 1) - upgradePrice(row.id, level)}` };
  }

  function drawUpgrades(ctx) {
    panelBox(ctx, UPGRADE_PANEL);
    ctxText(ctx, 'MELHORIAS', UPGRADE_PANEL.x + 6, UPGRADE_PANEL.y + 4, COLOR.selected);
    for (const row of upgradeRows) {
      const level = equipment.upgrades[row.id], next = { ...equipment, upgrades: { ...equipment.upgrades, [row.id]: level + 1 } };
      ctxText(ctx, UPGRADES[row.id].label, UPGRADE_PANEL.x + 6, row.y + 2, COLOR.text);
      for (let pip = 0; pip < maxUpgradeLevel(row.id); pip++) {
        ctx.fillStyle = pip < level ? COLOR.selected : COLOR.tileDark;
        ctx.fillRect(UPGRADE_PANEL.x + 52 + pip * 6, row.y + 2, 4, 6);
      }
      const canRaise = level < maxUpgradeLevel(row.id) && fitsBudget(next);
      drawStepper(ctx, row.minus, '-', level > 0, inside(row.minus, pointer.x, pointer.y));
      drawStepper(ctx, row.plus, '+', canRaise, inside(row.plus, pointer.x, pointer.y));
    }
  }

  function drawStepper(ctx, box, label, enabled, hovered) {
    if (enabled) markClickable(box);
    ctx.fillStyle = !enabled ? COLOR.tileDark : hovered ? COLOR.buttonHover : COLOR.button;
    ctx.fillRect(box.x, box.y, box.width, box.height);
    ctxText(ctx, label, box.x + 3, box.y + 2, enabled ? COLOR.text : COLOR.muted);
  }

  function drawFunds(ctx) {
    panelBox(ctx, { x: 6, y: 6, width: 106, height: 26 });
    ctxText(ctx, 'GARAGEM', 6 + Math.floor((106 - textWidth('GARAGEM')) / 2), 10, COLOR.text);
    const text = noFunds > 0 ? 'SEM SALDO' : `SALDO R$ ${BUDGET - loadoutCost(equipment)}`;
    ctxText(ctx, text, 6 + Math.floor((106 - textWidth(text)) / 2), 20, noFunds > 0 ? COLOR.danger : COLOR.selected);
  }

  function hoveredInfo() {
    const hoveredRow = upgradeRows.find(row => inside({ x: UPGRADE_PANEL.x, y: row.y, width: UPGRADE_PANEL.width, height: UPGRADE_ROW }, pointer.x, pointer.y));
    if (hoveredRow) return upgradeInfo(hoveredRow);
    const fromStrip = strip.hoverInfo(pointer, labelOf(active));
    if (fromStrip) return fromStrip;
    const slot = slots.find(candidate => inside(candidate, pointer.x, pointer.y));
    return slot ? { title: slot.options ? slot.options[currentId(slot)].name : labelOf(slot), detail: labelOf(slot) } : null;
  }

  screen.draw = ctx => {
    drawFunds(ctx);

    panelBox(ctx, leftPanel);
    ctxText(ctx, 'CABINE', leftPanel.x + 6, leftPanel.y + 5, COLOR.selected);
    panelBox(ctx, rightPanel);
    ctxText(ctx, 'CARRO', rightPanel.x + 6, rightPanel.y + 5, COLOR.selected);
    panelBox(ctx, equipmentPanel);
    ctxText(ctx, 'EQUIPAMENTO', equipmentPanel.x + 6, equipmentPanel.y + 5, COLOR.selected);

    for (const slot of slots) {
      const color = currentColor(slot);
      drawSlotTile(ctx, slot, {
        image: slot.options ? slot.thumbs[currentId(slot)] : null,
        color: color ?? ORIGINAL_SWATCH[slot.key],
        chipColor: slot.hasColor ? color : null,
        active: slot === active,
        hovered: inside(slot, pointer.x, pointer.y),
      });
      if (slot.trunkIndex !== undefined) drawTrunkCount(ctx, slot);
    }

    drawUpgrades(ctx);
    strip.draw(ctx, pointer);
    drawQuantity(ctx);
    const timeLeft = Number.isFinite(betweenRaces) ? ` (${Math.ceil(betweenRaces)})` : '';
    const nextLabel = waiting ? 'AGUARDANDO...' : betweenRaces > 0 ? `${waitsForHost ? 'PRONTO' : 'CORRER AGORA'}${timeLeft}` : browsing ? '< VOLTAR AO MENU' : 'CORRER >';
    drawButton(ctx, NEXT_BUTTON, nextLabel, inside(NEXT_BUTTON, pointer.x, pointer.y));
    drawButton(ctx, WORKSHOP_BUTTON, 'OFICINA >', inside(WORKSHOP_BUTTON, pointer.x, pointer.y));
    if (betweenRaces <= 0 && !waiting && !browsing) drawButton(ctx, MENU_BUTTON, '< MENU', inside(MENU_BUTTON, pointer.x, pointer.y));
    nameField.draw(ctx, pointer);
    drawButton(ctx, SAVED_CARS_BUTTON, 'MEUS CARROS', inside(SAVED_CARS_BUTTON, pointer.x, pointer.y));
    const stripBox = strip.box();
    readyPanel.draw(ctx, pointer, stripPlacement(active) === 'top' ? stripBox.y + stripBox.height + 4 : 38);
    if (savedCarsPanel.isOpen) { savedCarsPanel.draw(ctx, pointer); return; }

    const info = hoveredInfo();
    if (info) {
      const box = strip.box();
      drawTooltip(ctx, info, pointer.x, stripPlacement(active) === 'top' ? box.y + box.height + 4 : box.y - 34);
    }
  };

  screen.carSpec = () => resolveCarSpec(carSelection);
  screen.update = dt => {
    noFunds = Math.max(0, noFunds - dt);
    carScene.update(dt);
    strip.applyPending();
  };
  screen.renderCar = renderer => carScene.render(renderer);
  screen.open = () => {
    savedCarsPanel.cancelNaming();
    screen.isOpen = true;
    refreshEquipmentThumbs();
  };
  function endBetweenRaces() {
    betweenRaces = 0;
    if (waitsForHost) waiting = true;
    else screen.isOpen = false;
    onBetweenRacesEnd();
  }

  screen.proceed = () => {
    if (!screen.isOpen || waiting) return;
    if (betweenRaces > 0) { endBetweenRaces(); return; }
    screen.isOpen = false;
    if (browsing) { browsing = false; (browseDone ?? onBack)(); return; }
    onProceed();
  };

  // Entre as corridas a garagem abre com tempo contado; o relógio segue mesmo com o jogador na oficina.
  screen.openFromMenu = onDone => {
    browsing = true;
    browseDone = onDone ?? null;
    betweenRaces = 0;
    waiting = false;
    screen.open();
  };
  screen.openBetweenRaces = (seconds, options = {}) => {
    browsing = false;
    betweenRaces = seconds;
    waitsForHost = Boolean(options.waitsForHost);
    waiting = false;
    screen.open();
  };
  screen.isBetweenRaces = () => betweenRaces > 0 || waiting;
  screen.tickBetweenRaces = dt => {
    if (betweenRaces <= 0 || (betweenRaces -= dt) > 0) return;
    endBetweenRaces();
  };
  screen.closeAfterWait = () => {
    screen.isOpen = false;
    waiting = waitsForHost = false;
    betweenRaces = 0;
  };
  screen.isTyping = () => nameField.isEditing() || savedCarsPanel.isNaming();
  screen.changeUpgrade = changeUpgrade;
  screen.savedCarsPanel = savedCarsPanel;
  screen.readyPanel = readyPanel;
  screen.changeQuantity = changeQuantity;
  screen.funds = () => BUDGET - loadoutCost(equipment);
  screen.selectSlot = key => { active = slots.find(slot => slot.key === key); };
  screen.choose = (key, id) => choose(slots.find(slot => slot.key === key), id);
  screen.chooseColor = (key, color) => setColor(slots.find(slot => slot.key === key), color);
  return screen;
}
