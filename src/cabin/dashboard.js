import { Raster } from '../art/raster.js';
import { dither, vnoise } from '../art/shade.js';
import { rasterText, rasterTiny } from '../art/font.js';
import { DEPTH, LAYOUT } from './layout.js';
import { createAmmoRack } from './ammoRack.js';
import { createNitroFlame } from './nitroFlame.js';
import { createMagazineDisplay, createTrapButton, createTrapDisplay } from './trapDisplay.js';
import { Sprite } from './sprite.js';

// Mostradores do painel. Cada um guarda a arte fixa e só redesenha quando o valor muda.

const SWEEP_START = Math.PI * 0.75, SWEEP = Math.PI * 1.5;
const SPEEDOMETER_MAX_KMH = 180;

function plotNeedle(r, cx, cy, radius, value) {
  const a = SWEEP_START + SWEEP * value;
  r.line(cx, cy, cx + Math.cos(a) * (radius - 2.5), cy + Math.sin(a) * (radius - 2.5), 0xf02818);
  r.rect(Math.floor(cx) - 1, Math.floor(cy) - 1, 3, 3, 0x6a6a6a);
}

// Mostradores do jogo original (Dial.png, 32x32) com os ponteiros e o visor digital desenhados por cima.
const DIAL = 'assets/cabin/dial.png';

function createInstruments(parent) {
  const W = 144, H = 34, LEFT = [16, 16], RIGHT = [128, 16], DIAL_R = 13;   // um mostrador de cada lado do volante
  const r = new Raster(W, H);

  const base = r.snapshot();
  const { x, y } = LAYOUT.instruments;
  const sprite = new Sprite(parent, r.commit(), { x, y, depth: DEPTH.gauges });
  new Sprite(parent, DIAL, { x: x + LEFT[0] - 16, y: y + LEFT[1] - 16, depth: DEPTH.gaugeFace });
  new Sprite(parent, DIAL, { x: x + RIGHT[0] - 16, y: y + RIGHT[1] - 16, depth: DEPTH.gaugeFace });

  let last = '';
  return (kmh, rpm) => {
    const shown = String(Math.round(kmh));
    const key = `${shown}|${Math.round(rpm * 40)}`;
    if (key === last) return;
    last = key;
    r.restore(base);
    plotNeedle(r, ...LEFT, DIAL_R, rpm);
    plotNeedle(r, ...RIGHT, DIAL_R, Math.min(kmh / SPEEDOMETER_MAX_KMH, 1));
    rasterTiny(r, shown, RIGHT[0] - (shown.length * 4 - 1) / 2 | 0, 22, 0xc8c8c8);   // km/h no fundo do velocímetro
    r.commit();
    sprite.refresh();
  };
}

// Alavanca do registro: abaixada quando fechado, levantada quando o nitro está aberto.
function plotValveLever(r, open) {
  if (open) {
    r.poly([[39, 28], [48, 20], [50, 22], [39, 33]], 0x6a5a50);
    r.rect(46, 13, 12, 10, 0x4a3a34);
    r.rect(48, 15, 8, 6, 0x5a1c14);
  } else {
    r.poly([[39, 28], [50, 31], [50, 33], [39, 33]], 0x6a5a50);
    r.rect(50, 27, 12, 10, 0x4a3a34);
    r.rect(52, 29, 8, 6, 0x5a1c14);
  }
}

export const NITRO_SIZE = { width: 62, height: 72 };
const NITRO_BAR = { x: 10, top: 22, height: 45 };

const BOTTLE_STYLES = {
  plain() {},
  stripes(r) {
    r.rect(14, 32, 5, 29, 0xe8e4dc);
    r.rect(22, 32, 5, 29, 0xe8e4dc);
  },
  hazard(r) {
    for (let i = 0; i < 6; i++) r.poly([[2, 40 + i * 7], [35, 34 + i * 7], [35, 37 + i * 7], [2, 43 + i * 7]], 0x101012);
  },
  flames(r) {
    for (const [x, tip] of [[6, 36], [14, 42], [22, 34], [30, 44]]) {
      r.poly([[x - 4, 61], [x, tip], [x + 4, 61]], 0xe05818);
      r.poly([[x - 2, 61], [x, tip + 10], [x + 2, 61]], 0xf0c030);
    }
  },
  bands(r) {
    for (const y of [36, 46, 56]) r.rect(2, y, 33, 2, 0x34363c);
  },
};

