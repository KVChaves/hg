import { VIEW } from '../config.js';
import { Raster } from '../art/raster.js';
import { bayer, fbm, vnoise } from '../art/shade.js';
import { NET_TIME, TRAP_TYPES } from '../game/trapTypes.js';
import { DEPTH } from './layout.js';
import { WALL_SIZE } from './shell/sides.js';
import { addSideGlass } from './shell/shell.js';
import { Sprite } from './sprite.js';

// Tinta, fumaça e rede nos vidros. As camadas ficam atrás da pintura da cabine, então só aparecem pelas janelas.
// Cada tinta nova sorteia faixas e respingos diferentes. A rede aparece enquanto a direção está travada (effects.net).

const REDRAWS_PER_SECOND = 12;
const SIDE_REDRAW_EVERY = 2;                         // as janelas laterais atualizam a cada duas redesenhadas
const PAINT = 0xc0d428, PAINT_EDGE = 0x7a8a14, SMOKE = 0x2a2522;
const PAINT_THICKNESS = 0.85;                        // quanto do vidro a tinta tapa dentro das faixas
const SIDE_WINDOW_BOTTOM = 373;                      // abaixo disso a parede lateral é só porta

const WHOLE_GLASS_CHANCE = 0.12;                      // de vez em quando cobre tudo
const BAND_COUNT = [2, 3], BAND_HALF_WIDTH = [0.08, 0.2], BAND_WOBBLE = 0.1;

// Rede sobre o vidro (a do lança-redes): malha de cordas com nós e uma sombra para aparecer sobre qualquer cenário.
const ROPE = 0xf0dca8, KNOT = 0xb08c50, ROPE_SHADE = 0x3a2a14;
const NET_CELL = 34, NET_ROPE = 2, NET_KNOT = 6, NET_SAG = 2.2;   // tamanho da malha, espessura da corda, do nó e quanto a corda ondula
const NET_DROP_TIME = 0.3, NET_LIFT_TIME = 0.4;      // a rede cai do alto do vidro e, no fim, afrouxa e some

const random = ([low, high]) => low + Math.random() * (high - low);

// Posição de 0 a 1 ao longo de cada direção possível de faixa.
const BAND_AXES = [
  (u, v) => v,                    // horizontal
  (u, v) => u,                    // vertical
  (u, v) => (u + v) / 2,          // diagonal
  (u, v) => (u - v + 1) / 2,      // diagonal inversa
];

function drawBands() {
  if (Math.random() < WHOLE_GLASS_CHANCE) return null;
  return Array.from({ length: Math.round(random(BAND_COUNT)) }, () => ({
    position: BAND_AXES[Math.floor(Math.random() * BAND_AXES.length)],
    center: random([0.12, 0.88]),
    half: random(BAND_HALF_WIDTH),
  }));
}

const inBand = (bands, u, v, wobble) => !bands || bands.some(band => Math.abs(band.position(u, v) - band.center) < band.half + wobble);

