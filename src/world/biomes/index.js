import { BEACH } from './beach.js';
import { DESERT } from './desert.js';
import { FIRE_FACTORY } from './fireFactory.js';
import { FOREST } from './forest.js';
import { JUNGLE } from './jungle.js';
import { KINGS_ROAD } from './kingsRoad.js';
import { NEON_TOKYO } from './neonTokyo.js';
import { PIRATE_PORT } from './piratePort.js';
import { SPACE } from './space.js';
import { SALT_FLATS } from './saltFlats.js';
import { STADIUM } from './stadium.js';
import { STORM_SWAMP } from './stormSwamp.js';
import { WIND_CANYON } from './windCanyon.js';
import { WINTER_MOUNTAIN } from './winterMountain.js';

// Para criar um bioma novo, basta um arquivo como estes e uma entrada aqui.
export const BIOMES = [JUNGLE, FOREST, FIRE_FACTORY, NEON_TOKYO, STADIUM, WINTER_MOUNTAIN, DESERT, BEACH, SPACE, WIND_CANYON, SALT_FLATS, STORM_SWAMP, KINGS_ROAD, PIRATE_PORT];

// Opções da votação do próximo mapa (multiplayer): até `count` biomas ainda não jogados nesta rodada, sorteados.
// Mesma regra de pickMatchBiome, mas nada é marcado como jogado: isso só acontece quando a votação termina.
export function voteCandidates(played, count = 3) {
  const cycle = played.slice(played.length - played.length % BIOMES.length), last = played.at(-1);
  let options = BIOMES.filter(biome => !cycle.includes(biome.id) && biome.id !== last);
  if (!options.length) options = BIOMES.filter(biome => !cycle.includes(biome.id));
  const shuffled = [...options].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Bioma da próxima corrida do campeonato: nenhum se repete até todos terem saído. Aí começa outra rodada
// (sem repetir o da corrida anterior logo em seguida). `played`: ids já corridos, em ordem; recebe o sorteado.
export function pickMatchBiome(played) {
  const cycle = played.slice(played.length - played.length % BIOMES.length), last = played.at(-1);
  let options = BIOMES.filter(biome => !cycle.includes(biome.id) && biome.id !== last);
  if (!options.length) options = BIOMES.filter(biome => !cycle.includes(biome.id));
  const biome = options[Math.floor(Math.random() * options.length)];
  played.push(biome.id);
  return biome;
}
