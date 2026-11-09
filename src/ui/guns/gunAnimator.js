import { WEAPON_TYPES } from '../../game/weaponTypes.js';

// Transforma o estado da arma em movimento das partes. `update` devolve os eventos do quadro
// (cápsulas a ejetar e sons a tocar).

const HAMMER_RECOCK_DELAY = 0.12, HAMMER_SPEED = 9, SPIN_SPEED = 7;
const OPEN_SPEED = 9, BOLT_RETURN = 22, MAG_DROP_SPEED = 7;
const LEVER_DELAY = 0.16, LEVER_TRAVEL = 0.22;

// Momento do ciclo em que o pente sai da mão e encaixa na arma.
export const MAGAZINE_SEAT_AT = 0.86;
const MAGAZINE_CLICK_AT = 0.94;                    // o clique do som cai no fim do encaixe

const approach = (value, target, step) => (value < target ? Math.min(target, value + step) : Math.max(target, value - step));

export function createGunAnimator(id) {
  const type = WEAPON_TYPES[id];
  const pose = { hammer: 1, hammers: [1, 1], spin: 0, open: 0, bolt: 0, lever: 0, magDrop: 0, ammo: type.magazine };
  let sinceFire = Infinity, shots = 0, leverEjected = true, wasReloading = false, boltRack = 0, magazineClicked = false, leverStarted = true, lastAmmo = type.magazine;

  function fire() {
    sinceFire = 0;
    shots++;
    pose.hammer = 0;
    pose.hammers[(shots - 1) % 2] = 0;
    pose.spin = 0;
    if (id === 'smg') pose.bolt = 1;
    if (id === 'rifle') leverEjected = leverStarted = false;
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

  function updateReload(dt, state, events) {
    const { reloading, ammo, capacity, roundProgress, carrying } = state;
    pose.open = approach(pose.open, reloading && id !== 'smg' && id !== 'rifle' ? 1 : 0, dt * OPEN_SPEED);

    if (id !== 'smg' && ammo > lastAmmo && (reloading || wasReloading)) events.push({ sound: 'roundIn' });
    lastAmmo = ammo;
    if (!reloading && wasReloading) events.push({ sound: 'reloadEnd' });
    if (reloading && !wasReloading) {
      events.push({ sound: 'reloadStart' });
      if (id === 'revolver' || id === 'shotgun') events.push({ eject: capacity - ammo });
      shots = 0;                                    // a escopeta volta a disparar pelo primeiro cano
    }
    if (id === 'smg') {
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

  function updateBolt(dt, state) {
    if (id !== 'smg') return;
    boltRack = Math.max(0, boltRack - dt * 5);
    const lockedBack = state.ammo === 0;
    pose.bolt = lockedBack ? 1 : Math.max(boltRack, approach(pose.bolt, 0, dt * BOLT_RETURN));
  }

  function update(dt, state) {
    const events = [];
    sinceFire += dt;
    pose.ammo = state.ammo;
    pose.spin = approach(pose.spin, 1, dt * SPIN_SPEED);
    updateHammers(dt, state.reloading);
    if (id === 'rifle') updateRifleLever(dt, state.reloading, events);
    updateReload(dt, state, events);
    updateBolt(dt, state);
    if (id === 'smg' && sinceFire === dt) events.push({ eject: 1 });
    return events;
  }

  return { pose, fire, update };
}
