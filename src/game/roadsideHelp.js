import { TRACK_WIDTH } from '../config.js';
import { lifeAfterDestruction } from './carFlip.js';
import { EXTINGUISHER_LIFE, TRAP_TYPES } from './trapTypes.js';
import { isEpic } from '../world/track.js';

// Ajuda de beira de estrada para equilibrar a corrida. Quem ficou muito longe do carro da frente recebe
// uma oferta só dele: dois NPCs, um em cada lado da pista, com itens diferentes escolhidos pelo que falta
// àquele piloto. Quem está em primeiro nunca recebe. A oferta é por piloto, então cada um só vê a sua.

export const NPC_LANE = TRACK_WIDTH / 2 - 0.7;       // distância do centro da pista até cada NPC (na borda do asfalto)

const GAP_FOR_HELP = 60;                             // metros até o carro da frente
export const PICKUP_WINDOW = 3, PICKUP_REACH = 5;   // metros ao longo da pista e de lado até o NPC
const EPIC_SKIP = 6, SPAWN_AHEAD = 220, REMOVE_BEHIND = 40;
const FIRST_OFFER_DELAY = 12, COOLDOWN = 11, NO_NEED_RETRY = 3, MESSAGE_TIME = 1.8;
const CHOICE_VARIATION = 0.15;                       // evita que a oferta seja sempre a mesma

const AMMO_GIFT = 0.5;
const NITRO_GIFT = { min: 0.25, max: 1, fullAtGap: 300, step: 0.05 };   // quanto mais longe do carro da frente, mais nitro (fração do tanque padrão)

function nitroGiftFor(gap) {
  const { min, max, fullAtGap, step } = NITRO_GIFT;
  const t = Math.max(0, Math.min(1, (gap - GAP_FOR_HELP) / (fullAtGap - GAP_FOR_HELP)));
  return Math.round((min + (max - min) * t) / step) * step;
}

export const HELP_ITEMS = { ammo: 'MUNICAO', nitro: 'NITRO', extinguisher: TRAP_TYPES.extinguisher.label };

const fill = slots => slots.reduce((sum, s) => sum + s.charges, 0) / Math.max(1, slots.reduce((sum, s) => sum + s.capacity, 0));
const emptiest = slots => [...slots].sort((a, b) => a.charges / a.capacity - b.charges / b.capacity)[0];
const isExtinguisher = slot => slot.type.id === 'extinguisher';
// O extintor tem oferta própria; assim os dois NPCs não aparecem com o mesmo item.
const pickThrowable = slots => emptiest(slots.filter(slot => !isExtinguisher(slot))) ?? emptiest(slots);

// Quanto mais vida faltando e menos extintores na mala, maior a necessidade (1 = não precisa).
const extinguisherLevel = (slots, life) => Math.min(1, life + EXTINGUISHER_LIFE * (slots.find(isExtinguisher)?.charges ?? 0));

function addExtinguisher(slots) {
  const slot = slots.find(isExtinguisher);
  if (slot) slot.charges++;
  else slots.push({ type: TRAP_TYPES.extinguisher, charges: 1, capacity: 1 });
}

// O que cada piloto tem e como receber. `levels` vão de 0 (acabou) a 1 (cheio); ausente = não usa aquilo.
function playerSupplies(car, weapon, traps) {
  const lifeCap = () => lifeAfterDestruction(car.destroyed);
  return {
    slots: () => traps.slots,
    hasTraps: () => traps.slots.length > 0,
    pickTrap: () => pickThrowable(traps.slots),
    levels: () => ({
      ammo: (weapon.ammo + weapon.reserve) / (weapon.type.magazine + weapon.maxReserve),
      nitro: car.nitro,
      trap: traps.slots.length ? fill(traps.slots) : 1,
      extinguisher: extinguisherLevel(traps.slots, car.health / lifeCap()),
    }),
    give: {
      ammo(item) { weapon.reserve = Math.min(weapon.maxReserve, weapon.reserve + Math.ceil(weapon.type.reserve * (item.amount ?? AMMO_GIFT))); },
      nitro(item) { car.nitro = Math.min(1, car.nitro + item.amount / car.nitroCapacity); },
      trap(item) { item.slot.charges++; },
      extinguisher() { addExtinguisher(traps.slots); },
    },
  };
}

function opponentSupplies(op) {
  const { arsenal } = op, lifeCap = () => op.maxHp * lifeAfterDestruction(op.destroyed);
  return {
    slots: () => arsenal.traps,
    hasTraps: () => arsenal.traps.length > 0,
    pickTrap: () => pickThrowable(arsenal.traps),
    levels: () => ({
      ammo: (arsenal.ammo + arsenal.reserve) / (arsenal.type.magazine + arsenal.maxReserve),
      nitro: op.nitro,
      trap: fill(arsenal.traps),
      extinguisher: extinguisherLevel(arsenal.traps, op.hp / lifeCap()),
    }),
    give: {
      ammo(item) { arsenal.reserve = Math.min(arsenal.maxReserve, arsenal.reserve + Math.ceil(arsenal.type.reserve * (item.amount ?? AMMO_GIFT))); },
      nitro(item) { op.nitro = Math.min(1, op.nitro + item.amount / op.nitroCapacity); },
      trap(item) { item.slot.charges++; },
      extinguisher() { addExtinguisher(arsenal.traps); },
    },
  };
}

