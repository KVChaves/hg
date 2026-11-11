// Peças que mudam o desempenho do carro: para-choque, pneus, vidro e suspensão. Cada variante tem preço
// (sai do mesmo orçamento da garagem) e efeitos próprios. Nenhuma mexe na velocidade máxima, na aceleração
// nem no nitro: elas trocam resistência, controle e utilidade.
//
// Os efeitos são multiplicadores: 1 não muda nada. Quem aplica cada um:
//   crash    dano que o carro leva em batida (parede, obstáculo, outro carro)
//   ram      dano que o outro carro leva ao bater neste
//   grip     aderência em curva (soma das peças, limitada por GRIP_LIMIT)
//   offroad  quanto o carro freia fora da pista
//   punctureTime / punctureEffect   duração do pneu furado e o quanto ele atrapalha
//   oil / ice   aderência no óleo e no gelo
//   landing  dano de pouso depois de saltos
//   tip      facilidade de tombar numa pancada
//   paint / smoke   duração da tinta e da fumaça no vidro
//   crack    rachaduras do para-brisa por capotagem
// A chave de cada peça é a mesma do slot do carro (carOptions.js): a suspensão é `height`.

export const PART_KEYS = ['bumper', 'tire', 'glass', 'height'];
export const DEFAULT_PARTS = { bumper: 'stock', tire: 'street', glass: 'clear', height: 'stock' };
export const GRIP_LIMIT = 0.2;                       // as peças juntas mudam a aderência em no máximo 20%

export const CAR_PARTS = {
  bumper: {
    label: 'Para-choque', short: 'PARACHOQUE',
    variants: {
      stock: { name: 'Original', price: 0, summary: 'SEM EFEITO', stats: {} },
      sport: { name: 'Esportivo', price: 40, summary: '-10% DANO DE BATIDA', stats: { crash: 0.9 } },
      steel: { name: 'Aco', price: 90, summary: '-30% DANO DE BATIDA, -5% ADERENCIA', stats: { crash: 0.7, grip: 0.95 } },
      ram: { name: 'Ariete', price: 70, summary: '-15% DANO DE BATIDA, QUEM VOCE BATE LEVA +50%', stats: { crash: 0.85, ram: 1.5, grip: 0.95 } },
      absorber: { name: 'Absorvedor', price: 150, summary: '-45% DANO DE BATIDA', stats: { crash: 0.55 } },
    },
  },
  tire: {
    label: 'Pneus', short: 'PNEU',
    variants: {
      street: { name: 'Rua', price: 0, summary: 'SEM EFEITO', stats: {} },
      wide: { name: 'Largo', price: 130, summary: '+12% ADERENCIA, OLEO MENOS TRAICOEIRO, FORA DA PISTA FREIA +30%', stats: { grip: 1.12, oil: 1.5, offroad: 1.3 } },
      offroad: { name: 'Off-road', price: 80, summary: 'FORA DA PISTA FREIA 60% MENOS, -8% ADERENCIA', stats: { offroad: 0.4, grip: 0.92 } },
      big: { name: 'Gigante run-flat', price: 70, summary: 'PNEU FURADO DURA E ATRAPALHA METADE, -5% ADERENCIA', stats: { punctureTime: 0.5, punctureEffect: 0.5, grip: 0.95 } },
      slim: { name: 'Fino', price: 60, summary: 'ADERE NO GELO E NO OLEO, -10% ADERENCIA NO SECO', stats: { ice: 2.2, oil: 1.8, grip: 0.9 } },
    },
  },
  glass: {
    label: 'Vidros', short: 'VIDRO',
    variants: {
      clear: { name: 'Comum', price: 0, summary: 'SEM EFEITO', stats: {} },
      light: { name: 'Anti-tinta', price: 60, summary: 'TINTA DURA 35% MENOS', stats: { paint: 0.65 } },
      medium: { name: 'Fume', price: 40, summary: 'FUMACA DURA 35% MENOS', stats: { smoke: 0.65 } },
      dark: { name: 'Blindado', price: 90, summary: '-70% RACHADURAS, TINTA -20%, ESCURECE A VISAO', stats: { crack: 0.3, paint: 0.8 } },
      black: { name: 'Preto total', price: 90, summary: 'TINTA E FUMACA -50%, VISAO MUITO RUIM', stats: { paint: 0.5, smoke: 0.5 } },
    },
  },
  height: {
    label: 'Suspensao', short: 'SUSPENSAO',
    variants: {
      slammed: { name: 'Rebaixada total', price: 70, summary: '+10% ADERENCIA, FORA DA PISTA FREIA +50%, POUSO +40% DANO', stats: { grip: 1.1, offroad: 1.5, landing: 1.4 } },
      low: { name: 'Rebaixada', price: 40, summary: '+5% ADERENCIA, FORA DA PISTA FREIA +20%, POUSO +15% DANO', stats: { grip: 1.05, offroad: 1.2, landing: 1.15 } },
      stock: { name: 'Original', price: 0, summary: 'SEM EFEITO', stats: {} },
      high: { name: 'Elevada', price: 60, summary: 'FORA DA PISTA FREIA 35% MENOS, POUSO -30% DANO, TOMBA MAIS FACIL', stats: { offroad: 0.65, landing: 0.7, grip: 0.95, tip: 1.25 } },
      lifted: { name: 'Rally', price: 110, summary: 'FORA DA PISTA FREIA 60% MENOS, POUSO -50% DANO, TOMBA BEM MAIS FACIL', stats: { offroad: 0.4, landing: 0.5, grip: 0.9, tip: 1.5 } },
    },
  },
};

const NEUTRAL = { crash: 1, ram: 1, grip: 1, offroad: 1, punctureTime: 1, punctureEffect: 1, oil: 1, ice: 1, landing: 1, tip: 1, paint: 1, smoke: 1, crack: 1 };

export const partPrice = (key, id) => CAR_PARTS[key].variants[id]?.price ?? 0;
export const partsCost = parts => PART_KEYS.reduce((sum, key) => sum + partPrice(key, parts?.[key] ?? DEFAULT_PARTS[key]), 0);
export const isPartId = (key, id) => Boolean(CAR_PARTS[key].variants[id]);

// Efeitos somados das peças escolhidas (`parts` é { bumper, tire, glass, height }); o que não aparece fica neutro.
export function partStats(parts = DEFAULT_PARTS) {
  const stats = { ...NEUTRAL };
  for (const key of PART_KEYS) {
    const variant = CAR_PARTS[key].variants[parts[key]] ?? CAR_PARTS[key].variants[DEFAULT_PARTS[key]];
    for (const [name, value] of Object.entries(variant.stats)) stats[name] *= value;
  }
  stats.grip = Math.max(1 - GRIP_LIMIT, Math.min(1 + GRIP_LIMIT, stats.grip));
  return stats;
}

// Só o para-choque importa para quem o vê de fora: o dano que ele causa ao bater.
export const ramOf = bumperId => CAR_PARTS.bumper.variants[bumperId]?.stats.ram ?? 1;

export const NEUTRAL_STATS = NEUTRAL;
