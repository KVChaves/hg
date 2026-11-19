// Atraso de um piloto para o líder, de 0 (na frente ou colado) a 1 (a FULL_AT_GAP metros ou mais). É a única medida usada
// pelas ajudas de equilíbrio (suprimentos da volta, NPC de estrada, recompensa de abate).
export const FULL_AT_GAP = 300;

export const leaderDist = field => field.reduce((best, racer) => Math.max(best, racer.dist), -Infinity);
export const gapToLeader = (racer, field) => Math.max(0, leaderDist(field) - racer.dist);
export const deficitOf = (racer, field) => Math.min(1, gapToLeader(racer, field) / FULL_AT_GAP);
