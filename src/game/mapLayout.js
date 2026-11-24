import { TRACK_WIDTH } from '../config.js';
import { OPEN_WALL, SHARP_RADIUS, createRandom, track, trackAt } from '../world/track.js';
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
  // `within` ({ start, length }): só dentro desse trecho da pista.
  function seek(before, after, maxCurve, within = null) {
    const spots = [], total = count * step;
    const inZone = d => !within || ((d - within.start) % total + total) % total <= within.length - after;
    for (let i = 0; i < count; i++) if (inZone(i * step) && isFree(i * step - before, i * step + after, maxCurve)) spots.push(i * step);
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
    else if (track.shoulder > 0) narrowWalls(placer, start, length, OPEN_WALL);   // acostamento largo: o carro passa entre os pilares do arco, não por eles
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
function fixRiverSlopes({ start, length, river }) {
  const { count, step, py, lift, slope } = track, { slopeAt } = riverProfile(river);
  const base = i => py[i] - lift[i];
  forEachSample(start, length, (i, d) => {
    slope[i] = (base((i + 1) % count) - base((i - 1 + count) % count)) / (2 * step) + slopeAt(d);
  });
}

// Rampa única sobre um rio que cruza a pista. O leito (`track.bed`) afunda só sob o vão: como o terreno segue o
// ponto mais próximo da pista, vira uma faixa de rio atravessando a estrada, sem invadir outros trechos.
// `plan.gap` alarga o vão (o salto do recorde no salar pede turbo ou nitro); `plan.boost` põe uma placa de turbo
// no meio da pista logo antes da rampa.
function placeRiverJump(plan, placer, layout) {
  const river = { ...RIVER, gap: plan.gap ?? RIVER.gap };
  const { ramp, gap, flat, descent, depth } = river, length = ramp + gap + flat + descent;
  const bank = plan.volcano ? VOLCANO_BANK : RIVER.bank, bedDepth = Math.max(plan.volcano ? VOLCANO_DEPTH : depth, (plan.below ?? WATER_BELOW) + 6);
  const runUp = plan.boost ? JUMP_BOOST_RUNUP : 0;
  const start = placer.seek(EPIC_MARGIN + runUp, length + EPIC_MARGIN, EPIC_MAX_CURVE);
  if (start === null) return;
  placer.reserve(start - EPIC_MARGIN - runUp, start + length + EPIC_MARGIN);
  const { py, gap: gaps, epic, bed, lift, flight } = track, { heightAt } = riverProfile(river);
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
    type: 'jump', start, length, river, gaps: [span], blocks: [[start, span[0]], [span[1], start + length]], respawn: start - RESPAWN_BACK - runUp,
    water: 0, floor: 0, depth: bedDepth, below: plan.below ?? WATER_BELOW, fallLabel: plan.fallLabel ?? 'CAIU', volcano: Boolean(plan.volcano),
  };
  layout.epics.push(section);
  track.jumps.push(section);
  if (plan.boost) addBoost(layout, { start: start - JUMP_BOOST_AT, length: BOOST_LENGTH, lane: 0, half: JUMP_BOOST_HALF, jump: true });
}
const JUMP_BOOST_RUNUP = 40, JUMP_BOOST_AT = 26, JUMP_BOOST_HALF = 3.5;

