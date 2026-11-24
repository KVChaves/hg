import { CAR_MAX_HP, LAPS, TRACK_WIDTH } from '../config.js';
import { beltPush, boostAt, bridgeHalfAt, CLIFF_EDGE, splitAt, gustAt, hazardAt, raceClock, inFlightZone, inGap, isEpic, ledgeAt, nearestIndex, onBridge, OPEN_WALL, surfaceAt, track, trackAt, valleyRise, valleySlope, wrapDistance } from '../world/track.js';
import { BOOST_SPEED, BOOST_TIME, crashDamage, damagePlayer, resetCar, trackCapsizes } from './car.js';
import { resetRig, rigLean } from './carRoll.js';
import { createFlip, flipLandingTime, lifeAfterDestruction, RESPAWN_PROTECTION } from './carFlip.js';
import { createCollisions } from './collisions.js';
import { placeOpponent, resetOpponent, updateOpponent, updateRemoteRacer } from './opponents.js';
import { slipstreamStrength } from './slipstream.js';
import { cloakLevel } from './cloak.js';
import { FALL_TIME, fallIsCertain, GRAVITY, hitsGate, sinkStep, stepFlight } from './flight.js';
import { LEDGE_REACH } from './mapLayout.js';

const CRASH_MIN_IMPACT = 4, CRASH_FULL_IMPACT = 25, CRASH_MIN_STRENGTH = 0.25;
const ROAD_HALF = TRACK_WIDTH / 2 + 1.4, SHOULDER_BLEND = 6;
const WRONG_WAY_DELAY = 0.7, WRONG_WAY_MIN_SPEED = 3, WRONG_WAY_HEADING = -0.25;  // uma rodada rápida não dispara o aviso
const WALL_BOUNCE = 0.4, TUNNEL_WALL_BOUNCE = 0.05, TUNNEL_SCRAPE_SPEED = 6;   // m/s de batida que no túnel não tiram vida
const WALL_NOSE_IN = 0.05, WALL_KEEP_BACKWARD = -0.6, WALL_TURN_RATE = 3;   // rad/s
const INTRO_TIME = 5;                                // segundos do pop-up de ajuda antes da contagem
// O nitro larga vazio e enche uma vez depois do GO: o tanque normal leva 10 s; um tanque maior (melhoria) recebe
// o mesmo tanto por segundo, então demora mais. Assim quem larga na frente não dispara enquanto as armas ainda
// estão descarregadas e as armadilhas bloqueadas. `nitroToFill` é quanto do tanque ainda falta essa carga dar.
const NITRO_FILL_TIME = 10;
const SLIPSTREAM_RESPONSE = 4;                       // o vácuo entra e sai aos poucos
const MIN_TIME_GAP = 0.05;                           // segundos entre tempos estimados consecutivos
const IMPACT_DAMAGE = 0.4;                           // pontos de vida por m/s de batida
const SOFT_LANDING = 2;                                // m/s de descida a partir dos quais o pouso faz barulho de suspensão
const HARD_LANDING = 11, LANDING_DAMAGE = 3;         // a partir de 11 m/s de descida o pouso tira 3 pontos de vida por m/s (suspensão aguenta o resto)
const AIR_PITCH_RATE = 3, BANK_RATE = 8;             // no ar o bico acompanha a trajetória aos poucos
const BOOST_MIN_SPEED = 3;                           // de ré ou parado a placa de turbo não faz nada
const FACE_BOUNCE = 0.2;                             // quem bate na face da outra margem volta com isso da velocidade
const GATE_SPIN = 1.2;                               // a batida na muralha do castelo desalinha o carro

const GRID_ROW_GAP = 16, GRID_STAGGER = 7;           // metros entre as filas e entre os dois carros de uma fila
const gridDistance = slot => track.length - 8 - (slot >> 1) * GRID_ROW_GAP - (slot & 1) * GRID_STAGGER;
const gridLane = slot => (slot & 1 ? 1 : -1) * TRACK_WIDTH * 0.27;   // duas filas, uma de cada lado do centro

