import { LAPS } from '../config.js';
import { track } from '../world/track.js';
import { deficitOf } from './deficit.js';
import { TRAP_TYPES } from './trapTypes.js';

// Ao cruzar a linha de chegada (fim de uma volta que não é a última), cada piloto é reabastecido até um piso que depende do
// atraso para o líder: quem já tem mais que o piso não ganha nada, então a ajuda nunca se acumula. Vale para qualquer piloto;
// online, cada navegador cuida dos carros que simula.
// - Nitro: o líder não recebe; quem está atrás sobe até NITRO_FLOOR * atraso do tanque (mínimo simbólico para quem está colado).
// - Munição: do piso do líder (AMMO_FLOOR.leader) ao do último (AMMO_FLOOR.last), contando carregador e reserva.
// - Armadilhas: todos ganham uma; quem está muito atrás ganha duas. O líder ganha a dele sem abrir vantagem em nitro.

const NITRO_FLOOR = { least: 0.1, most: 0.6 };      // frações do tanque: de quem está colado (nunca o líder) ao último
const AMMO_FLOOR = { leader: 0.3, last: 0.7 };      // frações da capacidade total de munição
const TRAPS_FAR_BEHIND = 2, FAR_BEHIND_FROM = 0.67; // atraso (0 a 1) a partir do qual ganha a segunda armadilha
const FIRST_CRATE_LAP = 1;                           // antes da volta 1 os carros ainda estão no grid de largada

const nitroFloor = deficit => deficit > 0 ? Math.max(NITRO_FLOOR.least, NITRO_FLOOR.most * deficit) : 0;
const ammoFloor = deficit => AMMO_FLOOR.leader + (AMMO_FLOOR.last - AMMO_FLOOR.leader) * deficit;
const roundUp = value => Math.ceil(value * 100 - 1e-6) / 100;   // 1% de passo, para nunca ficar abaixo do piso

// Sorteia `count` itens, sem repetir enquanto houver opção: entre os que o piloto levou na largada (compartimentos do bagageiro)
// e, se ele não levou nada, entre todos os tipos.
function randomItems(allSlots, count) {
  const slots = allSlots.filter(slot => !slot.gifted);   // compartimentos abertos por presentes não contam como compra
  const pool = (slots.length ? slots.map(slot => ({ slot, type: slot.type })) : Object.values(TRAP_TYPES).map(type => ({ type })))
    .map(entry => ({ entry, order: Math.random() })).sort((a, b) => a.order - b.order).map(({ entry }) => entry);
  return Array.from({ length: count }, (_, i) => pool[i % pool.length]);
}

export function createLapSupplies({ race, suppliesFor, onPlayerSupplied, onLeaderReward = () => {} }) {
  const lapOf = new Map();

  // Quanto falta para chegar ao piso, na unidade que `give` espera (fração do tanque padrão / da reserva padrão).
  function contentsFor(racer, deficit, isLeader) {
    const supplies = suppliesFor(racer), levels = supplies.levels(), space = supplies.ammoSpace();
    const missingNitro = Math.max(0, nitroFloor(isLeader ? 0 : deficit) - levels.nitro) * (racer.nitroCapacity ?? 1);
    const missingAmmo = Math.max(0, ammoFloor(isLeader ? 0 : deficit) - levels.ammo) * space.total / space.standard;
    const traps = isLeader || deficit < FAR_BEHIND_FROM ? 1 : TRAPS_FAR_BEHIND;
    return { nitro: roundUp(missingNitro), ammo: roundUp(missingAmmo), items: randomItems(supplies.slots(), traps) };
  }

  function deliver(racer, contents) {
    const { give } = suppliesFor(racer);
    if (contents.nitro > 0) give.nitro({ amount: contents.nitro });
    if (contents.ammo > 0) give.ammo({ amount: contents.ammo });
    for (const item of contents.items) (item.slot ? give.trap : give.trapOfType)(item);
    return contents;
  }

  function rewardLeader(racer) {
    const contents = deliver(racer, contentsFor(racer, 0, true));
    if (racer.isPlayer) onLeaderReward({ ammo: contents.ammo, items: contents.items.map(item => item.type.label) });
  }

  function updateRacer(racer) {
    const lap = Math.floor(racer.dist / track.length), previous = lapOf.get(racer);
    const crossed = previous !== undefined && lap > previous;   // maior volta já alcançada: voltar para trás da linha não conta de novo
    lapOf.set(racer, Math.max(lap, previous ?? lap));
    if (!crossed || lap <= FIRST_CRATE_LAP || lap > LAPS || racer.dead > 0) return;
    if (race.order[0]?.name === racer.name) rewardLeader(racer);
    else {
      const contents = deliver(racer, contentsFor(racer, deficitOf(racer, race.field), false));
      if (racer.isPlayer) onPlayerSupplied({ nitro: contents.nitro, ammo: contents.ammo, items: contents.items.map(item => item.type.label) });
    }
  }

  return {
    reset() { lapOf.clear(); },
    update() {
      if (!race.started || race.finished) return;
      for (const racer of race.field) if (!racer.remote) updateRacer(racer);
    },
  };
}
