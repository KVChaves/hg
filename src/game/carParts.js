// Dano por parte do carro: o dano geral continua o da arma; pneu e capô levam mais.

export const PART_DAMAGE = {
  tire: { multiplier: 2, label: 'PNEU' },
  hood: { multiplier: 1.5, label: 'CAPO' },
  body: { multiplier: 1, label: null },
};

const HOOD_MAX_Z = -0.7, HOOD_MIN_Y = 0.5;      // no modelo a frente é z negativo; o capô é a parte alta da frente
const BOT_TIRE_CHANCE = 0.2, BOT_HOOD_CHANCE = 0.15;

// `object` é a malha atingida e `local` o ponto do tiro no espaço do carro.
export function partHit(object, local) {
  if (object.userData.side !== undefined) return PART_DAMAGE.tire;          // só as rodas têm `side`
  if (local.z < HOOD_MAX_Z && local.y > HOOD_MIN_Y) return PART_DAMAGE.hood;
  return PART_DAMAGE.body;
}

// Os bots não miram numa parte: sorteiam onde o tiro acertou.
export function rollPart() {
  const roll = Math.random();
  if (roll < BOT_TIRE_CHANCE) return PART_DAMAGE.tire;
  if (roll < BOT_TIRE_CHANCE + BOT_HOOD_CHANCE) return PART_DAMAGE.hood;
  return PART_DAMAGE.body;
}
