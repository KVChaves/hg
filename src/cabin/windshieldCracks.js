import { VIEW } from '../config.js';
import { Raster } from '../art/raster.js';
import { DEPTH } from './layout.js';
import { Sprite } from './sprite.js';

// Trincas no para-brisa: uma a cada capotagem, só para o piloto saber. São riscos finos nos cantos do vidro;
// o meio, por onde se enxerga a pista, fica sempre limpo. Saem na corrida seguinte, junto com o resto do carro.

const MAX_CRACKS = 12;
const CRACK_COLOR = 0xd4dee6, BRANCH_COLOR = 0x98a6b2;
const CLEAR_VIEW = { x: 320, y: 165, rx: 125, ry: 58 };   // miolo do para-brisa, que as trincas não invadem
const SCOREBOARD = { left: 528, right: 632, top: 52, bottom: 152 };
const AREA = { left: 96, right: 610, top: 84, bottom: 224 };
const RAYS = [6, 9], RAY_LENGTH = [16, 44], RAY_STEPS = 4, RAY_WOBBLE = 0.45, BRANCH_CHANCE = 0.45, BRANCH_LENGTH = [6, 14], WEB_AT = 1;
const MIN_SPACING = 64, PLACEMENT_TRIES = 40;

const between = ([low, high]) => low + Math.random() * (high - low);

const isInClearView = (x, y) => ((x - CLEAR_VIEW.x) / CLEAR_VIEW.rx) ** 2 + ((y - CLEAR_VIEW.y) / CLEAR_VIEW.ry) ** 2 < 1;
const isOnScoreboard = (x, y) => x > SCOREBOARD.left && x < SCOREBOARD.right && y > SCOREBOARD.top && y < SCOREBOARD.bottom;

// As colunas do para-brisa são inclinadas: quanto mais baixo, mais estreito o vidro.
const isOnGlass = (x, y) => x > 82 + (y - 82) * 0.645 && x < 634 - (y - 50) * 0.41 && !isInClearView(x, y) && !isOnScoreboard(x, y);

function pickSpot(spots) {
  let spot = null;
  for (let tries = 0; tries < PLACEMENT_TRIES; tries++) {
    const x = AREA.left + Math.random() * (AREA.right - AREA.left), y = AREA.top + Math.random() * (AREA.bottom - AREA.top);
    if (!isOnGlass(x, y)) continue;
    spot = { x, y };
    if (spots.every(other => Math.hypot(other.x - x, other.y - y) >= MIN_SPACING)) return spot;
  }
  return spot;                                       // vidro já cheio: aceita perto de outra trinca
}

// Um raio partindo do impacto, em passos tortos. Para ao chegar no miolo ou na beira do vidro.
function drawRay(r, spot, angle) {
  const length = between(RAY_LENGTH), points = [spot];
  for (let step = 1; step <= RAY_STEPS; step++) {
    angle += (Math.random() - 0.5) * RAY_WOBBLE;
    const last = points[points.length - 1], next = { x: last.x + Math.cos(angle) * length / RAY_STEPS, y: last.y + Math.sin(angle) * length / RAY_STEPS };
    if (!isOnGlass(next.x, next.y)) break;
    r.line(last.x, last.y, next.x, next.y, CRACK_COLOR);
    if (Math.random() < BRANCH_CHANCE) {
      const side = angle + (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.5), reach = between(BRANCH_LENGTH);
      const tip = { x: next.x + Math.cos(side) * reach, y: next.y + Math.sin(side) * reach };
      if (isOnGlass(tip.x, tip.y)) r.line(next.x, next.y, tip.x, tip.y, BRANCH_COLOR);
    }
    points.push(next);
  }
  return points;
}

function drawCrack(r, spot) {
  const count = Math.round(between(RAYS)), start = Math.random() * Math.PI * 2;
  const rays = Array.from({ length: count }, (_, i) => drawRay(r, spot, start + (i + Math.random() * 0.6) * Math.PI * 2 / count));
  rays.forEach((ray, i) => {                         // a teia em volta do impacto
    const a = ray[WEB_AT], b = rays[(i + 1) % count][WEB_AT];
    if (a && b) r.line(a.x, a.y, b.x, b.y, BRANCH_COLOR);
  });
  r.rect(Math.round(spot.x) - 1, Math.round(spot.y) - 1, 2, 2, CRACK_COLOR);
}

export function createWindshieldCracks(parent) {
  const r = new Raster(VIEW.width, VIEW.height);
  const sprite = new Sprite(parent, r.commit(), { x: 0, y: 0, depth: DEPTH.cracks });
  sprite.mesh.visible = false;
  const spots = [];

  return capsizes => {
    const wanted = Math.min(capsizes, MAX_CRACKS);
    if (wanted === spots.length) return;
    if (wanted < spots.length) {                     // carro novo na largada
      r.data.fill(0);
      spots.length = 0;
    }
    while (spots.length < wanted) {
      const spot = pickSpot(spots);
      if (!spot) break;
      spots.push(spot);
      drawCrack(r, spot);
    }
    r.commit();
    sprite.refresh();
    sprite.mesh.visible = spots.length > 0;
  };
}
