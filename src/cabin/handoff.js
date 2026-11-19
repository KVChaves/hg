import { Raster } from '../art/raster.js';
import { ROLES, paintHelpIcon } from '../art/roadsideCrew.js';
import { LAYOUT } from './layout.js';
import { Sprite } from './sprite.js';

// Entrega do NPC de beira de pista: o braço dele entra pela janela do lado em que ele estava,
// solta o item e o item cai no lugar dele no painel (cilindro de nitro, munição ou bagageiro).

const ARM_LENGTH = 190, ARM_HEIGHT = 48, MID = ARM_HEIGHT / 2;
const ICON = 26;

// Onde o braço entra e até onde chega, em pixels da cabine, para cada lado: pela janela, abaixo da coluna.
const WINDOWS = {
  left: { from: [-120, 270], to: [66, 234] },
  right: { from: [740, 250], to: [540, 204] },
};

// Para onde cada item vai.
const TARGETS = {
  nitro: [LAYOUT.nitro.x + 19, LAYOUT.nitro.y + 40],
  blueNitro: [LAYOUT.nitro.x + 19, LAYOUT.nitro.y + 40],
  ammo: [LAYOUT.ammo.x + 22, LAYOUT.ammo.y + 10],
  trap: [LAYOUT.trapDisplay.x + 20, LAYOUT.trapDisplay.y + 10],
};
const targetFor = item => TARGETS[item.slot || item.type || item.id === 'extinguisher' ? 'trap' : item.id];

const REACH = 0.2, RELEASE = 0.28, RETRACT = 0.42, GONE = 0.68;   // segundos desde o começo
const FLIGHT = 0.42, ARC = 46, SPIN = Math.PI * 2;
const FLASH_TIME = 0.28, FLASH_SIZE = 32;

const ease = t => 1 - (1 - t) * (1 - t);

// Braço na horizontal, com a mão no centro da imagem apontando para a direita (o giro é em volta da mão).
// `open`: a mão já soltou o item.
function paintArm(r, { jacket, shade, sleeve }, skin, open) {
  r.data.fill(0);
  const hand = ARM_LENGTH, cuff = hand - 16;
  r.rect(0, MID - 10, cuff, 21, jacket);                         // manga
  r.rect(0, MID - 11, cuff, 1, 0x100c0a);
  r.rect(0, MID + 11, cuff, 1, 0x100c0a);
  r.rect(0, MID + 5, cuff, 6, shade);
  r.rect(0, MID - 10, cuff, 2, shade);
  for (let x = 14; x < cuff - 10; x += 37) r.rect(x, MID - 3, 9, 1, shade);   // dobras do tecido
  if (sleeve) r.rect(cuff - 52, MID - 10, 7, 21, sleeve);
  r.rect(cuff, MID - 11, 6, 23, 0x100c0a);                       // punho
  r.rect(cuff + 1, MID - 10, 4, 21, shade);
  const dark = 0x5a3420;
  r.rect(cuff + 6, MID - 7, 10, 15, skin);                       // pulso e palma
  r.rect(cuff + 6, MID + 6, 10, 2, dark);
  if (open) {                                                   // dedos abertos, o item acabou de sair
    for (const [y, len] of [[-7, 13], [-3, 15], [1, 14], [5, 11]]) {
      r.rect(hand, MID + y, len, 3, skin);
      r.rect(hand, MID + y + 2, len, 1, dark);
    }
    r.rect(hand - 4, MID - 12, 4, 6, skin);                       // polegar para cima
  } else {
    r.rect(hand, MID - 7, 9, 15, skin);                          // punho fechado em volta do item
    for (const y of [-3, 1, 5]) r.rect(hand + 1, MID + y, 8, 1, dark);
    r.rect(hand + 8, MID - 7, 1, 15, dark);
    r.rect(hand - 3, MID - 10, 7, 4, skin);
  }
  return r.commit();
}

