import { trackAt } from '../world/track.js';

// Voo de verdade nas rampas com física (track.jumps): o carro segue o chão enquanto o chão o segura e sai voando
// quando o chão cai mais rápido que a gravidade o puxaria. No ar ninguém controla nada: a trajetória é uma
// parábola, e só a velocidade na saída do bico decide até onde o carro vai.

// Gravidade da corrida: cada bioma pode mudar (`gravity`), como o espaço. Importar GRAVITY acompanha a mudança.
export let GRAVITY = 9.81;
export const setGravity = value => { GRAVITY = value; };
// Da hora em que a queda fica certa (abaixo da borda de pouso, descendo) até voltar à pista: cair e afundar
// cabem nesses segundos.
export const FALL_TIME = 3;
const TAKEOFF_TOLERANCE = 0.12;                      // metros: abaixo disso o chão ainda segura o carro (a posição na pista tem pequenos saltos entre amostras)
const LAND_STEP = 0.5;                               // chegar até esse tanto abaixo da borda ainda pousa (as rodas pegam)
export const FLOAT_DEPTH = 0.7;                      // o carro afundado fica com a cabine fora d'água
const SINK_RATE = 1.6;

// `ground`: altura do chão sob o carro, ou nulo onde não há chão (o vão sobre o rio).
// `groundRate`: quanto o chão sobe por segundo debaixo do carro (inclinação × velocidade ao longo da pista).
// Devolve 'ground', 'air', 'landed' (com `impact`, m/s de descida no toque) ou 'blocked' (bateu na face da margem).
export function stepFlight(state, ground, groundRate, dt) {
  if (!state.airborne) {
    const ballistic = state.y + state.vy * dt - GRAVITY * dt * dt / 2;
    if (ground !== null && ground >= ballistic - TAKEOFF_TOLERANCE) {
      state.y = ground;
      state.vy = groundRate;
      return 'ground';
    }
    state.airborne = true;
  }
  state.vy -= GRAVITY * dt;
  state.y += state.vy * dt;
  if (ground === null || state.y > ground) return 'air';
  if (state.y < ground - LAND_STEP) return 'blocked';
  state.impact = groundRate - state.vy;
  state.y = ground;
  state.vy = groundRate;
  state.airborne = false;
  return 'landed';
}

// Altura da borda que o carro precisaria alcançar: a outra margem do salto, ou o tampo da ponte onde ele está.
function edgeHeight(hazard, distance) {
  return trackAt(hazard.type === 'bridge' ? distance : hazard.gaps[0][1]).y;
}

// Já não dá para pousar: está descendo e abaixo da borda. A partir daqui conta o FALL_TIME.
export function fallIsCertain(state, hazard, distance) {
  return state.airborne && hazard !== null && state.vy < 0 && state.y < edgeHeight(hazard, distance) - LAND_STEP;
}

// Caindo: segue a parábola até a água e lá afunda devagar até boiar com a cabine de fora.
// Devolve verdadeiro no quadro em que o carro bate na água.
export function sinkStep(state, water, dt) {
  state.sunk = Math.max(0, state.sunk - dt);
  if (state.y > water) {
    state.vy -= GRAVITY * dt;
    state.y = Math.max(water, state.y + state.vy * dt);
    return state.y <= water;
  }
  state.vy = 0;
  state.y = Math.max(water - FLOAT_DEPTH, state.y - SINK_RATE * dt);
  return false;
}