// Uma superfície de vidro: `paint` e `smoke` vão de 0 a 1. `seed` deixa cada vidro com respingos próprios.
function createGlass(width, height, seed) {
  const r = new Raster(width, height);
  const blobs = new Float32Array(width * height), haze = new Float32Array(width * height), coverage = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      blobs[y * width + x] = fbm(x / 34 + seed, y / 26 + seed);
      haze[y * width + x] = vnoise(x / 40 + seed, y / 30 + seed);
    }
  }

  return {
    canvas: r.commit(),

    // Nova tinta: desloca os respingos e guarda quais pixels a faixa alcança.
    splash(bands) {
      const shiftX = Math.floor(Math.random() * width), shiftY = Math.floor(Math.random() * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = y * width + x;
          const wobble = (haze[i] - 0.5) * BAND_WOBBLE;
          coverage[i] = inBand(bands, x / width, y / height, wobble)
            ? blobs[((y + shiftY) % height) * width + (x + shiftX) % width]
            : Infinity;
        }
      }
    },

    // Rede: `reveal` (0 a 1) é o quanto já desceu do alto do vidro; `fade` (0 a 1) quanto dela resta no fim.
    drawNet(reveal, fade, seed) {
      const limit = Math.round(height * reveal);
      const rows = Math.ceil(height / NET_CELL) + 1, columns = Math.ceil(width / NET_CELL) + 1;
      const sag = (x, y) => Math.round(Math.sin(x / 41 + seed) * NET_SAG + Math.sin(y / 29 + seed * 1.7) * NET_SAG);
      const put = (x, y, color) => { if (y < limit && x >= 0 && y >= 0 && x < width && y < height && bayer(x, y) < fade) r.put(x, y, color); };
      const thick = (x, y, w, h, color) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, color); };
      const offset = (NET_CELL * 0.3) | 0;
      for (let row = 0; row < rows; row++) {                      // cordas horizontais
        const baseY = row * NET_CELL + offset;
        for (let x = 0; x < width; x++) {
          const y = baseY + sag(x, baseY);
          thick(x, y + NET_ROPE, 1, 1, ROPE_SHADE);
          thick(x, y, 1, NET_ROPE, ROPE);
        }
      }
      for (let column = 0; column < columns; column++) {          // cordas verticais
        const baseX = column * NET_CELL + offset;
        for (let y = 0; y < height; y++) {
          const x = baseX + sag(baseX, y);
          thick(x + NET_ROPE, y, 1, 1, ROPE_SHADE);
          thick(x, y, NET_ROPE, 1, ROPE);
        }
      }
      for (let row = 0; row < rows; row++) {                      // nós nos cruzamentos
        for (let column = 0; column < columns; column++) {
          const baseX = column * NET_CELL + offset, baseY = row * NET_CELL + offset;
          const x = baseX + sag(baseX, baseY) - (NET_KNOT - NET_ROPE) / 2, y = baseY + sag(baseX, baseY) - (NET_KNOT - NET_ROPE) / 2;
          thick(x + 1, y + 1, NET_KNOT, NET_KNOT, ROPE_SHADE);
          thick(x, y, NET_KNOT, NET_KNOT, KNOT);
          thick(x + 1, y + 1, 2, 2, ROPE);
        }
      }
      r.commit();
    },

    draw(paint, smoke) {
      r.data.fill(0);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = y * width + x;
          // A tinta escorre: some primeiro na parte de cima.
          const limit = PAINT_THICKNESS * paint - 0.02 - (1 - y / height) * (1 - paint) * 0.2;
          const margin = limit - coverage[i];
          if (margin > 0) r.put(x, y, margin < 0.025 ? PAINT_EDGE : PAINT);
          else if (bayer(x, y) < smoke * (0.45 + 0.6 * haze[i])) r.put(x, y, SMOKE);
        }
      }
      r.commit();
    },
  };
}

export function createWindshieldEffects(parent) {
  const windshield = createGlass(VIEW.width, VIEW.height, 0);
  const sprite = new Sprite(parent, windshield.canvas, { x: 0, y: 0, depth: DEPTH.windshield });
  sprite.mesh.visible = false;

  const sides = [createGlass(WALL_SIZE.width, SIDE_WINDOW_BOTTOM, 137), createGlass(WALL_SIZE.width, SIDE_WINDOW_BOTTOM, 271)];
  const sideGlass = addSideGlass(parent, sides.map(side => side.canvas), WALL_SIZE, SIDE_WINDOW_BOTTOM);

  let clock = 0, painted = false, lastPaint = 0, lastNet = 0, netSeed = 0, redraws = 0;

  function drawAll(paint, smoke, net) {
    windshield.draw(paint, smoke);
    if (net) windshield.drawNet(net.reveal, net.fade, net.seed);
    sprite.refresh();
    if (redraws++ % SIDE_REDRAW_EVERY) return;
    for (const side of sides) {
      side.draw(paint, 0);
      if (net) side.drawNet(net.reveal, net.fade, net.seed);
    }
    sideGlass.refresh();
  }

  return (effects, dt) => {
    if (effects.paint > lastPaint) {                 // caiu tinta nova
      const bands = drawBands();
      windshield.splash(bands);
      for (const side of sides) side.splash(drawBands());
      painted = false;
      redraws = 0;
    }
    lastPaint = effects.paint;
    if (effects.net > lastNet) { netSeed = Math.random() * 100; painted = false; redraws = 0; }   // rede nova: outra ondulação
    lastNet = effects.net;

    const paint = Math.min(1, effects.paint / TRAP_TYPES.paint.duration * 1.4);
    const smoke = Math.min(1, effects.smoke / TRAP_TYPES.smoke.duration * 1.6);
    const netOn = effects.net > 0;
    const net = netOn ? { reveal: Math.min(1, (NET_TIME - effects.net) / NET_DROP_TIME), fade: Math.min(1, effects.net / NET_LIFT_TIME), seed: netSeed } : null;
    const active = paint > 0 || smoke > 0 || netOn;

    sprite.mesh.visible = active;
    sideGlass.setVisible(paint > 0 || netOn);
    if (!active) { painted = false; return; }

    clock += dt;
    if (painted && clock < 1 / REDRAWS_PER_SECOND) return;
    clock = 0;
    painted = true;
    drawAll(paint, smoke, net);
  };
}