// Nome exato do que o NPC entrega, igual ao da placa.
export function itemLabel({ id, slot, amount }) {
  if (slot) return slot.type.label;
  return amount ? `${HELP_ITEMS[id]} ${Math.round(amount * 100)}%` : HELP_ITEMS[id];
}

function chooseItems(supplies) {
  const needs = Object.entries(supplies.levels())
    .filter(([, level]) => level < 1)
    .map(([id, level]) => ({ id, score: 1 - level + Math.random() * CHOICE_VARIATION }))
    .sort((a, b) => b.score - a.score);
  const ids = needs.slice(0, 2).map(need => need.id);
  if (ids.length === 1 && ids[0] !== 'trap' && supplies.hasTraps()) ids.push('trap');
  return ids;
}

export function createRoadsideHelp({ race, car, weapon, traps, onPlayerOffer, onPlayerPickup }) {
  const states = new Map(race.field.map(racer => [racer, {
    offer: null,
    cooldown: FIRST_OFFER_DELAY,
    supplies: racer.isPlayer ? playerSupplies(car, weapon, traps) : opponentSupplies(racer),
  }]));
  const help = {
    message: '', messageTime: 0, update, reset, canPickUp: racer => canPickUp(racer),
    offerFor: racer => states.get(racer).offer,
    suppliesFor: racer => states.get(racer).supplies,
    showMessage(text) {
      help.message = text;
      help.messageTime = MESSAGE_TIME;
    },
  };

  function reset() {
    help.message = '';
    help.messageTime = 0;
    for (const [racer, state] of states) {
      setOffer(racer, state, null);
      state.cooldown = FIRST_OFFER_DELAY;
    }
  }

  function setOffer(racer, state, offer) {
    state.offer = offer;
    if (racer.isPlayer) onPlayerOffer(offer);
  }

  function endOffer(racer, state) {
    setOffer(racer, state, null);
    state.cooldown = COOLDOWN;
  }

  function createOffer(racer, state, gap) {
    const [first, second] = chooseItems(state.supplies);
    if (!second) { state.cooldown = NO_NEED_RETRY; return; }
    const side = Math.random() < 0.5 ? -1 : 1;       // cada item pode aparecer de qualquer lado
    // A oferta já sai definida: o NPC mostra exatamente o que vai entregar. Item de bagageiro pode passar da carga inicial.
    const describe = id => {
      if (id === 'trap') return { id, slot: state.supplies.pickTrap() };
      return id === 'nitro' ? { id, amount: nitroGiftFor(gap) } : { id };
    };
    let dist = racer.dist + SPAWN_AHEAD;
    while (isEpic(dist)) dist += EPIC_SKIP;          // nunca em cima de um salto ou dentro do tubo
    setOffer(racer, state, { dist, taken: false, items: [{ ...describe(first), side }, { ...describe(second), side: -side }] });
  }

  const canPickUp = racer => racer.dead <= 0 && !(racer.isPlayer ? car.overturned : racer.overturned);

  // O jogador pega o item do lado em que passar; os adversários levam o que mais precisam.
  function itemWithinReach(racer, offer) {
    if (!racer.isPlayer) return offer.items[0];
    return offer.items.find(item => Math.abs(racer.lane - item.side * NPC_LANE) < PICKUP_REACH);
  }

  function take(racer, state, item) {
    state.supplies.give[item.id](item);
    state.offer.taken = true;
    if (!racer.isPlayer) return;
    help.showMessage(`+${itemLabel(item)}`);
    onPlayerPickup(item);
  }

  function updateOffer(racer, state) {
    const passed = racer.dist - state.offer.dist;
    if (!state.offer.taken && Math.abs(passed) <= PICKUP_WINDOW && canPickUp(racer)) {
      const item = itemWithinReach(racer, state.offer);
      if (item) take(racer, state, item);
    }
    if (passed > REMOVE_BEHIND) endOffer(racer, state);
  }

  function update(dt) {
    help.messageTime = Math.max(0, help.messageTime - dt);
    if (!race.started || race.finished || dt <= 0) return;
    const ordered = [...race.field].sort((a, b) => b.dist - a.dist);
    ordered.forEach((racer, position) => {
      if (racer.remote) return;                      // cada navegador cuida das ofertas de quem ele simula
      const state = states.get(racer);
      if (position === 0) {                          // o líder não recebe ajuda, nem a que já estava a caminho
        if (state.offer) endOffer(racer, state);
        return;
      }
      if (state.offer) { updateOffer(racer, state); return; }
      const gap = ordered[position - 1].dist - racer.dist;
      if ((state.cooldown -= dt) <= 0 && gap >= GAP_FOR_HELP && racer.dead <= 0) createOffer(racer, state, gap);
    });
  }

  return help;
}
