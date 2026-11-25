import { VIEW } from '../config.js';
import { ctxText, textWidth } from '../art/font.js';
import { accessoriesOf, saveWeaponCustoms, WEAPON_PATTERNS } from '../game/weaponCustomization.js';
import { familyOf, fireInterval, stepSpin, WEAPON_TYPES } from '../game/weaponTypes.js';
import { saveEquipment } from '../game/equipment.js';
import { BUDGET, fitsBudget, loadoutCost } from '../game/shop.js';
import { buildWeapon, partSummary, variantsFor, WEAPON_PART_KEYS, WEAPON_PARTS } from '../game/weaponParts.js';
import { createGunAnimator } from './guns/gunAnimator.js';
import { createGunEffects } from './guns/gunEffects.js';
import { createGunRig } from './guns/gunRig.js';
import { partIcon } from './guns/partIcons.js';
import { createOptionStrip } from './optionStrip.js';
import { COLOR, drawButton, drawSlotTile, drawTooltip, inside, panelBox, pointerOnStage } from './panelKit.js';

// Oficina: a arma fica no centro, atirando e recarregando em demonstração, e cada parte é personalizável.
// À direita, em cima, as peças visuais (grátis); embaixo, as de combate (weaponParts.js), pagas com o saldo da garagem.
// À esquerda, embaixo, a ficha da arma montada, com o que as peças mudaram em destaque.

const TILE = { width: 46, height: 42, gapX: 48, gapY: 44 };
const LEFT = { x: 6, y: 40, width: 106, height: 16 + Math.ceil(Object.keys(WEAPON_TYPES).length / 2) * 44 + 4, columns: 2 };
const RIGHT = { x: 528, y: 40, width: 106, height: 156, columns: 2 };
const COMBAT = { x: 528, y: 200, width: 106, height: 16 + 2 * 44 + 4, columns: 2 };
const STATS = { x: 6, y: LEFT.y + LEFT.height + 4, width: 106, height: 72 };
const NO_FUNDS_TIME = 1.2;
const BACK_BUTTON = { x: 240, y: 6, width: 160, height: 26 };
const PREVIEW = { x: 320, y: 150, maxWidth: 400, maxScale: 3 };
const DEMO = { pause: 0.9, shotsPerRound: 3, minInterval: 0.55, burstInterval: 0.09, burstShots: 8, spinShots: 36 };
// Tiros de cada rodada da demonstração: a metralhadora precisa de uma rajada longa para os canos chegarem no máximo.
const burstOf = type => (type.spinUp ? DEMO.spinShots : type.automatic ? DEMO.burstShots : DEMO.shotsPerRound);
const WEAPON_SHORT = { revolver: 'REVOLV', shotgun: 'ESCOP', smg: 'SUBM', rifle: 'RIFLE', magnum: 'MAGNUM', sniper: 'SNIPER', autoshotgun: 'ESC AUT', crossbow: 'BESTA', grenade: 'GRANADA', heavymg: 'METRALH' };

const SLOT_DEFS = [
  { key: 'metal', short: 'METAL', label: 'Cor do metal', hasColor: true },
  { key: 'grip', short: 'CABO', label: 'Cor do cabo', hasColor: true },
  { key: 'pattern', short: 'PADRAO', label: 'Padrao do metal', hasColor: true, optionGroup: 'pattern' },
  { key: 'accessory', short: 'ACESS', label: 'Acessorio', hasColor: false, optionGroup: 'accessory' },
  { key: 'flash', short: 'FOGO', label: 'Cor do disparo', hasColor: true },
];
const ORIGINAL_SWATCH = { metal: 0x7c7e82, grip: 0x5a3a26, pattern: 0x4a5a30, flash: 0xffd060 };

