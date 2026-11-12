import { TRACK_WIDTH } from '../config.js';
import { SHARP_RADIUS, createRandom, track, trackAt } from '../world/track.js';
import { HAZARD_KINDS } from './hazardKinds.js';

// Decide onde vão os túneis e os trechos épicos. Só depende da pista e da semente: todos veem o mesmo mapa.
// Nada fica no grid nem junto das curvas fechadas.

const START_CLEAR = 120, GRID_CLEAR = 95;
const EPIC_MARGIN = 26, EPIC_MAX_CURVE = 1 / 50;
const TWIST_LENGTHS = [240, 200, 170], TWIST_GROUND_DROP = 7;
const SHARP_MARGIN = 45, TUNNEL_MARGIN = 35, TUNNEL_MAX_CURVE = 1 / 55, FUNNEL_LENGTH = 30;
export const TUNNEL_WALL = TRACK_WIDTH / 2 + 2.1, TUNNEL_HALF_WIDTH = TRACK_WIDTH / 2 + 4, TUNNEL_HEIGHT = 7.5;
// No salto a estrada é uma estrutura construída (rampa e plataforma) com mureta baixa: o carro anda até o meio-fio.
export const JUMP_WALL = TRACK_WIDTH / 2 + 0.65;
// Cada pista tem uma rampa sobre um rio (ou lava, ou abismo): o carro voa de verdade, sob gravidade. A rampa
// termina num bico inclinado (`lip`, metros de subida por metro); quem sai devagar não alcança a outra margem e cai.
// Com o bico a 0,3 o alcance em terreno plano é ~0,055 × v² (v em m/s): 120 km/h vão ~60 m, o vão pede ~76 km/h.
const RIVER = { ramp: 40, lip: 0.3, gap: 26, flat: 6, descent: 80, depth: 12, bank: 3 };
const RESPAWN_BACK = 4;                              // quem cai volta este tanto antes do começo do trecho
const VOLCANO_BANK = 18, VOLCANO_DEPTH = 22;         // com vulcão o buraco sob o vão é maior e mais fundo, para caber o cone
// Ponte de gelo (`bridge`): sem mureta e escorregadia; quem sai pela beirada cai no lago gelado lá embaixo.
export const BRIDGE_HALF = TRACK_WIDTH / 2, BRIDGE_REACH = BRIDGE_HALF + 8;   // até onde o centro do carro pode ir antes de bater no limite
const BRIDGE_DEPTH = 24;
const WATER_BELOW = 1.6;                             // por padrão a água fica um pouco abaixo do pé da rampa (`jump.below` muda)

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

  return { seek, reserve: (from, to) => mark(used, from, to), toIndex, random };
}

