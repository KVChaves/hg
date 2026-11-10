import { TRACK_WIDTH } from '../config.js';
import { OPEN_WALL, SHARP_RADIUS, createRandom, track } from '../world/track.js';

// Decide onde vão os túneis e os trechos épicos. Só depende da pista e da semente: todos veem o mesmo mapa.
// Nada fica no grid nem junto das curvas fechadas.

const START_CLEAR = 120, GRID_CLEAR = 95;
const EPIC_MARGIN = 26, EPIC_MAX_CURVE = 1 / 50;
const RAMP_RUN = 34, GAP_LENGTH = 24, PLATFORM_LENGTH = 26, DESCENT_RUN = 30, JUMP_HEIGHT = 7, CHASM_DEPTH = 24;
const TWIST_LENGTHS = [240, 200, 170], TWIST_GROUND_DROP = 7;
const SHARP_MARGIN = 45, TUNNEL_MARGIN = 35, TUNNEL_MAX_CURVE = 1 / 55, FUNNEL_LENGTH = 30;
export const TUNNEL_WALL = TRACK_WIDTH / 2 + 2.1, TUNNEL_HALF_WIDTH = TRACK_WIDTH / 2 + 4, TUNNEL_HEIGHT = 7.5;
// No salto a estrada é uma estrutura construída (rampa e plataformas) com mureta baixa: o carro anda até o meio-fio.
export const JUMP_WALL = TRACK_WIDTH / 2 + 0.65;
const RAMP_FOOT = 3, DESCENT_FOOT = 3;               // metros da rampa ainda em terra firme, na subida e na descida

function createPlacer(random) {
  const { count, step, curvature } = track;
  const used = new Uint8Array(count), nearSharp = new Uint8Array(count);
  const toIndex = distance => ((Math.round(distance / step) % count) + count) % count;
  const mark = (map, from, to) => { for (let d = from; d <= to; d += step) map[toIndex(d)] = 1; };

  mark(used, -GRID_CLEAR, START_CLEAR);
  for (let i = 0; i < count; i++) if (curvature[i] > 1 / SHARP_RADIUS) mark(nearSharp, i * step - SHARP_MARGIN, i * step + SHARP_MARGIN);

  function isFree(from, to, maxCurve) {
    for (let d = from; d <= to; d += step) {
      const i = toIndex(d);
      if (used[i] || nearSharp[i] || curvature[i] > maxCurve) return false;
    }
    return true;
  }

  // Sorteia um início `s` em que [s - before, s + after] esteja livre e sem curva acima de `maxCurve`.
  function seek(before, after, maxCurve) {
    const spots = [];
    for (let i = 0; i < count; i++) if (isFree(i * step - before, i * step + after, maxCurve)) spots.push(i * step);
    return spots.length ? spots[Math.floor(random() * spots.length)] : null;
  }

  return { seek, reserve: (from, to) => mark(used, from, to), toIndex };
}

function narrowWalls(placer, start, length, limit = TUNNEL_WALL) {
  const { step, wall } = track;
  const setWall = (distance, value) => {
    const i = placer.toIndex(distance);
    wall[i] = Math.min(wall[i], value);
  };
  for (let d = start; d <= start + length; d += step) setWall(d, limit);
  // As paredes afunilam para o carro não bater de frente na boca do túnel (ou da rampa).
  for (let d = 0; d <= FUNNEL_LENGTH; d += step) {
    const value = limit + (OPEN_WALL - limit) * (d / FUNNEL_LENGTH);
    setWall(start - d, value);
    setWall(start + length + d, value);
  }
}

// Túneis e tubo têm parede perto: ali o carro segura melhor e acompanha a curva (ver updateCar).
function markEnclosed(start, length) {
  forEachSample(start - FUNNEL_LENGTH, length + FUNNEL_LENGTH * 2, i => { track.enclosed[i] = 1; });
}

function placeTunnels(plan, placer, random, layout) {
  for (let n = 0; n < plan.count; n++) {
    const length = plan.length[0] + random() * (plan.length[1] - plan.length[0]);
    const start = placer.seek(TUNNEL_MARGIN, length + TUNNEL_MARGIN, TUNNEL_MAX_CURVE);
    if (start === null) continue;
    placer.reserve(start - TUNNEL_MARGIN, start + length + TUNNEL_MARGIN);
    layout.tunnels.push({ start, length, open: Boolean(plan.open) });
    if (!plan.open) narrowWalls(placer, start, length);
    markEnclosed(start, length);
  }
}

const easing = t => t * t * (3 - 2 * t);

// Altura a mais em cada ponto do salto. Rampa, arcos e plataformas emendam sem quina: a inclinação que
// sai de um trecho é a que entra no seguinte, então o carro decola e pousa suave.
function jumpProfile(hops) {
  const launch = 2 * JUMP_HEIGHT / RAMP_RUN, arc = launch * GAP_LENGTH / 4, bowl = launch * PLATFORM_LENGTH / 4;
  const period = GAP_LENGTH + PLATFORM_LENGTH, tail = PLATFORM_LENGTH + DESCENT_RUN;
  return d => {
    if (d < RAMP_RUN) return JUMP_HEIGHT * (d / RAMP_RUN) ** 2;
    const n = Math.floor((d - RAMP_RUN) / period), offset = d - RAMP_RUN - n * period;
    if (n < hops && offset < GAP_LENGTH) {
      const u = offset / GAP_LENGTH;
      return JUMP_HEIGHT + arc * 4 * u * (1 - u);
    }
    if (n < hops - 1) {
      const u = (offset - GAP_LENGTH) / PLATFORM_LENGTH;
      return JUMP_HEIGHT - bowl * 4 * u * (1 - u);
    }
    const u = (d - (RAMP_RUN + hops * period - PLATFORM_LENGTH)) / tail;     // último pouso e descida
    return JUMP_HEIGHT * (2 * u ** 3 - 3 * u ** 2 + 1) - launch * tail * (u ** 3 - 2 * u ** 2 + u);
  };
}

