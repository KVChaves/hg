import { CAR_MAX_HP, LAPS, TRACK_WIDTH } from '../config.js';
import { isBoosted, isEpic, nearestIndex, OPEN_WALL, surfaceAt, track, trackAt } from '../world/track.js';
import { damagePlayer, resetCar, trackCapsizes } from './car.js';
import { resetRig, rigLean } from './carRoll.js';
import { createFlip, flipLandingTime, lifeAfterDestruction, RESPAWN_PROTECTION } from './carFlip.js';
import { createCollisions } from './collisions.js';
import { placeOpponent, resetOpponent, updateOpponent, updateRemoteRacer } from './opponents.js';
import { slipstreamStrength } from './slipstream.js';

const CRASH_MIN_IMPACT = 4, CRASH_FULL_IMPACT = 25, CRASH_MIN_STRENGTH = 0.25;
const ROAD_HALF = TRACK_WIDTH / 2 + 1.4, SHOULDER_BLEND = 6;
const WRONG_WAY_DELAY = 0.7, WRONG_WAY_MIN_SPEED = 3, WRONG_WAY_HEADING = -0.25;  // uma rodada rápida não dispara o aviso
const WALL_BOUNCE = 0.4, TUNNEL_WALL_BOUNCE = 0.05, TUNNEL_SCRAPE_SPEED = 6;   // m/s de batida que no túnel não tiram vida
const WALL_NOSE_IN = 0.05, WALL_KEEP_BACKWARD = -0.6, WALL_TURN_RATE = 3;   // rad/s
const INTRO_TIME = 5;                                // segundos do pop-up de ajuda antes da contagem
const MIN_JUMP_SPEED = 22;                           // m/s: a rampa garante o impulso para cruzar o vão
const SLIPSTREAM_RESPONSE = 4;                       // o vácuo entra e sai aos poucos
const MIN_TIME_GAP = 0.05;                           // segundos entre tempos estimados consecutivos
const IMPACT_DAMAGE = 0.4;                           // pontos de vida por m/s de batida

const gridDistance = slot => track.length - 8 - (slot >> 1) * 10 - (slot & 1) * 4;
const gridLane = slot => (slot & 1) ? 3.6 : -3.6;

