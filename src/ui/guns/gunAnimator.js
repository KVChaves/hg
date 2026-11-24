import { familyOf, WEAPON_TYPES } from '../../game/weaponTypes.js';

// Transforma o estado da arma em movimento das partes. `update` devolve os eventos do quadro
// (cápsulas a ejetar e sons a tocar). O jeito de mover segue o `style` da arma (ou a família dela):
// revolver, topbreak (revólver de quebrar), shotgun, smg, rifle (alavanca), bolt (ferrolho),
// autoshotgun (tambor), crossbow, pump (bomba do lança-granadas) e gatling (canos giratórios da metralhadora).

const HAMMER_RECOCK_DELAY = 0.12, HAMMER_SPEED = 9, SPIN_SPEED = 7;
const OPEN_SPEED = 9, BOLT_RETURN = 22, MAG_DROP_SPEED = 7;
const LEVER_DELAY = 0.16, LEVER_TRAVEL = 0.22;
// Ferrolho da sniper: a mão chega ao ferrolho, ele abre depois da pausa e, vazio, fica aberto até a recarga.
const BOLT_DELAY = 0.3, BOLT_TIME = 0.7, BOLT_HOLD_AT = 0.55, BOLT_HAND_IN = [0.1, 0.28], BOLT_HAND_OUT = 0.16, BOLT_CLOSE_TIME = 0.5;
// Revólver de quebrar: a trava sobe, a arma abre devagar e a estrela extratora salta no fim da abertura.
const LATCH_SPEED = 14, BREAK_SPEED = 6, EXTRACT_DECAY = 4;
// Escopeta de tambor: velocidade do giro (cartuchos por segundo) e calor da capa do cano.
const DRUM_SPEED = 18, HEAT_PER_SHELL = 0.16, HEAT_DECAY = 0.3;
const STRING_SNAP_SPEED = 40, STRING_COCK_SPEED = 6, FLEX_DECAY = 3.2, CRANK_SPEED = 16, NUT_SPEED = 8;
// Bomba do lança-granadas: a mão chega, puxa (cospe o estojo) e empurra; tempos em segundos depois do tiro.
const PUMP_HAND_IN = [0.1, 0.24], PUMP_BACK = [0.24, 0.4], PUMP_FORWARD = [0.44, 0.58], PUMP_HAND_OUT = [0.58, 0.72];

// Metralhadora: os canos giram com `state.spin` (um cano por tiro, no ritmo máximo), a cinta anda um elo por tiro
// e os canos esquentam na rajada. O giro só faz som quando parte do repouso.
const BELT_SPEED = 30, GATLING_HEAT_PER_SHOT = 0.03, GATLING_HEAT_DECAY = 0.22, SPIN_SOUND_REST = 0.05;

// Momento do ciclo em que o pente sai da mão e encaixa na arma.
export const MAGAZINE_SEAT_AT = 0.86;
const MAGAZINE_CLICK_AT = 0.94;                    // o clique do som cai no fim do encaixe

const approach = (value, target, step) => (value < target ? Math.min(target, value + step) : Math.max(target, value - step));
const clamp01 = v => Math.max(0, Math.min(1, v));
const smooth = t => t * t * (3 - 2 * t);
const OPENS_ON_RELOAD = new Set(['revolver', 'shotgun', 'autoshotgun', 'gatling']);
const SWAPS_MAGAZINE = new Set(['smg', 'gatling']);           // trocam o pente inteiro de uma vez

