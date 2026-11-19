import { BLUE_NITRO, TRACK_WIDTH } from '../config.js';
import { EXTINGUISHER_LIFE, TRAP_TYPES } from './trapTypes.js';
import { isEpic } from '../world/track.js';
import { HELP_FROM, TARGET_FAR, gapToLeader, helpStrength } from './deficit.js';
import { styleOf } from './botStyles.js';

// Ajuda de beira de estrada para equilibrar a corrida. Quem ficou muito longe do líder recebe
// uma oferta só dele: dois NPCs, um em cada lado da pista, com itens diferentes escolhidos pelo que falta
// àquele piloto. Quem está em primeiro nunca recebe. A oferta é por piloto, então cada um só vê a sua.

export const NPC_LANE = TRACK_WIDTH / 2 - 0.7;       // distância do centro da pista até cada NPC (na borda do asfalto)

const GAP_FOR_HELP = HELP_FROM;                      // metros até o líder a partir dos quais há ajuda
export const PICKUP_WINDOW = 3, PICKUP_REACH = 5;   // metros ao longo da pista e de lado até o NPC
const EPIC_SKIP = 6, SPAWN_AHEAD = 220, REMOVE_BEHIND = 40;
const FIRST_OFFER_DELAY = 12, COOLDOWN = 11, MESSAGE_TIME = 1.8;
const BLUE_GAP = TARGET_FAR, BLUE_COOLDOWN = 40;           // último colocado a mais de BLUE_GAP m do penúltimo ganha um nitro azul; no mínimo BLUE_COOLDOWN s entre um e outro
const ERRAND_BASE_NEED = 0.2;                        // o bot também quer o que não está faltando, só que menos
const CHOICE_VARIATION = 0.15;                       // evita que a oferta seja sempre a mesma

const AMMO_GIFT = 0.5;                               // usado quando o item não traz quantidade (abate etc.)
const AMMO_OFFER = { min: 0.25, max: 0.4 };         // munição do NPC: quase plana, com pouco acréscimo pelo atraso
const NITRO_GIFT = { min: 0.15, max: 1, step: 0.05 };   // fração do tanque padrão: acompanha helpStrength (mais longe do líder, mais nitro)

function ammoGiftFor(gap) {
  const t = helpStrength(gap);
  return Math.round((AMMO_OFFER.min + (AMMO_OFFER.max - AMMO_OFFER.min) * t) / 0.05) * 0.05;
}

function nitroGiftFor(gap) {
  const { min, max, step } = NITRO_GIFT;
  const t = helpStrength(gap);
  return Math.round((min + (max - min) * t) / step) * step;
}

export const HELP_ITEMS = { ammo: 'MUNICAO', nitro: 'NITRO', blueNitro: 'NITRO AZUL', extinguisher: TRAP_TYPES.extinguisher.label };

const fill = slots => slots.reduce((sum, s) => sum + s.charges, 0) / Math.max(1, slots.reduce((sum, s) => sum + s.capacity, 0));
const emptiest = slots => [...slots].sort((a, b) => a.charges / a.capacity - b.charges / b.capacity)[0];
const isExtinguisher = slot => slot.type.id === 'extinguisher';
// O extintor tem oferta própria; assim os dois NPCs não aparecem com o mesmo item.
const pickThrowable = slots => emptiest(slots.filter(slot => !isExtinguisher(slot))) ?? emptiest(slots);

// Quanto mais vida faltando e menos extintores na mala, maior a necessidade (1 = não precisa).
const extinguisherLevel = (slots, life) => Math.min(1, life + EXTINGUISHER_LIFE * (slots.find(isExtinguisher)?.charges ?? 0));

// Item de um tipo que o piloto talvez não tenha levado: usa o compartimento dele ou abre um novo.
function addTrapOfType(slots, type) {
  const slot = slots.find(s => s.type.id === type.id);
  if (slot) slot.charges++;
  else slots.push({ type, charges: 1, capacity: 1, gifted: true });   // `gifted`: não veio da compra inicial
}