export function createRace(car, opponents, { onCrash, onDestroyed }) {
  const playerProxy = { name: 'Player', netId: 'player', slipstream: 0, wx: 0, wy: 0, wz: 0, twist: 0, y: 0, yaw: 0, dist: 0, lane: 0, v: 0, dead: 0, protectedFor: 0, x: 0, z: 0, isPlayer: true, effects: car.effects };
  const field = [playerProxy, ...opponents];
  const finishTimes = new Map();                     // nome -> tempo em que cruzou a linha final
  let playerStart = 0, wrongWayTime = 0;
  const allOpponents = [...opponents];               // `opponents` e `field` guardam só quem corre nesta partida

  const collisions = createCollisions({ car, field, onCrash, onDestroyed });

  const race = {
    intro: INTRO_TIME, countdown: 3.8, started: false, goTimer: 0, time: 0,
    playerDist: 0, lastS: 0,
    finished: false, finalRank: 0, rank: 1, order: [], finishOrder: [], finishResults: [], wrongWay: false,
    online: false, crossed: false,                   // online: o admin é quem encerra a corrida de todos
    field,
    get lap() { return Math.min(Math.floor(this.playerDist / track.length), LAPS); },
  };

  // `impact` é a velocidade em m/s contra o obstáculo; toques de leve não fazem barulho.
  function reportWallCrash(impact) {
    if (impact < CRASH_MIN_IMPACT) return;
    onCrash('crash', car.x, car.z, Math.max(CRASH_MIN_STRENGTH, Math.min(1, impact / CRASH_FULL_IMPACT)));
  }

  function placeOnGrid(grid) {
    grid.forEach((racer, slot) => {
      const lane = gridLane(slot), distance = gridDistance(slot), t = trackAt(distance);
      if (racer.isPlayer) {
        car.x = t.x - t.tz * lane;
        car.z = t.z + t.tx * lane;
        car.y = t.y;
        car.pitch = Math.atan(t.slope);
        car.yaw = Math.atan2(-t.tx, -t.tz);
        car.trackIndex = -1;
        race.playerDist = playerStart = distance;
        race.lastS = distance % track.length;
        race.rank = slot + 1;
      } else {
        racer.dist = distance;
        racer.lane = racer.laneTarget = racer.preferredLane = lane;
        placeOpponent(racer);
      }
    });
  }

  // Na primeira corrida o jogador larga perto do fim do grid.
  function firstGrid() {
    const grid = [...opponents];
    grid.splice(Math.min(opponents.length, Math.max(1, field.length - 3)), 0, playerProxy);
    return grid;
  }

  // Encostado na parede o carro quase não anda, e sem andar o volante não vira: é o que prendia o bico no muro.
  // Enquanto o bico aponta para a parede, o carro gira até ficar paralelo a ela.
  function turnAlongWall(wallX, wallZ, tx, tz, dt) {
    const fx = -Math.sin(car.yaw), fz = -Math.cos(car.yaw);
    if (fx * wallX + fz * wallZ < WALL_NOSE_IN) return;
    const direction = fx * tx + fz * tz < WALL_KEEP_BACKWARD ? -1 : 1;     // quem vinha na contramão continua nela
    const target = Math.atan2(-tx * direction, -tz * direction);
    const error = Math.atan2(Math.sin(target - car.yaw), Math.cos(target - car.yaw));
    car.yaw += Math.sign(error) * Math.min(Math.abs(error), WALL_TURN_RATE * dt);
  }

  function updatePlayerOnTrack(dt) {
    const { length, step, px, pz, tx, tz } = track;
    const i = car.trackIndex = nearestIndex(car.x, car.z, car.trackIndex);
    const dx = car.x - px[i], dz = car.z - pz[i];
    const s = i * step + dx * tx[i] + dz * tz[i];
    let offset = dx * -tz[i] + dz * tx[i];

    const wall = track.wall[i];                      // nos túneis a parede fica bem perto da pista
    if (Math.abs(offset) > wall) {
      const sign = Math.sign(offset), nx = -tz[i], nz = tx[i], push = wall * sign - offset;
      car.x += nx * push;
      car.z += nz * push;
      offset = wall * sign;
      const vn = car.vx * nx + car.vz * nz;
      if (vn * sign > 0) {
        const impact = Math.abs(vn), enclosed = track.enclosed[i] === 1;     // no túnel a parede raspa em vez de rebater
        const bounce = 1 + (enclosed ? TUNNEL_WALL_BOUNCE : WALL_BOUNCE);
        reportWallCrash(impact);
        car.vx -= nx * vn * bounce;
        car.vz -= nz * vn * bounce;
        damagePlayer(car, Math.max(0, impact - (enclosed ? TUNNEL_SCRAPE_SPEED : 0)) * IMPACT_DAMAGE / CAR_MAX_HP);
      }
      turnAlongWall(nx * sign, nz * sign, tx[i], tz[i], dt);
    }
    car.enclosed = track.enclosed[i] === 1;
    car.roadTurn = track.turn[i] * (-Math.sin(car.yaw) * tx[i] - Math.cos(car.yaw) * tz[i]);   // a curva como o carro a enxerga, de frente ou de ré
    car.offTrack = wall < OPEN_WALL ? 0 : Math.abs(offset);   // túnel e tubo não têm mato: a faixa junto da parede não freia
    car.lateral = offset;

    let delta = s - race.lastS;
    if (delta < -length / 2) delta += length;
    else if (delta > length / 2) delta -= length;
    race.playerDist += delta;
    race.lastS = s;

    placePlayerOnSurface(offset);
    playerProxy.dist = race.playerDist;
    playerProxy.lane = offset;
    playerProxy.v = car.speed;
  }

  // Na estrada segue a altura dela; saindo do asfalto, vai descendo até a do terreno.
  function placePlayerOnSurface(offset) {
    const t = trackAt(race.playerDist);
    const k = Math.min(1, Math.max(0, (Math.abs(offset) - ROAD_HALF) / SHOULDER_BLEND));
    car.y = isEpic(race.playerDist) ? t.y : t.y + (track.heightAt(car.x, car.z) - t.y) * k * k * (3 - 2 * k);
    const forward = -Math.sin(car.yaw) * t.tx - Math.cos(car.yaw) * t.tz;
    car.pitch = Math.atan(t.slope * forward);
    const point = surfaceAt(race.playerDist, offset);
    car.twist = point.roll;
    car.twistHeading = point.heading;
    car.twistYaw = point.twistYaw;
    car.twistPitch = point.twistPitch;
    car.wx = point.roll ? point.x : car.x;
    car.wy = point.roll ? point.y : car.y;
    car.wz = point.roll ? point.z : car.z;
  }

  // Contramão: bico virado contra o sentido da pista e andando nessa direção. Dar ré não conta.
  function updateWrongWay(dt) {
    const t = trackAt(race.playerDist);
    const heading = -Math.sin(car.yaw) * t.tx - Math.cos(car.yaw) * t.tz, along = car.vx * t.tx + car.vz * t.tz;
    const against = race.started && !race.finished && car.wrecked <= 0 && !car.overturned && heading < WRONG_WAY_HEADING && along < -WRONG_WAY_MIN_SPEED;
    wrongWayTime = against ? wrongWayTime + dt : 0;
    race.wrongWay = wrongWayTime >= WRONG_WAY_DELAY;
  }

  // Ninguém fica pendurado no vão: quem chega devagar na rampa é lançado com o mínimo para passar.
  function ensureJumpSpeed() {
    for (const racer of field) {
      if (racer.remote || racer.dead > 0 || !isBoosted(racer.dist)) continue;
      if (!racer.isPlayer) { racer.v = Math.max(racer.v, MIN_JUMP_SPEED); continue; }
      if (car.speed < 0 || car.speed >= MIN_JUMP_SPEED) continue;
      const fx = -Math.sin(car.yaw), fz = -Math.cos(car.yaw);
      car.vx = fx * MIN_JUMP_SPEED;
      car.vz = fz * MIN_JUMP_SPEED;
      car.speed = MIN_JUMP_SPEED;
    }
  }

  function updateSlipstreams(dt) {
    const blend = Math.min(1, dt * SLIPSTREAM_RESPONSE);
    for (const racer of field) {
      if (!racer.remote) racer.slipstream += (slipstreamStrength(racer, field) - racer.slipstream) * blend;
    }
    car.slipstream = playerProxy.slipstream;
  }

  // Enquanto rola, o carro destruído vai para o centro da pista e aponta para a frente; ao tocar o chão já chegou.
  function returnToTrack(dt) {
    const remaining = flipLandingTime(car.flip, car.wrecked);
    const t = trackAt(race.playerDist), k = remaining > dt ? dt / remaining : 1;
    const turn = Math.atan2(-t.tx, -t.tz) - car.yaw;
    car.x += (t.x - car.x) * k;
    car.z += (t.z - car.z) * k;
    car.yaw += Math.atan2(Math.sin(turn), Math.cos(turn)) * k;
  }

  // Sem vida o carro capota; depois volta ao centro da pista com menos vida do que antes.
  function respawnPlayer() {
    const t = trackAt(race.playerDist);
    car.x = t.x;
    car.z = t.z;
    car.yaw = Math.atan2(-t.tx, -t.tz);
    car.vx = car.vz = car.spin = 0;
    car.health = lifeAfterDestruction(car.destroyed);
    car.invulnerable = RESPAWN_PROTECTION;
    car.flip = null;
    for (const name in car.effects) car.effects[name] = 0;
  }

  function updatePlayerCondition(dt) {
    car.invulnerable = Math.max(0, car.invulnerable - dt);
    if (car.wrecked > 0) {
      if ((car.wrecked -= dt) <= 0) {
        car.wrecked = 0;
        respawnPlayer();
      } else {
        returnToTrack(dt);
      }
    } else if (car.health <= 0) {
      car.destroyed++;
      const lean = rigLean(car.rig);
      car.flip = createFlip({ direction: Math.sign(lean) || 1, startRoll: Math.abs(lean) });
      car.wrecked = car.flip.duration;
      resetRig(car.rig);
      car.overturned = false;
    }
    trackCapsizes(car, dt);
    playerProxy.dead = Math.max(0, car.wrecked);
    playerProxy.protectedFor = car.invulnerable;
  }

  // A corrida termina quando o jogador cruza a linha. Quem já chegou fica na ordem real de chegada;
  // quem ainda está correndo recebe um tempo estimado pelo que falta, no ritmo do jogador.
  function closeRace(order, line) {
    const arrived = order.filter(entry => finishTimes.has(entry.name))
      .map(entry => ({ name: entry.name, time: finishTimes.get(entry.name), estimated: false }))
      .sort((a, b) => a.time - b.time);
    const pace = (line - playerStart) / Math.max(race.time, 1);
    let last = arrived.at(-1)?.time ?? race.time;
    const running = order.filter(entry => !finishTimes.has(entry.name)).map(entry => {
      last = Math.max(last + MIN_TIME_GAP, race.time + (line - entry.progress) / pace);
      return { name: entry.name, time: last, estimated: true };
    });
    race.finishResults = [...arrived, ...running];
    race.finishOrder = race.finishResults.map(result => result.name);
    race.finalRank = race.finishOrder.indexOf(playerProxy.name) + 1;
    race.finished = true;
  }

  function updateRanking() {
    const order = [{ name: playerProxy.name, progress: race.playerDist, isPlayer: true }];
    for (const op of opponents) order.push({ name: op.name, progress: op.dist });
    order.sort((a, b) => b.progress - a.progress);
    race.order = order;
    race.rank = order.findIndex(entry => entry.isPlayer) + 1;
    if (race.finished) return;
    const line = (LAPS + 1) * track.length;
    for (const racer of field) if (racer.dist >= line && !finishTimes.has(racer.name)) finishTimes.set(racer.name, race.time);
    if (race.online) race.crossed = finishTimes.has(playerProxy.name);
    else if (race.playerDist >= line) closeRace(order, line);
  }

  race.setRacerCount = count => {
    opponents.splice(0, opponents.length, ...allOpponents.slice(0, count - 1));
    field.splice(1, field.length - 1, ...opponents);
    for (const op of allOpponents.slice(count - 1)) op.group.visible = false;
  };

  // Prepara uma nova corrida. `finishNames` é a ordem de chegada da anterior; sem ela usa o grid inicial.
  race.reset = finishNames => {
    Object.assign(race, { intro: INTRO_TIME, countdown: 3.8, started: false, goTimer: 0, time: 0, finished: false, crossed: false, finalRank: 0, finishOrder: [], finishResults: [] });
    finishTimes.clear();
    wrongWayTime = 0;
    race.wrongWay = false;
    resetCar(car);
    opponents.forEach(resetOpponent);
    Object.assign(playerProxy, { dead: 0, protectedFor: 0, slipstream: 0 });
    placeOnGrid(finishNames ? finishNames.map(name => field.find(racer => racer.name === name)).filter(Boolean) : firstGrid());
  };
  race.setPlayerName = name => { playerProxy.name = name; };
  race.renameRacer = (racer, name) => {
    if (finishTimes.has(racer.name)) {
      finishTimes.set(name, finishTimes.get(racer.name));
      finishTimes.delete(racer.name);
    }
    racer.name = name;
  };
  race.setOnline = value => { race.online = value; };
  race.hasFinished = racer => finishTimes.has(racer.name);

  // Quem simula a partida online encerra a corrida de todos; os outros recebem o resultado pronto.
  race.closeForAll = () => {
    closeRace(race.order, (LAPS + 1) * track.length);
    return race.finishResults;
  };
  race.applyFinish = results => {
    race.finishResults = results;
    race.finishOrder = results.map(result => result.name);
    race.finalRank = race.finishOrder.indexOf(playerProxy.name) + 1;
    race.finished = true;
  };

  race.removeRacer = racer => {
    racer.group.visible = false;
    opponents.splice(opponents.indexOf(racer), 1);
    field.splice(field.indexOf(racer), 1);
  };

  race.update = (dt, activeTraps) => {
    if (!race.started) {
      if (race.intro > 0) race.intro -= dt;               // pop-up de ajuda antes da contagem
      else if ((race.countdown -= dt) <= 0) { race.started = true; race.goTimer = 1.2; }
    } else {
      race.goTimer -= dt;
      if (!race.finished) race.time += dt;
    }
    updatePlayerCondition(dt);
    updatePlayerOnTrack(dt);
    updateWrongWay(dt);
    updateSlipstreams(dt);
    if (race.started) ensureJumpSpeed();
    for (const op of opponents) {
      if (op.remote) updateRemoteRacer(op, dt);
      else updateOpponent(op, dt, field, race.started, activeTraps);
    }
    collisions.update(dt);
    playerProxy.x = car.x;
    playerProxy.y = car.y;
    playerProxy.z = car.z;
    playerProxy.yaw = car.yaw;
    Object.assign(playerProxy, { wx: car.wx, wy: car.wy, wz: car.wz, twist: car.twist });
    updateRanking();
  };
  return race;
}
