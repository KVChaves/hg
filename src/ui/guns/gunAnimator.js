import { familyOf, WEAPON_TYPES } from '../../game/weaponTypes.js';

// Transforma o estado da arma em movimento das partes. `update` devolve os eventos do quadro
// (cápsulas a ejetar e sons a tocar). O jeito de mover segue o `style` da arma (ou a família dela):
// revolver, shotgun, smg, rifle (alavanca), bolt (ferrolho), autoshotgun, crossbow e flame.

const HAMMER_RECOCK_DELAY = 0.12, HAMMER_SPEED = 9, SPIN_SPEED = 7;
const OPEN_SPEED = 9, BOLT_RETURN = 22, MAG_DROP_SPEED = 7;
const LEVER_DELAY = 0.16, LEVER_TRAVEL = 0.22;
const BOLT_DELAY = 0.3, BOLT_TIME = 0.7;           // ferrolho da sniper: pausa depois do tiro e duração do ciclo
const STRING_SNAP_SPEED = 40, STRING_COCK_SPEED = 6, FLEX_DECAY = 7;
const VALVE_HOLD = 0.12, VALVE_SPEED = 14;

// Momento do ciclo em que o pente sai da mão e encaixa na arma.
export const MAGAZINE_SEAT_AT = 0.86;
const MAGAZINE_CLICK_AT = 0.94;                    // o clique do som cai no fim do encaixe

const approach = (value, target, step) => (value < target ? Math.min(target, value + step) : Math.max(target, value - step));
const clamp01 = v => Math.max(0, Math.min(1, v));
const smooth = t => t * t * (3 - 2 * t);
const OPENS_ON_RELOAD = new Set(['revolver', 'shotgun', 'autoshotgun']);
const SWAPS_MAGAZINE = new Set(['smg', 'flame']);   // trocam o pente (ou o tanque) inteiro de uma vez

export function createGunAnimator(weaponId) {
  const type = WEAPON_TYPES[weaponId], id = type.style ?? familyOf(weaponId);
  const pose = {
    hammer: 1, hammers: [1, 1], spin: 0, open: 0, bolt: 0, lever: 0, magDrop: 0, ammo: type.magazine,
    boltLift: 0, boltBack: 0, draw: 0, flex: 0, valve: 0, t: 0,
  };
  let sinceFire = Infinity, shots = 0, leverEjected = true, wasReloading = false, boltRack = 0, magazineClicked = false, leverStarted = true, lastAmmo = type.magazine;
  let boltOpened = true, boltEjected = true, boltClosed = true;

  function fire() {
    sinceFire = 0;
    shots++;
    pose.hammer = 0;
    pose.hammers[(shots - 1) % 2] = 0;
    pose.spin = 0;
    if (id === 'smg' || id === 'autoshotgun') pose.bolt = 1;
    if (id === 'rifle') leverEjected = leverStarted = false;
    if (id === 'bolt') boltOpened = boltEjected = boltClosed = false;
    if (id === 'crossbow') { pose.flex = 1; pose.draw = 0; }      // a corda solta de uma vez
    if (id === 'flame') pose.valve = 1;
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

  // Ferrolho da sniper: levanta o cabo, puxa (cospe o estojo), empurra e abaixa. Na recarga fica aberto.
  function updateBoltAction(dt, reloading, events) {
    if (reloading) {
      pose.boltLift = approach(pose.boltLift, 1, dt * OPEN_SPEED);
      pose.boltBack = approach(pose.boltBack, 1, dt * OPEN_SPEED);
      boltOpened = boltEjected = boltClosed = true;
      return;
    }
    const t = (sinceFire - BOLT_DELAY) / BOLT_TIME;
    if (t < 0 || t >= 1) {
      pose.boltLift = approach(pose.boltLift, 0, dt * OPEN_SPEED);
      pose.boltBack = approach(pose.boltBack, 0, dt * OPEN_SPEED);
      return;
    }
    if (!boltOpened) { boltOpened = true; events.push({ sound: 'boltOpen' }); }
    if (!boltEjected && t >= 0.4) { boltEjected = true; events.push({ eject: 1 }); }
    if (!boltClosed && t >= 0.8) { boltClosed = true; events.push({ sound: 'boltClose' }); }
    pose.boltLift = t < 0.25 ? smooth(t / 0.25) : t < 0.8 ? 1 : 1 - smooth((t - 0.8) / 0.2);
    pose.boltBack = t < 0.2 ? 0 : t < 0.55 ? smooth((t - 0.2) / 0.35) : t < 0.8 ? 1 - smooth((t - 0.55) / 0.25) : 0;
  }

  // Besta: a corda é puxada na recarga, fica esticada com a flecha e solta no tiro, com os braços balançando.
  function updateCrossbow(dt, { reloading, ammo, roundProgress }) {
    if (reloading) pose.draw = smooth(clamp01((roundProgress - 0.1) / 0.7));
    else if (ammo > 0) pose.draw = approach(pose.draw, 1, dt * STRING_COCK_SPEED);
    else pose.draw = approach(pose.draw, 0, dt * STRING_SNAP_SPEED);
    pose.flex = approach(pose.flex, 0, dt * FLEX_DECAY);
  }

  function updateFlame(dt) {
    pose.valve = sinceFire < VALVE_HOLD ? approach(pose.valve, 1, dt * VALVE_SPEED) : approach(pose.valve, 0, dt * VALVE_SPEED);
  }

  function updateReload(dt, state, events) {
    const { reloading, ammo, capacity, roundProgress, carrying } = state;
    pose.open = approach(pose.open, reloading && OPENS_ON_RELOAD.has(id) ? 1 : 0, dt * OPEN_SPEED);

    if (!SWAPS_MAGAZINE.has(id) && ammo > lastAmmo && (reloading || wasReloading)) events.push({ sound: 'roundIn' });
    lastAmmo = ammo;
    if (!reloading && wasReloading) events.push({ sound: 'reloadEnd' });
    if (reloading && !wasReloading) {
      events.push({ sound: 'reloadStart' });
      if (id === 'revolver' || id === 'shotgun') events.push({ eject: capacity - ammo });
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
  function updateBolt(dt, state) {
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
    if (id === 'bolt') updateBoltAction(dt, state.reloading, events);
    if (id === 'crossbow') updateCrossbow(dt, state);
    if (id === 'flame') updateFlame(dt);
    updateReload(dt, state, events);
    updateBolt(dt, state);
    if ((id === 'smg' || id === 'autoshotgun') && sinceFire === dt) events.push({ eject: 1 });
    return events;
  }

  return { pose, fire, update };
}
