import { ctxText, textWidth } from '../../art/font.js';
import { PARTS } from '../../cabin/parts/index.js';
import { PART_KEYS, partsCost } from '../../game/carUpgrades.js';
import { saveEquipment, savedParts, savedTrunk } from '../../game/equipment.js';
import { loadSavedCars, SAVED_CAR_SLOTS, storeSavedCars } from '../../game/savedCars.js';
import { BUDGET, fitsBudget, loadoutCost, maxUpgradeLevel, trunkUnits, UPGRADES, upgradeFactor, upgradePrice } from '../../game/shop.js';
import { TRAP_TYPES } from '../../game/trapTypes.js';
import { WEAPON_TYPES } from '../../game/weaponTypes.js';
import { savedWeaponParts, weaponPartsCost } from '../../game/weaponParts.js';
import { Raster } from '../../art/raster.js';
import { CAR_SLOTS, loadCarSelection, randomizeLook, resolveCarSpec, saveCarSelection } from '../../world/car/carOptions.js';
import { createNameField } from '../nameField.js';
import { createOptionStrip } from '../optionStrip.js';
import { COLOR, drawButton, drawSlotTile, drawTooltip, inside, markClickable, outline, panelBox, pointerOnStage } from '../panelKit.js';
import { createGarageScene } from './garageScene.js';
import { createReadyPanel } from './readyPanel.js';
import { createSavedCarsPanel } from './savedCarsPanel.js';
import { exteriorThumb, interiorThumb, weaponThumb } from './garageThumbs.js';
import { createTrunkPanel } from './trunkPanel.js';

// Garagem antes da corrida: à esquerda o interior e o equipamento, à direita o exterior. Ao clicar numa
// peça, a faixa mostra as opções dela e, quando houver, o seletor de cores.

const TILE = { width: 46, height: 42, gapX: 48, gapY: 44 };
const LEFT = { x: 6, y: 40, width: 106, columns: 2 };
const RIGHT = { x: 484, y: 40, width: 152, columns: 3 };
const EQUIPMENT = { x: 6, y: 196, width: 106, columns: 2 };
const UPGRADE_PANEL = { x: 6, y: 306, width: 106, height: 50 };
const UPGRADE_ROW = 12, NO_FUNDS_TIME = 1.2;
const TRUNK_BUTTON = { x: 6, y: 266, width: 106, height: 34 };
const NAME_BOX = { x: 528, y: 6, width: 106, height: 28 };
const SAVED_CARS_BUTTON = { x: 528, y: 284, width: 106, height: 22 };
const NEXT_BUTTON = { x: 240, y: 6, width: 160, height: 26 };
const BANNER_Y = 35, BANNER_HEIGHT = 18;             // aviso do próximo mapa, logo abaixo do botão de pronto
const MENU_BUTTON = { x: 118, y: 6, width: 116, height: 26 };
const WORKSHOP_BUTTON = { x: 406, y: 6, width: 116, height: 26 };
const INTERIOR_SHORT = { wheel: 'VOLANTE', shifter: 'CAMBIO', nitro: 'NITRO', health: 'VIDA', charm: 'ENFEITE', cabinColor: 'COR', hands: 'MAOS' };
const COLOR_ONLY_INTERIOR = new Set(['cabinColor']);
const NO_COLOR_INTERIOR = new Set(['hands']);
// As mãos são peça da cabine (a vista mostra o interior), mas o painel CABINE está cheio: ficam ao lado da arma.
const CABIN_PANEL_KEYS = Object.keys(PARTS).filter(key => key !== 'hands');
const ORIGINAL_SWATCH = { nitro: 0x8c251a, cabinColor: 0x4b2825 };   // amostra quando a peça está na cor original

// Dado de pixel para o botão de sortear o visual.
function diceThumb() {
  const r = new Raster(40, 28);
  r.rect(11, 3, 20, 20, 0x101012);
  r.rect(12, 4, 18, 18, 0xf0ece0);
  r.rect(12, 20, 18, 2, 0xb8b4a8);
  for (const [x, y] of [[15, 7], [25, 7], [20, 12], [15, 17], [25, 17]]) r.rect(x, y, 2, 2, 0xb01820);
  return r.commit();
}

// Opções de arma e do bagageiro: `name` e `detail` aparecem ao passar o mouse.
const weaponOptions = () => Object.fromEntries(Object.values(WEAPON_TYPES).map(type => [type.id, {
  name: `${type.label}: ${type.summary}`, detail: `R$ ${type.price}  DANO ${type.damage}  ALCANCE ${type.range}  BALAS ${type.magazine + type.reserve}`,
}]));

