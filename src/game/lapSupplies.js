import { LAPS } from '../config.js';
import { track } from '../world/track.js';

// A cada volta completa cada piloto recebe suprimentos conforme a posição: o líder nada, o último o máximo.
// Vale para qualquer piloto; online, cada navegador entrega aos carros que simula.

const MAX_NITRO = 0.6, MAX_AMMO = 0.6, MAX_ITEMS = 2;   // o que o último recebe: frações do tanque e da reserva padrão
const STEP = 0.05;
const FIRST_COUNTED_LINE = 2;                        // a primeira passagem pela linha é a largada, não uma volta completa

const roundedShare = (maximum, share) => Math.max(STEP, Math.round(maximum * share / STEP) * STEP);

export function createLapSupplies({ race, suppliesFor, onPlayerSupplied }) {
  const lastLine = new Map();

  function deliver(racer, share) {
    const supplies = suppliesFor(racer);
    const nitro = { amount: roundedShare(MAX_NITRO, share) }, ammo = { amount: roundedShare(MAX_AMMO, share) };
    supplies.give.nitro(nitro);
    supplies.give.ammo(ammo);
    const items = [];
    if (supplies.hasTraps()) {
      for (let i = 0; i < Math.ceil(MAX_ITEMS * share); i++) {
        const slot = supplies.pickTrap();
        supplies.give.trap({ slot });
        items.push(slot.type.label);
      }
    }
    if (racer.isPlayer) onPlayerSupplied({ nitro: nitro.amount, ammo: ammo.amount, items });
  }

  function positionShare(racer) {
    const position = race.order.findIndex(entry => entry.name === racer.name);
    return race.order.length > 1 ? Math.max(0, position) / (race.order.length - 1) : 0;
  }

  return {
    reset() { lastLine.clear(); },
    update() {
      if (!race.started || race.finished) return;
      for (const racer of race.field) {
        if (racer.remote) continue;
        const line = Math.floor(racer.dist / track.length), previous = lastLine.get(racer);
        if (previous === undefined) { lastLine.set(racer, line); continue; }
        if (line <= previous) continue;                // quem é puxado para trás e cruza de novo não recebe duas vezes
        lastLine.set(racer, line);
        const share = positionShare(racer);
        if (line >= FIRST_COUNTED_LINE && line <= LAPS && share > 0) deliver(racer, share);
      }
    },
  };
}
