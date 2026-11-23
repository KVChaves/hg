import { CAR_MAX_HP } from '../config.js';
import { inGap, surfaceAt, trackAt, wrapDistance } from '../world/track.js';
import { createTrapVisual } from '../world/trapVisuals.js';
import { damagePlayer } from './car.js';
import { shockedByLightning } from './effects.js';
import { damageOpponent } from './opponents.js';
import { raiseShield } from './shield.js';
import { EXTINGUISHER_LIFE, GROUND_FIRE, hazardType, TRAP_TYPES, TRAPS_UNLOCK_TIME } from './trapTypes.js';

const NOTICE_TIME = 1.4;
const GAP_BACKOFF = 3;
const DROP_DISTANCE_BEHIND = 8, EXPLOSION_VISIBLE_TIME = 0.4;
const DROPPER_SAFE_TIME = 2.5;                       // quem soltou a dinamite não a aciona logo em seguida
const THROW_BACK = 9, THROW_SIDE = 5, THROW_TIME = 0.5, THROW_SPEED_LOSS = 0.25, THROW_SPIN = 3, BOT_THROW_KNOCK = 8;   // o carro que pisa é jogado na diagonal para trás
const MIN_BLAST_SHARE = 0.4;                         // nas bordas da explosão o dano é 40% do de quem pisou
const BLAST_PUSH = 8, BOT_BLAST_KNOCK = 12, BLAST_FALLOFF = 0.6;   // m/s; o bot volta para a faixa sozinho, então o empurrão lateral nele é maior