function addExtinguisher(slots) {
  const slot = slots.find(isExtinguisher);
  if (slot) slot.charges++;
  else slots.push({ type: TRAP_TYPES.extinguisher, charges: 1, capacity: 1, gifted: true });
}

// O que cada piloto tem e como receber. `levels` vão de 0 (acabou) a 1 (cheio); ausente = não usa aquilo.
function playerSupplies(car, weapon, traps) {
  const lifeCap = () => 1;
  return {
    slots: () => traps.slots,
    hasTraps: () => traps.slots.length > 0,
    pickTrap: () => pickThrowable(traps.slots),
    ammoSpace: () => ({ total: weapon.type.magazine + weapon.maxReserve, standard: weapon.type.reserve }),
    levels: () => ({
      ammo: (weapon.ammo + weapon.reserve) / (weapon.type.magazine + weapon.maxReserve),
      nitro: car.nitro,
      trap: traps.slots.length ? fill(traps.slots) : 1,
      extinguisher: extinguisherLevel(traps.slots, car.health / lifeCap()),
    }),
    give: {
      ammo(item) { weapon.reserve = Math.min(weapon.maxReserve, weapon.reserve + Math.ceil(weapon.type.reserve * (item.amount ?? AMMO_GIFT))); },
      nitro(item) { car.nitro = Math.min(1, car.nitro + item.amount / car.nitroCapacity); },
      blueNitro() { car.nitro = 1; car.nitroToFill = 0; car.blueNitro = BLUE_NITRO.time; },
      trap(item) { item.slot.charges++; },
      trapOfType(item) { addTrapOfType(traps.slots, item.type); },
      extinguisher() { addExtinguisher(traps.slots); },
    },
  };
}

function opponentSupplies(op) {
  const { arsenal } = op, lifeCap = () => op.maxHp;
  return {
    slots: () => arsenal.traps,
    hasTraps: () => arsenal.traps.length > 0,
    pickTrap: () => pickThrowable(arsenal.traps),
    ammoSpace: () => ({ total: arsenal.type.magazine + arsenal.maxReserve, standard: arsenal.type.reserve }),
    levels: () => ({
      ammo: (arsenal.ammo + arsenal.reserve) / (arsenal.type.magazine + arsenal.maxReserve),
      nitro: op.nitro,
      trap: fill(arsenal.traps),
      extinguisher: extinguisherLevel(arsenal.traps, op.hp / lifeCap()),
    }),
    give: {
      ammo(item) { arsenal.reserve = Math.min(arsenal.maxReserve, arsenal.reserve + Math.ceil(arsenal.type.reserve * (item.amount ?? AMMO_GIFT))); },
      nitro(item) { op.nitro = Math.min(1, op.nitro + item.amount / op.nitroCapacity); },
      blueNitro() { op.nitro = 1; op.nitroToFill = 0; op.blueNitro = BLUE_NITRO.time; },
      trap(item) { item.slot.charges++; },
      trapOfType(item) { addTrapOfType(arsenal.traps, item.type); },
      extinguisher() { addExtinguisher(arsenal.traps); },
    },
  };
}

// Nome exato do que o NPC entrega, igual ao da placa.
export function itemLabel({ id, slot, amount }) {
  if (slot) return slot.type.label;
  return amount ? `${HELP_ITEMS[id]} ${Math.round(amount * 100)}%` : HELP_ITEMS[id];
}

// Um dos dois NPCs sempre oferece nitro; o outro traz o que mais falta ao piloto (fora o nitro).
function chooseItems(supplies) {
  const best = Object.entries(supplies.levels())
    .filter(([id, level]) => id !== 'nitro' && level < 1)
    .map(([id, level]) => ({ id, score: 1 - level + Math.random() * CHOICE_VARIATION }))
    .sort((a, b) => b.score - a.score)[0];
  return ['nitro', best?.id ?? (supplies.hasTraps() ? 'trap' : 'ammo')];
}

