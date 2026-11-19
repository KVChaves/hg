import { CAR_MAX_HP } from '../config.js';
import { bearingFrom, damagePlayer } from '../game/car.js';
import { createMatch } from '../game/championship.js';
import { damageOpponent } from '../game/opponents.js';
import { drawBotNames, seededRandom } from '../game/opponentProfiles.js';
import { wakeOf } from '../game/carUpgrades.js';
import { shakeCar } from '../game/shake.js';
import { hazardType } from '../game/trapTypes.js';
import { BIOMES, pickMatchBiome, voteCandidates } from '../world/biomes/index.js';
import { createHarpoonVisual } from '../world/harpoonVisual.js';

// Partida online. Cada navegador simula o próprio carro e o admin simula os bots; todos enviam a posição
// do que simulam. Dano e puxões vão para quem simula o alvo, que é quem aplica. O admin marca o ritmo:
// garagem, largada, fim da corrida e próxima rodada.

const SNAPSHOT_INTERVAL = 1 / 15;
const VOTE_TIME = 10, VOTE_RESULT_TIME = 1.8, VOTE_CHOICES = 3;
const GARAGE_TIME = 45, GARAGE_GRACE = 1, RESULTS_TIME = 12, FINISH_GRACE = 30;
const HIT_FLASH_TIME = 0.3, HARPOON_HEIGHT = 0.62, NOSE_FORWARD = 2.3;
const BOT_PREFIX = 'bot';

const round = value => Math.round(value * 100) / 100;
const isBotId = id => id.startsWith(BOT_PREFIX);