export function paintNitroBottle(r, palette, style = 'plain') {
  const body = (x, y) => dither(x, y, 0.72 - Math.abs(x - 20) / 34 + (vnoise(x / 5, y / 7) - 0.5) * 0.25, palette, 0.8);
  r.poly([[6, 15], [32, 15], [35, 20], [35, 68], [31, 72], [6, 72], [2, 68], [2, 20]], body);
  r.rect(2, 28, 33, 3, palette[0]);
  r.rect(2, 62, 33, 3, palette[0]);
  BOTTLE_STYLES[style](r);

  // registro e manômetro
  r.rect(15, 0, 14, 2, 0x4a3a30);
  r.poly([[17, 2], [27, 2], [24, 9], [20, 9]], 0x5e4a40);
  r.disc(22, 14, 8, 0x0c0808);
  r.ring(22, 14, 8.4, 7.2, 0x3e3430);
  r.line(22, 10, 22, 15, 0xc02818);

  // letras em relevo
  rasterRotated(r, 'Nos', 15, 58);

  // suporte da válvula lateral
  r.rect(37, 26, 4, 42, 0x0e0806);
  r.rect(38, 27, 2, 40, 0x2c2420);

  r.rect(NITRO_BAR.x, NITRO_BAR.top, 5, NITRO_BAR.height, 0x140403);
}

function createNitro(parent) {
  const r = new Raster(NITRO_SIZE.width, NITRO_SIZE.height);
  const sprite = new Sprite(parent, r.commit(), { ...LAYOUT.nitro, depth: DEPTH.gauges });
  const updateFlame = createNitroFlame(parent, LAYOUT.nitroNozzle);
  let base = r.snapshot(), last = '';

  // `blueLevel`: quanto resta do nitro azul (0 a 1). A barra dele cobre a amarela e vai baixando com o uso.
  function update(level, open, dt, blueLevel = 0) {
    updateFlame(open, dt, blueLevel > 0);
    const filled = Math.round(NITRO_BAR.height * level);
    const blueFilled = Math.ceil(NITRO_BAR.height * Math.min(1, blueLevel));   // ceil: some só quando o azul acaba
    const key = `${filled}|${blueFilled}|${open}`;
    if (key === last) return;
    last = key;
    r.restore(base);
    r.rect(NITRO_BAR.x, NITRO_BAR.top + NITRO_BAR.height - filled, 5, filled, 0xffff00);
    r.rect(NITRO_BAR.x, NITRO_BAR.top + NITRO_BAR.height - blueFilled, 5, blueFilled, 0x2f7bff);
    plotValveLever(r, open);
    r.commit();
    sprite.refresh();
  }

  function setPalette(palette, style) {
    r.data.fill(0);
    paintNitroBottle(r, palette, style);
    base = r.snapshot();
    last = '';
  }

  return { update, setPalette };
}

// Texto 5x7 em escala 2 girado 90° (lê de baixo para cima).
function rasterRotated(r, text, x, y) {
  [...text].forEach((ch, index) => {
    const tmp = { put: (px, py) => r.rect(x + py, y - index * 12 - px - 1, 1, 1, 0x120302) };
    rasterText(tmp, ch, 0, 0, 0, 2);
  });
}

export function createDashboard(parent) {
  const instruments = createInstruments(parent);
  const updateTrapDisplay = createTrapDisplay(parent);
  const trapButton = createTrapButton(parent);
  const nitro = createNitro(parent);
  const ammoRack = createAmmoRack(parent);
  const updateMagazine = createMagazineDisplay(parent);

  function update({ gear, nitroLevel, nitroOpen, nitroBlueLevel, reserveAmmo, magazineAmmo, trapSlot, trapReady, dt }) {
    instruments(gear.kmh, gear.rpm);
    updateTrapDisplay(trapSlot);
    trapButton.setLit(trapReady);
    nitro.update(nitroLevel, nitroOpen, dt, nitroBlueLevel);
    ammoRack.update(reserveAmmo);
    updateMagazine(magazineAmmo);
  }

  return { update, setWeapon: ammoRack.setWeapon, ammoSlot: ammoRack.slotFor, setNitroPalette: nitro.setPalette, setTrapButtonPressed: trapButton.setPressed };
}
