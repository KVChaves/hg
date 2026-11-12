import { Raster } from '../../art/raster.js';
import { mix } from '../../art/shade.js';
import { rasterText } from '../../art/font.js';
import { loadPng } from '../pngPixels.js';

// Indicadores de vida. Área de 76x67 px sobre a moldura da coluna A.
// `create(cor)` devolve { canvas, draw(health) }; cor nula usa a original. `draw` é chamado só quando a vida muda.

const WIDTH = 76, HEIGHT = 67;
const AXIS_START = [29, 25], AXIS_END = [61, 58];   // eixo do mostrador, seguindo a inclinação da coluna
const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];

const along = t => [AXIS_START[0] + (AXIS_END[0] - AXIS_START[0]) * t, AXIS_START[1] + (AXIS_END[1] - AXIS_START[1]) * t];

function plotHeart(r, x, y, color, scale = 1) {
  HEART.forEach((row, j) => [...row].forEach((cell, i) => {
    if (cell === '#') r.rect(x + i * scale, y + j * scale, scale, scale, color);
  }));
}

// Traço inclinado, atravessado em relação ao eixo do mostrador.
function segment(r, x, y, halfLength, halfThick, color) {
  const ux = 0.86, uy = -0.5, vx = 0.68, vy = 0.73;
  r.poly([
    [x - ux * halfLength - vx * halfThick, y - uy * halfLength - vy * halfThick],
    [x + ux * halfLength - vx * halfThick, y + uy * halfLength - vy * halfThick],
    [x + ux * halfLength + vx * halfThick, y + uy * halfLength + vy * halfThick],
    [x - ux * halfLength + vx * halfThick, y - uy * halfLength + vy * halfThick],
  ], color);
}

function createBarMeter(color) {
  const lit = color ?? 0xe6f000, glow = color === null ? 0x1f6e06 : mix(color, 0, 0.55), off = color === null ? 0x0e2c05 : mix(color, 0, 0.85);
  const r = new Raster(WIDTH, HEIGHT);
  const SEGMENTS = 12;

  function draw(health) {
    r.data.fill(0);
    plotHeart(r, 15, 7, glow, 2); plotHeart(r, 13, 7, glow, 2);
    plotHeart(r, 14, 8, glow, 2); plotHeart(r, 14, 6, glow, 2);
    plotHeart(r, 14, 7, lit, 2);
    r.line(24, 25, 26, 22, lit); r.put(27, 22, lit);

    for (let i = 0; i < SEGMENTS; i++) {
      const [x, y] = along(i / (SEGMENTS - 1));
      const on = i / SEGMENTS < health;
      segment(r, x, y, 5, 1.8, on ? glow : off);
      if (on) segment(r, x, y, 3.8, 1, lit);
    }
    return r.commit();
  }
  return { canvas: r.canvas, draw };
}

function createHeartMeter(color) {
  const lit = color ?? 0xff3226, off = color === null ? 0x3a1410 : mix(color, 0, 0.8);
  const r = new Raster(WIDTH, HEIGHT);
  const COUNT = 4;
  const FIRST = [24, 20];

  function draw(health) {
    r.data.fill(0);
    const filled = Math.ceil(health * COUNT - 0.001);
    for (let i = 0; i < COUNT; i++) {
      const t = i / (COUNT - 1);
      const x = FIRST[0] + (AXIS_END[0] - FIRST[0]) * t, y = FIRST[1] + (AXIS_END[1] - FIRST[1]) * t;
      plotHeart(r, Math.round(x - 7), Math.round(y - 6), i < filled ? lit : off, 2);
    }
    return r.commit();
  }
  return { canvas: r.canvas, draw };
}

function createPipMeter(color) {
  const lit = color ?? 0x40e0f0, off = color === null ? 0x0a2a30 : mix(color, 0, 0.82);
  const r = new Raster(WIDTH, HEIGHT);
  const COUNT = 7;

  function draw(health) {
    r.data.fill(0);
    for (let i = 0; i < COUNT; i++) {
      const [x, y] = along(i / (COUNT - 1));
      r.disc(x, y, 3.4, i / COUNT < health ? lit : off);
    }
    return r.commit();
  }
  return { canvas: r.canvas, draw };
}

