import { FIRE_FACTORY } from './fireFactory.js';
import { FOREST } from './forest.js';
import { JUNGLE } from './jungle.js';
import { NEON_TOKYO } from './neonTokyo.js';
import { STADIUM } from './stadium.js';
import { WINTER_MOUNTAIN } from './winterMountain.js';

// Para criar um bioma novo, basta um arquivo como estes e uma entrada aqui.
export const BIOMES = [JUNGLE, FOREST, FIRE_FACTORY, NEON_TOKYO, STADIUM, WINTER_MOUNTAIN];

export function pickBiome(previous) {
  const options = BIOMES.filter(biome => biome !== previous);
  return options[Math.floor(Math.random() * options.length)];
}