export function createGunAnimator(weaponId) {
  const type = WEAPON_TYPES[weaponId], id = type.style ?? familyOf(weaponId);
  const pose = {
    hammer: 1, hammers: [1, 1], spin: 0, open: 0, bolt: 0, lever: 0, magDrop: 0, ammo: type.magazine,
    boltLift: 0, boltBack: 0, draw: 0, flex: 0, t: 0,
    latch: 0, extract: 0, drum: 0, drumIndex: 0, heat: 0, crank: 0, actionHand: 0, pump: 0, spent: false, nut: 0,
    rotor: 0, rotorSpeed: 0, belt: 0, beltIndex: 0,
  };
  let lastSpin = 0;
  let sincePump = Infinity, pumpEjected = true, pumpSounded = true, wasFired = false;   // wasFired: a bomba tem estojo para cuspir
  let sinceFire = Infinity, shots = 0, leverEjected = true, wasReloading = false, boltRack = 0, magazineClicked = false, leverStarted = true, lastAmmo = type.magazine;
  let boltOpened = true, boltEjected = true, boltClosed = true, boltClosing = Infinity, pendingCasings = 0;

  function fire() {
    sinceFire = 0;
    shots++;
    pose.hammer = 0;
    pose.hammers[(shots - 1) % 2] = 0;
    pose.spin = 0;
    if (id === 'smg' || id === 'autoshotgun') pose.bolt = 1;
    if (id === 'autoshotgun') { pose.drumIndex++; pose.heat = Math.min(1, pose.heat + HEAT_PER_SHELL); }
    if (id === 'rifle') leverEjected = leverStarted = false;
    if (id === 'bolt') { boltOpened = boltEjected = boltClosed = false; pose.spent = true; boltClosing = Infinity; }
    if (id === 'crossbow') { pose.flex = 1; pose.draw = 0; pose.nut = 1; }      // a corda solta de uma vez
    if (id === 'pump') { startPump(); wasFired = true; }
    if (id === 'gatling') { pose.beltIndex++; pose.heat = Math.min(1, pose.heat + GATLING_HEAT_PER_SHOT); }
  }

  // Canos, cinta e calor da metralhadora; na recarga a cinta nova entra inteira (volta ao começo).
  function updateGatling(dt, state, events) {
    const spin = state.spin ?? 0;
    if (spin > SPIN_SOUND_REST && lastSpin <= SPIN_SOUND_REST && !state.reloading) events.push({ sound: 'spinUp' });
    lastSpin = spin;
    pose.rotorSpeed = spin / type.interval;
    pose.rotor += dt * pose.rotorSpeed;
    if (state.reloading) pose.beltIndex = pose.belt = 0;
    pose.belt = approach(pose.belt, pose.beltIndex, dt * BELT_SPEED);
    pose.heat = Math.max(0, pose.heat - dt * GATLING_HEAT_DECAY);
  }

  function startPump() {
    sincePump = 0;
    pumpEjected = pumpSounded = false;
  }

  // Lança-granadas: depois do tiro (e no fim da recarga) a mão bombeia uma vez.
  function updatePump(dt, reloading, events) {
    if (reloading) { pose.actionHand = approach(pose.actionHand, 0, dt * 8); pose.pump = approach(pose.pump, 0, dt * OPEN_SPEED); return; }
    sincePump += dt;
    const t = sincePump, span = ([a, b]) => smooth(clamp01((t - a) / (b - a)));
    pose.actionHand = sincePump === Infinity ? 0 : span(PUMP_HAND_IN) * (1 - span(PUMP_HAND_OUT));
    pose.pump = span(PUMP_BACK) * (1 - span(PUMP_FORWARD));
    if (!pumpSounded && t >= PUMP_BACK[0]) { pumpSounded = true; events.push({ sound: 'pump' }); }
    if (!pumpEjected && t >= PUMP_BACK[1]) { pumpEjected = true; if (wasFired) events.push({ eject: 1 }); }
  }

  function updateHammers(dt, reloading) {
    if (sinceFire < HAMMER_RECOCK_DELAY) return;
    pose.hammer = approach(pose.hammer, 1, dt * HAMMER_SPEED);
    // Na escopeta o cão só volta ao recarregar.
    if (id !== 'shotgun' || reloading) pose.hammers = pose.hammers.map(h => approach(h, 1, dt * HAMMER_SPEED));
  }

  // Depois do tiro a alavanca abre, cospe a cápsula e fecha; na recarga fica aberta.
  function updateRifleLever(dt, reloading, events) {
    if (reloading) {
      pose.lever = approach(pose.lever, 1, dt * OPEN_SPEED);
      leverStarted = leverEjected = true;
      return;
    }
    const t = (sinceFire - LEVER_DELAY) / LEVER_TRAVEL;
    if (t >= 0 && !leverStarted) {
      leverStarted = true;
      events.push({ sound: 'leverOpen' });
    }
    if (t >= 1 && !leverEjected) {
      leverEjected = true;
      events.push({ eject: 1, sound: 'leverClose' });
    }
    if (t >= 0 && t < 2) pose.lever = t < 1 ? t : 2 - t;
    else pose.lever = approach(pose.lever, 0, dt * OPEN_SPEED);
  }

  // Revólver de quebrar: trava, abre na dobradiça, a estrela cospe as cápsulas e, no fim, fecha com a trava.
  function updateTopBreak(dt, reloading, events) {
    pose.latch = approach(pose.latch, reloading || pose.open > 0.05 ? 1 : 0, dt * LATCH_SPEED);
    pose.open = approach(pose.open, reloading && pose.latch > 0.8 ? 1 : 0, dt * (reloading ? BREAK_SPEED : OPEN_SPEED));
    if (reloading && pose.open >= 0.95 && pendingCasings > 0) {
      events.push({ eject: pendingCasings });
      pendingCasings = 0;
      pose.extract = 1;
    }
    pose.extract = approach(pose.extract, 0, dt * EXTRACT_DECAY);
  }

  function actionHandWeight(cycle, holding) {
    const reach = clamp01((sinceFire - BOLT_HAND_IN[0]) / (BOLT_HAND_IN[1] - BOLT_HAND_IN[0]));
    const leaveAt = holding ? BOLT_HOLD_AT : 1, leave = clamp01((cycle - leaveAt) * BOLT_TIME / BOLT_HAND_OUT);
    return smooth(reach) * (1 - smooth(leave));
  }

  // Ferrolho da sniper: a mão levanta o cabo e puxa (cospe o estojo); com munição, empurra e abaixa.
  // Vazio, fica aberto; depois da recarga a mão volta e fecha.
  function updateBoltAction(dt, state, events) {
    if (state.reloading) {
      pose.boltLift = approach(pose.boltLift, 1, dt * OPEN_SPEED);
      pose.boltBack = approach(pose.boltBack, 1, dt * OPEN_SPEED);
      pose.actionHand = approach(pose.actionHand, 0, dt * 8);
      if (pose.boltBack > 0.5 && pose.spent) { pose.spent = false; events.push({ eject: 1 }); }
      boltOpened = boltEjected = boltClosed = true;
      boltClosing = 0;
      return;
    }
    if (boltClosing < BOLT_CLOSE_TIME) {
      boltClosing += dt;
      const t = boltClosing / BOLT_CLOSE_TIME;
      pose.actionHand = smooth(clamp01(t / 0.25)) * (1 - smooth(clamp01((t - 0.85) / 0.15)));
      pose.boltBack = 1 - smooth(clamp01((t - 0.25) / 0.35));
      pose.boltLift = 1 - smooth(clamp01((t - 0.6) / 0.25));
      if (t >= 0.6 && !boltClosed) { boltClosed = true; events.push({ sound: 'boltClose' }); }
      if (t < 0.6) boltClosed = false;
      return;
    }
    const cycle = (sinceFire - BOLT_DELAY) / BOLT_TIME, holding = state.ammo <= 0;
    pose.actionHand = sinceFire < Infinity ? actionHandWeight(cycle, holding) : 0;
    if (cycle < 0 || (cycle >= 1 && !holding)) {
      pose.boltLift = approach(pose.boltLift, 0, dt * OPEN_SPEED);
      pose.boltBack = approach(pose.boltBack, 0, dt * OPEN_SPEED);
      return;
    }
    if (!boltOpened) { boltOpened = true; events.push({ sound: 'boltOpen' }); }
    if (!boltEjected && cycle >= 0.4) { boltEjected = true; pose.spent = false; events.push({ eject: 1 }); }
    if (holding && cycle >= BOLT_HOLD_AT) { pose.boltLift = 1; pose.boltBack = 1; return; }
    if (!boltClosed && cycle >= 0.8) { boltClosed = true; events.push({ sound: 'boltClose' }); }
    pose.boltLift = cycle < 0.25 ? smooth(cycle / 0.25) : cycle < 0.8 ? 1 : 1 - smooth((cycle - 0.8) / 0.2);
    pose.boltBack = cycle < 0.2 ? 0 : cycle < 0.55 ? smooth((cycle - 0.2) / 0.35) : cycle < 0.8 ? 1 - smooth((cycle - 0.55) / 0.25) : 0;
  }

  // Tambor: anda um cartucho a cada tiro e volta um a cada cartucho que entra; a capa esfria aos poucos.
  function updateDrum(dt, state) {
    if (state.reloading && state.ammo > lastAmmo) pose.drumIndex -= state.ammo - lastAmmo;
    pose.drum = approach(pose.drum, pose.drumIndex, dt * DRUM_SPEED);
    pose.heat = Math.max(0, pose.heat - dt * HEAT_DECAY);
  }

  // Besta: a manivela gira enquanto a corda é puxada, a corda fica esticada com a flecha e solta no tiro,
  // com os braços e a corda vibrando.
  function updateCrossbow(dt, { reloading, ammo, roundProgress }) {
    const before = pose.draw;
    if (reloading) pose.draw = smooth(clamp01((roundProgress - 0.1) / 0.7));
    else if (ammo > 0) pose.draw = approach(pose.draw, 1, dt * STRING_COCK_SPEED);
    else pose.draw = approach(pose.draw, 0, dt * STRING_SNAP_SPEED);
    if (pose.draw > before) pose.crank += dt * CRANK_SPEED;
    pose.nut = approach(pose.nut, pose.draw > 0.95 ? 0 : 1, dt * NUT_SPEED);
    pose.flex = approach(pose.flex, 0, dt * FLEX_DECAY);
  }

  function updateReload(dt, state, events) {
    const { reloading, ammo, capacity, roundProgress, carrying } = state;
    if (id !== 'topbreak') pose.open = approach(pose.open, reloading && OPENS_ON_RELOAD.has(id) ? 1 : 0, dt * OPEN_SPEED);

    if (!SWAPS_MAGAZINE.has(id) && ammo > lastAmmo && (reloading || wasReloading)) events.push({ sound: 'roundIn' });
    // O ferrolho fecha pela mão, com som próprio no momento certo.
    if (!reloading && wasReloading && id !== 'bolt' && id !== 'pump') events.push({ sound: 'reloadEnd' });
    if (!reloading && wasReloading && id === 'pump') { startPump(); wasFired = false; }
    if (reloading && !wasReloading) {
      if (id !== 'bolt' || pose.boltBack < 0.9) events.push({ sound: 'reloadStart' });
      if (id === 'revolver' || id === 'shotgun') events.push({ eject: capacity - ammo });
      if (id === 'topbreak') pendingCasings = capacity - ammo;
      shots = 0;                                    // a escopeta volta a disparar pelo primeiro cano
    }
    if (SWAPS_MAGAZINE.has(id)) {
      if (carrying && roundProgress >= MAGAZINE_CLICK_AT && !magazineClicked) {
        magazineClicked = true;
        events.push({ sound: 'magazineIn' });
      }
      if (!reloading) magazineClicked = false;
      if (!reloading) pose.magDrop = 0;
      else if (carrying && roundProgress >= MAGAZINE_SEAT_AT) pose.magDrop = (1 - roundProgress) / (1 - MAGAZINE_SEAT_AT) * 0.99;
      else pose.magDrop = approach(pose.magDrop, 1, dt * MAG_DROP_SPEED);
      if (!reloading && wasReloading) boltRack = 1;
    }
    wasReloading = reloading;
  }

  // Ferrolho da submetralhadora e ferrolho/ação da escopeta automática: recua a cada tiro e trava aberto sem munição.
  // Na metralhadora é só a alavanca de armar, puxada uma vez no fim da recarga.
  function updateBolt(dt, state) {
    if (id === 'gatling') { boltRack = Math.max(0, boltRack - dt * 3); pose.bolt = boltRack; return; }
    if (id !== 'smg' && id !== 'autoshotgun') return;
    boltRack = Math.max(0, boltRack - dt * 5);
    const lockedBack = state.ammo === 0;
    pose.bolt = lockedBack ? 1 : Math.max(boltRack, approach(pose.bolt, 0, dt * BOLT_RETURN));
  }

  function update(dt, state) {
    const events = [];
    sinceFire += dt;
    pose.t += dt;
    pose.ammo = state.ammo;
    pose.spin = approach(pose.spin, 1, dt * SPIN_SPEED);
    updateHammers(dt, state.reloading);
    if (id === 'rifle') updateRifleLever(dt, state.reloading, events);
    if (id === 'topbreak') updateTopBreak(dt, state.reloading, events);
    if (id === 'bolt') updateBoltAction(dt, state, events);
    if (id === 'autoshotgun') updateDrum(dt, state);
    if (id === 'crossbow') updateCrossbow(dt, state);
    if (id === 'pump') updatePump(dt, state.reloading, events);
    if (id === 'gatling') updateGatling(dt, state, events);
    updateReload(dt, state, events);
    updateBolt(dt, state);
    if ((id === 'smg' || id === 'autoshotgun' || id === 'gatling') && sinceFire === dt) events.push({ eject: 1 });
    lastAmmo = state.ammo;
    return events;
  }

  return { pose, fire, update };
}