// O bagageiro: armadilhas e power-ups, usados com a tecla E.
export function createTraps({ scene, car, race, harpoon, burning, mines, nets, emp, onSound, onExtinguisher, onPlaced, onCaught, onDetonated = () => {}, onDestroyed = () => {} }) {
  const traps = { slots: [], selected: 0, active: [], notice: { text: '', time: 0, good: false } };
  const throws = [];
  traps.aiming = false;                               // mira de arremesso aberta (arpão, mina e rede)
  traps.aimYaw = () => car.yaw;                       // para onde o jogador mira (main.js põe a direção do olhar)
  traps.aimLock = null;                               // com a mira aberta: o carro que o item travaria agora (nulo: sem alvo)
  const THROWN = new Set(['harpoon', 'mine', 'net']);                                  // carros sendo jogados por uma explosão

  // O vidro do jogador encurta o que tapa a visão (game/carUpgrades.js).
  const effectScale = (racer, effect) => (racer.isPlayer ? { paint: car.parts.blind, smoke: car.parts.blind }[effect] ?? 1 : 1);

  Object.defineProperty(traps, 'current', { get: () => traps.slots[traps.selected] });

  // `items` é a lista de { id, count } comprada na garagem.
  traps.setLoadout = items => {
    traps.slots = items.map(({ id, count }) => ({ type: TRAP_TYPES[id], charges: count, capacity: count }));
    traps.selected = 0;
  };

  traps.cycle = direction => {
    traps.aiming = false;
    const count = traps.slots.length;
    if (count) traps.selected = (traps.selected + direction + count) % count;
  };

  traps.unlockIn = () => Math.max(0, TRAPS_UNLOCK_TIME - race.time);
  // Itens de defesa valem desde a largada; os outros esperam TRAPS_UNLOCK_TIME. Sem `type`, pergunta pelos itens que esperam.
  traps.isUnlocked = type => race.started && (type?.category === 'defense' || traps.unlockIn() === 0);
  // O botão do painel acende só quando o item selecionado pode ser usado.
  traps.isReady = () => Boolean(traps.current) && traps.isUnlocked(traps.current.type) && traps.current.charges > 0;

  const lifeCap = () => 1;                           // o extintor ignora a vida reduzida por destruições
  const showNotice = (text, good = false) => Object.assign(traps.notice, { text, time: NOTICE_TIME, good });

  // Motivo de o item selecionado não poder ser usado agora; nulo se puder.
  function blockedBy(type) {
    if (!traps.isUnlocked(type)) return `BAGAGEIRO EM ${Math.ceil(traps.unlockIn())}`;
    if (type.id === 'extinguisher' && car.health >= lifeCap()) return 'VIDA CHEIA';
    if (type.id === 'harpoon' && harpoon.busy) return 'ARPAO EM USO';
    if (car.effects.emp > 0) return shockedByLightning(car.effects) ? 'SEM ITENS' : 'EMP: SEM ITENS';
    if (type.id === 'shield' && car.effects.shield > 0) return 'ESCUDO ATIVO';
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
    else racer.hp = Math.min(racer.maxHp, racer.hp + racer.maxHp * EXTINGUISHER_LIFE);
    racer.effects.burning = 0;                       // e apaga o fogo
    onSound('extinguisher', racer.x, racer.z);
    onExtinguisher(racer);
  };

  // Vale para qualquer piloto: o escudo absorve parte do dano por um tempo (game/shield.js).
  traps.raiseShield = racer => {
    raiseShield(racer, racer.isPlayer ? 1 : racer.maxHp);
    onSound('shield', racer.x, racer.z);
  };

  // Power-ups de efeito imediato, para o jogador ou um bot. Devolve se foi usado.
  traps.usePower = (id, racer) => {
    if (racer.effects.emp > 0) return false;         // atingido por EMP: nenhum item funciona
    if (id === 'shield') {
      traps.raiseShield(racer);
      if (racer.isPlayer) showNotice('ESCUDO ATIVO', true);
    } else if (id === 'emp') {
      const defused = emp.pulse(racer);
      if (racer.isPlayer) showNotice(defused ? 'EMP: MINA DESARMADA' : 'PULSO EMP', true);
    } else if (id === 'mine') {
      if (!mines.launch(racer)) return false;
      if (racer.isPlayer) showNotice('MINA LANCADA', true);
    } else if (id === 'net') {
      if (!nets.fire(racer)) { if (racer.isPlayer) showNotice('SEM ALVO A FRENTE'); return false; }
      if (racer.isPlayer) showNotice('REDE LANCADA', true);
    }
    return true;
  };

  const POWERUPS = {
    extinguisher() {
      traps.extinguish(race.field[0]);
      showNotice(`+${Math.round(EXTINGUISHER_LIFE * 100)}% VIDA`, true);
    },
    harpoon() { harpoon.fire(); },
    shield() { traps.usePower('shield', race.field[0]); },
    emp() { traps.usePower('emp', race.field[0]); },
    mine() { traps.usePower('mine', race.field[0]); },
    net() { return traps.usePower('net', race.field[0]); },   // sem alvo à frente devolve false e a carga não se gasta
  };

  // `owner` é o piloto que soltou; nulo quando foi o jogador deste navegador. `dropper` é sempre quem soltou:
  // a armadilha já vale ao cair, mas não pega quem ainda está dentro da área dela nesse momento (a fumaça é longa).
  function place(type, dist, lane, owner, dropper, id = Math.random().toString(36).slice(2, 8)) {
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
      type, visual, x, z, dist, lane, owner, dropper, id,
      age: 0, explodedFor: -1,
      hitBy: new Set(), dodgers: new Map(),
    };
    if (type.effect && touches(trap, dropper)) trap.hitBy.add(dropper);
    traps.active.push(trap);
    return trap;
  }

  traps.drop = () => {
    if (!traps.canDrop()) return;
    const slot = traps.current;
    if (THROWN.has(slot.type.id)) { traps.aiming = !traps.aiming; return; }   // E abre/fecha a mira; o clique esquerdo lança
    slot.charges--;
    if (slot.type.powerup) { if (POWERUPS[slot.type.id]() === false) slot.charges++; }
    else {
      const trap = place(slot.type, race.playerDist - DROP_DISTANCE_BEHIND, car.lateral, null, race.field[0]);
      onPlaced(slot.type, race.playerDist - DROP_DISTANCE_BEHIND, car.lateral, race.field[0], trap.id);
    }
  };

  // O carro que o item de arremesso travaria agora, mirando para `yaw` (nulo se ninguém está na área da mira).
  const aimTarget = (id, yaw) => {
    const me = race.field[0];
    if (id === 'harpoon') return harpoon.targetAt(yaw);
    if (id === 'mine') return mines.aimTarget(me, yaw);
    return nets.targetFor(me, yaw);
  };

  // Clique esquerdo com a mira aberta: arremessa o item na direção do olhar (`yaw`). Devolve se lançou.
  traps.throwItem = yaw => {
    const slot = traps.current;
    if (!traps.aiming) return false;
    if (!slot || !THROWN.has(slot.type.id) || slot.charges <= 0 || !traps.canDrop()) { traps.aiming = false; return false; }
    if (!aimTarget(slot.type.id, yaw)) { showNotice('SEM ALVO NA MIRA'); return false; }   // a mira continua aberta e a carga não se gasta
    traps.aiming = false;
    slot.charges--;
    if (slot.type.id === 'harpoon') harpoon.fire();
    else if (slot.type.id === 'net') { nets.fire(race.field[0], yaw); showNotice('REDE LANCADA', true); }
    else { mines.throwStraight(race.field[0], yaw); showNotice('MINA LANCADA', true); }
    return true;
  };

  traps.dropFrom = (opponent, type) => {
    const trap = place(type, opponent.dist - DROP_DISTANCE_BEHIND, opponent.lane, opponent, opponent);
    onPlaced(type, opponent.dist - DROP_DISTANCE_BEHIND, opponent.lane, opponent, trap.id);
  };

  // Flecha incendiária que caiu no chão: o asfalto fica queimando ali. `shooter` é quem atirou (de race.field);
  // `owner` segue a regra de `place` (nulo quando foi o jogador deste navegador). No vão não há chão para queimar.
  traps.burnGround = (dist, lane, owner, shooter) => {
    if (inGap(dist)) return;
    const trap = place(GROUND_FIRE, dist, lane, owner, shooter);
    onSound(GROUND_FIRE.id, trap.x, trap.z);
    onPlaced(GROUND_FIRE, dist, lane, shooter, trap.id);
  };

  // Armadilha solta em outro navegador: aparece aqui e só afeta os carros simulados aqui.
  traps.placeFromNetwork = (typeId, dist, lane, owner, id) => {
    const type = hazardType(typeId);
    if (type) place(type, dist, lane, owner, owner, id);
  };
  // Outro navegador acionou a dinamite: aqui ela explode também, para quem estiver perto.
  traps.detonateFromNetwork = id => {
    const trap = traps.active.find(candidate => candidate.id === id && candidate.explodedFor < 0);
    if (trap) explode(trap, null);
  };

  // A linha de visão de (x0, z0) até (x1, z1) passa por alguma nuvem de fumaça?
  traps.smokeBlocks = (x0, z0, x1, z1) => traps.active.some(({ type, x, z }) => {
    if (type.id !== 'smoke') return false;
    const dx = x1 - x0, dz = z1 - z0;
    const t = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(x0 + dx * t - x, z0 + dz * t - z) < type.halfLength;
  });

  traps.reset = () => {
    for (const trap of [...traps.active]) remove(trap);
    throws.length = 0;
    traps.aiming = false;
    traps.notice.time = 0;
  };

  function remove(trap) {
    scene.remove(trap.visual.group);
    trap.visual.dispose();
    traps.active.splice(traps.active.indexOf(trap), 1);
  }

  // O carro que pisou na dinamite é jogado na diagonal para trás; os outros perto da explosão só são empurrados.
  function throwCar(racer, trap) {
    const side = Math.sign(racer.lane - trap.lane) || (Math.random() < 0.5 ? -1 : 1), spin = side * THROW_SPIN;
    if (racer.isPlayer) {
      car.vx *= THROW_SPEED_LOSS;
      car.vz *= THROW_SPEED_LOSS;
      car.spin += spin;
    } else {
      racer.v *= THROW_SPEED_LOSS;
      racer.spin += spin;
      racer.knock += side * BOT_THROW_KNOCK;
    }
    throws.push({ racer, side, left: THROW_TIME });
  }

  function updateThrows(dt) {
    for (let i = throws.length - 1; i >= 0; i--) {
      const { racer, side } = throws[i], step = dt / THROW_TIME;
      const t = trackAt(racer.dist);
      if (racer.isPlayer) {
        car.x += (-t.tx * THROW_BACK + -t.tz * side * THROW_SIDE) * step;
        car.z += (-t.tz * THROW_BACK + t.tx * side * THROW_SIDE) * step;
      } else {
        racer.dist -= THROW_BACK * step;
      }
      if ((throws[i].left -= dt) <= 0) throws.splice(i, 1);
    }
  }

  // Dano da explosão em quem é simulado aqui (cada navegador cuida dos seus carros). O abate conta para quem soltou a dinamite; quem pisa na própria não conta.
  function blastDamage(racer, trap, amount) {
    const owner = trap.owner ?? trap.dropper, attacker = owner && owner !== racer ? owner : null;
    if (racer.isPlayer) {
      const wasAlive = car.health > 0;
      damagePlayer(car, amount / CAR_MAX_HP * car.parts.bullet);
      if (wasAlive && car.health <= 0) onDestroyed(racer, attacker, 'splash');
    } else if (damageOpponent(racer, amount, attacker)) {
      onDestroyed(racer, attacker, 'splash');
    }
  }

  function explode(trap, trigger) {
    trap.explodedFor = 0;
    onSound(trap.type.id, trap.x, trap.z);
    for (const racer of race.field) {
      if (racer.dead > 0 || racer.remote) continue;
      if (racer === trigger) { throwCar(racer, trap); blastDamage(racer, trap, trap.type.damage); onCaught(racer, trap.type, trap.owner, trap.id); continue; }
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
      blastDamage(racer, trap, trap.type.damage * Math.max(MIN_BLAST_SHARE, strength));
      onCaught(racer, trap.type, trap.owner, trap.id);
    }
  }

  function touches(trap, racer) {
    const { halfLength, halfWidth } = trap.type;
    return Math.abs(wrapDistance(racer.dist - trap.dist)) < halfLength + 2 && Math.abs(racer.lane - trap.lane) < halfWidth + 1;
  }

  // Fogo no chão: queima quem está em cima enquanto estiver; avisa e toca o som só na primeira vez.
  function updateGroundFire(trap) {
    if (trap.age > trap.type.life) { remove(trap); return; }
    for (const racer of race.field) {
      if (racer.remote || racer.dead > 0 || !touches(trap, racer)) continue;
      burning.ignite(racer, trap.owner ?? trap.dropper, trap.type.duration);
      if (trap.hitBy.has(racer)) continue;
      trap.hitBy.add(racer);
      onSound(trap.type.id, racer.x, racer.z);
      onCaught(racer, trap.type, trap.owner, trap.id);
    }
  }

  function updateGroundTrap(trap) {
    if (trap.age > trap.type.life) { remove(trap); return; }
    for (const racer of race.field) {
      if (racer.remote || racer.dead > 0 || trap.hitBy.has(racer) || !touches(trap, racer)) continue;
      trap.hitBy.add(racer);
      racer.effects[trap.type.effect] = trap.type.duration * effectScale(racer, trap.type.effect);
      onSound(trap.type.id, racer.x, racer.z);
      onCaught(racer, trap.type, trap.owner, trap.id);
    }
  }

  function updateDynamite(trap, dt) {
    if (trap.explodedFor >= 0) {
      trap.explodedFor += dt;
      trap.visual.showExplosion(trap.explodedFor / EXPLOSION_VISIBLE_TIME);
      if (trap.explodedFor > EXPLOSION_VISIBLE_TIME) remove(trap);
      return;
    }
    if (trap.age > trap.type.life) { remove(trap); return; }
    // Explode quando um carro simulado aqui passa por cima.
    const trigger = race.field.find(racer => !racer.remote && racer.dead <= 0 && !(racer === trap.dropper && trap.age < DROPPER_SAFE_TIME) && touches(trap, racer));
    if (!trigger) return;
    explode(trap, trigger);
    onDetonated(trap.id);
  }

  traps.update = dt => {
    if (traps.aiming && !traps.canDrop()) traps.aiming = false;
    traps.aimLock = traps.aiming && THROWN.has(traps.current?.type.id) ? aimTarget(traps.current.type.id, traps.aimYaw()) : null;
    traps.notice.time = Math.max(0, traps.notice.time - dt);
    updateThrows(dt);
    for (const trap of [...traps.active]) {
      trap.age += dt;
      trap.visual.update(dt);
      if (trap.type === GROUND_FIRE) updateGroundFire(trap);
      else if (trap.type.effect) updateGroundTrap(trap);
      else updateDynamite(trap, dt);
    }
  };

  return traps;
}