export function createRace(car, opponents, { onCrash, onDestroyed, onBlast, onContact }) {
  const playerProxy = { name: 'Player', netId: 'player', sunk: 0, slipstream: 0, wx: 0, wy: 0, wz: 0, twist: 0, y: 0, yaw: 0, dist: 0, lane: 0, v: 0, dead: 0, protectedFor: 0, x: 0, z: 0, isPlayer: true, effects: car.effects };
  const field = [playerProxy, ...opponents];
  const finishTimes = new Map();                     // nome -> tempo em que cruzou a linha final
  let playerStart = 0, wrongWayTime = 0;
  const allOpponents = [...opponents];               // `opponents` e `field` guardam só quem corre nesta partida

  const collisions = createCollisions({ car, field, onCrash, onDestroyed, onBlast, onContact });

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

    // Nos túneis a parede fica bem perto da pista; na beira do penhasco o lado aberto não tem parede (o carro cai).
    const wall = track.ledge[i] && Math.sign(offset) === track.ledge[i] ? LEDGE_REACH : track.wall[i];
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
        crashDamage(car, Math.max(0, impact - (enclosed ? TUNNEL_SCRAPE_SPEED : 0)) * IMPACT_DAMAGE / CAR_MAX_HP);
      }
      turnAlongWall(nx * sign, nz * sign, tx[i], tz[i], dt);
    }
    car.enclosed = track.enclosed[i] === 1;
    car.icy = track.bridge[i] === 1;
    if (!car.airborne && car.sunk <= 0 && track.belts.length) {   // esteira rolante: empurra o carro ao longo da pista
      const push = beltPush(race.playerDist, offset) * dt;
      car.vx += tx[i] * push;
      car.vz += tz[i] * push;
    }
    // Rajada de vento (cânion): empurra de lado, no chão e no ar. Na ponte sem mureta pode jogar o carro no abismo.
    const gust = track.gusts.length && car.sunk <= 0 ? gustAt(race.playerDist, race.time) : null;
    car.gust = gust ? gust.push : 0;
    if (gust) {
      car.vx += -tz[i] * gust.push * dt;
      car.vz += tx[i] * gust.push * dt;
    }
    // Placa de turbo: ao entrar nela o carro é jogado para a frente, acima da velocidade máxima.
    const pad = track.boosts.length && !car.airborne && car.sunk <= 0 ? boostAt(race.playerDist, offset) : null;
    if (pad && pad !== car.boostPad) {
      const fx = -Math.sin(car.yaw), fz = -Math.cos(car.yaw), forward = car.vx * fx + car.vz * fz;
      if (forward > BOOST_MIN_SPEED) {
        const kick = Math.max(0, BOOST_SPEED - forward);
        car.vx += fx * kick;
        car.vz += fz * kick;
        car.boost = BOOST_TIME;
        car.boostKick = true;
      }
    }
    car.boostPad = pad;
    car.roadTurn = track.turn[i] * (-Math.sin(car.yaw) * tx[i] - Math.cos(car.yaw) * tz[i]);   // a curva como o carro a enxerga, de frente ou de ré
    car.offTrack = wall < OPEN_WALL ? 0 : Math.abs(offset);   // túnel e tubo não têm mato: a faixa junto da parede não freia; no vale a encosta freia
    car.lateral = offset;

    let delta = s - race.lastS;
    if (delta < -length / 2) delta += length;
    else if (delta > length / 2) delta -= length;
    race.prevDist = race.playerDist;
    race.playerDist += delta;
    race.lastS = s;

    placePlayerOnSurface(offset, dt);
    playerProxy.dist = race.playerDist;
    playerProxy.lane = offset;
    playerProxy.v = car.speed;
  }

  // Altura do chão sob o carro, ou nulo no vão sobre o rio. No vale a encosta sobe dos dois lados da estrada;
  // nos outros biomas, saindo do asfalto o carro vai descendo até a altura do terreno.
  function groundUnder(t, offset) {
    if (isEpic(race.playerDist)) {
      if (inGap(race.playerDist)) return null;
      // Ponte sem borda: fora dela (ou já abaixo dela, caindo) não há chão.
      if (onBridge(race.playerDist) && (Math.abs(offset) > bridgeHalfAt(race.playerDist) || (car.airborne && car.y < t.y - 0.5))) return null;
      return t.y;
    }
    if (track.valley) return t.y + valleyRise(offset);
    // Penhasco: do lado aberto, passou da beira (ou já caiu abaixo dela), não há chão.
    const ledge = ledgeAt(race.playerDist);
    if (ledge && Math.sign(offset) === ledge && Math.abs(offset) > CLIFF_EDGE) return null;
    if (car.jump?.type === 'ledge' && car.airborne && car.y < t.y - 0.5) return null;
    // Pista dividida: no buraco do meio (ou já caindo nele) não há chão.
    if (Math.abs(offset) < splitAt(race.playerDist)) return null;
    if (car.jump?.type === 'split' && car.airborne && car.y < t.y - 0.5) return null;
    if (track.pier) return t.y;                      // píer: o deque vai até a cerca, tudo na altura da estrada
    const k = Math.min(1, Math.max(0, (Math.abs(offset) - ROAD_HALF - track.shoulder) / SHOULDER_BLEND));   // acostamento largo: plano até o fim dele
    return t.y + (track.heightAt(car.x, car.z) - t.y) * k * k * (3 - 2 * k);
  }

  // Na rampa e na encosta do vale a gravidade puxa o carro morro abaixo: devagar ele não sobe.
  function pullDownhill(t, bank, dt) {
    const along = inFlightZone(race.playerDist) ? t.slope : 0, nx = -t.tz, nz = t.tx;
    if (!along && !bank) return;
    const scale = GRAVITY * dt / (1 + along * along + bank * bank);
    car.vx -= (along * t.tx + bank * nx) * scale;
    car.vz -= (along * t.tz + bank * nz) * scale;
  }

  // Volta ao começo do trecho (base da rampa, cabeceira da ponte) depois de cair.
  function respawnAtRamp() {
    const t = trackAt(car.jump.respawn);
    Object.assign(car, { x: t.x, z: t.z, y: t.y, vy: 0, vx: 0, vz: 0, speed: 0, spin: 0, airborne: false, sunk: 0, jump: null, trackIndex: -1 });
    car.yaw = Math.atan2(-t.tx, -t.tz);
    car.invulnerable = RESPAWN_PROTECTION;
  }

  // Bateu na face da outra margem por baixo da borda: volta para o vão e cai.
  function bounceOffBank(t) {
    const edge = car.jump.gaps[0][1], overshoot = wrapDistance(race.playerDist - edge) + 0.3;
    const along = car.vx * t.tx + car.vz * t.tz;
    car.x -= t.tx * overshoot;
    car.z -= t.tz * overshoot;
    car.vx -= t.tx * along * (1 + FACE_BOUNCE);
    car.vz -= t.tz * along * (1 + FACE_BOUNCE);
    reportWallCrash(Math.abs(along));
    crashDamage(car, Math.abs(along) * IMPACT_DAMAGE / CAR_MAX_HP);
  }

  // Voou alto demais pelo portão do castelo: bate na muralha acima dele, volta para cima do fosso e cai.
  function bounceOffGate(t) {
    const overshoot = wrapDistance(race.playerDist - car.jump.gate.at) + 0.4;
    const along = car.vx * t.tx + car.vz * t.tz;
    car.x -= t.tx * overshoot;
    car.z -= t.tz * overshoot;
    car.vx -= t.tx * along * (1 + FACE_BOUNCE);
    car.vz -= t.tz * along * (1 + FACE_BOUNCE);
    car.vy = Math.min(car.vy, 0);
    car.spin += (Math.random() < 0.5 ? -1 : 1) * GATE_SPIN;
    reportWallCrash(Math.max(CRASH_FULL_IMPACT, Math.abs(along)));
    crashDamage(car, Math.abs(along) * IMPACT_DAMAGE / CAR_MAX_HP);
  }

  // Altura do carro: colado no chão, voando sobre o rio ou boiando nele.
  function updateHeight(t, offset, bank, dt) {
    const ground = groundUnder(t, offset);
    const groundRate = (car.vx * t.tx + car.vz * t.tz) * t.grade + (car.vx * -t.tz + car.vz * t.tx) * bank;
    if (ground === null) car.jump = hazardAt(race.playerDist) ?? car.jump;
    if (car.sunk > 0) {
      if (sinkStep(car, car.jump.water, dt)) onCrash('crash', car.x, car.z, 0.6);   // bateu na água
      if (car.sunk <= 0) respawnAtRamp();
      return;
    }
    if (!car.airborne && !inFlightZone(race.playerDist) && ground !== null) {
      car.y = ground ?? car.y;
      car.vy = groundRate;
      return;
    }
    const result = stepFlight(car, ground, groundRate, dt);
    if (result === 'blocked' && car.jump) bounceOffBank(t);
    if (car.airborne && hitsGate(car.jump, race.prevDist ?? race.playerDist, race.playerDist, car.y)) bounceOffGate(t);
    if (result === 'landed') {
      if (car.impact >= SOFT_LANDING) onCrash('land', car.x, car.z, Math.min(1, car.impact / HARD_LANDING));
      reportWallCrash(car.impact);
      damagePlayer(car, Math.max(0, car.impact - HARD_LANDING) * LANDING_DAMAGE * car.parts.landing / CAR_MAX_HP);
    }
    if (ground === null && fallIsCertain(car, car.jump, race.playerDist)) car.sunk = FALL_TIME;   // não alcança mais: está caindo
  }

  function placePlayerOnSurface(offset, dt) {
    const t = trackAt(race.playerDist);
    const bank = track.valley && !isEpic(race.playerDist) ? valleySlope(offset) : 0;
    updateHeight(t, offset, bank, dt);
    if (!car.airborne && car.sunk <= 0) pullDownhill(t, bank, dt);
    const forward = -Math.sin(car.yaw) * t.tx - Math.cos(car.yaw) * t.tz;
    if (car.airborne || car.sunk > 0) {
      const flat = Math.hypot(car.vx, car.vz), target = car.sunk > 0 ? 0.08 : Math.atan2(car.vy, Math.max(flat, 1)) * Math.sign(forward || 1);
      car.pitch += (target - car.pitch) * Math.min(1, dt * AIR_PITCH_RATE);
    } else {
      car.pitch = Math.atan(t.slope * forward);
    }
    const point = surfaceAt(race.playerDist, offset);
    // Saindo do tubo o carro deu uma volta completa (2π): equivale a giro nenhum, e não pode "desgirar" de volta.
    if (car.tube && point.roll === 0) car.twist = Math.atan2(Math.sin(car.twist), Math.cos(car.twist));
    car.tube = point.roll !== 0;
    // Na encosta do vale o carro deita junto com o chão, como dentro do tubo (o giro é em volta da pista).
    const lean = car.tube ? point.roll : car.airborne ? car.twist * Math.exp(-dt * BANK_RATE / 4) : Math.atan(bank);
    car.twist = car.tube ? lean : car.twist + (lean - car.twist) * Math.min(1, dt * BANK_RATE);
    if (Math.abs(car.twist) < 1e-4 && !car.tube) car.twist = 0;
    car.twistHeading = point.heading;
    car.twistYaw = car.tube ? point.twistYaw : 0;
    car.twistPitch = car.tube ? point.twistPitch : 0;
    car.wx = car.tube ? point.x : car.x;
    car.wy = car.tube ? point.y : car.y;
    car.wz = car.tube ? point.z : car.z;
  }

  // Contramão: bico virado contra o sentido da pista e andando nessa direção. Dar ré não conta.
  function updateWrongWay(dt) {
    const t = trackAt(race.playerDist);
    const heading = -Math.sin(car.yaw) * t.tx - Math.cos(car.yaw) * t.tz, along = car.vx * t.tx + car.vz * t.tz;
    const against = race.started && !race.finished && car.wrecked <= 0 && !car.overturned && heading < WRONG_WAY_HEADING && along < -WRONG_WAY_MIN_SPEED;
    wrongWayTime = against ? wrongWayTime + dt : 0;
    race.wrongWay = wrongWayTime >= WRONG_WAY_DELAY;
  }

  function fillNitro(racer, dt) {
    if (racer.nitroToFill <= 0) return;
    const amount = Math.min(racer.nitroToFill, dt / NITRO_FILL_TIME / racer.nitroCapacity, 1 - racer.nitro);
    racer.nitro += amount;
    racer.nitroToFill = racer.nitro >= 1 ? 0 : racer.nitroToFill - amount;
  }

  function updateSlipstreams(dt) {
    const blend = Math.min(1, dt * SLIPSTREAM_RESPONSE);
    playerProxy.draftRange = car.parts.draftRange;   // as peças do jogador valem nos dois lados do vácuo
    playerProxy.wake = car.parts.wake;
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
    car.health = lifeAfterDestruction(car.destroyed, car.parts.wreck);
    car.invulnerable = RESPAWN_PROTECTION;
    car.flip = null;
    car.destroyedBy = null;
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
    if (car.wrecked > 0) car.effects.cloak = 0;      // destruído, a camuflagem acaba
    playerProxy.sunk = car.sunk;
    playerProxy.protectedFor = car.invulnerable;
    playerProxy.health = car.health;                 // a IA escolhe alvo pela vida (botStyles.healthOf)
    playerProxy.overturned = car.overturned;
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
    // Quem não estava na corrida anterior (entrou depois) larga no fim do grid.
    const previous = finishNames?.map(name => field.find(racer => racer.name === name)).filter(Boolean);
    placeOnGrid(previous ? [...previous, ...field.filter(racer => !previous.includes(racer))] : firstGrid());
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
    raceClock.time = race.time;
    updatePlayerCondition(dt);
    updatePlayerOnTrack(dt);
    updateWrongWay(dt);
    updateSlipstreams(dt);
    if (race.started) {
      fillNitro(car, dt);
      for (const op of opponents) if (!op.remote) fillNitro(op, dt);
    }
    for (const op of opponents) {
      if (op.remote) updateRemoteRacer(op, dt);
      else updateOpponent(op, dt, field, race.started, activeTraps, race.time);
      if (op.remote) op.effects.cloak = Math.max(0, op.effects.cloak - dt);   // entre um retrato e outro da rede
      else if (op.dead > 0) op.effects.cloak = 0;    // destruído, a camuflagem acaba
      op.model.setCloak(cloakLevel(op));
    }
    collisions.update(dt);
    playerProxy.x = car.x;
    playerProxy.y = car.y;
    playerProxy.airborne = car.airborne;
    playerProxy.z = car.z;
    playerProxy.yaw = car.yaw;
    Object.assign(playerProxy, { wx: car.wx, wy: car.wy, wz: car.wz, twist: car.twist });
    updateRanking();
  };
  return race;
}
