import { inGap, surfaceAt, trackAt, wrapDistance } from '../world/track.js';
import { createTrapVisual } from '../world/trapVisuals.js';
import { lifeAfterDestruction } from './carFlip.js';
import { EXTINGUISHER_LIFE, TRAP_TYPES, TRAPS_UNLOCK_TIME } from './trapTypes.js';

const NOTICE_TIME = 1.4;
const GAP_BACKOFF = 3;
const DROP_DISTANCE_BEHIND = 8, EXPLOSION_VISIBLE_TIME = 0.4;
const BLAST_PUSH = 8, BOT_BLAST_KNOCK = 12, BLAST_FALLOFF = 0.6;   // m/s; o bot volta para a faixa sozinho, então o empurrão lateral nele é maior

// O bagageiro: armadilhas e power-ups, usados com a tecla E.
export function createTraps({ scene, car, race, harpoon, onSound, onExtinguisher, onPlaced, onCaught }) {
  const traps = { slots: [], selected: 0, active: [], notice: { text: '', time: 0, good: false } };

  Object.defineProperty(traps, 'current', { get: () => traps.slots[traps.selected] });

  // `items` é a lista de { id, count } comprada na garagem.
  traps.setLoadout = items => {
    traps.slots = items.map(({ id, count }) => ({ type: TRAP_TYPES[id], charges: count, capacity: count }));
    traps.selected = 0;
  };

  traps.cycle = direction => {
    const count = traps.slots.length;
    if (count) traps.selected = (traps.selected + direction + count) % count;
  };

  traps.unlockIn = () => Math.max(0, TRAPS_UNLOCK_TIME - race.time);
  traps.isUnlocked = () => race.started && traps.unlockIn() === 0;
  // O botão do painel acende só quando o item selecionado pode ser usado.
  traps.isReady = () => traps.isUnlocked() && Boolean(traps.current) && traps.current.charges > 0;

  const lifeCap = () => lifeAfterDestruction(car.destroyed);
  const showNotice = (text, good = false) => Object.assign(traps.notice, { text, time: NOTICE_TIME, good });

  // Motivo de o item selecionado não poder ser usado agora; nulo se puder.
  function blockedBy(type) {
    if (!traps.isUnlocked()) return `BAGAGEIRO EM ${Math.ceil(traps.unlockIn())}`;
    if (type.id === 'extinguisher' && car.health >= lifeCap()) return 'VIDA CHEIA';
    if (type.id === 'harpoon' && harpoon.busy) return 'ARPAO EM USO';
    return null;
  }

  traps.explainDenied = () => {
    if (!traps.current || !race.started || car.wrecked > 0 || car.overturned || traps.current.charges <= 0) return;
    const reason = blockedBy(traps.current.type);
    if (reason) showNotice(reason);
  };

  traps.canDrop = () => {
    const slot = traps.current;
    return Boolean(slot) && slot.charges > 0 && race.started && car.wrecked <= 0 && !car.overturned && !blockedBy(slot.type);
  };

  // Vale para qualquer piloto: devolve uma fração da vida total, até o teto atual dele.
  traps.extinguish = racer => {
    if (racer.isPlayer) car.health = Math.min(lifeCap(), car.health + EXTINGUISHER_LIFE);
    else racer.hp = Math.min(racer.maxHp * lifeAfterDestruction(racer.destroyed), racer.hp + racer.maxHp * EXTINGUISHER_LIFE);
    onSound('extinguisher', racer.x, racer.z);
    onExtinguisher(racer);
  };

  const POWERUPS = {
    extinguisher() {
      traps.extinguish(race.field[0]);
      showNotice(`+${Math.round(EXTINGUISHER_LIFE * 100)}% VIDA`, true);
    },
    harpoon() { harpoon.fire(); },
  };

  // `owner` é o piloto que soltou; nulo quando foi o jogador deste navegador. `dropper` é sempre quem soltou:
  // a armadilha já vale ao cair, mas não pega quem ainda está dentro da área dela nesse momento (a fumaça é longa).
  function place(type, dist, lane, owner, dropper) {
    while (inGap(dist)) dist -= GAP_BACKOFF;         // no vão não há chão: a armadilha fica na beirada
    const t = trackAt(dist), x = t.x - t.tz * lane, z = t.z + t.tx * lane;
    const pitch = Math.atan(t.slope), yaw = Math.atan2(-t.tx, -t.tz);
    const point = surfaceAt(dist, lane);
    const visual = createTrapVisual(type);
    visual.group.position.set(point.x, point.y, point.z);
    visual.group.rotation.order = 'YXZ';
    visual.group.rotation.set(pitch, yaw, point.roll);
    scene.add(visual.group);

    const trap = {
      type, visual, x, z, dist, lane, owner,
      age: 0, fuse: type.fuse ?? 0, explodedFor: -1,
      hitBy: new Set(), dodgers: new Map(),
    };
    if (type.effect && touches(trap, dropper)) trap.hitBy.add(dropper);
    traps.active.push(trap);
  }

  traps.drop = () => {
    if (!traps.canDrop()) return;
    const slot = traps.current;
    slot.charges--;
    if (slot.type.powerup) POWERUPS[slot.type.id]();
    else {
      place(slot.type, race.playerDist - DROP_DISTANCE_BEHIND, car.lateral, null, race.field[0]);
      onPlaced(slot.type, race.playerDist - DROP_DISTANCE_BEHIND, car.lateral, race.field[0]);
    }
  };

  traps.dropFrom = (opponent, type) => {
    place(type, opponent.dist - DROP_DISTANCE_BEHIND, opponent.lane, opponent, opponent);
    onPlaced(type, opponent.dist - DROP_DISTANCE_BEHIND, opponent.lane, opponent);
  };

  // Armadilha solta em outro navegador: aparece aqui e só afeta os carros simulados aqui.
  traps.placeFromNetwork = (typeId, dist, lane, owner) => place(TRAP_TYPES[typeId], dist, lane, owner, owner);

  // A linha de visão de (x0, z0) até (x1, z1) passa por alguma nuvem de fumaça?
  traps.smokeBlocks = (x0, z0, x1, z1) => traps.active.some(({ type, x, z }) => {
    if (type.id !== 'smoke') return false;
    const dx = x1 - x0, dz = z1 - z0;
    const t = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(x0 + dx * t - x, z0 + dz * t - z) < type.halfLength;
  });

  traps.reset = () => {
    for (const trap of [...traps.active]) remove(trap);
    traps.notice.time = 0;
  };

  function remove(trap) {
    scene.remove(trap.visual.group);
    trap.visual.dispose();
    traps.active.splice(traps.active.indexOf(trap), 1);
  }

  // A dinamite não causa dano: só empurra para longe quem estiver perto da explosão.
  function explode(trap) {
    trap.explodedFor = 0;
    onSound(trap.type.id, trap.x, trap.z);
    for (const racer of race.field) {
      if (racer.dead > 0 || racer.remote) continue;
      const dx = racer.x - trap.x, dz = racer.z - trap.z, distance = Math.hypot(dx, dz);
      if (distance > trap.type.radius) continue;
      const d = distance || 1, awayX = dx / d, awayZ = dz / d, strength = 1 - BLAST_FALLOFF * distance / trap.type.radius;
      if (racer.isPlayer) {
        car.vx += awayX * BLAST_PUSH * strength;
        car.vz += awayZ * BLAST_PUSH * strength;
      } else {
        const forward = -Math.sin(racer.yaw) * awayX - Math.cos(racer.yaw) * awayZ, side = Math.cos(racer.yaw) * awayX - Math.sin(racer.yaw) * awayZ;
        racer.v = Math.max(0, racer.v + forward * BLAST_PUSH * strength);
        racer.knock += side * BOT_BLAST_KNOCK * strength;
      }
      onCaught(racer, trap.type, trap.owner);
    }
  }

  function touches(trap, racer) {
    const { halfLength, halfWidth } = trap.type;
    return Math.abs(wrapDistance(racer.dist - trap.dist)) < halfLength + 2 && Math.abs(racer.lane - trap.lane) < halfWidth + 1;
  }

  function updateGroundTrap(trap) {
    if (trap.age > trap.type.life) { remove(trap); return; }
    for (const racer of race.field) {
      if (racer.remote || racer.dead > 0 || trap.hitBy.has(racer) || !touches(trap, racer)) continue;
      trap.hitBy.add(racer);
      racer.effects[trap.type.effect] = trap.type.duration;
      onSound(trap.type.id, racer.x, racer.z);
      onCaught(racer, trap.type, trap.owner);
    }
  }

  function updateDynamite(trap, dt) {
    if (trap.explodedFor >= 0) {
      trap.explodedFor += dt;
      trap.visual.showExplosion(trap.explodedFor / EXPLOSION_VISIBLE_TIME);
      if (trap.explodedFor > EXPLOSION_VISIBLE_TIME) remove(trap);
    } else if ((trap.fuse -= dt) <= 0) {
      explode(trap);
    }
  }

  traps.update = dt => {
    traps.notice.time = Math.max(0, traps.notice.time - dt);
    for (const trap of [...traps.active]) {
      trap.age += dt;
      trap.visual.update(dt);
      if (trap.type.effect) updateGroundTrap(trap);
      else updateDynamite(trap, dt);
    }
  };

  return traps;
}