function narrowWalls(placer, start, length, limit = TUNNEL_WALL) {
  const { step, wall, openWall } = track;
  const setWall = (distance, value) => {
    const i = placer.toIndex(distance);
    wall[i] = Math.min(wall[i], value);
  };
  for (let d = start; d <= start + length; d += step) setWall(d, limit);
  // As paredes afunilam para o carro não bater de frente na boca do túnel (ou da rampa).
  // No vale (limite largo) o funil é mais longo, para o carro descer da encosta aos poucos.
  const funnel = Math.max(FUNNEL_LENGTH, (openWall - limit) * 3);
  for (let d = 0; d <= funnel; d += step) {
    const value = limit + (openWall - limit) * (d / funnel);
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

// Percorre uma vez cada ponto da pista dentro do trecho.
function forEachSample(start, length, visit) {
  const { step, count } = track;
  for (let k = Math.ceil(start / step); k * step <= start + length; k++) visit(k % count, k * step - start);
}

// Altura a mais na rampa do rio e a inclinação dela: sobe em parábola até o bico, a outra margem tem um trecho
// plano e depois desce suave até a terra. No vão não há chão; ali a altura continua a linha do bico, para a
// estrada entre a última amostra da rampa e o vão sair na inclinação certa (o chão é interpolado entre amostras).
function riverProfile({ ramp, lip, gap, flat, descent }) {
  const height = lip * ramp / 2, landing = ramp + gap + flat;
  const heightAt = d => {
    if (d < ramp) return height * (d / ramp) ** 2;
    if (d < ramp + gap) return height + lip * (d - ramp);
    if (d < landing) return height;
    const u = Math.min(1, (d - landing) / descent);
    return height * (1 - u * u * (3 - 2 * u));
  };
  const slopeAt = d => {
    if (d < ramp) return 2 * height * d / (ramp * ramp);
    if (d < ramp + gap) return lip;
    if (d < landing) return 0;
    const u = Math.min(1, (d - landing) / descent);
    return -height * 6 * u * (1 - u) / descent;
  };
  return { heightAt, slopeAt };
}

// A inclinação calculada por diferença entre amostras arredonda o bico e a beira do vão: aqui ela é a exata.
function fixRiverSlopes({ start, length }) {
  const { count, step, py, lift, slope } = track, { slopeAt } = riverProfile(RIVER);
  const base = i => py[i] - lift[i];
  forEachSample(start, length, (i, d) => {
    slope[i] = (base((i + 1) % count) - base((i - 1 + count) % count)) / (2 * step) + slopeAt(d);
  });
}

// Rampa única sobre um rio que cruza a pista. O leito (`track.bed`) afunda só sob o vão: como o terreno segue o
// ponto mais próximo da pista, vira uma faixa de rio atravessando a estrada, sem invadir outros trechos.
function placeRiverJump(plan, placer, layout) {
  const { ramp, gap, flat, descent, depth } = RIVER, length = ramp + gap + flat + descent;
  const bank = plan.volcano ? VOLCANO_BANK : RIVER.bank, bedDepth = Math.max(plan.volcano ? VOLCANO_DEPTH : depth, (plan.below ?? WATER_BELOW) + 6);
  const start = placer.seek(EPIC_MARGIN, length + EPIC_MARGIN, EPIC_MAX_CURVE);
  if (start === null) return;
  placer.reserve(start - EPIC_MARGIN, start + length + EPIC_MARGIN);
  const { py, gap: gaps, epic, bed, lift, flight } = track, { heightAt } = riverProfile(RIVER);
  // O chão existe até a primeira amostra do vão e volta na primeira amostra depois dele: o vão desenhado é esse.
  const span = [Infinity, Infinity];
  forEachSample(start, length, (i, d) => {
    lift[i] = heightAt(d);
    py[i] += lift[i];
    epic[i] = flight[i] = 1;
    if (d >= ramp - bank && d < ramp + gap + bank) bed[i] = bedDepth;   // o leito fica sempre abaixo da água
    if (d >= ramp && d < ramp + gap) {
      gaps[i] = 1;
      span[0] = Math.min(span[0], start + d);
    } else if (d >= ramp + gap) {
      span[1] = Math.min(span[1], start + d);
    }
  });
  narrowWalls(placer, start, length, JUMP_WALL);
  const section = {
    type: 'jump', start, length, gaps: [span], blocks: [[start, span[0]], [span[1], start + length]], respawn: start - RESPAWN_BACK,
    water: 0, floor: 0, depth: bedDepth, below: plan.below ?? WATER_BELOW, fallLabel: plan.fallLabel ?? 'CAIU', volcano: Boolean(plan.volcano),
  };
  layout.epics.push(section);
  track.jumps.push(section);
}

function placeBridge(plan, placer, layout) {
  const { length } = plan, start = placer.seek(EPIC_MARGIN, length + EPIC_MARGIN, EPIC_MAX_CURVE);
  if (start === null) return;
  placer.reserve(start - EPIC_MARGIN, start + length + EPIC_MARGIN);
  const below = plan.below ?? 16;
  forEachSample(start, length, i => {
    track.bridge[i] = track.epic[i] = 1;            // sem voo livre: na ponte o carro só sai do chão pela beirada
    track.bed[i] = Math.max(BRIDGE_DEPTH, below + 6);
    track.wall[i] = BRIDGE_REACH;
  });
  const section = { type: 'bridge', start, length, gaps: [[start, start + length]], respawn: start - RESPAWN_BACK, water: 0, below, fallLabel: plan.fallLabel ?? 'CAIU' };
  layout.epics.push(section);
  track.bridges.push(section);
}

// Trecho escuro: um túnel fechado em que só se enxerga o que brilha (`dark.fog`: neblina [perto, longe] lá dentro).
function placeDarkTunnel(plan, placer, layout) {
  const length = plan.length[0] + placer.random() * (plan.length[1] - plan.length[0]);
  const start = placer.seek(TUNNEL_MARGIN, length + TUNNEL_MARGIN, TUNNEL_MAX_CURVE);
  if (start === null) return;
  placer.reserve(start - TUNNEL_MARGIN, start + length + TUNNEL_MARGIN);
  layout.tunnels.push({ start, length, open: false, dark: plan });
  narrowWalls(placer, start, length);
  markEnclosed(start, length);
  track.darkZones.push({ start, length, fog: plan.fog, pulse: Boolean(plan.pulse) });
}

// Clima pesado (`storm`): um trecho longo a céu aberto em que a neblina fecha a vista (ver stormAt): tempestade de
// areia, temporal, nevasca. Tenta o comprimento pedido e, se a pista não tiver reta livre, encurta. `fog`: neblina
// [perto, longe] lá dentro; `color`: cor dela; `wind`: o quanto empurra as partículas de lado; `grip`: aderência no
// meio do trecho (1 = normal); `label`: texto da placa de aviso; `flooded`: a pista fica alagada.
function placeStorm(plan, placer, layout) {
  for (const length of [plan.length, plan.length * 0.8, plan.length * 0.6]) {
    const start = placer.seek(STORM_MARGIN, length + STORM_MARGIN, 1);
    if (start === null) continue;
    placer.reserve(start - STORM_MARGIN, start + length + STORM_MARGIN);
    const zone = { start, length, fog: plan.fog, color: plan.color, wind: plan.wind ?? 0, grip: plan.grip ?? 1, label: plan.label ?? 'CLIMA', flooded: Boolean(plan.flooded), waterColor: plan.waterColor ?? '#4a7a8a' };
    track.stormZones.push(zone);
    layout.storms.push(zone);
    return;
  }
}
const STORM_MARGIN = 60;

// Esteiras rolantes (`belts`: { count, length, force }): retas em que cada metade da pista corre para um lado.
const BELT_MARGIN = 40, BELT_MAX_CURVE = 1 / 110;
function placeBelts(plan, placer, layout) {
  for (let n = 0; n < plan.count; n++) {
    const start = placer.seek(BELT_MARGIN, plan.length + BELT_MARGIN, BELT_MAX_CURVE);
    if (start === null) return;
    placer.reserve(start - BELT_MARGIN, start + plan.length + BELT_MARGIN);
    const belt = { start, length: plan.length, force: plan.force, dir: placer.random() < 0.5 ? -1 : 1 };
    track.belts.push(belt);
    layout.belts.push(belt);
  }
}

// Pontos de perigo (hazardKinds.js): retas livres, longe uns dos outros e dos trechos especiais. O de túnel fica
// logo depois da entrada de um túnel fechado (sem ser o escuro). `side`: de que lado da pista vem o perigo.
const HAZARD_MARGIN = 45, HAZARD_MAX_CURVE = 1 / 70, TUNNEL_HAZARD_IN = 10;
function placeHazards(plans, placer, layout) {
  const random = placer.random;
  for (const { kind, count } of plans) {
    const tunnels = layout.tunnels.filter(tunnel => !tunnel.open && !tunnel.dark);
    for (let n = 0; n < count; n++) {
      let dist = null;
      if (HAZARD_KINDS[kind].atTunnel) {
        if (n < tunnels.length) dist = tunnels[n].start + TUNNEL_HAZARD_IN;
      } else {
        dist = placer.seek(HAZARD_MARGIN, HAZARD_MARGIN, HAZARD_MAX_CURVE);
        if (dist !== null) placer.reserve(dist - HAZARD_MARGIN, dist + HAZARD_MARGIN);
      }
      if (dist === null) continue;
      const site = { kind, dist, side: random() < 0.5 ? -1 : 1 };
      layout.hazards.push(site);
      track.hazards.push(site);
    }
  }
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
  const blocked = new Uint8Array(count), free = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const d = i * step;
    blocked[i] = epic[i] || enclosed[i] || d < START_CLEAR || d > total - GRID_CLEAR ? 1 : 0;
  }
  const reach = Math.round(BUMP_FADE / step);
  // A transição acontece toda antes do trecho: dentro dele (na rampa, por exemplo) não sobra ondulação nenhuma.
  for (let i = 0; i < count; i++) {
    let near = 0;
    for (let k = -reach; k <= reach && !near; k++) near = blocked[(i + k + count) % count];
    free[i] = near ? 0 : 1;
  }
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
  const layout = { tunnels: [], epics: [], hazards: [], storms: [], belts: [] };
  if (plan.twist) placeTwist(placer, layout);        // os trechos épicos pedem retas longas: escolhem primeiro
  placeRiverJump(plan.jump ?? {}, placer, layout);
  if (plan.bridge) placeBridge(plan.bridge, placer, layout);
  if (plan.dark) placeDarkTunnel(plan.dark, placer, layout);
  if (plan.storm) placeStorm(plan.storm, placer, layout);
  if (plan.belts) placeBelts(plan.belts, placer, layout);
  placeTunnels(plan.tunnels, placer, random, layout);
  placeHazards(plan.hazards ?? [], placer, layout);
  if (plan.bumps) addBumps(plan.bumps);
  recomputeSlope();
  for (const jump of track.jumps) fixRiverSlopes(jump);
  // A água fica abaixo do ponto mais baixo do chão no trecho (sem contar o que a rampa ergueu); o leito, abaixo dela.
  for (const section of [...track.jumps, ...track.bridges]) {
    let lowest = Infinity, deepest = Infinity;
    forEachSample(section.start, section.length, i => {
      lowest = Math.min(lowest, track.py[i] - track.lift[i]);
      if (track.bed[i] > 0) deepest = Math.min(deepest, track.py[i] - track.lift[i] - track.bed[i]);
    });
    section.water = lowest - section.below;
    section.floor = deepest;
  }
  return layout;
}
