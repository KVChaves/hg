import * as THREE from 'three';
import { CAR_MAX_HP, TRACK_WIDTH } from '../config.js';
import { surfaceAt, track, trackAt, wrapDistance } from '../world/track.js';
import { createDebris, createObstacleVisual, createShadow } from '../world/obstacleVisuals.js';
import { crashDamage } from './car.js';
import { damageOpponent } from './opponents.js';
import { HAZARD_KINDS } from './hazardKinds.js';
import { OBSTACLE_TYPES } from './obstacleTypes.js';

// Obstáculos dos pontos de perigo (hazardKinds.js): cada ponto fixo da pista dispara quando um carro chega perto,
// avisa (sombra e poeira, árvore balançando, bicho parado na beira) e depois recarrega. Qualquer carro dispara;
// como o primeiro a chegar costuma ser o líder, é ele quem mais abre caminho. Com o líder disparado os pontos
// recarregam até 2x mais rápido, e quem bate liderando perde mais velocidade (vale igual para jogador e bots).

const COOLDOWN = [20, 35], FIRST_COOLDOWN = [6, 14], MAX_ACTIVE = 2;   // segundos; no máximo 2 perigos em ação ao mesmo tempo
const LEAD_FOR_DOUBLE = 60, MAX_PRESSURE = 2;        // metros de vantagem do líder que dobram o ritmo da recarga
const RESPAWN_CLEAR = 150;                           // o que fica esperando (árvore, obras) só volta sem ninguém a essa distância
const FALL_TIME = 0.55, TOPPLE_TIME = 0.9, TOPPLE_SOLID_AT = 0.65, TOPPLE_LEAN = 0.12, WOBBLE = 0.06, WOBBLE_RATE = 18;
const SHAKE = 0.25, SHAKE_RATE = 30, DUST_COLORS = { rock: [0x8a867e, 0x6a665e], stalactite: [0xd8f4ff, 0x9ad8f0], barrels: [0xe8c020, 0x5a5a5a], crates: [0x9a7038, 0x5a5a5a], pillar: [0xe0b078, 0xc88a50], meteor: [0x8a8480, 0x5a5450], coconut: [0xd8c090, 0xa89a70], cactus: [0xd8c090, 0x9a8a60] };
const LEAF_COLORS = [0x2f7a2a, 0x3a8c30, 0x5a3a20];
// Som de quebrar por material (nomes em audio/soundFiles.js); o que não está aqui usa `crash`.
const OBSTACLE_SOUND = {
  tree: 'obstacleWood', crates: 'obstacleWood', umbrella: 'obstacleWood', cactus: 'obstacleWood', coconut: 'obstacleWood', tumbleweed: 'obstacleWood',
  animal: 'obstacleFlesh', camel: 'obstacleFlesh', crab: 'obstacleFlesh', kaiju: 'obstacleFlesh',
  stalactite: 'obstacleIce', snowball: 'obstacleIce', crystal: 'obstacleCrystal',
  rock: 'obstacleRock', pillar: 'obstacleRock', meteor: 'obstacleRock',
  barrels: 'obstacleMetal', antenna: 'obstacleMetal', rover: 'obstacleMetal',
};
const CAR_HALF_WIDTH = 0.95, CAR_HALF_LENGTH = 1.8, HIT_SLOWDOWN = 0.55, LEADER_HIT_SLOWDOWN = 0.2, LEADER_SPIN = 2.5;   // fração da velocidade que sobra
const PASSED_MARGIN = 35, LINGER = 8, CLEAR_VIEW = 120;   // caído na pista sem ninguém por perto, some depois de LINGER s
const EDGE_LANE = TRACK_WIDTH / 2 - 1.2, CROSS_FROM = TRACK_WIDTH / 2 + 4, BOT_LANE_LIMIT = TRACK_WIDTH / 2 - 1.2;
const DODGE_CHANCE = 0.65, DODGE_SIGHT = 55, DODGE_CLEARANCE = 2.4, DODGE_HOLD = 1;

