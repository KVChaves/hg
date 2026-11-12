// Os pilotos logo à frente e logo atrás do jogador na classificação e quantos metros de pista os separam.
// Nulo quando não faz sentido mostrar (antes da largada, depois de cruzar a linha, carro destruído).

export function findRivals(race, opponents, car) {
  if (!race.started || race.crossed || car.wrecked > 0 || !race.order.length) return null;
  const { order, rank } = race;
  const visible = entry => entry && opponents.some(op => op.name === entry.name && op.group.visible);
  const ahead = rank > 1 ? order[rank - 2] : null, behind = rank < order.length ? order[rank] : null;
  return {
    ahead: visible(ahead) ? { meters: ahead.progress - race.playerDist } : null,
    behind: visible(behind) ? { meters: race.playerDist - behind.progress } : null,
  };
}
