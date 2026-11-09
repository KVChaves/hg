// Mini-rasterizador de pixel art: bordas duras (sem antialias) e cor por pixel.
// Uma cor é 0xRRGGBB, CLEAR (transparente) ou uma função (x, y) => cor.

export const CLEAR = -1;

const toABGR = c => (0xff000000 | ((c & 0xff) << 16) | (c & 0xff00) | ((c >> 16) & 0xff)) >>> 0;

export class Raster {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');
    this.image = this.ctx.createImageData(width, height);
    this.data = new Uint32Array(this.image.data.buffer);
  }

  put(x, y, color) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const c = typeof color === 'function' ? color(x, y) : color;
    if (c === undefined || c === null) return;
    this.data[y * this.width + x] = c < 0 ? 0 : toABGR(c);
  }

  rect(x, y, w, h, color) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.put(i, j, color);
  }

  // Polígono qualquer (regra par-ímpar), amostrado no centro de cada pixel.
  poly(points, color) {
    let minY = Infinity, maxY = -Infinity;
    for (const p of points) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    const crossings = [];
    for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(this.height - 1, Math.ceil(maxY)); y++) {
      const sy = y + 0.5;
      crossings.length = 0;
      for (let i = 0; i < points.length; i++) {
        const [ax, ay] = points[i], [bx, by] = points[(i + 1) % points.length];
        if ((ay <= sy) !== (by <= sy)) crossings.push(ax + (sy - ay) * (bx - ax) / (by - ay));
      }
      crossings.sort((a, b) => a - b);
      for (let k = 0; k + 1 < crossings.length; k += 2) {
        const from = Math.ceil(crossings[k] - 0.5), to = Math.ceil(crossings[k + 1] - 0.5);
        for (let x = from; x < to; x++) this.put(x, y, color);
      }
    }
  }

  ellipse(cx, cy, rx, ry, color) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.put(x, y, color);
      }
    }
  }

  disc(cx, cy, r, color) { this.ellipse(cx, cy, r, r, color); }

  ring(cx, cy, outer, inner, color) {
    for (let y = Math.floor(cy - outer); y <= Math.ceil(cy + outer); y++) {
      for (let x = Math.floor(cx - outer); x <= Math.ceil(cx + outer); x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d <= outer && d >= inner) this.put(x, y, color);
      }
    }
  }

  // Linha de Bresenham; `thick` carimba um quadrado em cada passo.
  line(x0, y0, x1, y1, color, thick = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    const lo = -Math.floor((thick - 1) / 2);
    let err = dx + dy;
    for (;;) {
      for (let j = 0; j < thick; j++) for (let i = 0; i < thick; i++) this.put(x0 + lo + i, y0 + lo + j, color);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  snapshot() { return this.data.slice(); }
  restore(snapshot) { this.data.set(snapshot); }

  // Envia os pixels para o canvas e o devolve.
  commit() {
    this.ctx.putImageData(this.image, 0, 0);
    return this.canvas;
  }
}
