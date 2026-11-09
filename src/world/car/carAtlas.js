// Mapa da textura do carro. Cada região é uma projeção plana: a geometria e a pintura usam as
// mesmas funções para que as duas coincidam. A frente do carro é z negativo.

export const ATLAS = { width: 256, height: 168 };

const Z_SPAN = 2.35;     // metade do comprimento coberto pela textura
const Y_TOP = 1.5, Y_BOTTOM = 0.15;
const X_SPAN = 1;

export const REGION = {
  side: { x: 0, y: 0, width: 256, height: 64 },
  top: { x: 0, y: 64, width: 256, height: 48 },
  rear: { x: 0, y: 112, width: 128, height: 48 },
  front: { x: 128, y: 112, width: 128, height: 48 },
  solid: { x: 0, y: 160, width: 256, height: 8 },
};

const across = x => (x + X_SPAN) / (2 * X_SPAN);
const lengthwise = z => (Z_SPAN - z) / (2 * Z_SPAN);     // frente à direita da textura
const height = y => (Y_TOP - y) / (Y_TOP - Y_BOTTOM);

// Coordenadas em pixels da textura.
export const sidePixel = (z, y) => [REGION.side.width * lengthwise(z), REGION.side.y + REGION.side.height * height(y)];
export const topPixel = (z, x) => [REGION.top.width * lengthwise(z), REGION.top.y + REGION.top.height * across(x)];
export const rearPixel = (x, y) => [REGION.rear.x + REGION.rear.width * across(x), REGION.rear.y + REGION.rear.height * height(y)];
export const frontPixel = (x, y) => [REGION.front.x + REGION.front.width * across(x), REGION.front.y + REGION.front.height * height(y)];

// Coordenadas de textura (0..1) de um vértice [x, y, z].
const toUv = ([px, py]) => [px / ATLAS.width, 1 - py / ATLAS.height];

export const PROJECT = {
  side: ([, y, z]) => toUv(sidePixel(z, y)),
  top: ([x, , z]) => toUv(topPixel(z, x)),
  rear: ([x, y]) => toUv(rearPixel(x, y)),
  front: ([x, y]) => toUv(frontPixel(x, y)),
  solid: () => toUv([REGION.solid.width / 2, REGION.solid.y + REGION.solid.height / 2]),
};
