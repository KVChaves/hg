// Competição em várias corridas. Vence quem ganhar mais corridas; empate decide pelos segundos lugares,
// depois pelos terceiros e depois pela menor soma das posições em todas as corridas.
// Se ainda assim empatar, quem chegou melhor na última corrida fica na frente.

export function createMatch({ racerNames, raceCount }) {
  const table = new Map(racerNames.map(name => [name, { name, wins: 0, silvers: 0, bronzes: 0, totalPositions: 0, lastPosition: 0 }]));

  const match = {
    raceCount,
    racesDone: 0,
    lastOrder: null,                                 // nomes na ordem de chegada da última corrida
    // Largada invertida: quem chegou por último larga na frente. Sem corrida anterior, não define.
    get nextGrid() { return match.lastOrder && [...match.lastOrder].reverse(); },
    get currentRace() { return Math.min(match.racesDone + 1, raceCount); },
    get isOver() { return match.racesDone >= raceCount; },

    recordRace(order) {
      order.forEach((name, position) => {
        const entry = table.get(name);
        entry.lastPosition = position + 1;
        entry.totalPositions += position + 1;
        if (position === 0) entry.wins++;
        if (position === 1) entry.silvers++;
        if (position === 2) entry.bronzes++;
      });
      match.lastOrder = [...order];
      match.racesDone++;
    },

    // O jogador trocou de nome entre as corridas: os pontos continuam com ele.
    renameRacer(oldName, newName) {
      const entry = table.get(oldName);
      if (!entry) return;
      table.delete(oldName);
      entry.name = newName;
      table.set(newName, entry);
      if (match.lastOrder) match.lastOrder = match.lastOrder.map(name => (name === oldName ? newName : name));
    },

    standings() {
      return [...table.values()].sort((a, b) =>
        b.wins - a.wins || b.silvers - a.silvers || b.bronzes - a.bronzes || a.totalPositions - b.totalPositions || a.lastPosition - b.lastPosition);
    },
  };
  return match;
}