function paintFlash(r, t) {
  r.data.fill(0);
  const c = FLASH_SIZE / 2, radius = 4 + t * 12, thick = Math.max(1, 3 * (1 - t));
  r.ring(c, c, radius, radius - thick, t < 0.5 ? 0xfff6c0 : 0xffd040);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, inner = radius + 1, outer = radius + 2 + 4 * (1 - t);
    r.line(c + Math.cos(a) * inner, c + Math.sin(a) * inner, c + Math.cos(a) * outer, c + Math.sin(a) * outer, 0xfff6c0);
  }
  return r.commit();
}

export function createHandoff(parent, depth) {
  const armRaster = new Raster(ARM_LENGTH * 2, ARM_HEIGHT), openRaster = new Raster(ARM_LENGTH * 2, ARM_HEIGHT);
  const iconRaster = new Raster(ICON, ICON), flashRaster = new Raster(FLASH_SIZE, FLASH_SIZE);
  const arm = new Sprite(parent, armRaster.commit(), { x: 0, y: 0, depth: depth.arm, anchor: 'center' });
  const openArm = new Sprite(parent, openRaster.commit(), { x: 0, y: 0, depth: depth.arm, anchor: 'center' });
  const icon = new Sprite(parent, iconRaster.commit(), { x: 0, y: 0, depth: depth.item, anchor: 'center' });
  const flash = new Sprite(parent, flashRaster.commit(), { x: 0, y: 0, depth: depth.item, anchor: 'center' });
  for (const s of [arm, openArm, icon, flash]) s.mesh.visible = false;

  let active = null;

  // `side`: -1 é a janela da esquerda e 1 a da direita.
  function start(item, { roleId, skin }, side) {
    const role = ROLES[roleId] ?? ROLES.nitro;
    const opening = WINDOWS[side < 0 ? 'left' : 'right'];
    paintArm(armRaster, role, skin, false);
    paintArm(openRaster, role, skin, true);
    paintHelpIcon(item, iconRaster);
    for (const s of [arm, openArm, icon]) s.refresh();
    // Na janela da direita o braço é espelhado; a mão continua no centro da imagem.
    const [fx, fy] = opening.from, [tx, ty] = opening.to, mirrored = side > 0;
    arm.rotation = openArm.rotation = mirrored ? Math.atan2(ty - fy, fx - tx) : Math.atan2(fy - ty, tx - fx);
    arm.mesh.scale.x = openArm.mesh.scale.x = Math.abs(arm.mesh.scale.x) * (mirrored ? -1 : 1);
    flash.mesh.visible = false;
    active = { window: opening, target: targetFor(item), time: 0 };
  }

  function placeArm(sprite, t) {
    const { from, to } = active.window;
    sprite.moveTo(from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t);
  }

  function update(dt) {
    if (!active) return;
    const time = active.time += dt;
    const holding = time < RELEASE;
    arm.mesh.visible = holding;
    openArm.mesh.visible = !holding && time < GONE;
    const reach = time < REACH ? ease(time / REACH) : time < RETRACT ? 1 : Math.max(0, 1 - (time - RETRACT) / (GONE - RETRACT)) ** 2;
    placeArm(holding ? arm : openArm, reach);

    const { from, to: hand } = active.window;
    if (holding) {
      icon.mesh.visible = true;
      icon.moveTo(from[0] + (hand[0] - from[0]) * reach + Math.sign(hand[0] - from[0]) * 10, from[1] + (hand[1] - from[1]) * reach - 10);
      icon.rotation = 0;
    } else {
      const flight = (time - RELEASE) / FLIGHT;
      if (flight < 1) {
        const [x0, y0] = [hand[0] + Math.sign(hand[0] - from[0]) * 10, hand[1] - 10], [x1, y1] = active.target;
        icon.mesh.visible = true;
        icon.moveTo(x0 + (x1 - x0) * flight, y0 + (y1 - y0) * flight - Math.sin(flight * Math.PI) * ARC);
        icon.rotation = -SPIN * flight * Math.sign(x1 - x0);
      } else {
        icon.mesh.visible = false;
        const glow = (flight - 1) * FLIGHT / FLASH_TIME;
        flash.mesh.visible = glow < 1;
        if (glow < 1) {
          paintFlash(flashRaster, glow);
          flash.refresh();
          flash.moveTo(...active.target);
        } else if (time >= GONE) active = null;
      }
    }
  }

  return { start, update };
}
