import { VIEW } from '../config.js';

const toCss = color => `#${color.toString(16).padStart(6, '0')}`;

// Mira da arma, personalizável na oficina (settings.crosshair, vale para todas as armas). O jogo, a prévia e as
// miniaturas da oficina desenham com esta mesma função. A mira é feita de retângulos de pixel; o contorno é cada
// retângulo aumentado 1 pixel, em preto, por baixo.
//   style      um dos CROSSHAIR_STYLES
//   color      cor em 0xRRGGBB, escolhida na mesma barra de cor das peças; null é o branco original
//   size       comprimento de cada braço, em pixels da tela de 640x360
//   thickness  espessura das linhas
//   gap        espaço vazio entre o centro e o começo de cada braço (no aro e no quadrado, o tamanho)
//   outline    contorno preto, para ler em cima de neve, céu e areia
//   dynamic    a mira abre junto com a abertura da rajada (weapon.spread): mostra até onde as balas podem ir

export const CROSSHAIR_STYLES = [
  { id: 'cross', label: 'CRUZ' },
  { id: 'crossDot', label: 'CRUZ COM PONTO' },
  { id: 'dot', label: 'PONTO' },
  { id: 'tee', label: 'T' },
  { id: 'x', label: 'X' },
  { id: 'chevron', label: 'SETA' },
  { id: 'circle', label: 'ARO COM PONTO' },
  { id: 'ring', label: 'ARO' },
  { id: 'scope', label: 'ARO COM CRUZ' },
  { id: 'square', label: 'QUADRADO' },
  { id: 'brackets', label: 'CANTOS' },
];
export const CROSSHAIR_RANGE = { size: [2, 10], thickness: [1, 3], gap: [0, 8] };
export const ORIGINAL_CROSSHAIR_COLOR = 0xffffff;
// Igual à mira antiga: cruz branca de braços de 5 pixels, linhas de 2 e 2 pixels livres no meio.
export const DEFAULT_CROSSHAIR = { style: 'cross', color: null, size: 5, thickness: 2, gap: 2, outline: false, dynamic: true };

const HIT_COLOR = '#ff3030', HIT_ON_RED = '#ffffff', OUTLINE_COLOR = '#000000';

// Confere o que veio salvo; o que estiver fora do lugar volta ao padrão.
export function sanitizeCrosshair(saved = {}) {
  const pick = (key, ok) => (ok(saved?.[key]) ? saved[key] : DEFAULT_CROSSHAIR[key]);
  const inRange = key => value => Number.isInteger(value) && value >= CROSSHAIR_RANGE[key][0] && value <= CROSSHAIR_RANGE[key][1];
  return {
    style: pick('style', value => CROSSHAIR_STYLES.some(style => style.id === value)),
    color: pick('color', value => value === null || (Number.isInteger(value) && value >= 0 && value <= 0xffffff)),
    size: pick('size', inRange('size')),
    thickness: pick('thickness', inRange('thickness')),
    gap: pick('gap', inRange('gap')),
    outline: pick('outline', value => typeof value === 'boolean'),
    dynamic: pick('dynamic', value => typeof value === 'boolean'),
  };
}

// Mira vermelha: o acerto pisca em branco, senão não daria para ver.
const isReddish = color => ((color >> 16) & 255) > 170 && ((color >> 8) & 255) < 120 && (color & 255) < 120;

