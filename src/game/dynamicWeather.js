import { createRandom } from '../world/track.js';

// Clima dinâmico: em algumas corridas (nem todas) o tempo muda no meio da prova. O sorteio sai só da semente da
// corrida e o andamento do relógio dela (`race.time`), então todos os jogadores de uma sala veem a mesma coisa
// ao mesmo tempo. É independente das zonas de clima pesado fixas de cada bioma (tempestade de areia, maré...).
//
//   grip    aderência da pista no auge do evento (1 = normal); vale para o jogador e para os bots
//   fog     neblina [perto, longe] no auge; `color` é a cor dela; `dim`: o quanto o céu escurece
//   precip  'rain' ou 'snow': o que cai na tela

export const WEATHER_TYPES = {
  rain: { id: 'rain', label: 'CHUVA', warning: 'CHUVA: PISTA ESCORREGADIA', grip: 0.78, fog: [10, 120], color: 0x5c6670, dim: 0.35, precip: 'rain' },
  snow: { id: 'snow', label: 'NEVASCA', warning: 'NEVASCA: PISTA ESCORREGADIA', grip: 0.82, fog: [8, 80], color: 0xdfe8f2, dim: 0.1, precip: 'snow' },
  fog: { id: 'fog', label: 'NEBLINA', warning: 'NEBLINA: VISAO CURTA', grip: 0.95, fog: [4, 55], color: 0xc4ccd2, dim: 0.15, precip: null },
};

export const WEATHER_CHANCE = 0.4;                    // chance de uma corrida ter um evento de clima
const START_RANGE = [18, 70];                         // segundos de corrida até o clima começar (sorteado entre esses dois)
const DURATION_RANGE = [40, 85];                      // quanto dura no auge
const FADE_TIME = 7;                                  // segundos para chegar ao auge e para voltar ao normal

// Tipos possíveis por bioma; os que não aparecem aqui aceitam chuva e neblina. Lista vazia = nunca muda.
const BY_BIOME = {
  space: [], fireFactory: [],
  winterMountain: ['snow', 'fog'],
  jungle: ['fog'], neonTokyo: ['fog'], stormSwamp: ['fog'],     // já chove o tempo todo
};
const DEFAULT_TYPES = ['rain', 'fog'];

// Plano do clima de uma corrida: { type, start, duration } ou null (sem evento). Sempre o mesmo para a mesma semente.
export function rollWeather(biomeId, seed) {
  const types = BY_BIOME[biomeId] ?? DEFAULT_TYPES;
  const random = createRandom(seed + 91);
  const happens = random() < WEATHER_CHANCE, pick = random(), start = random(), duration = random();
  if (!happens || !types.length) return null;
  return {
    type: WEATHER_TYPES[types[Math.floor(pick * types.length)]],
    start: START_RANGE[0] + start * (START_RANGE[1] - START_RANGE[0]),
    duration: DURATION_RANGE[0] + duration * (DURATION_RANGE[1] - DURATION_RANGE[0]),
  };
}

// Quanto do clima está ativo agora (0 a 1) no instante `time` da corrida.
export function weatherLevel(plan, time) {
  if (!plan) return 0;
  const into = time - plan.start;
  if (into <= 0 || into >= plan.duration + FADE_TIME * 2) return 0;
  return Math.max(0, Math.min(1, into / FADE_TIME, (plan.duration + FADE_TIME * 2 - into) / FADE_TIME));
}
