// Competição em várias corridas. Cada pódio vale pontos: ouro 3, prata 1,5 e bronze 1; as demais posições não somam.
// Vence quem tiver mais pontos. Empate decide por mais ouros, depois mais pratas, depois mais bronzes e depois
// pela menor soma das posições em todas as corridas. Se ainda assim empatar, quem chegou melhor na última corrida fica na frente.
// Os abates não valem pontos: ficam guardados por corrida (`killsByRace`) só para a tabela mostrar quem mais destruiu.

export const MEDAL_POINTS = { gold: 3, silver: 1.5, bronze: 1 };
export const pointsOf = ({ wins, silvers, bronzes }) => wins * MEDAL_POINTS.gold + silvers * MEDAL_POINTS.silver + bronzes * MEDAL_POINTS.bronze;

function sortStandings(entries) {
  return entries.map(entry => ({ ...entry, points: pointsOf(entry) })).sort((a, b) =>
    b.points - a.points || b.wins - a.wins || b.silvers - a.silvers || b.bronzes - a.bronzes || a.totalPositions - b.totalPositions || a.lastPosition - b.lastPosition);
}

export function createMatch({ racerNames, raceCount }) {
  const blank = (name, extra = {}) => ({ name, wins: 0, silvers: 0, bronzes: 0, totalPositions: 0, lastPosition: 0, killsByRace: [], ...extra });
  const table = new Map(racerNames.map(name => [name, blank(name)]));

  const match = {
    raceCount,
    racesDone: 0,
    lastOrder: null,                                 // nomes na ordem de chegada da última corrida
    biomesPlayed: [],                                // ids dos biomas já sorteados, em ordem (pickMatchBiome)
    upcomingBiome: null,                             // id do bioma da próxima corrida, já sorteado para avisar os pilotos entre as corridas
    weaponCycle: { seen: [], last: [] },             // sorteio de armas (game/weaponDraft.js): já mostradas no ciclo e a mesa anterior
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

    // Abates de cada piloto na corrida `index` (0 é a primeira), a partir de { nome → abates }. Gravar de novo a mesma
    // corrida substitui a anterior, então dá para gravar o parcial e depois o final sem contar duas vezes.
    setRaceKills(index, kills) {
      for (const entry of table.values()) entry.killsByRace[index] = kills.get(entry.name) ?? 0;
    },

    // Abates de um piloto na partida. `skipRace` deixa uma corrida de fora (a que ainda está sendo contada ao vivo).
    killsOf(name, skipRace = null) {
      return (table.get(name)?.killsByRace ?? []).reduce((sum, kills, i) => (i === skipRace ? sum : sum + (kills ?? 0)), 0);
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
      return { racesDone: match.racesDone, lastOrder: match.lastOrder, biomesPlayed: match.biomesPlayed, upcomingBiome: match.upcomingBiome, weaponCycle: match.weaponCycle, entries: [...table.values()] };
    },
    restore(data, names) {
      match.racesDone = data.racesDone;
      match.biomesPlayed = [...(data.biomesPlayed ?? [])];
      match.upcomingBiome = data.upcomingBiome ?? null;
      match.weaponCycle = { seen: [...(data.weaponCycle?.seen ?? [])], last: [...(data.weaponCycle?.last ?? [])] };
      match.lastOrder = data.lastOrder ? data.lastOrder.filter(name => names.includes(name)) : null;
      const old = new Map(data.entries.map(entry => [entry.name, entry]));
      table.clear();
      for (const name of names) {
        const entry = old.get(name);
        // Snapshot de uma versão sem abates: começa a contar do zero.
        table.set(name, entry ? { ...entry, killsByRace: [...(entry.killsByRace ?? [])].map(kills => kills ?? 0) } : blank(name, { totalPositions: data.racesDone * names.length, lastPosition: names.length }));
      }
    },

    // Classificação antes da última corrida, para mostrar quem subiu e quem caiu. Nula antes da segunda corrida.
    standingsBefore() {
      if (match.racesDone < 2) return null;
      const undo = entry => {
        const p = entry.lastPosition;
        return { ...entry, wins: entry.wins - (p === 1), silvers: entry.silvers - (p === 2), bronzes: entry.bronzes - (p === 3), totalPositions: entry.totalPositions - p };
      };
      return sortStandings([...table.values()].map(undo));
    },

    standings() {
      return sortStandings([...table.values()]);
    },
  };
  return match;
}
