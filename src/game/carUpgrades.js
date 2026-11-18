// Peças que mudam o desempenho do carro: para-choque, pneus, vidro e suspensão. Cada variante tem preço
// (sai do mesmo orçamento da garagem) e efeitos próprios. Nenhuma mexe na velocidade máxima, na aceleração
// nem no nitro: elas trocam resistência, controle e utilidade.
//
// Os efeitos são multiplicadores: 1 não muda nada. Quem aplica cada um:
//   bullet   dano de bala (tiros de bots e de outros jogadores); limitado por BULLET_LIMIT
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
//   nitroDrain / nitroAccel / nitroTop   gasto, aceleração extra e velocidade final do nitro (escapamento)
//   nitroGrip  aderência lateral enquanto o nitro está aberto
//   driftCharge  fração do tanque de nitro que volta por segundo derrapando (soma, não multiplica)
//   blast        dano de explosão (em pontos de vida) que a batida causa em quem toca o para-choque (soma)
//   fireTrail    1 = o nitro deixa fogo na pista atrás do carro (soma, não multiplica)
// A chave de cada peça é a mesma do slot do carro (carOptions.js): a suspensão é `height`.

export const PART_KEYS = ['bumper', 'tire', 'glass', 'height', 'exhaust'];
export const DEFAULT_PARTS = { bumper: 'stock', tire: 'street', glass: 'clear', height: 'stock', exhaust: 'stock' };
export const BULLET_LIMIT = 0.5;                    // as peças juntas cortam no máximo 50% do dano de bala (a melhoria de vida vem por cima)
export const GRIP_LIMIT = 0.2;                       // as peças juntas mudam a aderência em no máximo 20%

export const CAR_PARTS = {
  bumper: {
    label: 'Para-choque', short: 'PARACHOQUE',
    variants: {
      stock: { name: 'Original', price: 0, summary: 'SEM EFEITO', stats: {} },
      sport: { name: 'Esportivo', price: 50, summary: '-15% DANO DE BATIDA', stats: { crash: 0.85 } },
      steel: { name: 'Aco', price: 130, summary: '-30% DANO DE BATIDA, -10% DANO DE BALA, -5% ADERENCIA', stats: { crash: 0.7, bullet: 0.9, grip: 0.95 } },
      ram: { name: 'Ariete', price: 60, summary: '-15% DANO DE BATIDA, QUEM VOCE BATE LEVA +70%', stats: { crash: 0.85, ram: 1.7, grip: 0.95 } },
      explosive: { name: 'Explosivo', price: 160, summary: 'BATIDA EXPLODE: +45 DE DANO EM QUEM VOCE BATE E 20 EM QUEM ESTA PERTO, -15% DANO DE BATIDA', stats: { crash: 0.85, blast: 45 } },
      absorber: { name: 'Absorvedor', price: 190, summary: '-45% DANO DE BATIDA, -10% DANO DE BALA', stats: { crash: 0.55, bullet: 0.9 } },
    },
  },
  tire: {
    label: 'Pneus', short: 'PNEU',
    variants: {
      street: { name: 'Rua', price: 0, summary: 'SEM EFEITO', stats: {} },
      wide: { name: 'Largo', price: 110, summary: '+12% ADERENCIA, OLEO MENOS TRAICOEIRO, FORA DA PISTA FREIA +30%', stats: { grip: 1.12, oil: 1.5, offroad: 1.3 } },
      offroad: { name: 'Off-road', price: 70, summary: 'FORA DA PISTA FREIA 60% MENOS, -5% ADERENCIA', stats: { offroad: 0.4, grip: 0.95 } },
      big: { name: 'Gigante run-flat', price: 80, summary: 'PNEU FURADO DURA E ATRAPALHA METADE, -10% DANO DE BALA, -5% ADERENCIA', stats: { punctureTime: 0.5, punctureEffect: 0.5, bullet: 0.9, grip: 0.95 } },
      slim: { name: 'Fino', price: 50, summary: 'ADERE NO GELO E NO OLEO, -10% ADERENCIA NO SECO', stats: { ice: 2.2, oil: 1.8, grip: 0.9 } },
    },
  },
  glass: {
    label: 'Vidros', short: 'VIDRO',
    variants: {
      clear: { name: 'Comum', price: 0, summary: 'SEM EFEITO', stats: {} },
      light: { name: 'Anti-tinta', price: 45, summary: 'TINTA DURA 35% MENOS', stats: { paint: 0.65 } },
      medium: { name: 'Fume', price: 35, summary: 'FUMACA DURA 35% MENOS', stats: { smoke: 0.65 } },
      dark: { name: 'Blindado', price: 160, summary: '-20% DANO DE BALA, -65% RACHADURAS, TINTA -20%, ESCURECE A VISAO', stats: { bullet: 0.8, crack: 0.35, paint: 0.8 } },
      black: { name: 'Preto total', price: 70, summary: 'TINTA E FUMACA -50%, VISAO MUITO RUIM', stats: { paint: 0.5, smoke: 0.5 } },
    },
  },
  height: {
    label: 'Suspensao', short: 'SUSPENSAO',
    variants: {
      slammed: { name: 'Rebaixada total', price: 60, summary: '+10% ADERENCIA, FORA DA PISTA FREIA +50%, POUSO +50% DANO', stats: { grip: 1.1, offroad: 1.5, landing: 1.5 } },
      low: { name: 'Rebaixada', price: 35, summary: '+5% ADERENCIA, FORA DA PISTA FREIA +20%, POUSO +15% DANO', stats: { grip: 1.05, offroad: 1.2, landing: 1.15 } },
      stock: { name: 'Original', price: 0, summary: 'SEM EFEITO', stats: {} },
      high: { name: 'Elevada', price: 55, summary: 'FORA DA PISTA FREIA 35% MENOS, POUSO -30% DANO, TOMBA MAIS FACIL', stats: { offroad: 0.65, landing: 0.7, grip: 0.95, tip: 1.25 } },
      lifted: { name: 'Rally', price: 120, summary: 'FORA DA PISTA FREIA 60% MENOS, POUSO -50% DANO, -10% DANO DE BALA (PROTECAO DE CARTER), TOMBA MAIS FACIL', stats: { offroad: 0.4, landing: 0.5, bullet: 0.9, grip: 0.9, tip: 1.4 } },
    },
  },
  // Escapamento: não mexe na velocidade normal, só no jeito que o nitro funciona.
  exhaust: {
    label: 'Escapamento', short: 'ESCAPE',
    variants: {
      stock: { name: 'Original', price: 0, summary: 'SEM EFEITO', stats: {} },
      muffled: { name: 'Abafado', price: 50, summary: 'NITRO GASTA 25% MENOS, VELOCIDADE FINAL DO NITRO -6%', stats: { nitroDrain: 0.75, nitroTop: 0.94 } },
      sport: { name: 'Esportivo', price: 80, summary: 'NITRO ACELERA +30%, GASTA +10%', stats: { nitroAccel: 1.3, nitroDrain: 1.1 } },
      drift: { name: 'Coletor', price: 100, summary: 'DERRAPANDO RECARREGA 12% DO NITRO POR SEGUNDO, NITRO ACELERA -10%', stats: { driftCharge: 0.12, nitroAccel: 0.9 } },
      turbo: { name: 'Turbo duplo', price: 130, summary: 'NITRO ACELERA +50%, VELOCIDADE FINAL +6%, GASTA +30%, -15% ADERENCIA COM NITRO', stats: { nitroAccel: 1.5, nitroTop: 1.06, nitroDrain: 1.3, nitroGrip: 0.85 } },
      explosive: { name: 'Explosivo', price: 150, summary: 'NITRO DEIXA FOGO NA PISTA ATRAS DO CARRO, GASTA +25%', stats: { fireTrail: 1, nitroDrain: 1.25 } },
    },
  },
};

