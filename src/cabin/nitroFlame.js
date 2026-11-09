import { Raster } from '../art/raster.js';
import { hash } from '../art/shade.js';
import { DEPTH } from './layout.js';
import { Sprite } from './sprite.js';

// Foguinho que sai do registro do cilindro enquanto o nitro está aberto.

const W = 18, H = 30, FRAMES_PER_SECOND = 18;
const GROW_SPEED = 8, SHRINK_SPEED = 10;

function flameColor(heat, nearBase) {
  if (nearBase) return 0x9ac8ff;
  if (heat > 0.72) return 0xfff6c0;
  if (heat > 0.5) return 0xffd040;
  if (heat > 0.3) return 0xff8a20;
  return 0xd83a10;
}

function paintFlame(r, frame, size) {
  r.data.fill(0);
  const height = size * (0.8 + 0.2 * hash(frame, 1));

  for (let y = 0; y < H; y++) {
    const rise = (H - 1 - y) / (H - 1);
    if (rise > height) continue;

    const along = rise / height;
    const halfWidth = 7 * Math.pow(1 - along, 0.7) * Math.min(1, along * 6 + 0.35);
    const center = W / 2 + Math.sin(y * 0.45 + frame * 1.3) * along * 2.5;

    for (let x = 0; x < W; x++) {
      const across = Math.abs(x + 0.5 - center) / Math.max(halfWidth, 0.5);
      if (across > 1) continue;
      const noise = hash(x, y + frame * 5);
      if (across > 0.7 && noise > 0.6) continue;
      const heat = 1 - across * 0.7 - along * 0.7 + (noise - 0.5) * 0.25;
      r.put(x, y, flameColor(heat, along < 0.12 && across < 0.6));
    }
  }
}

export function createNitroFlame(parent, nozzle) {
  const r = new Raster(W, H);
  const sprite = new Sprite(parent, r.commit(), {
    x: nozzle.x - Math.floor(W / 2), y: nozzle.y - H + 1, depth: DEPTH.gauges - 0.02,
  });
  sprite.mesh.visible = false;

  let clock = 0, lastFrame = -1, size = 0;

  return (active, dt) => {
    size = active ? Math.min(1, size + dt * GROW_SPEED) : Math.max(0, size - dt * SHRINK_SPEED);
    sprite.mesh.visible = size > 0.05;
    if (!sprite.mesh.visible) return;

    clock += dt;
    const frame = Math.floor(clock * FRAMES_PER_SECOND);
    if (frame === lastFrame && size === 1) return;
    lastFrame = frame;

    paintFlame(r, frame, size);
    r.commit();
    sprite.refresh();
  };
}
