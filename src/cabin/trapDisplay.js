import { Raster } from '../art/raster.js';
import { plotTrapIcon } from '../art/trapIcons.js';
import { rasterText } from '../art/font.js';
import { DEPTH, LAYOUT } from './layout.js';
import { Sprite } from './sprite.js';

// Mostrador do painel: quantos usos restam (vermelho) e o ícone da armadilha selecionada.

const W = 40, H = 21;

export function createTrapDisplay(parent) {
  const r = new Raster(W, H);
  r.poly([[2, 1], [36, 0], [39, 5], [39, 18], [3, 20], [0, 16]], 0x4a463c);
  r.poly([[3, 3], [35, 2], [37, 6], [37, 16], [4, 18], [2, 15]], 0x000000);
  const base = r.snapshot();
  const sprite = new Sprite(parent, r.commit(), { ...LAYOUT.trapDisplay, depth: DEPTH.gauges });

  let last = '';
  return slot => {
    const key = slot ? `${slot.type.id}|${slot.charges}` : 'empty';   // sem itens no bagageiro o mostrador fica vazio
    if (key === last) return;
    last = key;

    r.restore(base);
    if (slot) {
      const color = slot.charges > 0 ? 0xf01810 : 0x4a1410;
      rasterText(r, String(slot.charges), 5, 4, color, 1, 2);
      rasterText(r, String(slot.charges), 6, 4, color, 1, 2);
      plotTrapIcon(r, slot.type.id, 16, 3, slot.charges <= 0);
    }
    r.commit();
    sprite.refresh();
  };
}

// Mostrador das balas no pente, ao lado da munição de reserva: mesma caixa do mostrador da armadilha, com os
// números em âmbar (vermelhos com o pente vazio), alinhados à direita para não pular quando o número encolhe.
const MAG_W = 30, MAG_H = 19;

export function createMagazineDisplay(parent) {
  const r = new Raster(MAG_W, MAG_H);
  r.poly([[2, 1], [26, 0], [29, 4], [29, 16], [3, 18], [0, 15]], 0x4a463c);
  r.poly([[3, 3], [25, 2], [27, 5], [27, 15], [4, 16], [2, 14]], 0x000000);
  const base = r.snapshot();
  const sprite = new Sprite(parent, r.commit(), { ...LAYOUT.magazine, depth: DEPTH.gauges });

  let last = -1;
  return ammo => {
    if (ammo === last) return;
    last = ammo;
    r.restore(base);
    // Negrito (cada dígito desenhado duas vezes, 6 pixels de largura) com 1 pixel de folga entre os dígitos.
    const text = String(Math.max(0, Math.min(999, ammo))), left = 26 - text.length * 7;
    const color = ammo > 0 ? 0xf0a020 : 0xf01810;
    [...text].forEach((digit, i) => {
      rasterText(r, digit, left + i * 7, 4, color, 1, 2);
      rasterText(r, digit, left + i * 7 + 1, 4, color, 1, 2);
    });
    r.commit();
    sprite.refresh();
  };
}

// Botão do painel que a mão aperta para soltar a armadilha.
export function createTrapButton(parent) {
  const SIZE = LAYOUT.trapButtonSize, CENTER = SIZE / 2;
  const r = new Raster(SIZE, SIZE);
  r.rect(0, 0, SIZE, SIZE, 0x4a463c);
  r.rect(1, 1, SIZE - 2, SIZE - 2, 0x1a1712);
  const base = r.snapshot();
  const sprite = new Sprite(parent, r.commit(), { ...LAYOUT.trapButton, depth: DEPTH.gauges });

  // `lit` apaga a luz do botão quando o item selecionado não pode ser usado.
  let pressed = false, lit = false, drawn = '';
  function draw() {
    const state = `${pressed}|${lit}`;
    if (state === drawn) return;
    drawn = state;
    r.restore(base);
    r.disc(CENTER, CENTER, 6, 0x0a0806);
    if (pressed) {
      r.disc(CENTER, CENTER + 1, 4.4, lit ? 0x7a1410 : 0x2e0e0c);
    } else if (lit) {
      r.disc(CENTER, CENTER, 5.1, 0xc01c14);
      r.disc(CENTER - 1.5, CENTER - 1.5, 1.8, 0xf06a50);
    } else {
      r.disc(CENTER, CENTER, 5.1, 0x3e1412);
      r.disc(CENTER - 1.5, CENTER - 1.5, 1.8, 0x552420);
    }
    r.commit();
    sprite.refresh();
  }
  draw();
  return {
    setPressed(value) { pressed = value; draw(); },
    setLit(value) { lit = value; draw(); },
  };
}