const NEUTRAL = { bullet: 1, crash: 1, ram: 1, grip: 1, offroad: 1, punctureTime: 1, punctureEffect: 1, oil: 1, ice: 1, landing: 1, tip: 1, paint: 1, smoke: 1, crack: 1, nitroDrain: 1, nitroAccel: 1, nitroTop: 1, nitroGrip: 1, driftCharge: 0, fireTrail: 0, blast: 0 };

export const partPrice = (key, id) => CAR_PARTS[key].variants[id]?.price ?? 0;
export const partsCost = parts => PART_KEYS.reduce((sum, key) => sum + partPrice(key, parts?.[key] ?? DEFAULT_PARTS[key]), 0);
export const isPartId = (key, id) => Boolean(CAR_PARTS[key].variants[id]);

// Efeitos somados das peças escolhidas (`parts` é { bumper, tire, glass, height }); o que não aparece fica neutro.
export function partStats(parts = DEFAULT_PARTS) {
  const stats = { ...NEUTRAL };
  for (const key of PART_KEYS) {
    const variant = CAR_PARTS[key].variants[parts[key]] ?? CAR_PARTS[key].variants[DEFAULT_PARTS[key]];
    for (const [name, value] of Object.entries(variant.stats)) stats[name] = NEUTRAL[name] === 0 ? stats[name] + value : stats[name] * value;
  }
  stats.bullet = Math.max(1 - BULLET_LIMIT, stats.bullet);
  stats.grip = Math.max(1 - GRIP_LIMIT, Math.min(1 + GRIP_LIMIT, stats.grip));
  return stats;
}

// Só o para-choque importa para quem o vê de fora: o dano que ele causa ao bater.
export const ramOf = bumperId => CAR_PARTS.bumper.variants[bumperId]?.stats.ram ?? 1;

export const blastOf = bumperId => CAR_PARTS.bumper.variants[bumperId]?.stats.blast ?? 0;

export const NEUTRAL_STATS = NEUTRAL;