export function createGarageScreen({ stage, cabin, customs, equipment, getName, setName, getReadyRoster, getUpcomingBiome = () => null, onPurchase = () => {}, onKickPlayer, onProceed, onBetweenRacesEnd, onBack, onOpenWorkshop }) {
  const carSelection = loadCarSelection();
  // As peças de desempenho (para-choque, pneus, vidro, suspensão) valem pelo que está no equipamento comprado.
  const syncPartsToCar = () => { for (const key of PART_KEYS) carSelection.options[key] = equipment.parts[key]; };
  equipment.parts = savedParts(equipment.parts);
  syncPartsToCar();
  const carScene = createGarageScene(resolveCarSpec(carSelection));

  // O painel do carro tem duas abas: aparência (grátis) e desempenho (peças com preço e efeito).
  const performanceKeys = ['bumper', 'bumperTrim', 'tire', 'glass', 'height', 'exhaust'];
  const lookKeys = Object.keys(CAR_SLOTS).filter(key => !performanceKeys.includes(key));
  const tabOf = key => (performanceKeys.includes(key) ? 'performance' : 'look');

  const makeSlot = (group, key, index, panel, short, thumbOf, options, hasColor) => ({
    group, key, short, options, hasColor, tab: group === 'exterior' ? tabOf(key) : null,
    thumbs: options ? Object.fromEntries(Object.entries(options).map(([id, option]) => [id, thumbOf(key, option)])) : null,
    x: panel.x + 6 + (index % panel.columns) * TILE.gapX,
    y: panel.y + 16 + Math.floor(index / panel.columns) * TILE.gapY,
    width: TILE.width, height: TILE.height,
  });

  const slots = [
    ...CABIN_PANEL_KEYS.map((key, i) => makeSlot('interior', key, i, LEFT, INTERIOR_SHORT[key], interiorThumb, COLOR_ONLY_INTERIOR.has(key) ? null : PARTS[key].options, !NO_COLOR_INTERIOR.has(key))),
    makeSlot('interior', 'hands', 1, EQUIPMENT, INTERIOR_SHORT.hands, interiorThumb, PARTS.hands.options, false),
    ...[...lookKeys, ...performanceKeys].map(key => makeSlot('exterior', key, (tabOf(key) === 'look' ? lookKeys : performanceKeys).indexOf(key), RIGHT, CAR_SLOTS[key].short, exteriorThumb, CAR_SLOTS[key].options ?? null, CAR_SLOTS[key].colorDefault !== undefined)),
  ];

  const equipmentSlots = [
    { key: 'weapon', short: 'ARMA', label: 'Arma', options: weaponOptions(), thumbOf: id => weaponThumb(id, customs[id], equipment.weaponParts?.[id]) },
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

  // Depois das peças de aparência vem o botão que sorteia o visual inteiro (peças grátis e cores).
  const RANDOM_TILE = {
    short: 'SORTEAR', image: diceThumb(),
    x: RIGHT.x + 6 + (lookKeys.length % RIGHT.columns) * TILE.gapX,
    y: RIGHT.y + 16 + Math.floor(lookKeys.length / RIGHT.columns) * TILE.gapY,
    width: TILE.width, height: TILE.height,
  };

  const leftRows = Math.ceil(CABIN_PANEL_KEYS.length / LEFT.columns);
  const rightRows = Math.ceil((lookKeys.length + 1) / RIGHT.columns);
  const leftPanel = { ...LEFT, height: 16 + leftRows * TILE.gapY + 4 };
  const rightPanel = { ...RIGHT, height: 16 + rightRows * TILE.gapY + 4 };
  const equipmentPanel = { ...EQUIPMENT, height: 16 + Math.ceil(equipmentSlots.length / EQUIPMENT.columns) * TILE.gapY + 4 };

  const upgradeRows = Object.keys(UPGRADES).map((id, i) => {
    const y = UPGRADE_PANEL.y + 14 + i * UPGRADE_ROW;
    return { id, y, minus: { x: UPGRADE_PANEL.x + 72, y, width: 11, height: 10 }, plus: { x: UPGRADE_PANEL.x + 88, y, width: 11, height: 10 } };
  });

  let rightTab = 'look';
  const isShown = slot => slot.group !== 'exterior' || slot.tab === rightTab;
  const shownSlots = () => slots.filter(isShown);
  const TABS = [{ id: 'look', label: 'APARENCIA', x: RIGHT.x + 4, width: 68 }, { id: 'performance', label: 'DESEMPENHO', x: RIGHT.x + 76, width: 72 }]
    .map(tab => ({ ...tab, y: RIGHT.y + 3, height: 12 }));
  function selectTab(id) {
    rightTab = id;
    if (!isShown(active)) active = shownSlots().find(slot => slot.group === 'exterior');
  }
  let active = slots.find(slot => slot.key === 'body');
  let browsing = false, browseDone = null;           // aberta só para personalizar (menu ou sala), sem corrida; `browseDone` diz para onde voltar
  let noFunds = 0, betweenRaces = 0;                 // segundos que restam do intervalo; 0 fora dele
  let waitLabel = 'AGUARDANDO...';
  let waitsForHost = false, waiting = false;         // online: o intervalo termina quando o admin largar
  const nameField = createNameField({ box: NAME_BOX, getName, setName });
  const readyPanel = createReadyPanel({ getRoster: getReadyRoster, onKick: onKickPlayer });

  const savedCars = loadSavedCars();
  const savedCarsPanel = createSavedCarsPanel({
    slotCount: SAVED_CAR_SLOTS,
    describe: index => {
      const saved = savedCars[index];
      return saved && `${WEAPON_TYPES[saved.equipment.weaponId].label}  R$ ${loadoutCost({ ...saved.equipment, trunk: savedTrunk(saved.equipment) })}`;
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
      cabin.setPart(kind, PARTS[kind].options[saved.cabin[kind]] ? saved.cabin[kind] : PARTS[kind].default);   // carros salvos antes de uma peça existir
      cabin.setPartColor(kind, saved.cabin.colors?.[kind] ?? null);
    }
    const savedEquipment = { ...structuredClone(saved.equipment), trunk: savedTrunk(saved.equipment), parts: savedParts(saved.equipment.parts), weaponParts: savedWeaponParts(saved.equipment.weaponParts) };
    if (fitsBudget(savedEquipment)) {
      Object.assign(equipment, savedEquipment);
      saveEquipment(equipment);
    } else {
      noFunds = NO_FUNDS_TIME;                       // os preços mudaram: leva só a aparência
    }
    syncPartsToCar();
    refreshCar();
  }
  let pointer = { x: -1, y: -1 }, dragging = false;

  const screen = { isOpen: false, get view() { return active.group === 'interior' ? 'cabin' : 'car'; } };

  function currentId(slot) {
    if (slot.group === 'interior') return cabin.loadout[slot.key];
    if (slot.group === 'exterior') return carSelection.options[slot.key];
    return equipment.weaponId;
  }
  const currentColor = slot => (slot.group === 'interior' ? cabin.loadout.colors[slot.key] : carSelection.colors[slot.key]);
  const labelOf = slot => (slot.label ?? (slot.group === 'interior' ? PARTS[slot.key].label : CAR_SLOTS[slot.key].label));

  function refreshCar() {
    carScene.apply(resolveCarSpec(carSelection));
    saveCarSelection(carSelection);
  }

  const withChoice = (slot, id) => ({ ...equipment, weaponId: id });

  function purchase(next) {
    if (!fitsBudget(next)) { noFunds = NO_FUNDS_TIME; return false; }
    if (loadoutCost(next) > loadoutCost(equipment)) onPurchase();      // só gastar faz barulho de compra; devolver não
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

  // Quantidade de um item do bagageiro; recusa se passar do limite do item ou do saldo.
  const withTrunk = (id, count) => ({ ...equipment, trunk: { ...equipment.trunk, [id]: count } });
  function setTrunkCount(id, count) {
    if (!TRAP_TYPES[id] || !Number.isInteger(count) || count < 0 || count > TRAP_TYPES[id].maxCharges) return false;
    return purchase(withTrunk(id, count));
  }
  const trunkPanel = createTrunkPanel({
    getTrunk: () => equipment.trunk,
    canSet: (id, count) => fitsBudget(withTrunk(id, count)),
    setCount: setTrunkCount,
    funds: () => BUDGET - loadoutCost(equipment),
  });

  const isPartSlot = slot => slot.group === 'exterior' && PART_KEYS.includes(slot.key);
  const withPart = (slot, id) => ({ ...equipment, parts: { ...equipment.parts, [slot.key]: id } });

  const priceOfEquipment = (slot, id) => {
    if (isPartSlot(slot)) return slot.options[id].price;
    if (slot.group !== 'equipment') return null;
    return WEAPON_TYPES[id].price + weaponPartsCost(id, equipment.weaponParts?.[id]);   // a arma já com as peças de combate dela
  };

  function choose(slot, id) {
    if (slot.group === 'equipment') {
      chooseEquipment(slot, id);
    } else if (slot.group === 'interior') {
      cabin.setPart(slot.key, id);
    } else if (isPartSlot(slot)) {
      if (!purchase(withPart(slot, id))) return;
      carSelection.options[slot.key] = id;
      refreshCar();
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

  // O aviso do próximo mapa aparece na garagem de corrida (não quando ela só abre para personalizar o carro).
  const upcomingBiome = () => (browsing ? null : getUpcomingBiome());
  const stripTop = () => (upcomingBiome() ? BANNER_Y + BANNER_HEIGHT + 3 : 36);

  const strip = createOptionStrip({
    x: 118, width: 362, top: stripTop, bottom: 356,
    placement: stripPlacement,
    getSlot: () => active, currentId, currentColor,
    priceOf: priceOfEquipment,
    isLocked: (slot, id) => (isPartSlot(slot) ? !fitsBudget(withPart(slot, id)) : slot.group === 'equipment' && !fitsBudget(withChoice(slot, id))),
    originalSwatch: slot => ORIGINAL_SWATCH[slot.key],
    onChoose: choose, onColor: setColor,
  });

  const overUi = (x, y) => savedCarsPanel.isOpen || readyPanel.contains(x, y) || inside(NAME_BOX, x, y) || inside(SAVED_CARS_BUTTON, x, y) || trunkPanel.isOpen || inside(TRUNK_BUTTON, x, y) || inside(UPGRADE_PANEL, x, y) || inside(equipmentPanel, x, y) || inside(WORKSHOP_BUTTON, x, y) || inside(leftPanel, x, y) || inside(rightPanel, x, y) || strip.contains(x, y) || inside(NEXT_BUTTON, x, y) || inside(MENU_BUTTON, x, y);

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
    if (trunkPanel.isOpen) { trunkPanel.click(x, y); return; }
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
    if (inside(TRUNK_BUTTON, x, y)) { trunkPanel.isOpen = true; return; }
    for (const row of upgradeRows) {
      if (inside(row.minus, x, y)) { changeUpgrade(row.id, -1); return; }
      if (inside(row.plus, x, y)) { changeUpgrade(row.id, 1); return; }
    }
    const tab = TABS.find(candidate => inside(candidate, x, y));
    if (tab) { selectTab(tab.id); return; }
    if (rightTab === 'look' && inside(RANDOM_TILE, x, y)) { randomizeLook(carSelection, lookKeys); refreshCar(); return; }
    const slot = shownSlots().find(candidate => inside(candidate, x, y));
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

  // Resumo das peças de desempenho escolhidas, abaixo das miniaturas da aba.
  function drawPartsSummary(ctx) {
    const top = RIGHT.y + 16 + Math.ceil(performanceKeys.length / RIGHT.columns) * TILE.gapY + 4;
    ctx.fillStyle = COLOR.edge;
    ctx.fillRect(RIGHT.x + 6, top - 3, RIGHT.width - 12, 1);
    PART_KEYS.forEach((key, i) => {
      const option = CAR_SLOTS[key].options[equipment.parts[key]], y = top + 2 + i * 13;
      ctxText(ctx, CAR_SLOTS[key].short, RIGHT.x + 8, y, COLOR.muted);
      ctxText(ctx, option.name.toUpperCase().slice(0, 8), RIGHT.x + 58, y, option.price > 0 ? COLOR.selected : COLOR.text);
      const price = option.price > 0 ? `R$${option.price}` : '-';
      ctxText(ctx, price, RIGHT.x + RIGHT.width - 8 - textWidth(price), y, COLOR.text);
    });
    const total = partsCost(equipment.parts), label = `TOTAL R$ ${total}`;
    ctxText(ctx, label, RIGHT.x + RIGHT.width - 8 - textWidth(label), top + 2 + PART_KEYS.length * 13 + 3, COLOR.selected);
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
    if (rightTab === 'look' && inside(RANDOM_TILE, pointer.x, pointer.y)) return { title: 'Sortear visual', detail: 'Pecas de aparencia e cores' };
    const slot = shownSlots().find(candidate => inside(candidate, pointer.x, pointer.y));
    return slot ? { title: slot.options ? slot.options[currentId(slot)].name : labelOf(slot), detail: labelOf(slot) } : null;
  }

  screen.draw = ctx => {
    drawFunds(ctx);

    panelBox(ctx, leftPanel);
    ctxText(ctx, 'CABINE', leftPanel.x + 6, leftPanel.y + 5, COLOR.selected);
    panelBox(ctx, rightPanel);
    for (const tab of TABS) drawButton(ctx, tab, tab.label, inside(tab, pointer.x, pointer.y), { style: 'tab', active: tab.id === rightTab });
    panelBox(ctx, equipmentPanel);
    ctxText(ctx, 'EQUIPAMENTO', equipmentPanel.x + 6, equipmentPanel.y + 5, COLOR.selected);

    for (const slot of shownSlots()) {
      const color = currentColor(slot);
      drawSlotTile(ctx, slot, {
        image: slot.options ? slot.thumbs[currentId(slot)] : null,
        color: color ?? ORIGINAL_SWATCH[slot.key],
        chipColor: slot.hasColor ? color : null,
        active: slot === active,
        hovered: inside(slot, pointer.x, pointer.y),
      });
    }

    if (rightTab === 'look') drawSlotTile(ctx, RANDOM_TILE, { image: RANDOM_TILE.image, chipColor: null, active: false, hovered: inside(RANDOM_TILE, pointer.x, pointer.y) });
    if (rightTab === 'performance') drawPartsSummary(ctx);
    drawUpgrades(ctx);
    strip.draw(ctx, pointer);
    const itemLabel = `${trunkUnits(equipment.trunk)} ITENS`;
    drawButton(ctx, TRUNK_BUTTON, 'BAGAGEIRO', inside(TRUNK_BUTTON, pointer.x, pointer.y));
    ctxText(ctx, itemLabel, TRUNK_BUTTON.x + Math.floor((TRUNK_BUTTON.width - textWidth(itemLabel)) / 2), TRUNK_BUTTON.y + 23, COLOR.selected);
    const timeLeft = Number.isFinite(betweenRaces) ? ` (${Math.ceil(betweenRaces)})` : '';
    const nextLabel = waiting ? waitLabel : betweenRaces > 0 ? `${waitsForHost ? 'PRONTO' : 'CORRER AGORA'}${timeLeft}` : browsing ? '< VOLTAR AO MENU' : 'CORRER >';
    drawButton(ctx, NEXT_BUTTON, nextLabel, inside(NEXT_BUTTON, pointer.x, pointer.y), waiting || browsing ? 'auto' : 'primary');
    drawButton(ctx, WORKSHOP_BUTTON, 'OFICINA >', inside(WORKSHOP_BUTTON, pointer.x, pointer.y));
    if (betweenRaces <= 0 && !waiting && !browsing) drawButton(ctx, MENU_BUTTON, '< MENU', inside(MENU_BUTTON, pointer.x, pointer.y));
    nameField.draw(ctx, pointer);
    const upcoming = upcomingBiome();
    if (upcoming) {
      const text = `PROXIMO MAPA: ${upcoming}`, width = textWidth(text) + 20, box = { x: NEXT_BUTTON.x + Math.floor((NEXT_BUTTON.width - width) / 2), y: BANNER_Y, width, height: 18 };
      panelBox(ctx, box);
      ctxText(ctx, text, box.x + 10, box.y + 6, '#f0d060');
    }
    drawButton(ctx, SAVED_CARS_BUTTON, 'MEUS CARROS', inside(SAVED_CARS_BUTTON, pointer.x, pointer.y));
    const stripBox = strip.box();
    readyPanel.draw(ctx, pointer, stripPlacement(active) === 'top' ? stripBox.y + stripBox.height + 4 : stripTop() + 2);
    if (savedCarsPanel.isOpen) { savedCarsPanel.draw(ctx, pointer); return; }
    if (trunkPanel.isOpen) { trunkPanel.draw(ctx, pointer); return; }

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
    trunkPanel.isOpen = false;
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
    waiting = Boolean(options.waiting);              // online: abriu antes de a corrida acabar; o botão só libera depois da votação
    waitLabel = options.waitLabel ?? 'AGUARDANDO...';
    screen.open();
  };
  // Garagem aberta pela sala de multiplayer (fora de partida): é a única em que o ESC volta ao menu principal.
  screen.isBrowsingFromRoom = () => screen.isOpen && browsing && browseDone !== null;
  screen.closeBrowse = () => {
    screen.isOpen = false;
    browsing = false;
    browseDone = null;
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
  screen.setTrunkCount = setTrunkCount;
  screen.trunkPanel = trunkPanel;
  screen.funds = () => BUDGET - loadoutCost(equipment);
  screen.selectSlot = key => {
    active = slots.find(slot => slot.key === key);
    if (active.group === 'exterior') rightTab = active.tab;
  };
  screen.choose = (key, id) => choose(slots.find(slot => slot.key === key), id);
  screen.chooseColor = (key, color) => setColor(slots.find(slot => slot.key === key), color);
  return screen;
}