const between = ([low, high]) => low + Math.random() * (high - low);
const clamp = (v, limit) => Math.max(-limit, Math.min(limit, v));
const kindOf = site => HAZARD_KINDS[site.kind];
const typeFor = kind => (Array.isArray(kind.obstacle) ? kind.obstacle[Math.floor(Math.random() * kind.obstacle.length)] : kind.obstacle);

// `isAuthority`: só um navegador decide quando os pontos disparam (o admin no online); os outros recebem pela rede.
export function createObstacles({ scene, race, car, isAuthority, onSound, onPlayerHit, onSpawned, onBroken }) {
  const obstacles = { active: [] };
  const debris = [];
  let nextId = 1, sites = [];
  const position = new THREE.Vector3();

  // Faixa que o obstáculo ocupa: a árvore caída cobre da base até a outra ponta.
  function bounds(ob) {
    if (ob.motion === 'topple') return { lane: ob.lane - ob.side * ob.type.length / 2, halfWidth: ob.type.length / 2 };
    return { lane: ob.lane, halfWidth: ob.type.halfWidth };
  }

  function place(ob) {
    const t = trackAt(ob.dist), pitch = Math.atan(t.slope), yaw = Math.atan2(-t.tx, -t.tz);
    const point = surfaceAt(ob.dist, ob.lane);
    ob.group.position.set(point.x, point.y, point.z);
    ob.group.rotation.order = 'YXZ';
    ob.group.rotation.set(pitch, yaw, point.roll);
  }

  // Fase inicial: o que cai ou atravessa nasce já avisando; árvore e obras nascem esperando.
  const firstPhase = motion => ({ drop: 'warning', cross: 'warning', topple: 'idle', static: 'solid' })[motion];

  function add(id, typeId, dist, lane, side, siteIndex, phase) {
    const type = OBSTACLE_TYPES[typeId], site = sites[siteIndex] ?? null, kind = site ? kindOf(site) : { motion: 'static' };
    const visual = createObstacleVisual(typeId);
    const ob = {
      id, type, visual, group: visual.group, body: visual.body, dist, lane, side, hp: type.hp, isObstacle: true, dead: false,
      site, kind, motion: kind.motion, phase: phase ?? firstPhase(kind.motion), t: 0, decisions: new Map(), shadow: null,
    };
    ob.solid = ob.phase === 'solid' || ob.motion === 'cross';
    ob.group.traverse(object => { object.userData.opponent = ob; });   // é por aqui que o tiro reconhece o obstáculo
    if (ob.motion === 'drop') {
      ob.body.position.y = kind.height;
      ob.shadow = createShadow(Math.max(type.halfWidth, type.halfLength) * 1.2);
      ob.shadow.scale.setScalar(0.2);
      ob.group.add(ob.shadow);
    }
    if (ob.motion === 'topple') ob.body.rotation.z = side * TOPPLE_LEAN;
    if (ob.motion === 'cross') ob.walk = -side;
    if (site) { site.ob = ob; site.state = 'active'; }
    scene.add(ob.group);
    place(ob);
    obstacles.active.push(ob);
    return ob;
  }

  // Cria o obstáculo de um ponto (só quem tem a autoridade) e avisa a rede.
  function spawnAt(site) {
    const kind = kindOf(site), typeId = typeFor(kind);
    let lane;
    if (kind.motion === 'topple') lane = site.side * EDGE_LANE;
    else if (kind.motion === 'cross') lane = site.side * CROSS_FROM;
    else if (kind.atTunnel) lane = between(kind.lanes);
    else lane = site.side * between(kind.lanes);
    onSpawned(add(nextId++, typeId, site.dist, lane, site.side, site.index));
  }

  obstacles.spawnFromNetwork = ({ n, i, d, l, s, w = -1, p }) => {
    if (OBSTACLE_TYPES[i] && !obstacles.active.some(ob => ob.id === n)) add(n, i, d, l, s, w, p);
  };
  obstacles.removeFromNetwork = id => {
    const ob = obstacles.active.find(candidate => candidate.id === id);
    if (ob) destroy(ob, false);
  };

  // O ponto fica livre: espera a recarga para disparar de novo.
  function release(ob) {
    if (!ob.site || ob.site.ob !== ob) return;
    ob.site.ob = null;
    ob.site.state = 'cooldown';
    ob.site.cooldown = between(COOLDOWN);
  }

  function remove(ob) {
    obstacles.active.splice(obstacles.active.indexOf(ob), 1);
    scene.remove(ob.group);
    ob.visual.dispose();
    ob.shadow?.material.dispose();
    ob.dead = true;
    release(ob);
  }

  function destroy(ob, announce = true) {
    ob.group.getWorldPosition(position);
    debris.push(createDebris(scene, position, ob.type.debris));
    remove(ob);
    onSound(OBSTACLE_SOUND[ob.type.id] ?? 'crash', position.x, position.z, 0.7);
    if (announce) onBroken(ob);
  }

  // Tiro do jogador: devolve true se quebrou.
  obstacles.shoot = (ob, amount) => {
    if (ob.dead) return false;
    ob.hp -= amount;
    if (ob.hp > 0) return false;
    destroy(ob);
    return true;
  };

  const alive = () => race.field.filter(racer => racer.dead <= 0);
  const leaderOf = racers => racers.reduce((best, racer) => (!best || racer.dist > best.dist ? racer : best), null);

  // Ritmo da recarga: 1 com a corrida embolada, até MAX_PRESSURE com o líder disparado.
  function pressure() {
    const [first, second] = alive().map(racer => racer.dist).sort((a, b) => b - a);
    if (second === undefined) return 1;
    return Math.min(MAX_PRESSURE, 1 + (first - second) / LEAD_FOR_DOUBLE);
  }

  function crash(racer, ob) {
    const leading = leaderOf(alive()) === racer, keep = Math.min(ob.type.keep ?? HIT_SLOWDOWN, leading ? LEADER_HIT_SLOWDOWN : 1);
    const kick = (ob.type.spin ?? 0) + (leading ? LEADER_SPIN : 0), side = Math.random() < 0.5 ? -1 : 1;
    if (racer.isPlayer) {
      crashDamage(car, ob.type.damage);
      car.vx *= keep;
      car.vz *= keep;
      car.spin += side * kick;
      onPlayerHit(ob.type);
    } else {
      damageOpponent(racer, ob.type.damage * CAR_MAX_HP, null);
      racer.v *= keep;
      racer.spin += side * kick;
    }
    destroy(ob);
  }

  function touches(racer, ob) {
    const { lane, halfWidth } = bounds(ob);
    return Math.abs(wrapDistance(racer.dist - ob.dist)) < ob.type.halfLength + CAR_HALF_LENGTH && Math.abs(racer.lane - lane) < halfWidth + CAR_HALF_WIDTH;
  }

  // Os bots nem sempre percebem: cada um decide uma vez se desvia de cada obstáculo.
  function steerBots(ob) {
    const { lane, halfWidth } = bounds(ob);
    if (ob.motion === 'cross' && Math.abs(lane) > TRACK_WIDTH / 2 + halfWidth) return;   // ainda (ou já) fora da pista
    for (const racer of race.field) {
      if (racer.isPlayer || racer.remote || racer.dead > 0) continue;
      const ahead = wrapDistance(ob.dist - racer.dist);
      if (ahead <= 0 || ahead > DODGE_SIGHT || Math.abs(racer.lane - lane) > halfWidth + DODGE_CLEARANCE) continue;
      if (!ob.decisions.has(racer)) ob.decisions.set(racer, Math.random() < DODGE_CHANCE);
      if (!ob.decisions.get(racer)) continue;
      let target;
      if (ob.motion === 'topple') target = -ob.side * BOT_LANE_LIMIT;
      else if (ob.motion === 'cross') target = -ob.walk * BOT_LANE_LIMIT;        // passa por trás de quem atravessa
      else {
        const direction = racer.lane >= lane ? 1 : -1;
        target = lane + direction * (halfWidth + DODGE_CLEARANCE);
        if (Math.abs(target) > BOT_LANE_LIMIT) target = lane - direction * (halfWidth + DODGE_CLEARANCE);
      }
      racer.laneTarget = clamp(target, BOT_LANE_LIMIT);
      racer.laneHold = DODGE_HOLD;
    }
  }

  // Algum carro vindo, entre 0 e `range` metros antes do ponto.
  const approaching = (dist, range) => alive().some(racer => {
    const ahead = wrapDistance(dist - racer.dist);
    return ahead > 0 && ahead < range;
  });
  const anyoneNear = (dist, range) => race.field.some(racer => Math.abs(wrapDistance(dist - racer.dist)) < range);

  function dropDust(ob, height) {
    ob.group.getWorldPosition(position);
    position.y += height;
    debris.push(createDebris(scene, position, DUST_COLORS[ob.type.id] ?? ob.type.debris, 7, { dust: true }));
  }

  function animate(ob, dt) {
    ob.t += dt;
    const { kind } = ob;
    if (ob.motion === 'drop') {
      if (ob.phase === 'warning') {
        // Sacode lá em cima, solta poeira e a sombra cresce no chão onde vai cair.
        ob.body.position.x = Math.sin(ob.t * SHAKE_RATE) * SHAKE;
        ob.shadow.scale.setScalar(ob.shadow.userData.radius * (0.2 + 0.8 * Math.min(1, ob.t / kind.warning)));
        if (ob.t - dt < 0.05 || (ob.t - dt < kind.warning * 0.6 && ob.t >= kind.warning * 0.6)) dropDust(ob, kind.height);
        if (ob.t >= kind.warning) { ob.phase = 'falling'; ob.t = 0; ob.body.position.x = 0; }
      } else if (ob.phase === 'falling') {
        const k = Math.min(1, ob.t / FALL_TIME);
        ob.body.position.y = kind.height * (1 - k * k);
        ob.body.rotation.y += dt * 4;
        if (k >= 1) {
          ob.phase = 'solid';
          ob.solid = true;
          // Quem já está embaixo quando ela pousa não bate: a rocha só vale para quem a vê no chão.
          ob.spared = new Set(race.field.filter(racer => touches(racer, ob)));
          ob.body.position.y = 0;
          ob.group.remove(ob.shadow);
          ob.group.getWorldPosition(position);
          onSound('crash', position.x, position.z, 0.5);
        }
      }
    } else if (ob.motion === 'topple') {
      if (ob.phase === 'idle' && approaching(ob.dist, kind.range)) { ob.phase = 'warning'; ob.t = 0; }
      if (ob.phase === 'warning') {
        // O galho estala: a árvore balança e solta folhas antes de vir abaixo.
        ob.body.rotation.z = ob.side * (TOPPLE_LEAN + Math.sin(ob.t * WOBBLE_RATE) * WOBBLE);
        if (ob.t - dt < 0.05) { ob.group.getWorldPosition(position); position.y += 7; debris.push(createDebris(scene, position, LEAF_COLORS, 8, { dust: true })); }
        if (ob.t >= kind.warning) { ob.phase = 'falling'; ob.t = 0; }
      } else if (ob.phase === 'falling') {
        const k = Math.min(1, ob.t / TOPPLE_TIME), angle = TOPPLE_LEAN + (Math.PI / 2 - TOPPLE_LEAN) * k * k;
        ob.body.rotation.z = ob.side * angle;
        ob.solid = k >= TOPPLE_SOLID_AT;
        if (k >= 1) ob.phase = 'solid';
      }
    } else if (ob.motion === 'cross') {
      // Espera na beira (dá para ver chegando) e atravessa; do outro lado, vai embora.
      if (ob.phase === 'warning' && ob.t >= kind.warning) ob.phase = 'walking';
      if (ob.phase === 'walking') {
        const step = kind.speed * dt;
        ob.lane += ob.walk * step;
        if (ob.type.radius) ob.body.rotation.z -= ob.walk * step / ob.type.radius;   // a bola rola
        place(ob);
      }
      ob.body.rotation.y = ob.type.radius ? 0 : ob.walk > 0 ? 0 : Math.PI;
    }
  }

  // O que ninguém mais vai alcançar sai da pista: todos já passaram, ou terminou a travessia.
  const passedByAll = ob => ob.phase !== 'idle' && race.field.every(racer => wrapDistance(racer.dist - ob.dist) > PASSED_MARGIN);
  const crossedOver = ob => ob.motion === 'cross' && Math.sign(ob.lane) === Math.sign(ob.walk) && Math.abs(ob.lane) > CROSS_FROM;

  obstacles.reset = () => {
    for (const ob of [...obstacles.active]) { scene.remove(ob.group); ob.visual.dispose(); }
    obstacles.active.length = 0;
    for (const piece of debris) piece.dispose();
    debris.length = 0;
    sites = track.hazards.map((site, index) => ({ ...site, index, state: 'cooldown', cooldown: between(FIRST_COOLDOWN), ob: null }));
    // Árvore torta e obras já estão lá na largada.
    if (isAuthority()) for (const site of sites) if (kindOf(site).idle) { site.state = 'ready'; spawnAt(site); }
  };

  function updateSites(dt) {
    const push = pressure(), busy = obstacles.active.filter(ob => ob.phase !== 'idle' && ob.motion !== 'static').length;
    let available = MAX_ACTIVE - busy;
    for (const site of sites) {
      const kind = kindOf(site);
      if (site.state === 'cooldown' && (site.cooldown -= dt * push) <= 0) site.state = 'ready';
      if (site.state !== 'ready') continue;
      if (kind.idle) {
        if (!anyoneNear(site.dist, RESPAWN_CLEAR)) spawnAt(site);   // volta sem ninguém ver brotar
      } else if (available > 0 && approaching(site.dist, kind.range)) {
        spawnAt(site);
        available--;
      }
    }
  }

  obstacles.update = dt => {
    for (let i = debris.length - 1; i >= 0; i--) {
      if (!debris[i].update(dt)) { debris[i].dispose(); debris.splice(i, 1); }
    }
    if (!race.started || race.finished || dt <= 0) return;
    if (isAuthority()) updateSites(dt);
    for (const ob of [...obstacles.active]) {
      animate(ob, dt);
      steerBots(ob);
      if (ob.solid) {
        if (ob.spared) { for (const racer of ob.spared) if (!touches(racer, ob)) ob.spared.delete(racer); }
        const hitter = race.field.find(racer => !ob.spared?.has(racer) && !racer.remote && racer.dead <= 0 && !racer.airborne && !(racer.isPlayer && (car.wrecked > 0 || car.overturned || car.airborne)) && touches(racer, ob));
        if (hitter) { crash(hitter, ob); continue; }
      }
      // Pedra caída, árvore tombada: saem quando todos passaram, ou depois de um tempo longe de todo mundo.
      // As obras (static) ficam até alguém bater.
      const settled = ob.phase === 'solid' && ob.motion !== 'static';
      if (settled) ob.solidFor = (ob.solidFor ?? 0) + dt;
      if (crossedOver(ob) || (settled && (passedByAll(ob) || (ob.solidFor > LINGER && !anyoneNear(ob.dist, CLEAR_VIEW))))) remove(ob);
    }
  };

  return obstacles;
}
