// Recompensa por abate. O abate já é uma vantagem por si só, então o bônus é pequeno e quem está atrás só ganha um pouco mais:
// o nitro e a munição maiores vêm dos suprimentos da volta e do NPC de estrada. Derrubar o líder rende um extra, porque fecha a distância.

const AMMO_BASE = 0.3, AMMO_BEHIND = 0.4;         // fração da reserva padrão
const BEHIND_FROM = 0.34, FAR_BEHIND_FROM = 0.67;  // atraso (0 a 1, ver deficit.js) a partir do qual conta como atrás / muito atrás
const NITRO_FAR_BEHIND = 0.2, NITRO_LEADER_KILL = 0.3;
// Sequência de abates sem morrer: cada abate seguido soma este bônus (até STREAK_CAP abates seguidos).
const STREAK_AMMO = 0.1, STREAK_LIFE = 0.05, STREAK_NITRO = 0.1, STREAK_CAP = 6, LEADER_NITRO_SHARE = 0.25;   // quem lidera recebe só esta parte do nitro da sequência
const LIFE_BASE = 0.1, LIFE_BEHIND = 0.15;         // fração da vida total devolvida a quem abateu

// `supplies` é o que roadsideHelp.suppliesFor(piloto) devolve; `deficit` é o atraso de quem abateu para o líder;
// `victimLeads` diz se a vítima era o líder. Entrega os itens e devolve os nomes.
export function giveKillReward(supplies, { deficit, victimLeads, streak = 1 }) {
  const labels = [];
  const extra = Math.min(Math.max(streak, 1), STREAK_CAP) - 1;   // 0 no primeiro abate

  const life = supplies.life();
  if (life > 0 && life < 1) {                      // destruído (0) não cura; vida cheia não precisa
    const amount = (deficit >= BEHIND_FROM ? LIFE_BEHIND : LIFE_BASE) + extra * STREAK_LIFE;
    supplies.give.life({ amount });
    labels.push(`VIDA ${Math.round(amount * 100)}%`);
  }

  supplies.give.ammo({ amount: (deficit >= BEHIND_FROM ? AMMO_BEHIND : AMMO_BASE) + extra * STREAK_AMMO });
  labels.push('MUNICAO');

  if (deficit >= BEHIND_FROM && supplies.hasTraps()) {
    const slot = supplies.pickTrap();
    supplies.give.trap({ slot });
    labels.push(slot.type.label);
  }
  const nitro = (deficit >= FAR_BEHIND_FROM ? NITRO_FAR_BEHIND : 0) + (victimLeads && deficit > 0 ? NITRO_LEADER_KILL : 0) + extra * STREAK_NITRO * (deficit > 0 ? 1 : LEADER_NITRO_SHARE);   // o líder (atraso 0) ganha só uma parte
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
