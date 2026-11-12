import { HEALTH_METERS } from './healthMeters.js';
import { CABIN_COLORS } from './cabinColors.js';
import { CHARMS } from './charms.js';
import { NITROS } from './nitros.js';
import { SHIFTERS } from './shifters.js';
import { WHEELS } from './wheels.js';

// Catálogo de peças trocáveis. Para adicionar uma opção, basta uma entrada no arquivo da peça.
export const PARTS = {
  wheel: { label: 'Volante', options: WHEELS, default: 'bullSkull' },
  health: { label: 'Indicador de vida', options: HEALTH_METERS, default: 'bar' },
  shifter: { label: 'Câmbio', options: SHIFTERS, default: 'classic' },
  nitro: { label: 'Cilindro de nitro', options: NITROS, default: 'standard' },
  charm: { label: 'Enfeite do retrovisor', options: CHARMS, default: 'cross' },
  cabinColor: { label: 'Cor da cabine', options: CABIN_COLORS, default: 'standard' },
};