function createNumberMeter(color) {
  const lit = color ?? 0xff5a30;
  const r = new Raster(WIDTH, HEIGHT);

  function draw(health) {
    r.data.fill(0);
    rasterText(r, String(Math.round(health * 100)), 24, 26, lit, 2, 3);
    return r.commit();
  }
  return { canvas: r.canvas, draw };
}

function createGaugeMeter(color) {
  const needle = color ?? 0xf04020, dial = color === null ? 0x4a4438 : mix(color, 0, 0.7);
  const r = new Raster(WIDTH, HEIGHT);
  const CENTER = [42, 40], RADIUS = 18, START = Math.PI * 0.8, SWEEP = Math.PI * 1.4;

  function draw(health) {
    r.data.fill(0);
    r.disc(CENTER[0], CENTER[1], RADIUS + 2, 0x101012);
    r.ring(CENTER[0], CENTER[1], RADIUS + 2, RADIUS, dial);
    for (let i = 0; i <= 8; i++) {
      const a = START + SWEEP * i / 8;
      r.put(CENTER[0] + Math.cos(a) * (RADIUS - 3), CENTER[1] + Math.sin(a) * (RADIUS - 3), dial);
    }
    const a = START + SWEEP * health;
    r.line(CENTER[0], CENTER[1], CENTER[0] + Math.cos(a) * (RADIUS - 4), CENTER[1] + Math.sin(a) * (RADIUS - 4), needle, 2);
    r.disc(CENTER[0], CENTER[1], 2.5, dial);
    return r.commit();
  }
  return { canvas: r.canvas, draw };
}

// Placa enferrujada do jogo original: a máscara tem um valor de cinza por segmento (mais claro = mais embaixo).
const PLATE = 'assets/cabin/hp-plate.png', PLATE_MASK = 'assets/cabin/hp-plate-mask.png';

function createPlateMeter(color) {
  const lit = '#' + (color ?? 0xa6e022).toString(16).padStart(6, '0');
  const canvas = document.createElement('canvas');
  canvas.width = 55; canvas.height = 127;
  const ctx = canvas.getContext('2d');
  let plate = null, segments = [], last = 1;

  function draw(health) {
    last = health;
    if (!plate) return canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(plate, 0, 0);
    const on = Math.ceil(health * segments.length - 0.001);
    ctx.fillStyle = lit;
    segments.forEach((pixels, i) => { if (i < on) for (const [x, y] of pixels) ctx.fillRect(x, y, 1, 1); });
    if (health > 0) for (const [x, y] of heart) ctx.fillRect(x, y, 1, 1);
    return canvas;
  }

  let heart = [];
  const ready = Promise.all([loadPng(PLATE), loadPng(PLATE_MASK)]).then(([plateImage, mask]) => {
    plate = plateImage;
    const data = mask.getContext('2d').getImageData(0, 0, mask.width, mask.height).data;
    const byValue = new Map();
    for (let y = 0; y < mask.height; y++) for (let x = 0; x < mask.width; x++) {
      const i = (y * mask.width + x) * 4;
      if (data[i + 3] === 0 || data[i] === 0) continue;
      if (data[i] === 255) { heart.push([x, y]); continue; }
      if (!byValue.has(data[i])) byValue.set(data[i], []);
      byValue.get(data[i]).push([x, y]);
    }
    segments = [...byValue.entries()].sort((a, b) => b[0] - a[0]).map(([, pixels]) => pixels);   // de baixo para cima
    draw(last);
  });
  return { canvas, draw, ready };
}

export const HEALTH_METERS = {
  bar: { name: 'Barra', create: createBarMeter },
  hearts: { name: 'Corações', create: createHeartMeter },
  pips: { name: 'Pontos', create: createPipMeter },
  number: { name: 'Numero', create: createNumberMeter },
  gauge: { name: 'Ponteiro', create: createGaugeMeter },
  plate: { name: 'Placa enferrujada', create: createPlateMeter, layout: 'healthPlate' },
};