// Castelo da Estrada do Rei (track.castle, que o traçado já trouxe): a ponte levadiça meio erguida é a rampa sobre o
// fosso, o carro voa pelo portão e cai no pátio, que fica no alto (a mesma altura do bico) e é um carro mais estreito
// que a estrada; lá dentro são duas curvas de 90°, e do outro lado do portão de saída uma descida de pedra.
// O portão é baixo de propósito: com o bico a 0,3 (6 m acima do chão) e o fosso de 24 m, só alcança o pátio quem sai
// do bico a mais de ~75 km/h; acima de ~105 km/h o carro passa alto demais e bate na muralha sobre o portão (vão de
// 5,2 m, CASTLE_GATE), volta e cai no fosso. Na velocidade máxima sem nitro (120 km/h) bate: é preciso tirar o pé
// antes da ponte. (Faixa medida com a física do jogo, flight.js, em várias pistas.)
export const CASTLE_HALF = TRACK_WIDTH / 2 - 1.8, CASTLE_WALL = CASTLE_HALF - 0.4;
// `height`: vão livre do portão acima do pátio; `depth`: espessura da muralha (o túnel do portão).
export const CASTLE_GATE = { height: 5.2, depth: 5 };
export const CASTLE_JUMP = { ramp: 40, lip: 0.3, gap: 24, descent: 80, depth: 12, bank: 3 };
const CASTLE_RUNUP = 110;                            // reta livre antes da ponte, sem nada no caminho
function placeCastle(plan, placer, layout) {
  const castle = track.castle;
  if (!castle) return;
  // A rampa e o fosso caem em amostras da pista, contadas em números inteiros: o bico fica exatamente na altura e o
  // portão exatamente no começo do pátio. Fora do alinhamento a rampa ganharia uma amostra (0,9 m mais alta) e a
  // faixa de velocidade que passa pelo portão mudaria de pista para pista.
  const { step, count, py, gap: gaps, epic, bed, lift, flight, ownFloor } = track, { descent, bank } = CASTLE_JUMP;
  const rampN = Math.round(CASTLE_JUMP.ramp / step), gapN = Math.round(CASTLE_JUMP.gap / step), gateIndex = Math.round(castle.gate / step);
  const ramp = rampN * step, gap = gapN * step, flat = castle.exitGate - gateIndex * step;
  const firstIndex = gateIndex - rampN - gapN, start = firstIndex * step, length = ramp + gap + flat + descent, river = { ...CASTLE_JUMP, ramp, gap, flat };
  const bedDepth = Math.max(CASTLE_JUMP.depth, (plan.below ?? WATER_BELOW) + 6);
  placer.reserve(start - CASTLE_RUNUP, start + length + EPIC_MARGIN);
  const { heightAt } = riverProfile(river), span = [start + ramp, start + ramp + gap], bankN = Math.round(bank / step);
  for (let k = 0; k * step <= length; k++) {
    const i = ((firstIndex + k) % count + count) % count;
    lift[i] = heightAt(k * step);
    py[i] += lift[i];
    epic[i] = flight[i] = 1;
    if (k >= rampN - bankN && k < rampN + gapN + bankN) bed[i] = bedDepth;
    if (k >= rampN && k < rampN + gapN) gaps[i] = 1;
    if (k < rampN + gapN + flat / step) ownFloor[i] = 1;   // ponte levadiça e pátio: o castelo desenha o chão
  }
  narrowWalls(placer, start, length, CASTLE_WALL);
  markEnclosed(span[1], flat);
  const section = {
    type: 'castle', start, length, river, gaps: [span], blocks: [[start, span[0]], [span[1], start + length]], respawn: start - RESPAWN_BACK,
    water: 0, floor: 0, depth: bedDepth, below: plan.below ?? WATER_BELOW, fallLabel: plan.fallLabel ?? 'CAIU NO FOSSO', volcano: false,
    gate: { at: span[1], ...CASTLE_GATE }, castle,   // a muralha fica onde o chão do pátio começa de verdade (na amostra)
  };
  layout.epics.push(section);
  track.jumps.push(section);
}