export function createRoadsideHelp({ race, car, weapon, traps, onPlayerOffer, onPlayerPickup }) {
  const states = new Map(race.field.map(racer => [racer, {
    offer: null,
    cooldown: FIRST_OFFER_DELAY, blueCooldown: FIRST_OFFER_DELAY,
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
      state.cooldown = state.blueCooldown = FIRST_OFFER_DELAY;
      racer.blueNitro = 0;
    }
  }

  function setOffer(racer, state, offer) {
    state.offer = offer;
    if (racer.isPlayer) onPlayerOffer(offer);
    else racer.errand = offer ? errandFor(racer, state, offer) : null;
  }

  // O bot vê os dois NPCs e escolhe o item que o estilo dele mais quer, pesado pelo quanto lhe falta; a tática de pista
  // (botTactics.js) o leva para aquele lado. Nitro azul é igual dos dois lados: vai para o mais perto.
  function errandFor(racer, state, offer) {
    const levels = state.supplies.levels(), wants = styleOf(racer).items;
    const want = item => (item.id === 'blueNitro' ? -Math.abs(racer.lane - item.side * NPC_LANE)
      : (wants[item.id] ?? 1) * (1 - (levels[item.id] ?? 0.5) + ERRAND_BASE_NEED));
    const wanted = offer.items.reduce((best, item) => (want(item) > want(best) ? item : best));
    return { dist: offer.dist, lane: wanted.side * NPC_LANE };
  }

  function endOffer(racer, state) {
    setOffer(racer, state, null);
    state.cooldown = COOLDOWN;
  }

  function createOffer(racer, state, gap) {
    const [first, second] = chooseItems(state.supplies);
    const side = Math.random() < 0.5 ? -1 : 1;       // cada item pode aparecer de qualquer lado
    // A oferta já sai definida: o NPC mostra exatamente o que vai entregar. Item de bagageiro pode passar da carga inicial.
    const describe = id => {
      if (id === 'trap') return { id, slot: state.supplies.pickTrap() };
      if (id === 'nitro') return { id, amount: nitroGiftFor(gap) };
      return id === 'ammo' ? { id, amount: ammoGiftFor(gap) } : { id };
    };
    let dist = racer.dist + SPAWN_AHEAD;
    while (isEpic(dist)) dist += EPIC_SKIP;          // nunca em cima de um salto ou dentro do tubo
    setOffer(racer, state, { dist, taken: false, items: [{ ...describe(first), side }, { ...describe(second), side: -side }] });
  }

  // O último colocado muito longe do penúltimo ganha um nitro azul: os dois NPCs seguram o mesmo item, um de cada lado.
  function createBlueOffer(racer, state) {
    let dist = racer.dist + SPAWN_AHEAD;
    while (isEpic(dist)) dist += EPIC_SKIP;
    setOffer(racer, state, { dist, taken: false, blue: true, items: [{ id: 'blueNitro', side: -1 }, { id: 'blueNitro', side: 1 }] });
    state.blueCooldown = BLUE_COOLDOWN;
  }

  const canPickUp = racer => racer.dead <= 0 && !(racer.isPlayer ? car.overturned : racer.overturned);

  // Todo piloto pega o item do lado em que passar: o bot precisa ir até lá, como o jogador.
  function itemWithinReach(racer, offer) {
    return offer.items.find(item => Math.abs(racer.lane - item.side * NPC_LANE) < PICKUP_REACH);
  }

  function take(racer, state, item) {
    state.supplies.give[item.id](item);
    state.offer.taken = true;
    if (!racer.isPlayer) { racer.errand = null; return; }
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
      const gapAhead = ordered[position - 1].dist - racer.dist;
      state.blueCooldown -= dt;
      const needsBlue = position === ordered.length - 1 && gapAhead > BLUE_GAP && state.blueCooldown <= 0 && racer.dead <= 0 && !(racer.blueNitro > 0);
      if (needsBlue && !state.offer?.blue && !state.offer?.taken) createBlueOffer(racer, state);
      if (state.offer) { updateOffer(racer, state); return; }
      const gap = gapToLeader(racer, race.field);
      if ((state.cooldown -= dt) <= 0 && gap >= GAP_FOR_HELP && racer.dead <= 0) createOffer(racer, state, gap);
    });
  }

  return help;
}
