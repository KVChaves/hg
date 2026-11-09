import { buildGunArt } from './gunArt.js';

// Monta a arma a partir das camadas e a desenha numa pose. A origem é o pivô da arma.

export const REST_POSE = { hammer: 1, hammers: [1, 1], spin: 0, open: 0, bolt: 0, lever: 0, magDrop: 0, ammo: 6, boltLift: 0, boltBack: 0, draw: 1, flex: 0, valve: 0, t: 0 };

export function createGunRig(id, custom) {
  const art = buildGunArt(id, custom);
  const [pivotX, pivotY] = art.pivot;

  function draw(ctx, pose) {
    ctx.save();
    ctx.translate(-pivotX, -pivotY);
    for (const layer of art.layers) {
      const t = layer.pose ? layer.pose(pose) : {};
      if (t.hidden) continue;
      const key = t.variant ?? layer.select?.(pose);
      const image = key !== undefined ? layer.variants[key] : layer.image;
      ctx.save();
      ctx.translate(t.dx ?? 0, t.dy ?? 0);
      if (t.angle) {
        ctx.translate(t.px, t.py);
        ctx.rotate(t.angle);
        ctx.translate(-t.px, -t.py);
      }
      ctx.drawImage(image, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  // Clarão em cruz irregular; `seed` varia o formato a cada tiro.
  // Lança-chamas: um jato que alarga e esfria até a ponta.
  function drawJet(ctx, seed) {
    const [mx, my] = art.muzzle, size = art.flashSize, [outer, middle, core] = art.flash;
    const hex = c => `#${c.toString(16).padStart(6, '0')}`;
    const length = Math.round((52 + seed * 26) * size), x0 = mx - pivotX, y0 = my - pivotY;
    for (let i = 0; i < length; i += 2) {
      const t = i / length, half = Math.round((1.5 + i * 0.16) * (0.8 + 0.4 * Math.sin(i * 0.7 + seed * 9)));
      ctx.fillStyle = hex(t < 0.35 ? outer : t < 0.7 ? outer : 0x7a2410);
      ctx.fillRect(x0 - i - 2, y0 - half, 2, half * 2 + 1);
      ctx.fillStyle = hex(t < 0.5 ? middle : outer);
      ctx.fillRect(x0 - i - 2, y0 - Math.round(half * 0.6), 2, Math.round(half * 1.2) + 1);
      if (t < 0.4) {
        ctx.fillStyle = hex(core);
        ctx.fillRect(x0 - i - 2, y0 - Math.round(half * 0.25), 2, Math.round(half * 0.5) + 1);
      }
    }
  }

  function drawFlash(ctx, seed) {
    if (!art.flashSize) return;
    if (art.flashStyle === 'jet') { drawJet(ctx, seed); return; }
    const [mx, my] = art.muzzle, size = art.flashSize, [outer, middle, core] = art.flash;
    const x = mx - pivotX, y = my - pivotY;
    const long = Math.round((14 + seed * 8) * size), side = Math.round((7 + (1 - seed) * 6) * size);
    ctx.fillStyle = `#${outer.toString(16).padStart(6, '0')}`;
    ctx.fillRect(x - long, y - 1, long, 3);
    ctx.fillRect(x - Math.round(long * 0.5), y - side, 3, side * 2 + 1);
    ctx.fillStyle = `#${middle.toString(16).padStart(6, '0')}`;
    ctx.fillRect(x - Math.round(long * 0.7), y - 2, Math.round(long * 0.7), 5);
    ctx.fillRect(x - Math.round(long * 0.45), y - Math.round(side * 0.6), 5, Math.round(side * 1.2) + 1);
    ctx.fillStyle = `#${core.toString(16).padStart(6, '0')}`;
    ctx.fillRect(x - Math.round(long * 0.4), y - 1, Math.round(long * 0.4), 3);
  }

  // Imagem parada, para miniaturas.
  function snapshot(pose = REST_POSE) {
    const canvas = document.createElement('canvas');
    [canvas.width, canvas.height] = art.size;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.translate(pivotX, pivotY);
    draw(ctx, pose);
    return canvas;
  }

  return { art, draw, drawFlash, snapshot };
}