export function createOnlineMatch({ onRopeTripped = () => {}, onPlayerKilledBy = () => {}, onPlayerShot = () => {}, net, scene, race, car, opponents, combat, traps, mines, nets, emp, burning, foam, harpoon, pulls, weapon, look, garage, results, podium, voteScreen, getSpec, setRacerCount, setMatch, getMatch, getMatchKills, beginRace, getBiome, playAt, creditKill, rewardKillFor, announceTrapCatch, obstacles, onLateJoin }) {
  const byId = new Map(), harpoonVisuals = new Map(), ready = new Set(), pool = [...opponents], killsOf = new Map();
  let isHost = false, phase = 'idle', phaseTimer = 0, snapshotTimer = 0, finishGrace = 0;
  let vote = null;                                   // votação em andamento: { candidates, played, number, timeLeft, votes }

  const online = { active: false, start, update, markReady, castVote, readyRoster, returnToLobby, onRoomChange, sendKill, sendCaught, sendShot, sendTrap, sendTrapBoom, sendExtinguisher, sendPull, sendMine, sendNet, sendTrip, sendEmp, sendPullEnd, sendObstacle, sendObstacleBreak };
  const me = () => race.field[0];
  const humanIds = () => race.field.filter(racer => !isBotId(racer.netId)).map(racer => racer.netId);
  const ownerOf = racer => (isBotId(racer.netId) ? net.room.hostId : racer.netId);

  function broadcast(data) {
    net.relay(data);
    handle(net.id, data);
  }

  function sendHit(target, amount, attacker, shake = 0) {
    if (amount <= 0) return;
    net.relay({ k: 'hit', t: target.netId, a: amount, by: attacker?.netId ?? null, ...(shake > 0 && { s: round(shake) }) }, ownerOf(target));
  }

  function setUpRacers(room) {
    isHost = room.hostId === net.id;
    const others = room.players.filter(player => player.id !== net.id);
    const botCount = room.config.bots;
    setRacerCount(room.players.length + botCount);
    race.setPlayerName(room.players.find(player => player.id === net.id).name);
    me().netId = net.id;
    byId.clear();
    byId.set(net.id, me());

    const taken = new Set(room.players.map(player => player.name));
    const botNames = drawBotNames(botCount, taken, seededRandom(room.matchId || room.id));   // mesma semente, mesmos nomes em todos os clientes
    opponents.forEach((op, i) => {
      const bot = i < botCount;
      op.netId = bot ? `${BOT_PREFIX}${i}` : others[i - botCount].id;
      op.remote = bot ? !isHost : true;
      op.bumper = null;                                // o dos humanos chega com a aparência deles (k: 'spec')
      op.name = bot ? botNames[i] : others[i - botCount].name;
      op.onRemoteDamage = (amount, attacker, shake) => sendHit(op, amount, attacker, shake);
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
    phase = 'waiting';
    if (isHost) startVote();                         // o mapa se vota antes da garagem; a partida só larga com todos prontos
  }

  // O admin abre a votação com opções sorteadas entre os biomas ainda não jogados. Com uma só opção não há o que votar.
  function startVote() {
    const match = getMatch(), played = [...match.biomesPlayed], candidates = voteCandidates(played, VOTE_CHOICES);
    if (candidates.length === 1) { broadcast({ k: 'vr', b: candidates[0].id, p: played, auto: true }); return; }
    broadcast({ k: 'vt', c: candidates.map(biome => biome.id), p: played, n: match.racesDone + 1, tot: match.raceCount, s: VOTE_TIME });
  }

  const voteNames = () => new Map(race.field.filter(racer => !isBotId(racer.netId)).map(racer => [racer.netId, racer.name]));
  const showVotes = () => voteScreen.setVotes(vote.votes, voteNames());

  // Maioria vence; empate (ou ninguém votou) o admin sorteia entre os empatados e avisa todos.
  function resolveVote() {
    const tally = new Map(vote.candidates.map(id => [id, 0]));
    for (const choice of vote.votes.values()) tally.set(choice, (tally.get(choice) ?? 0) + 1);
    const top = Math.max(...tally.values()), tied = [...tally].filter(([, count]) => count === top).map(([id]) => id);
    broadcast({ k: 'vr', b: tied[Math.floor(Math.random() * tied.length)], p: vote.played });
  }

  // O jogador clicou num mapa: vale o último clique até a votação acabar.
  function castVote(biomeId) {
    if (phase === 'vote') broadcast({ k: 'vv', b: biomeId });
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
    const previous = getMatch().nextGrid?.filter(name => names.includes(name));
    const grid = previous ?? [...names].sort(() => Math.random() - 0.5);
    const match = getMatch(), biomeId = match.upcomingBiome ?? pickMatchBiome(match.biomesPlayed).id;   // o sorteado entre as corridas, se houver
    broadcast({ k: 'go', b: biomeId, s: Math.floor(Math.random() * 1e9), g: grid });
  }

  function stepHost(dt) {
    if (phase === 'garage') {
      phaseTimer -= dt;
      if (phaseTimer <= 0 || humanIds().every(id => ready.has(id))) launchRace();
    } else if (phase === 'race' && race.started && !race.finished) {
      const humans = race.field.filter(racer => !isBotId(racer.netId));
      const done = humans.filter(racer => race.hasFinished(racer)).length;
      if (done > 0) finishGrace += dt;
      if (done === humans.length || finishGrace >= FINISH_GRACE) {
        const finished = race.closeForAll();
        net.endRace(getBiome()?.id, raceResults(finished));
        broadcast({ k: 'end', r: finished });
      }
    } else if (phase === 'results' && (phaseTimer -= dt) <= 0) {
      phase = 'waiting';
      const match = getMatch();
      broadcast({ k: match.isOver ? 'podium' : 'inter', m: match.snapshot() });
    } else if (phase === 'podium' && humanIds().every(id => ready.has(id))) {
      phase = 'waiting';
      net.endMatch(matchResults());
    }
  }

  // Ordem de chegada da corrida, com o id de rede de cada humano (os bots vão só com o nome).
  function raceResults(finished) {
    return finished.map((entry, i) => {
      const racer = race.field.find(candidate => candidate.name === entry.name);
      const human = racer && !isBotId(racer.netId);
      return { ...(human ? { id: racer.netId } : {}), name: entry.name, position: i + 1, time: entry.time };
    });
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
      (isMe ? car.effects : racer.effects).shield > 0 ? 1 : 0,
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
    const [, dist, lane, x, y, z, yaw, pitch, v, vx, vz, health, dead, protectedFor, overturned, nitro, rigActive, rigAngle, rigY, tip, burningNow, shieldNow] = values;
    racer.snapshot = {
      dist, lane, x, y, z, yaw, pitch, v, vx, vz, health, dead, protectedFor, age: 0,
      overturned: Boolean(overturned), nitro: Boolean(nitro), rigActive: Boolean(rigActive), rigAngle, rigY, tip: tip || null,
    };
    racer.effects.shield = shieldNow ? 1 : 0;        // idem: só desenha a bolha
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

  // Contagem da votação (em todos os navegadores) e a pausa curta para ver o mapa escolhido antes da garagem.
  function tickVote(dt) {
    if (phase === 'vote' && vote) {
      vote.timeLeft = Math.max(0, vote.timeLeft - dt);
      voteScreen.setTime(vote.timeLeft);
      if (isHost && (vote.timeLeft <= 0 || humanIds().every(id => vote.votes.has(id)))) resolveVote();
    } else if (phase === 'voteResult' && (phaseTimer -= dt) <= 0) {
      voteScreen.close();
      openGarage(getMatch().racesDone === 0 ? Infinity : GARAGE_TIME);
    }
  }

  function update(frameTime) {
    if (!online.active) return;
    tickVote(frameTime);
    if (isHost) stepHost(frameTime);
    if (phase === 'race') {
      sendSnapshots(frameTime);
      drawRemoteHarpoons();
    }
  }

  function receiveHit({ t, a, by, s = 0 }) {
    const target = byId.get(t), attacker = byId.get(by);
    if (!target || target.remote) return;
    let destroyed = false;
    if (target === me()) {
      const before = car.wrecked;
      damagePlayer(car, a * car.parts.bullet / CAR_MAX_HP);
      destroyed = car.health <= 0 && before <= 0;
      if (s > 0 && car.health > 0) shakeCar(car, s);
      if (destroyed) onPlayerKilledBy(attacker);
      if (attacker) {
        onPlayerShot();
        combat.hitFlash = HIT_FLASH_TIME;
        combat.hitAngle = bearingFrom(car, look, attacker.x, attacker.z);
      }
    } else {
      destroyed = damageOpponent(target, a, attacker, s);
    }
    if (destroyed && attacker) sendKill(target, attacker);
  }

  const HANDLERS = {
    s: data => data.r.forEach(receiveSnapshot),
    vt: data => {
      const match = getMatch();
      if (!match) return;
      results.close();
      ready.clear();
      match.upcomingBiome = null;
      phase = 'vote';
      vote = { candidates: data.c, played: data.p, timeLeft: data.s, votes: new Map() };
      voteScreen.open({ candidates: data.c.map(id => BIOMES.find(biome => biome.id === id)), played: data.p, number: data.n, total: data.tot, seconds: VOTE_TIME, myId: net.id });
      voteScreen.setTime(data.s);
      showVotes();
    },
    vv: (data, from) => {                            // `by`: o admin repassa os votos já dados a quem entrou no meio
      if (phase !== 'vote' || !vote.candidates.includes(data.b)) return;
      vote.votes.set(data.by ?? from, data.b);
      showVotes();
    },
    vr: data => {
      const match = getMatch();
      if (!match) return;
      match.biomesPlayed = [...data.p, data.b];
      match.upcomingBiome = data.b;
      if (!data.auto && voteScreen.isOpen) voteScreen.showResult(data.b);
      phase = 'voteResult';
      phaseTimer = data.auto ? 0.1 : VOTE_RESULT_TIME;
    },
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
    shot: data => { learnWeapon(data.w, data.f); combat.showRemoteShot(data.w, data.f, data.e); },
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
    mine: data => {                                  // outro navegador grudou uma mina: aqui só o aviso e a explosão
      const owner = byId.get(data.o), target = byId.get(data.t);
      if (owner && target) mines.addGhost(owner, target, data.f, data.n);
    },
    net: data => {                                   // alguém prendeu um carro na rede: trava se ele é nosso e mostra a rede
      const target = byId.get(data.t);
      if (target) nets.catchFromNetwork(target);
    },
    emp: data => {
      const owner = byId.get(data.r);
      if (owner) emp.receive(owner);
    },
    trip: data => {                                  // alguém atravessou um cabo de arpão: aplica o tranco se o carro é nosso
      const racer = byId.get(data.t);
      if (!racer || racer.remote) return;
      pulls.trip(racer, data.s);
      onRopeTripped(racer);
    },
    pend: data => {                                  // o dono soltou o cabo do arpão
      const owner = byId.get(data.by);
      if (owner) pulls.endFrom(owner);
    },
    pull: data => {
      const target = byId.get(data.t);
      if (target && !target.remote) pulls.start(target, byId.get(data.by));
    },
    spec: (data, from) => {
      const racer = byId.get(from);
      if (!racer) return;
      racer.model?.apply(data.s);
      racer.bumper = data.s.bumper;                  // o dano que o outro carro leva ao bater depende do para-choque
      racer.wake = wakeOf(data.s.heightKind);        // e o vácuo que quem vem atrás pega dele, da suspensão
    },
    ready: (data, from) => {
      ready.add(from);
      killsOf.set(from, data.kills);
    },
    go: data => {
      getMatch().upcomingBiome = null;
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
      getMatch().upcomingBiome = null;
      resyncRoster(data.m);
      results.close();
      phase = 'waiting';
      if (isHost) startVote();                       // o próximo mapa se vota antes de voltar à garagem
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
    voteScreen.close();
    vote = null;
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
    if (matchData.upcomingBiome) openGarage(GARAGE_TIME);   // mapa já escolhido: entra na garagem; senão espera a votação em andamento
    else { results.close(); phase = 'waiting'; }
  }

  // Quem entrou (ou saiu) durante a corrida passa a valer na garagem seguinte: a vaga livre vira um carro novo.
  function resyncRoster(matchData) {
    const room = net.room;
    if (!room || !matchData) return;
    const known = race.field.filter(racer => !isBotId(racer.netId)).map(racer => racer.netId);
    const knownBots = race.field.length - known.length;
    if (knownBots === room.config.bots && room.players.length === known.length && room.players.every(player => known.includes(player.id))) return;
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
    // Quem entra enquanto todos ainda estão na garagem não espera a corrida: todos o encaixam na pista agora
    // e o admin manda a ele o placar para entrar na garagem junto.
    if (phase === 'vote') for (const id of [...vote.votes.keys()]) if (!room.players.some(player => player.id === id)) vote.votes.delete(id);
    if (phase === 'garage' || phase === 'vote' || phase === 'voteResult') {
      const joined = room.players.filter(player => !byId.has(player.id));
      if (joined.length) {
        resyncRoster(getMatch().snapshot());
        if (isHost) for (const player of joined) {
          net.relay({ k: 'inter', m: getMatch().snapshot() }, player.id);
          if (phase === 'vote') {
            net.relay({ k: 'vt', c: vote.candidates, p: vote.played, n: getMatch().racesDone + 1, tot: getMatch().raceCount, s: vote.timeLeft }, player.id);
            for (const [by, b] of vote.votes) net.relay({ k: 'vv', b, by }, player.id);
          }
        }
      }
    }
    if (phase === 'vote' && vote) showVotes();
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

  // Quem é visto atirando revela a arma: os bots daqui passam a levá-la em conta (botStyles.weaponOf).
  // O tiro não diz quem atirou, então vale o carro remoto mais perto da boca do cano.
  const SHOOTER_REACH = 5;
  function learnWeapon(weaponId, start) {
    let shooter = null, nearest = SHOOTER_REACH;
    for (const racer of race.field) {
      if (!racer.remote) continue;
      const distance = Math.hypot(racer.wx - start[0], racer.wz - start[2]);
      if (distance < nearest) { nearest = distance; shooter = racer; }
    }
    if (shooter) shooter.weaponId = weaponId;
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
    if (online.active) net.relay({ k: 'ob', n: ob.id, i: ob.type.id, d: round(ob.dist), l: round(ob.lane), s: ob.side, w: ob.site ? ob.site.index : -1, p: ob.phase });
  }
  function sendObstacleBreak(ob) {
    if (online.active) net.relay({ k: 'obx', n: ob.id });
  }
  function sendExtinguisher(racer) {
    if (online.active) net.relay({ k: 'ext', r: racer.netId });
  }
  function sendMine(mine) {
    if (online.active) net.relay({ k: 'mine', o: mine.owner.netId, t: mine.target.netId, f: round(mine.fuse), n: mine.id });
  }
  function sendNet(target) {
    if (online.active) net.relay({ k: 'net', t: target.netId });
  }
  function sendTrip(racer, side) {
    if (online.active) net.relay({ k: 'trip', t: racer.netId, s: side }, ownerOf(racer));
  }
  function sendEmp(racer) {
    if (online.active) net.relay({ k: 'emp', r: racer.netId });
  }
  function sendPullEnd(target, shooter) {
    if (online.active) net.relay({ k: 'pend', by: shooter.netId }, ownerOf(target));
  }
  function sendPull(target, shooter) {
    if (online.active) net.relay({ k: 'pull', t: target.netId, by: shooter.netId }, ownerOf(target));
  }

  return online;
}
