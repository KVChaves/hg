// Funções de sombreamento para pixel art: dithering ordenado, ruído e geometria 2D.

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
export const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
export const bayer = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

// Escolhe uma cor da paleta para o tom t (0..1), com dithering Bayer 4x4.
export function dither(x, y, t, palette, strength = 1) {
  const n = palette.length - 1;
  const v = clamp(t) * n + (bayer(x, y) - 0.5) * strength;
  return palette[clamp(Math.round(v), 0, n)];
}

export function hash(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), u = smooth(x - xi), v = smooth(y - yi);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export const fbm = (x, y) => 0.6 * vnoise(x, y) + 0.3 * vnoise(x * 2.1, y * 2.1) + 0.1 * vnoise(x * 4.3, y * 4.3);

export function mix(a, b, t) {
  const lerp = (s) => {
    const ca = (a >> s) & 255, cb = (b >> s) & 255;
    return Math.round(ca + (cb - ca) * t) << s;
  };
  return lerp(16) | lerp(8) | lerp(0);
}

// Cinco tons da mesma cor, do mais escuro ao mais claro.
export const colorRamp = color => [mix(color, 0, 0.62), mix(color, 0, 0.36), mix(color, 0, 0.12), color, mix(color, 0xffffff, 0.24)];

// Distância do ponto à reta AB (sempre positiva).
export function distToLine(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  return Math.abs((x + 0.5 - ax) * dy - (y + 0.5 - ay) * dx) / Math.hypot(dx, dy);
}

// Ponto (u,v) dentro do quadrilátero ABCD (A=0,0  B=1,0  C=1,1  D=0,1).
export function quadPoint([a, b, c, d], u, v) {
  const top = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  const bottom = [d[0] + (c[0] - d[0]) * u, d[1] + (c[1] - d[1]) * u];
  return [top[0] + (bottom[0] - top[0]) * v, top[1] + (bottom[1] - top[1]) * v];
}

export const subQuad = (quad, u0, v0, u1, v1) => [
  quadPoint(quad, u0, v0), quadPoint(quad, u1, v0), quadPoint(quad, u1, v1), quadPoint(quad, u0, v1),
];