// `icy: false` faz uma ponte seca (de tábuas, no cânion): track.bridge vale 2 nela, e o carro não escorrega.
// `style`: como epicVisuals.js desenha ('ice' ou 'wood').
function placeBridge(plan, placer, layout) {
  const { length } = plan, start = placer.seek(EPIC_MARGIN, length + EPIC_MARGIN, EPIC_MAX_CURVE);
  if (start === null) return;
  placer.reserve(start - EPIC_MARGIN, start + length + EPIC_MARGIN);
  const below = plan.below ?? 16, icy = plan.icy ?? true;
  forEachSample(start, length, i => {
    track.bridge[i] = icy ? 1 : 2;                  // sem voo livre: na ponte o carro só sai do chão pela beirada
    track.epic[i] = 1;
    track.bed[i] = Math.max(BRIDGE_DEPTH, below + 6);
    track.wall[i] = BRIDGE_REACH;
  });
  const section = { type: 'bridge', start, length, gaps: [[start, start + length]], respawn: start - RESPAWN_BACK, water: 0, below, fallLabel: plan.fallLabel ?? 'CAIU', style: plan.style ?? 'ice' };
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

// Rajadas de vento (`gusts`: { force, period, onBridges, count, length }): trechos em que o vento sopra de lado em
// ciclos (calmaria, aviso, rajada) e empurra o carro para fora. `onBridges` cobre cada ponte sem mureta, onde a
// rajada pode jogar o carro no abismo; `count` trechos a mais vão em retas livres. Ver gustAt em track.js.
const GUST_MARGIN = 30, GUST_BRIDGE_EXTRA = 25;
function placeGusts(plan, placer, layout) {
  const random = placer.random, zones = [];
  if (plan.onBridges) for (const bridge of track.bridges) zones.push({ start: bridge.start - GUST_BRIDGE_EXTRA, length: bridge.length + GUST_BRIDGE_EXTRA * 2 });
  for (let n = 0; n < (plan.count ?? 0); n++) {
    const start = placer.seek(GUST_MARGIN, plan.length + GUST_MARGIN, 1 / 60);
    if (start === null) break;
    placer.reserve(start - GUST_MARGIN, start + plan.length + GUST_MARGIN);
    zones.push({ start, length: plan.length });
  }
  for (const zone of zones) {
    const gust = { ...zone, force: plan.force, period: plan.period * (0.85 + random() * 0.3), phase: random(), dir: random() < 0.5 ? -1 : 1 };
    track.gusts.push(gust);
    layout.gusts.push(gust);
  }
}

// Placas de turbo (`boosts`: { count, half }): faixas curtas sobre parte da pista que jogam o carro acima da
// velocidade máxima por um instante. Ficam em retas, numa faixa sorteada: quem quer o turbo sai da trajetória.
const BOOST_MARGIN = 50, BOOST_LENGTH = 9, BOOST_LANE = TRACK_WIDTH / 2 - 3;
function addBoost(layout, pad) {
  track.boosts.push(pad);
  layout.boosts.push(pad);
}
function placeBoosts(plan, placer, layout) {
  for (let n = 0; n < plan.count; n++) {
    const start = placer.seek(BOOST_MARGIN, BOOST_LENGTH + BOOST_MARGIN, 1 / 90);
    if (start === null) return;
    placer.reserve(start - BOOST_MARGIN, start + BOOST_LENGTH + BOOST_MARGIN);
    const half = plan.half ?? 2.6, lane = (placer.random() * 2 - 1) * (BOOST_LANE - half + 2);
    addBoost(layout, { start, length: BOOST_LENGTH, lane, half, jump: false });
  }
}

// Pontos de perigo (hazardKinds.js): retas livres, longe uns dos outros e dos trechos especiais. O de túnel fica
// logo depois da entrada de um túnel fechado (sem ser o escuro). `side`: de que lado da pista vem o perigo.
// `zone` (hazardKinds.js): só dentro desse trecho da pista (track.zones), com curva ou não. `travel`: o obstáculo anda
// pela pista; o ponto reserva a reta toda por onde ele vai, para não entrar em salto, túnel ou castelo.
const HAZARD_MARGIN = 45, HAZARD_MAX_CURVE = 1 / 70, TUNNEL_HAZARD_IN = 10, TRAVEL_MAX_CURVE = 1 / 30, BEFORE_CASTLE_STOP = 50;
function placeHazards(plans, placer, layout) {
  const random = placer.random;
  for (const { kind, count } of plans) {
    const tunnels = layout.tunnels.filter(tunnel => !tunnel.open && !tunnel.dark), type = HAZARD_KINDS[kind];
    for (let n = 0; n < count; n++) {
      let dist = null;
      if (type.atTunnel) {
        if (n < tunnels.length) dist = tunnels[n].start + TUNNEL_HAZARD_IN;
      } else if (type.zone) {
        const zone = track.zones[type.zone];
        dist = zone ? placer.seek(HAZARD_MARGIN, HAZARD_MARGIN, Infinity, zone) : null;
        if (dist !== null) placer.reserve(dist - HAZARD_MARGIN, dist + HAZARD_MARGIN);
      } else if (type.travel) {
        // A primeira vai pela estrada que chega ao castelo e para na beira pouco antes da ponte levadiça: quem vem
        // embalado para o salto tem de passar por ela. Fica nesse lugar fixo, sem sorteio (a reta da ponte já está
        // reservada pelo castelo).
        const castle = n === 0 && layout.epics.find(epic => epic.type === 'castle');
        const before = castle ? castle.start - BEFORE_CASTLE_STOP - type.travel : null;
        if (before !== null && before - HAZARD_MARGIN > START_CLEAR) {
          dist = before;
          placer.reserve(dist - HAZARD_MARGIN, castle.start);
        } else {
          dist = placer.seek(HAZARD_MARGIN, type.travel + HAZARD_MARGIN, TRAVEL_MAX_CURVE);
        }
        if (dist !== null) placer.reserve(dist - HAZARD_MARGIN, dist + type.travel + HAZARD_MARGIN);
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
  const layout = { tunnels: [], epics: [], hazards: [], storms: [], belts: [], gusts: [], boosts: [] };
  if (plan.castle) placeCastle(plan.castle, placer, layout);   // o castelo já tem lugar marcado no traçado: vem antes de tudo
  if (plan.twist) placeTwist(placer, layout);        // os trechos épicos pedem retas longas: escolhem primeiro
  if (!plan.castle) placeRiverJump(plan.jump ?? {}, placer, layout);   // no castelo, a ponte levadiça é o salto
  for (const bridge of [plan.bridge ?? []].flat()) placeBridge(bridge, placer, layout);   // uma ponte ou uma lista delas
  if (plan.dark) placeDarkTunnel(plan.dark, placer, layout);
  if (plan.storm) placeStorm(plan.storm, placer, layout);
  if (plan.belts) placeBelts(plan.belts, placer, layout);
  if (plan.gusts) placeGusts(plan.gusts, placer, layout);
  if (plan.boosts) placeBoosts(plan.boosts, placer, layout);
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
