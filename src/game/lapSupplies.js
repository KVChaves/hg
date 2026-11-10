import { LAPS } from '../config.js';
import { track } from '../world/track.js';
import { NPC_LANE, PICKUP_REACH, PICKUP_WINDOW } from './roadsideHelp.js';

// A cada volta, um NPC de cada lado da pista, logo antes da linha, segura uma caixa com suprimentos: o líder nada,
// o último o máximo. Só leva quem passar perto de um deles, uma vez por volta. Vale para qualquer piloto; online, cada navegador
// cuida dos carros que simula e cada um vê só as caixas dele.
// O líder não pega caixa, mas ao cruzar a linha liderando ganha uma armadilha e um pouco de munição: liderar
// também rende algo, sem abrir mais vantagem (nada de nitro).

const CRATE_BEFORE_LINE = 15;                        // metros
const MAX_NITRO = 0.6, MAX_AMMO = 0.6, MAX_ITEMS = 2;   // o que o último recebe: frações do tanque e da reserva padrão
const STEP = 0.05;
const FIRST_CRATE_LAP = 1;                           // antes da volta 1 os carros ainda estão no grid de largada
const LEADER_AMMO = 0.25;                            // fração da reserva padrão que o líder ganha na linha

const roundedShare = (maximum, share) => Math.max(STEP, Math.round(maximum * share / STEP) * STEP);

// Reparte os itens entre os compartimentos mais vazios, considerando o que já foi separado para a caixa.
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

export function createLapSupplies({ race, suppliesFor, canPickUp, onStation, onStationTaken, onPlayerSupplied, onLeaderReward = () => {} }) {
  const takenOnLap = new Map(), lapOf = new Map();
  let shownKey = null;

  const hasCrates = lap => lap >= FIRST_CRATE_LAP && lap < LAPS;

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

  function publish(station) {
    const key = station?.key ?? null;
    if (key === shownKey) return;
    shownKey = key;
    onStation(station);
  }

  function deliver(racer, contents) {
    const { give } = suppliesFor(racer);
    give.nitro({ amount: contents.nitro });
    give.ammo({ amount: contents.ammo });
    for (const slot of contents.slots) give.trap({ slot });
    if (racer.isPlayer) onPlayerSupplied({ nitro: contents.nitro, ammo: contents.ammo, items: contents.slots.map(slot => slot.type.label) });
  }

  // O jogador precisa passar perto de um dos NPCs; os bots andam em faixas, então levam ao passar por eles.
  function sideReached(racer, offset) {
    if (Math.abs(offset + CRATE_BEFORE_LINE) > PICKUP_WINDOW) return 0;
    if (!racer.isPlayer) return 1;
    return [-1, 1].find(side => Math.abs(racer.lane - side * NPC_LANE) < PICKUP_REACH) ?? 0;
  }

  // Cruzou a linha (fim de uma volta que não é a última) em primeiro.
  function rewardLeader(racer, lap) {
    const crossed = lapOf.has(racer) && lap > lapOf.get(racer);   // maior volta já alcançada: voltar para trás da linha não conta de novo
    lapOf.set(racer, Math.max(lap, lapOf.get(racer) ?? lap));
    if (!crossed || lap <= FIRST_CRATE_LAP || lap > LAPS || race.order[0]?.name !== racer.name) return;
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
    const lap = Math.floor(racer.dist / track.length), alreadyTaken = takenOnLap.get(racer) === lap;
    rewardLeader(racer, lap);
    const share = positionShare(racer), eligible = hasCrates(lap) && !alreadyTaken && share > 0;
    const line = (lap + 1) * track.length;
    if (racer.isPlayer && !alreadyTaken) publish(eligible ? { key: lap, dist: line - CRATE_BEFORE_LINE } : null);   // depois de pegar, os NPCs ficam comemorando
    if (!eligible || !canPickUp(racer)) return;
    const side = sideReached(racer, racer.dist - line);
    if (!side) return;
    takenOnLap.set(racer, lap);
    deliver(racer, contentsFor(racer, share));
    if (racer.isPlayer) onStationTaken(side);
  }

  return {
    reset() {
      takenOnLap.clear();
      lapOf.clear();
      publish(null);
    },
    update() {
      if (!race.started || race.finished) { publish(null); return; }
      for (const racer of race.field) if (!racer.remote) updateRacer(racer);
    },
  };
}
