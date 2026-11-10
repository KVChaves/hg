// Partículas das armas em pixels: cápsulas ejetadas e fumaça do cano.

const GRAVITY = 620, BOUNCE = 0.35, CASING_LIFE = 1.3, SMOKE_LIFE = 0.7, SMOKE_RISE = 26, SMOKE_GROWTH = 11;
const CASINGS = {
  round: { width: 2, height: 4, color: '#d0a040' },
  long: { width: 2, height: 6, color: '#d8b050' },
  shell: { width: 3, height: 7, color: '#a02418' },
  grenade: { width: 5, height: 7, color: '#c8a040' },              // estojo largo da granada
};

export function createGunEffects(floorY, onCasingLand) {
  const casings = [], puffs = [];

  function ejectCasing(x, y, kind) {
    casings.push({
      x, y, kind, life: CASING_LIFE, angle: Math.random() * 6,
      vx: 70 + Math.random() * 50, vy: -150 - Math.random() * 70, spin: 10 + Math.random() * 12,
    });
  }

  function puffSmoke(x, y, amount) {
    const count = Math.max(1, Math.round(amount * 3));
    for (let i = 0; i < count; i++) {
      puffs.push({ x: x - i * 4 - Math.random() * 3, y: y + (Math.random() - 0.5) * 4, life: SMOKE_LIFE, radius: 2 + Math.random() * 2 });
    }
  }

  function update(dt) {
    for (const c of casings) {
      c.life -= dt;
      c.vy += GRAVITY * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.angle += c.spin * dt;
      if (c.y > floorY && c.vy > 0) {
        if (!c.landed) onCasingLand?.();
        c.landed = true;
        c.y = floorY;
        c.vy *= -BOUNCE;
        c.vx *= 0.6;
        c.spin *= 0.5;
      }
    }
    for (const p of puffs) {
      p.life -= dt;
      p.y -= SMOKE_RISE * dt;
      p.radius += SMOKE_GROWTH * dt;
    }
    for (const list of [casings, puffs]) {
      for (let i = list.length - 1; i >= 0; i--) if (list[i].life <= 0) list.splice(i, 1);
    }
  }

  function drawPuff(ctx, p) {
    const density = p.life / SMOKE_LIFE, r = Math.round(p.radius);
    ctx.fillStyle = '#a8a29a';
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        // Xadrez cada vez mais ralo conforme a fumaça se dissipa.
        if ((dx + dy) & 1 || density < 0.5 && dy & 1) continue;
        ctx.fillRect(Math.round(p.x) + dx, Math.round(p.y) + dy, 1, 1);
      }
    }
  }

  function draw(ctx) {
    for (const p of puffs) drawPuff(ctx, p);
    for (const c of casings) {
      const { width, height, color } = CASINGS[c.kind];
      ctx.save();
      ctx.translate(Math.round(c.x), Math.round(c.y));
      ctx.rotate(c.angle);
      ctx.fillStyle = color;
      ctx.fillRect(-width / 2, -height / 2, width, height);
      ctx.restore();
    }
  }

  return { ejectCasing, puffSmoke, update, draw };
}