// Percorre uma vez cada ponto da pista dentro do trecho.
function forEachSample(start, length, visit) {
  const { step, count } = track;
  for (let k = Math.ceil(start / step); k * step <= start + length; k++) visit(k % count, k * step - start);
}

// Salto: rampa construída que sai da água (ou do abismo), vãos separados por plataformas e descida.
// A altura no vão é um arco, igual para todos. Do pé da rampa ao fim da descida o terreno afunda: a rampa
// e as plataformas ficam como blocos de pedra, com mureta, e o carro não sai pelo lado.
function placeJump(hops, placer, layout) {
  const period = GAP_LENGTH + PLATFORM_LENGTH, length = RAMP_RUN + hops * period + DESCENT_RUN;
  const start = placer.seek(EPIC_MARGIN, length + EPIC_MARGIN, EPIC_MAX_CURVE);
  if (start === null) return;
  placer.reserve(start - EPIC_MARGIN, start + length + EPIC_MARGIN);
  const { py, gap, epic, drop, boost } = track, heightAt = jumpProfile(hops), lastLanding = RAMP_RUN + hops * period - PLATFORM_LENGTH;
  const inGapAt = d => d >= RAMP_RUN && d < lastLanding && (d - RAMP_RUN) % period < GAP_LENGTH;
  forEachSample(start, length, (i, d) => {
    py[i] += heightAt(d);
    epic[i] = 1;
    boost[i] = d < lastLanding ? 1 : 0;
    if (d >= RAMP_FOOT && d <= length - DESCENT_FOOT) drop[i] = CHASM_DEPTH;
    if (inGapAt(d)) gap[i] = 1;
  });
  narrowWalls(placer, start, length, JUMP_WALL);
  const gaps = Array.from({ length: hops }, (_, n) => [start + RAMP_RUN + n * period, start + RAMP_RUN + n * period + GAP_LENGTH]);
  // Blocos de pedra sob a estrada: a rampa, as plataformas entre os vãos e a última, que desce até a terra.
  const blocks = [[start, gaps[0][0]], ...gaps.slice(1).map(([from], n) => [gaps[n][1], from]), [gaps[hops - 1][1], start + length]];
  layout.epics.push({ type: 'jump', start, length, gaps, blocks });
}

// Tubo: a estrada dá uma volta completa, passando pela parede e pelo teto.
function placeTwist(placer, layout) {
  let length = 0, start = null;
  for (length of TWIST_LENGTHS) {                    // prefere o tubo longo; em pista mais sinuosa aceita um menor
    start = placer.seek(EPIC_MARGIN, length + EPIC_MARGIN, EPIC_MAX_CURVE);
    if (start !== null) break;
  }
  if (start === null) return;
  placer.reserve(start - EPIC_MARGIN, start + length + EPIC_MARGIN);
  forEachSample(start, length, (i, d) => {
    track.roll[i] = Math.PI * 2 * easing(d / length);
    track.epic[i] = 1;
    track.drop[i] = TWIST_GROUND_DROP;               // o chão desce para não atravessar o tubo por dentro
  });
  narrowWalls(placer, start, length);
  markEnclosed(start, length);
  layout.epics.push({ type: 'twist', start, length });
}

// Ondulações no leito da pista (`bumps`: altura em metros e comprimento de onda), como estrada de terra que
// sobe e desce. Duas ondas com número inteiro de ciclos por volta, para emendar na largada. Somem perto da
// largada, dos saltos, do tubo e dos túneis, com transição suave de BUMP_FADE metros.
const BUMP_FADE = 40;
function addBumps({ height, length }) {
  const { count, step, py, epic, enclosed } = track, total = count * step;
  const cycles = wavelength => Math.max(1, Math.round(total / wavelength)) * Math.PI * 2 / total;
  const k1 = cycles(length), k2 = cycles(length * 0.6);
  const free = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const d = i * step;
    free[i] = epic[i] || enclosed[i] || d < START_CLEAR || d > total - GRID_CLEAR ? 0 : 1;
  }
  const reach = Math.round(BUMP_FADE / step);
  for (let i = 0; i < count; i++) {
    let sum = 0;
    for (let k = -reach; k <= reach; k++) sum += free[(i + k + count) % count];
    const weight = sum / (reach * 2 + 1), d = i * step;
    py[i] += weight * height * (0.65 * Math.sin(k1 * d) + 0.35 * Math.sin(k2 * d + 1.7));
  }
}

function recomputeSlope() {
  const { count, step, py, slope } = track;
  for (let i = 0; i < count; i++) slope[i] = (py[(i + 1) % count] - py[(i - 1 + count) % count]) / (2 * step);
}

export function createMapLayout(plan, seed) {
  const random = createRandom(seed + 5), placer = createPlacer(random);
  const layout = { tunnels: [], epics: [] };
  placeTwist(placer, layout);                        // os trechos épicos pedem retas longas: escolhem primeiro
  placeJump(plan.jumpHops, placer, layout);
  placeTunnels(plan.tunnels, placer, random, layout);
  if (plan.bumps) addBumps(plan.bumps);
  recomputeSlope();
  return layout;
}
