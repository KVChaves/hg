import { LAPS } from '../config.js';
import { track } from '../world/track.js';

// Ao cruzar a linha de chegada (fim de uma volta que não é a última), cada piloto recebe os suprimentos na hora: o líder
// nada de nitro, o último o máximo, e quem está no meio, uma parte. Vale para qualquer piloto; online, cada navegador
// cuida dos carros que simula.
// O líder não recebe esses suprimentos, mas ao cruzar a linha liderando ganha uma armadilha e um pouco de munição:
// liderar também rende algo, sem abrir mais vantagem (nada de nitro).

const MAX_NITRO = 0.6, MAX_AMMO = 0.6, MAX_ITEMS = 2;   // o que o último recebe: frações do tanque e da reserva padrão
const STEP = 0.05;
const FIRST_CRATE_LAP = 1;                           // antes da volta 1 os carros ainda estão no grid de largada
const LEADER_AMMO = 0.25;                            // fração da reserva padrão que o líder ganha na linha

const roundedShare = (maximum, share) => Math.max(STEP, Math.round(maximum * share / STEP) * STEP);

// Reparte os itens entre os compartimentos mais vazios, considerando o que já foi separado.
function plannedSlots(slots, count) {
  if (!slots.length) return [];
  const planned = new Map(), fillOf = slot => (slot.charges + (planned.get(slot) ?? 0)) / slot.capacity, chosen = [];
  for (let i = 0; i < count; i++) {
    const slot = [...slots].sort((a, b) => fillOf(a) - fillOf(b))[0];
    planned.set(slot, (planned.get(slot) ?? 0) + 1);
    chosen.push(slot);
  }
  return chosen;
}

export function createLapSupplies({ race, suppliesFor, onPlayerSupplied, onLeaderReward = () => {} }) {
  const lapOf = new Map();

  function positionShare(racer) {
    const position = race.order.findIndex(entry => entry.name === racer.name);
    return race.order.length > 1 ? Math.max(0, position) / (race.order.length - 1) : 0;
  }

  function contentsFor(racer, share) {
    return {
      nitro: roundedShare(MAX_NITRO, share),
      ammo: roundedShare(MAX_AMMO, share),
      slots: plannedSlots(suppliesFor(racer).slots(), Math.ceil(MAX_ITEMS * share)),
    };
  }

  function deliver(racer, contents) {
    const { give } = suppliesFor(racer);
    give.nitro({ amount: contents.nitro });
    give.ammo({ amount: contents.ammo });
    for (const slot of contents.slots) give.trap({ slot });
    if (racer.isPlayer) onPlayerSupplied({ nitro: contents.nitro, ammo: contents.ammo, items: contents.slots.map(slot => slot.type.label) });
  }

  function rewardLeader(racer) {
    const supplies = suppliesFor(racer), labels = [];
    supplies.give.ammo({ amount: LEADER_AMMO });
    labels.push('MUNICAO');
    if (supplies.hasTraps()) {
      const slot = supplies.pickTrap();
      supplies.give.trap({ slot });
      labels.push(slot.type.label);
    }
    if (racer.isPlayer) onLeaderReward({ ammo: LEADER_AMMO, items: labels.slice(1) });
  }

  function updateRacer(racer) {
    const lap = Math.floor(racer.dist / track.length), previous = lapOf.get(racer);
    const crossed = previous !== undefined && lap > previous;   // maior volta já alcançada: voltar para trás da linha não conta de novo
    lapOf.set(racer, Math.max(lap, previous ?? lap));
    if (!crossed || lap <= FIRST_CRATE_LAP || lap > LAPS || racer.dead > 0) return;
    if (race.order[0]?.name === racer.name) rewardLeader(racer);
    else deliver(racer, contentsFor(racer, positionShare(racer)));
  }

  return {
    reset() { lapOf.clear(); },
    update() {
      if (!race.started || race.finished) return;
      for (const racer of race.field) if (!racer.remote) updateRacer(racer);
    },
  };
}
