// Recompensa por abate: o que o jogador ganha depende da posição na corrida.
// Quem lidera ganha pouco (munição); quem está atrás ganha o que ajuda a recuperar o terreno.

const MID_FROM = 0.34, BACK_FROM = 0.67;          // fração da posição (0 = líder, 1 = último)
const AMMO_LEADER = 0.35, AMMO_OTHERS = 0.5, NITRO_BACK = 0.5;

// `supplies` é o que roadsideHelp.suppliesFor(jogador) devolve. Entrega os itens e devolve os nomes.
export function giveKillReward(supplies, rank, fieldSize) {
  const place = fieldSize > 1 ? (rank - 1) / (fieldSize - 1) : 0;
  const labels = [];

  supplies.give.ammo({ amount: place < MID_FROM ? AMMO_LEADER : AMMO_OTHERS });
  labels.push('MUNICAO');

  if (place >= MID_FROM && supplies.hasTraps()) {
    const slot = supplies.pickTrap();
    supplies.give.trap({ slot });
    labels.push(slot.type.label);
  }
  if (place >= BACK_FROM) {
    supplies.give.nitro({ amount: NITRO_BACK });
    labels.push(`NITRO ${Math.round(NITRO_BACK * 100)}%`);
    if (supplies.levels().extinguisher < 1) {
      supplies.give.extinguisher();
      labels.push('EXTINTOR');
    }
  }
  return labels;
}