// `equipment` é o mesmo objeto da garagem: as peças de combate saem do saldo dela. `onPurchase` toca o som da compra.
export function createWeaponWorkshop({ stage, customs, equipment, onChange, onPurchase = () => {}, onClose }) {
  const weaponIds = Object.keys(WEAPON_TYPES);
  let weaponId = weaponIds[0], rig = null, animator = null, effects = null, demo = null;
  let pointer = { x: -1, y: -1 };

  const screen = { isOpen: false };
  const custom = () => customs[weaponId];

  const weaponTiles = weaponIds.map((id, i) => ({
    id, short: WEAPON_SHORT[id],
    x: LEFT.x + 6 + (i % LEFT.columns) * TILE.gapX,
    y: LEFT.y + 16 + Math.floor(i / LEFT.columns) * TILE.gapY,
    width: TILE.width, height: TILE.height, image: null,
  }));

  const slots = SLOT_DEFS.map((def, i) => ({
    ...def, options: null, thumbs: null,
    x: RIGHT.x + 6 + (i % RIGHT.columns) * TILE.gapX,
    y: RIGHT.y + 16 + Math.floor(i / RIGHT.columns) * TILE.gapY,
    width: TILE.width, height: TILE.height,
  }));
  const combatSlots = WEAPON_PART_KEYS.map((key, i) => ({
    key, combat: true, short: WEAPON_PARTS[key].short, label: WEAPON_PARTS[key].label, hasColor: false, options: null, thumbs: null,
    x: COMBAT.x + 6 + (i % COMBAT.columns) * TILE.gapX,
    y: COMBAT.y + 16 + Math.floor(i / COMBAT.columns) * TILE.gapY,
    width: TILE.width, height: TILE.height,
  }));
  const allSlots = [...slots, ...combatSlots];
  let active = slots[0], noFunds = 0;

  // Peças de combate da arma na tela. O saldo é conferido como se ela fosse a equipada: a garagem só deixa
  // equipar uma arma se ela couber com as peças dela.
  const combatParts = (id = weaponId) => equipment.weaponParts[id];
  const builtType = () => buildWeapon(weaponId, combatParts());
  const withCombatPart = (key, id) => ({ ...equipment, weaponId, weaponParts: { ...equipment.weaponParts, [weaponId]: { ...combatParts(), [key]: id } } });
  const isEquipped = () => equipment.weaponId === weaponId;

  function refreshCombatSlots() {
    for (const slot of combatSlots) {
      const variants = variantsFor(slot.key, weaponId);
      slot.options = Object.fromEntries(variants.map(([id, variant]) => [id, { name: `${variant.name.toUpperCase()}${variant.price ? `  R$ ${variant.price}` : ''}`, detail: partSummary(variant, weaponId) }]));
      slot.thumbs = Object.fromEntries(variants.map(([id]) => [id, partIcon(slot.key, id)]));
    }
  }

  function chooseCombatPart(slot, id) {
    const next = withCombatPart(slot.key, id);
    if (!fitsBudget(next)) { noFunds = NO_FUNDS_TIME; return; }
    if (loadoutCost(next) > loadoutCost({ ...equipment, weaponId })) onPurchase();
    equipment.weaponParts = next.weaponParts;
    saveEquipment(equipment);
    rebuild();                                       // as peças de combate também mudam o desenho
    resetDemo();
  }

  const optionsFor = slot => (slot.optionGroup === 'pattern' ? WEAPON_PATTERNS : accessoriesOf(weaponId));
  const withOption = (group, id) => ({ colors: custom().colors, options: { ...custom().options, [group]: id } });

  function refreshThumbs() {
    refreshCombatSlots();
    for (const tile of weaponTiles) tile.image = createGunRig(tile.id, customs[tile.id], combatParts(tile.id)).snapshot();
    for (const slot of slots) {
      if (!slot.optionGroup) continue;
      slot.options = optionsFor(slot);
      slot.thumbs = Object.fromEntries(Object.keys(slot.options).map(id => [id, createGunRig(weaponId, withOption(slot.optionGroup, id), combatParts()).snapshot()]));
    }
  }

  function resetDemo() {
    const type = builtType();                        // a demonstração atira e recarrega no ritmo das peças escolhidas
    animator = createGunAnimator(weaponId);
    effects = createGunEffects(58);
    demo = { type, ammo: type.magazine, timer: DEMO.pause, shotsLeft: burstOf(type), spin: 0, reloading: false, progress: 0, carrying: false, toLoad: 0, recoil: 0, velocity: 0, flash: 0, seed: 0 };
  }

  function rebuild() {
    rig = createGunRig(weaponId, custom(), combatParts());
    refreshThumbs();
    onChange(weaponId);
    saveWeaponCustoms(customs);
  }

  function selectWeapon(id) {
    weaponId = id;
    rig = createGunRig(id, custom(), combatParts(id));
    refreshThumbs();
    resetDemo();
  }

  const currentId = slot => (slot.combat ? combatParts()[slot.key] : custom().options[slot.optionGroup]);
  const currentColor = slot => custom().colors[slot.key];

  const strip = createOptionStrip({
    x: 118, width: 404, top: 36, bottom: 356,
    placement: () => 'bottom',
    getSlot: () => active, currentId, currentColor,
    priceOf: (slot, id) => (slot.combat ? WEAPON_PARTS[slot.key].variants[id].price : null),
    isLocked: (slot, id) => slot.combat && !fitsBudget(withCombatPart(slot.key, id)),
    originalSwatch: slot => ORIGINAL_SWATCH[slot.key],
    onChoose: (slot, id) => {
      if (slot.combat) { chooseCombatPart(slot, id); return; }
      custom().options[slot.optionGroup] = id;
      rebuild();
    },
    onColor: (slot, color) => { custom().colors[slot.key] = color; rebuild(); },
  });

  addEventListener('mousemove', e => {
    if (!screen.isOpen) return;
    pointer = pointerOnStage(e, stage);
    strip.pointerMove(pointer.x, pointer.y);
  });
  stage.addEventListener('mousedown', e => {
    if (!screen.isOpen) return;
    const { x, y } = pointerOnStage(e, stage);
    strip.pointerDown(x, y);
  });
  addEventListener('mouseup', () => strip.pointerUp());
  stage.addEventListener('click', e => {
    if (!screen.isOpen) return;
    const { x, y } = pointerOnStage(e, stage);
    if (inside(BACK_BUTTON, x, y)) { screen.isOpen = false; onClose(); return; }
    const tile = weaponTiles.find(candidate => inside(candidate, x, y));
    if (tile) { selectWeapon(tile.id); return; }
    const slot = allSlots.find(candidate => inside(candidate, x, y));
    if (slot) { active = slot; return; }
    strip.click(x, y);
  });

  // Roteiro da demonstração: alguns tiros, recarga e recomeça.
  function fireDemo() {
    demo.ammo--;
    demo.flash = 0.07;
    demo.seed = Math.random();
    demo.velocity += demo.type.recoil * 11;
    animator.fire();
    const [mx, my] = rig.art.muzzle, [px, py] = rig.art.pivot;
    effects.puffSmoke(mx - px, my - py, rig.art.smoke);
  }

  function stepDemo(dt) {
    // Metralhadora: os canos aceleram durante a rajada e param devagar depois dela.
    demo.spin = stepSpin(demo.type, demo.spin, !demo.reloading && demo.shotsLeft > 0 && demo.ammo > 0 && demo.timer <= DEMO.pause * 0.5, dt);
    if (demo.reloading) {
      demo.progress += dt / demo.type.roundTime;
      if (demo.progress >= 0.5) demo.carrying = true;
      if (demo.progress >= 1) {
        const amount = demo.type.reloadsWholeMagazine ? demo.toLoad : 1;
        demo.ammo += amount;
        demo.toLoad -= amount;
        demo.progress = 0;
        demo.carrying = false;
        if (demo.toLoad <= 0) {
          demo.reloading = false;
          demo.timer = DEMO.pause;
          demo.shotsLeft = burstOf(demo.type);
        }
      }
      return;
    }
    if ((demo.timer -= dt) > 0) return;
    if (demo.shotsLeft > 0 && demo.ammo > 0) {
      fireDemo();
      demo.shotsLeft--;
      demo.timer = demo.type.spinUp ? fireInterval(demo.type, demo.spin) : demo.type.automatic ? DEMO.burstInterval : Math.max(demo.type.interval, DEMO.minInterval);
    } else {
      demo.reloading = true;
      demo.progress = 0;
      demo.carrying = false;
      demo.toLoad = demo.type.magazine - demo.ammo;
    }
  }

  function updateDemo(dt) {
    stepDemo(dt);
    demo.flash -= dt;
    const { stiffness, damping } = rig.art.recoil;
    demo.velocity += (-stiffness * demo.recoil - damping * demo.velocity) * dt;
    demo.recoil += demo.velocity * dt;

    const events = animator.update(dt, { reloading: demo.reloading, ammo: demo.ammo, capacity: demo.type.magazine, roundProgress: demo.progress, carrying: demo.carrying, spin: demo.spin });
    const [ex, ey] = rig.art.eject, [px, py] = rig.art.pivot;
    for (const { eject } of events) for (let i = 0; i < eject; i++) effects.ejectCasing(ex - px, ey - py, rig.art.casing);
    effects.update(dt);
  }

  function drawPreview(ctx) {
    const scale = Math.min(PREVIEW.maxScale, Math.floor(PREVIEW.maxWidth / rig.art.size[0]));
    ctx.save();
    const [width, height] = rig.art.size, [pivotX, pivotY] = rig.art.pivot;
    ctx.translate(PREVIEW.x + (pivotX - width / 2) * scale, PREVIEW.y + (pivotY - height / 2) * scale);
    ctx.scale(scale, scale);
    ctx.save();
    const { back, up, tilt } = rig.art.recoil;
    ctx.translate(demo.recoil * back * 0.8, -demo.recoil * up * 0.65);
    ctx.rotate(demo.recoil * tilt * 0.75);
    rig.draw(ctx, animator.pose);
    if (demo.flash > 0) rig.drawFlash(ctx, demo.seed);
    ctx.restore();
    effects.draw(ctx);
    ctx.restore();
  }

  const labelOf = slot => slot.label;

  function hoveredInfo() {
    const fromStrip = strip.hoverInfo(pointer, labelOf(active));
    if (fromStrip) return fromStrip;
    const tile = weaponTiles.find(candidate => inside(candidate, pointer.x, pointer.y));
    if (tile) return { title: WEAPON_TYPES[tile.id].label, detail: 'Trocar de arma' };
    const slot = allSlots.find(candidate => inside(candidate, pointer.x, pointer.y));
    if (!slot) return null;
    if (slot.combat) {
      const option = slot.options[currentId(slot)];
      return { title: `${labelOf(slot)}: ${option.name}`, detail: option.detail };
    }
    return { title: slot.optionGroup ? slot.options[currentId(slot)].name : labelOf(slot), detail: labelOf(slot) };
  }

  // Ficha da arma montada; o que as peças mudaram aparece em destaque.
  function drawStats(ctx) {
    const base = WEAPON_TYPES[weaponId], type = builtType();
    const rows = [
      ['DANO', Math.round(type.damage), Math.round(base.damage)],
      ['TIROS/S', (1 / type.interval).toFixed(1), (1 / base.interval).toFixed(1)],
      ['RECUO', `${Math.round(type.kick.up / base.kick.up * 100)}%`, '100%'],
      ['MIRA VOLTA', `${Math.round(type.kick.recover / base.kick.recover * 100)}%`, '100%'],
      ['RECARGA', `${type.roundTime.toFixed(2)}S`, `${base.roundTime.toFixed(2)}S`],
      ['PENTE/RES', `${type.magazine}/${type.reserve}`, `${base.magazine}/${base.reserve}`],
    ];
    panelBox(ctx, STATS);
    ctxText(ctx, 'FICHA', STATS.x + 6, STATS.y + 4, COLOR.selected);
    rows.forEach(([label, value, original], i) => {
      const y = STATS.y + 14 + i * 9, text = String(value);
      ctxText(ctx, label, STATS.x + 6, y, COLOR.muted);
      ctxText(ctx, text, STATS.x + STATS.width - 6 - textWidth(text), y, text === String(original) ? COLOR.text : COLOR.selected);
    });
  }

  screen.draw = ctx => {
    ctx.fillStyle = COLOR.backdrop;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    drawPreview(ctx);

    panelBox(ctx, { x: 6, y: 6, width: 106, height: 26 });
    ctxText(ctx, 'OFICINA', 6 + Math.floor((106 - textWidth('OFICINA')) / 2), 10, COLOR.text);
    const funds = noFunds > 0 ? 'SEM SALDO' : `SALDO R$ ${BUDGET - loadoutCost(equipment)}`;
    ctxText(ctx, funds, 6 + Math.floor((106 - textWidth(funds)) / 2), 20, noFunds > 0 ? COLOR.danger : COLOR.selected);
    drawButton(ctx, BACK_BUTTON, '< VOLTAR', inside(BACK_BUTTON, pointer.x, pointer.y));

    panelBox(ctx, LEFT);
    ctxText(ctx, 'ARMA', LEFT.x + 6, LEFT.y + 5, COLOR.selected);
    for (const tile of weaponTiles) drawSlotTile(ctx, tile, { image: tile.image, active: tile.id === weaponId, hovered: inside(tile, pointer.x, pointer.y) });

    panelBox(ctx, RIGHT);
    ctxText(ctx, 'PECAS', RIGHT.x + 6, RIGHT.y + 5, COLOR.selected);
    for (const slot of slots) {
      const color = slot.hasColor ? currentColor(slot) : null;
      drawSlotTile(ctx, slot, {
        image: slot.optionGroup ? slot.thumbs[currentId(slot)] : null,
        color: color ?? ORIGINAL_SWATCH[slot.key], chipColor: color,
        active: slot === active, hovered: inside(slot, pointer.x, pointer.y),
      });
    }

    panelBox(ctx, COMBAT);
    ctxText(ctx, 'COMBATE', COMBAT.x + 6, COMBAT.y + 5, COLOR.selected);
    for (const slot of combatSlots) {
      drawSlotTile(ctx, slot, { image: slot.thumbs[currentId(slot)], chipColor: null, active: slot === active, hovered: inside(slot, pointer.x, pointer.y) });
    }
    drawStats(ctx);

    const label = WEAPON_TYPES[weaponId].label;
    ctxText(ctx, label, Math.round(VIEW.width / 2 - textWidth(label) / 2), 46, COLOR.selected);
    if (!isEquipped()) {
      const note = 'NAO EQUIPADA: AS PECAS DE COMBATE SO CONTAM AO EQUIPAR';
      ctxText(ctx, note, Math.round(VIEW.width / 2 - textWidth(note) / 2), 56, COLOR.muted);
    }

    strip.draw(ctx, pointer);
    const info = hoveredInfo();
    if (info) drawTooltip(ctx, info, pointer.x, strip.box().y - 34);
  };

  screen.update = dt => {
    if (!screen.isOpen) return;
    noFunds = Math.max(0, noFunds - dt);
    strip.applyPending();
    updateDemo(dt);
  };
  screen.open = id => {
    screen.isOpen = true;
    active = slots[0];
    selectWeapon(id);
  };
  screen.selectSlot = key => { active = slots.find(slot => slot.key === key); };   // só as peças visuais
  return screen;
}
