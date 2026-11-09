import { VIEW } from '../config.js';
import { Raster } from '../art/raster.js';
import { bayer, fbm, vnoise } from '../art/shade.js';
import { TRAP_TYPES } from '../game/trapTypes.js';
import { DEPTH } from './layout.js';
import { WALL_SIZE } from './shell/sides.js';
import { addSideGlass } from './shell/shell.js';
import { Sprite } from './sprite.js';

// Tinta e fumaça nos vidros. As camadas ficam atrás da pintura da cabine, então só aparecem pelas janelas.
// Cada tinta nova sorteia faixas e respingos diferentes.

const REDRAWS_PER_SECOND = 12;
const SIDE_REDRAW_EVERY = 2;                         // as janelas laterais atualizam a cada duas redesenhadas
const PAINT = 0xc0d428, PAINT_EDGE = 0x7a8a14, SMOKE = 0x2a2522;
const PAINT_THICKNESS = 0.85;                        // quanto do vidro a tinta tapa dentro das faixas
const SIDE_WINDOW_BOTTOM = 373;                      // abaixo disso a parede lateral é só porta

const WHOLE_GLASS_CHANCE = 0.12;                      // de vez em quando cobre tudo
const BAND_COUNT = [2, 3], BAND_HALF_WIDTH = [0.08, 0.2], BAND_WOBBLE = 0.1;

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

  let clock = 0, painted = false, lastPaint = 0, redraws = 0;

  function drawAll(paint, smoke) {
    windshield.draw(paint, smoke);
    sprite.refresh();
    if (redraws++ % SIDE_REDRAW_EVERY) return;
    for (const side of sides) side.draw(paint, 0);
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

    const paint = Math.min(1, effects.paint / TRAP_TYPES.paint.duration * 1.4);
    const smoke = Math.min(1, effects.smoke / TRAP_TYPES.smoke.duration * 1.6);
    const active = paint > 0 || smoke > 0;

    sprite.mesh.visible = active;
    sideGlass.setVisible(paint > 0);
    if (!active) { painted = false; return; }

    clock += dt;
    if (painted && clock < 1 / REDRAWS_PER_SECOND) return;
    clock = 0;
    painted = true;
    drawAll(paint, smoke);
  };
}
