// Atraso de um piloto para o líder, de 0 a 1. É a única medida usada pelas ajudas de equilíbrio (suprimentos da volta,
// NPC de estrada, recompensa de abate). Quanto mais longe do líder, maior a ajuda. A ajuda mira deixar o piloto a
// TARGET_NEAR..TARGET_FAR metros do líder (distância em que ainda se enxergam): nessa faixa ela fica moderada (AT_TARGET),
// cresce além dela até o máximo em HELP_FULL, e abaixo de TARGET_NEAR diminui até sumir em HELP_FROM.
export const HELP_FROM = 30, TARGET_NEAR = 90, TARGET_FAR = 110, HELP_FULL = 200, AT_TARGET = 0.5;

export const helpStrength = gap => {
  if (gap <= HELP_FROM) return 0;
  if (gap < TARGET_NEAR) return AT_TARGET * (gap - HELP_FROM) / (TARGET_NEAR - HELP_FROM);
  if (gap <= TARGET_FAR) return AT_TARGET;
  return AT_TARGET + (1 - AT_TARGET) * Math.min(1, (gap - TARGET_FAR) / (HELP_FULL - TARGET_FAR));
};

export const leaderDist = field => field.reduce((best, racer) => Math.max(best, racer.dist), -Infinity);
export const gapToLeader = (racer, field) => Math.max(0, leaderDist(field) - racer.dist);
export const deficitOf = (racer, field) => helpStrength(gapToLeader(racer, field));
