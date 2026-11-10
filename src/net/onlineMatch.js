import { CAR_MAX_HP } from '../config.js';
import { bearingFrom, damagePlayer } from '../game/car.js';
import { createMatch } from '../game/championship.js';
import { damageOpponent } from '../game/opponents.js';
import { hazardType } from '../game/trapTypes.js';
import { BIOMES, pickBiome } from '../world/biomes/index.js';
import { createHarpoonVisual } from '../world/harpoonVisual.js';

// Partida online. Cada navegador simula o próprio carro e o admin simula os bots; todos enviam a posição
// do que simulam. Dano e puxões vão para quem simula o alvo, que é quem aplica. O admin marca o ritmo:
// garagem, largada, fim da corrida e próxima rodada.

const SNAPSHOT_INTERVAL = 1 / 15;
const GARAGE_TIME = 45, GARAGE_GRACE = 1, RESULTS_TIME = 12, FINISH_GRACE = 30;
const HIT_FLASH_TIME = 0.3, HARPOON_HEIGHT = 0.62, NOSE_FORWARD = 2.3;
const BOT_PREFIX = 'bot';

const round = value => Math.round(value * 100) / 100;
const isBotId = id => id.startsWith(BOT_PREFIX);

export function createOnlineMatch({ onPlayerKilledBy = () => {}, onPlayerShot = () => {}, net, scene, race, car, opponents, combat, traps, burning, foam, harpoon, pulls, weapon, look, garage, results, podium, getSpec, setRacerCount, setMatch, getMatch, getMatchKills, beginRace, getBiome, playAt, creditKill, rewardKillFor, announceTrapCatch, obstacles, onLateJoin }) {
  const byId = new Map(), harpoonVisuals = new Map(), ready = new Set(), pool = [...opponents], killsOf = new Map();
  let isHost = false, phase = 'idle', phaseTimer = 0, snapshotTimer = 0, finishGrace = 0;

  const online = { active: false, start, update, markReady, readyRoster, returnToLobby, onRoomChange, sendKill, sendCaught, sendShot, sendTrap, sendTrapBoom, sendExtinguisher, sendPull, sendObstacle, sendObstacleBreak };
  const me = () => race.field[0];
  const humanIds = () => race.field.filter(racer => !isBotId(racer.netId)).map(racer => racer.netId);
  const ownerOf = racer => (isBotId(racer.netId) ? net.room.hostId : racer.netId);

  function broadcast(data) {
    net.relay(data);
    handle(net.id, data);
  }

  function sendHit(target, amount, attacker) {
    if (amount <= 0) return;
    net.relay({ k: 'hit', t: target.netId, a: amount, by: attacker?.netId ?? null }, ownerOf(target));
  }

  function setUpRacers(room) {
    isHost = room.hostId === net.id;
    const others = room.players.filter(player => player.id !== net.id);
    const botCount = room.config.cars - room.players.length;
    setRacerCount(room.config.cars);
    race.setPlayerName(room.players.find(player => player.id === net.id).name);
    me().netId = net.id;
    byId.clear();
    byId.set(net.id, me());

    const taken = new Set(room.players.map(player => player.name));
    opponents.forEach((op, i) => {
      const bot = i < botCount;
      op.netId = bot ? `${BOT_PREFIX}${i}` : others[i - botCount].id;
      op.remote = bot ? !isHost : true;
      op.name = bot ? (taken.has(op.profile.name) ? `${op.profile.name} Bot` : op.profile.name) : others[i - botCount].name;
      op.onRemoteDamage = (amount, attacker) => sendHit(op, amount, attacker);
      op.onRemoteIgnite = (seconds, attacker) => net.relay({ k: 'burn', t: op.netId, s: seconds, by: attacker?.netId ?? null }, ownerOf(op));
      byId.set(op.netId, op);
    });
  }

  // `seconds` infinito: só larga quando todos derem pronto.
  function openGarage(seconds) {
    results.close();
    ready.clear();
    phase = 'garage';
    phaseTimer = seconds + GARAGE_GRACE;
    garage.openBetweenRaces(seconds, { waitsForHost: true });
  }

  function start(room) {
    online.active = true;
    race.setOnline(true);
    setUpRacers(room);
    setMatch(createMatch({ racerNames: race.field.map(racer => racer.name), raceCount: room.config.races }));
    openGarage(Infinity);                            // a partida só começa com todos prontos
  }

  // O jogador terminou a garagem: avisa todos e espera a largada.
  function markReady() {
    ready.add(net.id);
    killsOf.set(net.id, getMatchKills());
    net.relay({ k: 'ready', kills: getMatchKills() });
  }

  function readyRoster() {
    if (!online.active || (phase !== 'garage' && phase !== 'podium')) return null;
    const players = race.field.filter(racer => !isBotId(racer.netId))
      .map(racer => ({ id: racer.netId, name: racer.name, ready: ready.has(racer.netId), isMe: racer === me() }));
    return { canKick: isHost, players };
  }

  function launchRace() {
    const names = race.field.map(racer => racer.name);
    const inverted = getMatch().nextGrid?.filter(name => names.includes(name));
    const grid = inverted ?? [...names].sort(() => Math.random() - 0.5);
    broadcast({ k: 'go', b: pickBiome(getBiome()).id, s: Math.floor(Math.random() * 1e9), g: grid });
  }

  function stepHost(dt) {
    if (phase === 'garage') {
      phaseTimer -= dt;
      if (phaseTimer <= 0 || humanIds().every(id => ready.has(id))) launchRace();
    } else if (phase === 'race' && race.started && !race.finished) {
      const humans = race.field.filter(racer => !isBotId(racer.netId));
      const done = humans.filter(racer => race.hasFinished(racer)).length;
      if (done > 0) finishGrace += dt;
      if (done === humans.length || finishGrace >= FINISH_GRACE) broadcast({ k: 'end', r: race.closeForAll() });
    } else if (phase === 'results' && (phaseTimer -= dt) <= 0) {
      phase = 'waiting';
      broadcast({ k: getMatch().isOver ? 'podium' : 'inter', m: getMatch().snapshot() });
    } else if (phase === 'podium' && humanIds().every(id => ready.has(id))) {
      phase = 'waiting';
      net.endMatch(matchResults());
    }
  }

  // O que cada humano fez na partida. Troféu é o 1º lugar final; medalhas são os pódios de cada corrida.
  function matchResults() {
    return getMatch().standings().flatMap((entry, i) => {
      const racer = race.field.find(candidate => candidate.name === entry.name);
      if (!racer || isBotId(racer.netId)) return [];
      return [{ id: racer.netId, position: i + 1, gold: entry.wins, silver: entry.silvers, bronze: entry.bronzes, kills: killsOf.get(racer.netId) ?? 0 }];
    });
  }

  function snapshotOf(racer) {
    const isMe = racer === me(), state = isMe ? car : racer;
    const tip = (isMe ? harpoon.tip : combat.harpoonTip(racer));
    const dist = isMe ? race.playerDist : racer.dist, lane = isMe ? car.lateral : racer.lane;
    const speed = isMe ? car.speed : racer.v, vx = isMe ? car.vx : -Math.sin(racer.yaw) * racer.v, vz = isMe ? car.vz : -Math.cos(racer.yaw) * racer.v;
    const health = isMe ? car.health : racer.hp / racer.maxHp, dead = isMe ? Math.max(0, car.wrecked) : Math.max(0, racer.dead);
    const pitch = isMe ? car.pitch : racer.group.rotation.x;
    return [
      racer.netId, round(dist), round(lane), round(racer.x), round(racer.y), round(racer.z), round(racer.yaw), round(pitch),
      round(speed), round(vx), round(vz), round(health), round(dead), round(isMe ? car.invulnerable : racer.protectedFor),
      state.overturned ? 1 : 0, (isMe ? car.nitroActive : racer.nitroActive) ? 1 : 0,
      state.rig.active ? 1 : 0, round(state.rig.angle), round(state.rig.y), tip ? tip.map(round) : 0,
      (isMe ? car.effects : racer.effects).burning > 0 ? 1 : 0,
    ];
  }

  function sendSnapshots(frameTime) {
    if ((snapshotTimer -= frameTime) > 0) return;
    snapshotTimer = SNAPSHOT_INTERVAL;
    const local = race.field.filter(racer => !racer.remote);
    net.relay({ k: 's', r: local.map(snapshotOf) });
  }

  function receiveSnapshot(values) {
    const racer = byId.get(values[0]);
    if (!racer || !racer.remote) return;
    const [, dist, lane, x, y, z, yaw, pitch, v, vx, vz, health, dead, protectedFor, overturned, nitro, rigActive, rigAngle, rigY, tip, burningNow] = values;
    racer.snapshot = {
      dist, lane, x, y, z, yaw, pitch, v, vx, vz, health, dead, protectedFor, age: 0,
      overturned: Boolean(overturned), nitro: Boolean(nitro), rigActive: Boolean(rigActive), rigAngle, rigY, tip: tip || null,
    };
    racer.effects.burning = burningNow ? 1 : 0;      // só para mostrar as chamas; quem queima é o navegador dele
  }

  function drawRemoteHarpoons() {
    for (const racer of race.field) {
      if (!racer.remote) continue;
      const tip = racer.snapshot?.tip;
      if (!tip && !harpoonVisuals.has(racer)) continue;
      if (!harpoonVisuals.has(racer)) harpoonVisuals.set(racer, createHarpoonVisual(scene));
      const visual = harpoonVisuals.get(racer);
      if (!tip) { visual.hide(); continue; }
      visual.show(racer.x - Math.sin(racer.yaw) * NOSE_FORWARD, racer.y + HARPOON_HEIGHT, racer.z - Math.cos(racer.yaw) * NOSE_FORWARD, tip[0], tip[1], tip[2]);
    }
  }

  function update(frameTime) {
    if (!online.active) return;
    if (isHost) stepHost(frameTime);
    if (phase === 'race') {
      sendSnapshots(frameTime);
      drawRemoteHarpoons();
    }
  }

  function receiveHit({ t, a, by }) {
    const target = byId.get(t), attacker = byId.get(by);
    if (!target || target.remote) return;
    let destroyed = false;
    if (target === me()) {
      const before = car.wrecked;
      damagePlayer(car, a / CAR_MAX_HP);
      destroyed = car.health <= 0 && before <= 0;
      if (destroyed) onPlayerKilledBy(attacker);
      if (attacker) {
        onPlayerShot();
        combat.hitFlash = HIT_FLASH_TIME;
        combat.hitAngle = bearingFrom(car, look, attacker.x, attacker.z);
      }
    } else {
      destroyed = damageOpponent(target, a, attacker);
    }
    if (destroyed && attacker) sendKill(target, attacker);
  }

  const HANDLERS = {
    s: data => data.r.forEach(receiveSnapshot),
    hit: receiveHit,
    kill: data => {
      if (data.b) { rewardKillFor(byId.get(data.b)); return; }
      creditKill(byId.get(data.t));
      weapon.hitMarker = 0.4;
    },
    caught: data => {
      const racer = byId.get(data.t);
      if (data.by === net.id && racer) announceTrapCatch(racer, hazardType(data.i));
    },
    burn: data => {
      const target = byId.get(data.t);
      if (target && !target.remote) burning.ignite(target, byId.get(data.by) ?? null, data.s);
    },
    shot: data => combat.showRemoteShot(data.w, data.f, data.e),
    ob: data => obstacles.spawnFromNetwork(data),
    obx: data => obstacles.removeFromNetwork(data.n),
    trap: data => traps.placeFromNetwork(data.i, data.d, data.l, byId.get(data.by), data.n),
    boom: data => traps.detonateFromNetwork(data.n),
    ext: data => {
      const racer = byId.get(data.r);
      if (!racer) return;
      foam.spray(racer);
      playAt('extinguisher', racer.x, racer.z);
    },
    pull: data => {
      const target = byId.get(data.t);
      if (target && !target.remote) pulls.start(target, byId.get(data.by));
    },
    spec: (data, from) => byId.get(from)?.model?.apply(data.s),
    ready: (data, from) => {
      ready.add(from);
      killsOf.set(from, data.kills);
    },
    go: data => {
      garage.closeAfterWait();
      for (const visual of harpoonVisuals.values()) visual.hide();
      beginRace(BIOMES.find(biome => biome.id === data.b), data.s, data.g);
      net.relay({ k: 'spec', s: getSpec() });
      phase = 'race';
      finishGrace = 0;
      snapshotTimer = 0;
    },
    end: data => {
      if (!race.finished) race.applyFinish(data.r);
      phase = 'results';
      phaseTimer = RESULTS_TIME;
    },
    inter: data => {
      if (!online.active) { joinLate(data.m); return; }
      resyncRoster(data.m);
      openGarage(GARAGE_TIME);
    },
    podium: () => {
      results.close();
      ready.clear();
      phase = 'podium';
      podium.open(getMatch());
    },
  };

  // Todos deram pronto no pódio: desfaz a partida para a sala poder começar outra.
  function returnToLobby() {
    online.active = false;
    phase = 'idle';
    race.setOnline(false);
    for (const visual of harpoonVisuals.values()) visual.hide();
    for (const op of pool) {
      op.remote = false;
      op.snapshot = null;
      op.name = op.profile.name;
      op.model.apply(op.livery);
    }
    podium.close();
    results.close();
    setMatch(null);
  }

  // Entrou com a partida em andamento: esperou a corrida acabar e agora entra na garagem entre as corridas.
  function joinLate(matchData) {
    const room = net.room;
    if (!room || room.phase !== 'playing' || !matchData) return;
    online.active = true;
    race.setOnline(true);
    setUpRacers(room);
    const names = race.field.map(racer => racer.name);
    const created = createMatch({ racerNames: names, raceCount: room.config.races });
    created.restore(matchData, names);
    setMatch(created);
    onLateJoin();
    openGarage(GARAGE_TIME);
  }

  // Quem entrou (ou saiu) durante a corrida passa a valer na garagem seguinte: o lugar de um bot vira o jogador.
  function resyncRoster(matchData) {
    const room = net.room;
    if (!room || !matchData) return;
    const known = race.field.filter(racer => !isBotId(racer.netId)).map(racer => racer.netId);
    if (room.players.length === known.length && room.players.every(player => known.includes(player.id))) return;
    setUpRacers(room);
    getMatch().restore(matchData, race.field.map(racer => racer.name));
  }

  function handle(from, data) {
    if (online.active || (data.k === 'inter' && net.room?.phase === 'playing')) HANDLERS[data.k]?.(data, from);
  }
  net.onGame = handle;

  // Quem saiu durante a partida sai também da pista.
  function renameRacer(racer, name) {
    getMatch().renameRacer(racer.name, name);
    race.renameRacer(racer, name);
  }

  // Renomear na garagem: o servidor garante nome único entre os jogadores e o bot cede o dele, como na montagem da sala.
  function applyRenames(room) {
    for (const player of room.players) {
      const racer = byId.get(player.id);
      if (!racer || racer.name === player.name) continue;
      const bot = race.field.find(candidate => isBotId(candidate.netId) && candidate.name === player.name);
      if (bot) renameRacer(bot, `${player.name} Bot`);
      renameRacer(racer, player.name);
    }
  }

  function onRoomChange(room) {
    if (!online.active) return;
    applyRenames(room);
    for (const racer of [...race.field]) {
      if (racer === me() || isBotId(racer.netId) || room.players.some(player => player.id === racer.netId)) continue;
      harpoonVisuals.get(racer)?.hide();
      byId.delete(racer.netId);
      ready.delete(racer.netId);
      race.removeRacer(racer);
    }
  }

  // Avisa o piloto humano que destruiu ou pegou numa armadilha um carro simulado aqui.
  function sendKill(victim, killer) {
    if (!online.active) return;
    // Bot: quem recompensa é o admin, que simula os bots (`b` diz qual bot).
    if (isBotId(killer.netId)) net.relay({ k: 'kill', t: victim.netId, b: killer.netId }, net.room.hostId);
    else net.relay({ k: 'kill', t: victim.netId }, killer.netId);
  }
  function sendCaught(victim, type, owner) {
    if (online.active && !isBotId(owner.netId)) net.relay({ k: 'caught', t: victim.netId, i: type.id, by: owner.netId }, owner.netId);
  }

  function sendShot(weaponId, from, end) {
    if (!online.active) return;
    net.relay({ k: 'shot', w: weaponId, f: [round(from.x), round(from.y), round(from.z)], e: [round(end.x), round(end.y), round(end.z)] });
  }
  function sendTrap(type, dist, lane, owner, id) {
    if (online.active) net.relay({ k: 'trap', i: type.id, d: round(dist), l: round(lane), by: owner.netId, n: id });
  }
  function sendTrapBoom(id) {
    if (online.active) net.relay({ k: 'boom', n: id });
  }
  function sendObstacle(ob) {
    if (online.active) net.relay({ k: 'ob', n: ob.id, i: ob.type.id, d: round(ob.dist), l: round(ob.lane), s: ob.side });
  }
  function sendObstacleBreak(ob) {
    if (online.active) net.relay({ k: 'obx', n: ob.id });
  }
  function sendExtinguisher(racer) {
    if (online.active) net.relay({ k: 'ext', r: racer.netId });
  }
  function sendPull(target, shooter) {
    if (online.active) net.relay({ k: 'pull', t: target.netId, by: shooter.netId }, ownerOf(target));
  }

  return online;
}