// Retângulos [x, y, largura, altura] da mira. `openX` e `openY`: quanto a rajada afasta os braços, em pixels.
// Alinhamento: uma linha de espessura par fica centrada na fronteira entre os pixels (cx, cy), o meio exato da tela;
// uma de espessura ímpar não cabe ali e fica centrada no pixel (cx - 1, cy - 1). Em cada caso a mira inteira é
// espelhada em volta do mesmo centro, então todos os braços, o ponto e o aro ficam simétricos.
function shape(o, cx, cy, openX, openY) {
  const t = o.thickness, odd = t % 2, rects = [], open = Math.round((openX + openY) / 2);
  const flipX = ([x, y, w, h]) => [2 * cx - odd - x - w, y, w, h];
  const flipY = ([x, y, w, h]) => [x, 2 * cy - odd - y - h, w, h];
  const mirrored = (rect, sides) => rects.push(rect, ...(sides.x ? [flipX(rect)] : []), ...(sides.y ? [flipY(rect)] : []), ...(sides.x && sides.y ? [flipX(flipY(rect))] : []));
  const centered = (c, w) => c - (w + odd) / 2;      // começo de uma faixa de largura w (mesma paridade de t) centrada
  const both = { x: true, y: true };

  const gx = o.gap + openX, gy = o.gap + openY;
  const right = [cx + gx, centered(cy, t), o.size, t], down = [centered(cx, t), cy + gy, t, o.size];
  const arms = sides => {
    if (sides.includes('x')) rects.push(right, flipX(right));
    if (sides.includes('down')) rects.push(down);
    if (sides.includes('up')) rects.push(flipY(down));
    if (odd && (gx === 0 || gy === 0)) rects.push([centered(cx, t), centered(cy, t), t, t]);   // o pixel do meio
  };
  const dot = (d = t) => rects.push([centered(cx, d), centered(cy, d), d, d]);
  const radius = Math.max(3, o.gap + 2 + open + Math.floor(o.size / 2));   // aro, quadrado e cantos

  // Diagonais em degraus de t x t, a partir do canto de baixo à direita e espelhadas.
  const diagonals = sides => {
    const start = Math.round(o.gap * 0.7) + Math.round(open * 0.7), length = Math.max(2, Math.round(o.size * 0.8));
    for (let k = start; k < start + length; k++) mirrored([cx + k, cy + k, t, t], sides);
  };
  const ring = () => {
    const centerX = cx - odd / 2, centerY = cy - odd / 2, band = t / 2;
    for (let y = cy - radius - 3; y <= cy + radius + 3; y++) {
      for (let x = cx - radius - 3; x <= cx + radius + 3; x++) {
        if (Math.abs(Math.hypot(x + 0.5 - centerX, y + 0.5 - centerY) - radius) <= band) rects.push([x, y, 1, 1]);
      }
    }
  };
  // Quadrado de "raio" r em volta do centro: canto de cima à esquerda e lado.
  const corner = r => [cx - r - odd, cy - r - odd, 2 * r + odd];

  switch (o.style) {
    case 'cross': arms(['x', 'up', 'down']); break;
    case 'crossDot': arms(['x', 'up', 'down']); dot(); break;
    case 'dot': dot(t + 2); break;
    case 'tee': arms(['x', 'down']); break;
    case 'x': diagonals(both); break;
    case 'chevron': diagonals({ x: true }); break;      // a ponta fica no centro, os braços descem
    case 'circle': ring(); dot(); break;
    case 'ring': ring(); break;
    case 'scope': {                                    // aro com braços curtos para fora, como numa luneta
      ring();
      const start = radius + Math.ceil(t / 2) + 1, length = Math.max(2, Math.ceil(o.size / 2) + 1);
      const outRight = [cx + start, centered(cy, t), length, t], outDown = [centered(cx, t), cy + start, t, length];
      rects.push(outRight, flipX(outRight), outDown, flipY(outDown));
      dot();
      break;
    }
    case 'square': {
      const [x, y, side] = corner(radius);
      rects.push([x, y, side, t], flipY([x, y, side, t]), [x, y, t, side], flipX([x, y, t, side]));
      dot();
      break;
    }
    case 'brackets': {
      const [x, y] = corner(radius), length = Math.max(t + 1, Math.ceil(radius * 0.6));
      mirrored([x, y, length, t], both);
      mirrored([x, y, t, length], both);
      dot();
      break;
    }
  }
  return rects;
}

// `hit`: o tiro acabou de acertar (a mira pisca em vermelho). `spread`: abertura da rajada agora (weapon.spread).
export function drawCrosshair(ctx, cx, cy, settings, { hit = false, spread = 0 } = {}) {
  const o = settings ?? DEFAULT_CROSSHAIR, color = o.color ?? ORIGINAL_CROSSHAIR_COLOR;
  // A abertura é um desvio em coordenadas de tela de -1 a 1: metade da largura na horizontal e metade da altura na vertical.
  const openX = o.dynamic ? Math.round(spread * VIEW.width / 2) : 0, openY = o.dynamic ? Math.round(spread * VIEW.height / 2) : 0;
  const rects = shape(o, cx, cy, openX, openY);
  if (o.outline) {
    ctx.fillStyle = OUTLINE_COLOR;
    for (const [x, y, w, h] of rects) ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  }
  ctx.fillStyle = hit ? (isReddish(color) ? HIT_ON_RED : HIT_COLOR) : toCss(color);
  for (const [x, y, w, h] of rects) ctx.fillRect(x, y, w, h);
}

// Fundo das prévias: céu, horizonte e asfalto com a faixa do meio, como atrás da mira numa corrida.
export function paintCrosshairBackdrop(ctx, width, height) {
  const horizon = Math.round(height * 0.48);
  for (let y = 0; y < height; y++) {
    const k = y / height;
    ctx.fillStyle = y < horizon ? `rgb(${Math.round(110 + k * 90)}, ${Math.round(140 + k * 60)}, 190)` : y < horizon + 2 ? '#5a6a40' : `rgb(${Math.round(50 + k * 30)}, ${Math.round(48 + k * 30)}, ${Math.round(54 + k * 26)})`;
    ctx.fillRect(0, y, width, 1);
  }
  ctx.fillStyle = '#e8e0c0';
  for (let y = horizon + 5; y < height; y += 7) ctx.fillRect(Math.floor(width / 2) - 1, y, 2, 3);
}

// Miniatura quadrada da mira em tamanho real (sem ampliar), sobre o fundo de pista.
export function crosshairThumb(settings, size, options) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  paintCrosshairBackdrop(ctx, size, size);
  drawCrosshair(ctx, size / 2, size / 2, settings, options);
  return canvas;
}
