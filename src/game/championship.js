// Competição em várias corridas. Cada pódio vale pontos: ouro 3, prata 1,5 e bronze 1; as demais posições não somam.
// Vence quem tiver mais pontos. Empate decide por mais ouros, depois mais pratas, depois mais bronzes e depois
// pela menor soma das posições em todas as corridas. Se ainda assim empatar, quem chegou melhor na última corrida fica na frente.

export const MEDAL_POINTS = { gold: 3, silver: 1.5, bronze: 1 };
export const pointsOf = ({ wins, silvers, bronzes }) => wins * MEDAL_POINTS.gold + silvers * MEDAL_POINTS.silver + bronzes * MEDAL_POINTS.bronze;

export function createMatch({ racerNames, raceCount }) {
  const table = new Map(racerNames.map(name => [name, { name, wins: 0, silvers: 0, bronzes: 0, totalPositions: 0, lastPosition: 0 }]));

  const match = {
    raceCount,
    racesDone: 0,
    lastOrder: null,                                 // nomes na ordem de chegada da última corrida
    biomesPlayed: [],                                // ids dos biomas já sorteados, em ordem (pickMatchBiome)
    upcomingBiome: null,                             // id do bioma da próxima corrida, já sorteado para avisar os pilotos entre as corridas
    // Quem chegou na frente larga na frente. Sem corrida anterior, não define.
    get nextGrid() { return match.lastOrder && [...match.lastOrder]; },
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

    // Para quem entra no meio da partida: o placar atual vai para ele e os nomes da lista nova assumem a tabela.
    // Quem é novo começa como se tivesse chegado em último em todas as corridas já feitas.
    snapshot() {
      return { racesDone: match.racesDone, lastOrder: match.lastOrder, biomesPlayed: match.biomesPlayed, upcomingBiome: match.upcomingBiome, entries: [...table.values()] };
    },
    restore(data, names) {
      match.racesDone = data.racesDone;
      match.biomesPlayed = [...(data.biomesPlayed ?? [])];
      match.upcomingBiome = data.upcomingBiome ?? null;
      match.lastOrder = data.lastOrder ? data.lastOrder.filter(name => names.includes(name)) : null;
      const old = new Map(data.entries.map(entry => [entry.name, entry]));
      table.clear();
      for (const name of names) {
        table.set(name, old.get(name) ?? { name, wins: 0, silvers: 0, bronzes: 0, totalPositions: data.racesDone * names.length, lastPosition: names.length });
      }
    },

    standings() {
      return [...table.values()].map(entry => ({ ...entry, points: pointsOf(entry) })).sort((a, b) =>
        b.points - a.points || b.wins - a.wins || b.silvers - a.silvers || b.bronzes - a.bronzes || a.totalPositions - b.totalPositions || a.lastPosition - b.lastPosition);
    },
  };
  return match;
}
