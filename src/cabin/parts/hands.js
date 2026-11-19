import { handThumb } from '../../ui/handArt.js';

// Mãos do piloto. Só aparência: a arte de cada estilo fica em ui/handArt.js (HAND_STYLES).
const hand = (id, name, detail) => ({ name, detail, image: () => handThumb(id) });

export const HANDS = {
  glove: hand('glove', 'Luva de piloto', 'A MAO PADRAO'),
  demon: hand('demon', 'Demoniaca', 'GARRAS PRETAS E BRASA NAS RACHADURAS'),
  werewolf: hand('werewolf', 'Lobisomem', 'PELO, GARRAS E MANGA RASGADA'),
  android: hand('android', 'Android', 'METAL SEGMENTADO E LEDS PISCANDO'),
  ghost: hand('ghost', 'Fantasma', 'TRANSLUCIDA E SEMPRE FALHANDO'),
};
