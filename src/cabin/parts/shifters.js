import { Raster } from '../../art/raster.js';
import { dither, vnoise } from '../../art/shade.js';

// Alavancas de câmbio. `anchor` é o pixel da imagem que encosta na grade em H; `grip`, onde a mão segura.

const STEEL = [0x3a2c26, 0x56443a, 0x74604f, 0x8e7966];
const KNOB = [0x0f0908, 0x1a100e, 0x2a1c18, 0x3e2d27];
const CAP = [0x352620, 0x4e3b31, 0x6a5346, 0x84695a];
const FUR = [0x4a2e12, 0x7a5420, 0xa67c34, 0xc9a050, 0xe6c47a];

function paintShaft(r, cx, top, bottom) {
  r.poly([[cx - 6, top], [cx + 6, top], [cx + 4, bottom], [cx - 4, bottom]], (x, y) => dither(x, y, 0.65 - (x - cx) / 20, STEEL, 0.7));
}

function paintClassicKnob() {
  const r = new Raster(30, 58);
  paintShaft(r, 15, 32, 58);

  r.poly([[1, 9], [29, 9], [28, 30], [24, 36], [6, 36], [2, 30]], (x, y) => dither(x, y, 0.72 - Math.abs(x - 11) / 16 - (y - 9) / 60, KNOB, 0.8));
  r.ellipse(15, 8, 14, 7.5, (x, y) => dither(x, y, 0.75 - (y - 1) / 26, KNOB, 0.8));
  r.ellipse(15, 7, 11, 5, (x, y) => dither(x, y, 0.55 + (vnoise(x / 3, y / 3) - 0.5) * 0.5, CAP, 0.6));
  r.rect(8, 6, 14, 2, 0x201610);
  r.rect(13, 5, 4, 4, 0x201610);
  return r.commit();
}

function paintFoxTail() {
  const r = new Raster(52, 74);
  paintShaft(r, 22, 54, 74);

  const tail = [[20, 56], [10, 44], [8, 28], [14, 14], [28, 5], [50, 0], [38, 12], [34, 24], [36, 38], [32, 50], [26, 58]];
  r.poly(tail, (x, y) => {
    const strand = vnoise(x / 2.2 + y / 7, y / 11) - 0.5;
    return dither(x, y, 0.42 + strand * 1.1 - (y - 5) / 200, FUR, 0.7);
  });
  return r.commit();
}

const BALL = [0x08080a, 0x16161a, 0x2a2a30, 0x4a4a54, 0x8a8a96];
const BONE_KNOB = [0x6a5a48, 0x968470, 0xbaa890, 0xd8c8b0, 0xf0e6d4];
const CHROME = [0x3a3c42, 0x62666e, 0x8e949c, 0xb8bec6, 0xe4e8ee];

function paintBallKnob() {
  const r = new Raster(32, 58);
  paintShaft(r, 16, 28, 58);
  r.disc(16, 16, 15, (x, y) => dither(x, y, 0.75 - Math.hypot(x - 11, y - 10) / 22, BALL, 0.8));
  r.disc(16, 16, 7, 0xe8e4dc);
  r.rect(14, 12, 4, 2, 0x101012); r.rect(14, 15, 4, 2, 0x101012); r.rect(14, 18, 4, 2, 0x101012);
  r.rect(13, 12, 1, 8, 0x101012); r.rect(18, 12, 1, 8, 0x101012);
  return r.commit();
}

function paintSkullKnob() {
  const r = new Raster(34, 60);
  paintShaft(r, 17, 34, 60);
  r.disc(17, 15, 14, (x, y) => dither(x, y, 0.8 - (y - 3) / 34, BONE_KNOB, 0.7));
  r.rect(9, 25, 16, 9, BONE_KNOB[1]);
  r.disc(11, 15, 4, 0x0a0806); r.disc(23, 15, 4, 0x0a0806);
  r.poly([[17, 19], [14, 24], [20, 24]], 0x0a0806);
  for (const x of [11, 15, 19, 23]) r.rect(x, 27, 2, 7, 0x0a0806);
  return r.commit();
}

function paintTHandle() {
  const r = new Raster(44, 58);
  paintShaft(r, 22, 12, 58);
  r.rect(2, 2, 40, 13, (x, y) => dither(x, y, 0.85 - (y - 2) / 16, CHROME, 0.7));
  r.disc(5, 8, 6, CHROME[1]); r.disc(39, 8, 6, CHROME[1]);
  r.rect(18, 4, 8, 9, 0xc02818);
  return r.commit();
}

export const SHIFTERS = {
  classic: { name: 'Manopla clássica', image: paintClassicKnob, anchor: [15, 57], grip: [15, 18] },
  foxtail: { name: 'Cauda de raposa', image: paintFoxTail, anchor: [22, 73], grip: [22, 34] },
  ball: { name: 'Bola oito', image: paintBallKnob, anchor: [16, 57], grip: [16, 16] },
  skull: { name: 'Caveira', image: paintSkullKnob, anchor: [17, 59], grip: [17, 18] },
  thandle: { name: 'Punho em T', image: paintTHandle, anchor: [22, 57], grip: [22, 10] },
  // PNGs do jogo original (Half Grip).
  blockKnob: { name: 'Manopla preta', image: 'assets/cabin/shifters/knob-a.png', anchor: [13, 31], grip: [13, 14] },
  slimKnob: { name: 'Manopla fina', image: 'assets/cabin/shifters/knob-b.png', anchor: [13, 31], grip: [13, 14] },
  redKnob: { name: 'Manopla com botão', image: 'assets/cabin/shifters/knob-c.png', anchor: [13, 27], grip: [13, 14] },
};
