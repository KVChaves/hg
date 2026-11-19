// Recompensa por abate. O abate já é uma vantagem por si só, então o bônus é pequeno e quem está atrás só ganha um pouco mais:
// o nitro e a munição maiores vêm dos suprimentos da volta e do NPC de estrada. Derrubar o líder rende um extra, porque fecha a distância.

const AMMO_BASE = 0.3, AMMO_BEHIND = 0.4;         // fração da reserva padrão
const BEHIND_FROM = 0.34, FAR_BEHIND_FROM = 0.67;  // atraso (0 a 1, ver deficit.js) a partir do qual conta como atrás / muito atrás
const NITRO_FAR_BEHIND = 0.2, NITRO_LEADER_KILL = 0.3;

// `supplies` é o que roadsideHelp.suppliesFor(piloto) devolve; `deficit` é o atraso de quem abateu para o líder;
// `victimLeads` diz se a vítima era o líder. Entrega os itens e devolve os nomes.
export function giveKillReward(supplies, { deficit, victimLeads }) {
  const labels = [];

  supplies.give.ammo({ amount: deficit >= BEHIND_FROM ? AMMO_BEHIND : AMMO_BASE });
  labels.push('MUNICAO');

  if (deficit >= BEHIND_FROM && supplies.hasTraps()) {
    const slot = supplies.pickTrap();
    supplies.give.trap({ slot });
    labels.push(slot.type.label);
  }
  const nitro = (deficit >= FAR_BEHIND_FROM ? NITRO_FAR_BEHIND : 0) + (victimLeads && deficit > 0 ? NITRO_LEADER_KILL : 0);
  if (nitro > 0) {
    supplies.give.nitro({ amount: nitro });
    labels.push(`NITRO ${Math.round(nitro * 100)}%`);
  }
  if (deficit >= FAR_BEHIND_FROM && supplies.levels().extinguisher < 1) {
    supplies.give.extinguisher();
    labels.push('EXTINTOR');
  }
  return labels;
}
