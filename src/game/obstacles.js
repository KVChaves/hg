import * as THREE from 'three';
import { CAR_MAX_HP, LAPS, TRACK_WIDTH } from '../config.js';
import { inGap, isEpic, surfaceAt, track, trackAt, wrapDistance } from '../world/track.js';
import { createDebris, createObstacleVisual } from '../world/obstacleVisuals.js';
import { damagePlayer } from './car.js';
import { damageOpponent } from './opponents.js';
import { BIOME_OBSTACLES, OBSTACLE_TYPES } from './obstacleTypes.js';

// Obstáculos dinâmicos: surgem à frente do líder e ficam na pista até alguém bater ou eles serem quebrados a tiro.

const FIRST_DELAY = 10, INTERVAL = [9, 15], SPAWN_AHEAD = [170, 230], MAX_ACTIVE = 4, MIN_SPACING = 70;
const TRIGGER_RANGE = 60, DROP_HEIGHT = 14, DROP_TIME = 0.55, TOPPLE_TIME = 0.9, TOPPLE_SOLID_AT = 0.65;
const CAR_HALF_WIDTH = 0.95, CAR_HALF_LENGTH = 1.8, HIT_SLOWDOWN = 0.55;
const FINISH_MARGIN = 40, PASSED_MARGIN = 35, MAX_CURVE = 1 / 70;
const EDGE_LANE = TRACK_WIDTH / 2 - 1.2, FREE_LANE = 4.2, BOT_LANE_LIMIT = 5.2, WANDER_LIMIT = 4.5;
const DODGE_CHANCE = 0.65, DODGE_SIGHT = 55, DODGE_CLEARANCE = 2.4, DODGE_HOLD = 1;

const between = ([low, high]) => low + Math.random() * (high - low);
const pick = list => list[Math.floor(Math.random() * list.length)];
const clamp = (v, limit) => Math.max(-limit, Math.min(limit, v));

// `isAuthority`: só um navegador sorteia os obstáculos (o admin no online); os outros recebem pela rede.
export function createObstacles({ scene, race, car, getBiome, isAuthority, onSound, onPlayerHit, onSpawned, onBroken }) {
  const obstacles = { active: [] };
  const debris = [];
  let nextId = 1, timer = FIRST_DELAY;
  const position = new THREE.Vector3();

  // Faixa que o obstáculo ocupa: a árvore caída cobre da base até a outra ponta.
  function bounds(ob) {
    if (ob.type.behavior === 'topple') return { lane: ob.lane - ob.side * ob.type.length / 2, halfWidth: ob.type.length / 2 };
    return { lane: ob.lane, halfWidth: ob.type.halfWidth };
  }

  function place(ob) {
    const t = trackAt(ob.dist), pitch = Math.atan(t.slope), yaw = Math.atan2(-t.tx, -t.tz);
    const point = surfaceAt(ob.dist, ob.lane);
    ob.group.position.set(point.x, point.y, point.z);
    ob.group.rotation.order = 'YXZ';
    ob.group.rotation.set(pitch, yaw, point.roll);
  }

  function add(id, typeId, dist, lane, side) {
    const type = OBSTACLE_TYPES[typeId];
    const visual = createObstacleVisual(typeId);
    const ob = {
      id, type, visual, group: visual.group, body: visual.body, dist, lane, side, hp: type.hp, isObstacle: true, dead: false,
      phase: type.behavior === 'drop' ? 'hanging' : type.behavior === 'topple' ? 'standing' : 'solid',
      solid: type.behavior !== 'drop' && type.behavior !== 'topple', t: 0, moved: 0, decisions: new Map(),
    };
    ob.group.traverse(object => { object.userData.opponent = ob; });   // é por aqui que o tiro reconhece o obstáculo
    if (type.behavior === 'drop') ob.body.position.y = DROP_HEIGHT;
    scene.add(ob.group);
    place(ob);
    obstacles.active.push(ob);
    return ob;
  }

  // Sorteia o ponto: longe do líder, sem vão, salto, túnel, curva fechada nem outro obstáculo por perto.
  function chooseSpot() {
    const leader = race.field.filter(racer => racer.dead <= 0).reduce((best, racer) => (!best || racer.dist > best.dist ? racer : best), null);
    if (!leader) return null;
    const finish = (LAPS + 1) * track.length - FINISH_MARGIN;
    for (let attempt = 0; attempt < 12; attempt++) {
      const dist = leader.dist + between(SPAWN_AHEAD);
      if (dist > finish || inGap(dist) || isEpic(dist)) continue;
      const index = Math.floor((((dist % track.length) + track.length) % track.length) / track.step) % track.count;
      if (track.enclosed[index] || track.curvature[index] > MAX_CURVE) continue;
      if (obstacles.active.some(ob => Math.abs(ob.dist - dist) < MIN_SPACING)) continue;
      return dist;
    }
    return null;
  }

  function spawn() {
    const dist = chooseSpot();
    if (dist === null) return;
    const typeId = pick(BIOME_OBSTACLES[getBiome().id] ?? []);
    if (!typeId) return;
    const type = OBSTACLE_TYPES[typeId];
    const side = Math.random() < 0.5 ? -1 : 1;
    const lane = type.behavior === 'topple' ? side * EDGE_LANE : (Math.random() * 2 - 1) * FREE_LANE;
    onSpawned(add(nextId++, typeId, dist, lane, side));
  }

  obstacles.spawnFromNetwork = ({ n, i, d, l, s }) => {
    if (OBSTACLE_TYPES[i] && !obstacles.active.some(ob => ob.id === n)) add(n, i, d, l, s);
  };
  obstacles.removeFromNetwork = id => {
    const ob = obstacles.active.find(candidate => candidate.id === id);
    if (ob) destroy(ob, false);
  };

  function destroy(ob, announce = true) {
    obstacles.active.splice(obstacles.active.indexOf(ob), 1);
    ob.group.getWorldPosition(position);
    debris.push(createDebris(scene, position, ob.type.debris));
    scene.remove(ob.group);
    ob.visual.dispose();
    ob.dead = true;
    onSound('crash', position.x, position.z, 0.7);
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

  function crash(racer, ob) {
    if (racer.isPlayer) {
      damagePlayer(car, ob.type.damage);
      car.vx *= HIT_SLOWDOWN;
      car.vz *= HIT_SLOWDOWN;
      onPlayerHit(ob.type);
    } else {
      damageOpponent(racer, ob.type.damage * CAR_MAX_HP, null);
      racer.v *= HIT_SLOWDOWN;
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
    for (const racer of race.field) {
      if (racer.isPlayer || racer.remote || racer.dead > 0) continue;
      const ahead = ob.dist - racer.dist;
      if (ahead <= 0 || ahead > DODGE_SIGHT || Math.abs(racer.lane - lane) > halfWidth + DODGE_CLEARANCE) continue;
      if (!ob.decisions.has(racer)) ob.decisions.set(racer, Math.random() < DODGE_CHANCE);
      if (!ob.decisions.get(racer)) continue;
      let target;
      if (ob.type.behavior === 'topple') target = -ob.side * BOT_LANE_LIMIT;
      else {
        const direction = racer.lane >= lane ? 1 : -1;
        target = lane + direction * (halfWidth + DODGE_CLEARANCE);
        if (Math.abs(target) > BOT_LANE_LIMIT) target = lane - direction * (halfWidth + DODGE_CLEARANCE);
      }
      racer.laneTarget = clamp(target, BOT_LANE_LIMIT);
      racer.laneHold = DODGE_HOLD;
    }
  }

  function triggered(ob) {
    return race.field.some(racer => racer.dead <= 0 && ob.dist - racer.dist > 0 && ob.dist - racer.dist < TRIGGER_RANGE);
  }

  function animate(ob, dt) {
    const { behavior } = ob.type;
    if (behavior === 'drop') {
      if (ob.phase === 'hanging' && triggered(ob)) ob.phase = 'falling';
      if (ob.phase === 'falling') {
        ob.t += dt;
        const k = Math.min(1, ob.t / DROP_TIME);
        ob.body.position.y = DROP_HEIGHT * (1 - k * k);
        ob.body.rotation.y += dt * 4;
        if (k >= 1) { ob.phase = 'solid'; ob.solid = true; ob.body.position.y = 0; }
      }
    } else if (behavior === 'topple') {
      if (ob.phase === 'standing' && triggered(ob)) ob.phase = 'falling';
      if (ob.phase === 'falling') {
        ob.t += dt;
        const k = Math.min(1, ob.t / TOPPLE_TIME);
        ob.body.rotation.z = ob.side * (Math.PI / 2) * k * k;
        ob.solid = k >= TOPPLE_SOLID_AT;
        if (k >= 1) ob.phase = 'solid';
      }
    } else if (behavior === 'roll') {
      if (ob.moved < ob.type.rollDistance) {
        const step = ob.type.rollSpeed * dt;
        ob.dist -= step;
        ob.moved += step;
        ob.body.rotation.x -= step / ob.type.radius;
        place(ob);
      }
    } else if (behavior === 'wander') {
      ob.walk ??= Math.random() < 0.5 ? -1 : 1;
      ob.lane += ob.walk * ob.type.speed * dt;
      if (Math.abs(ob.lane) > WANDER_LIMIT) { ob.lane = clamp(ob.lane, WANDER_LIMIT); ob.walk = -ob.walk; }
      ob.body.rotation.y = ob.walk > 0 ? 0 : Math.PI;
      place(ob);
    }
  }

  // Quando todos já passaram, ninguém mais vai bater: sai da pista.
  const passedByAll = ob => race.field.every(racer => racer.dist - ob.dist > PASSED_MARGIN);

  obstacles.reset = () => {
    for (const ob of [...obstacles.active]) { scene.remove(ob.group); ob.visual.dispose(); }
    obstacles.active.length = 0;
    for (const piece of debris) piece.dispose();
    debris.length = 0;
    timer = FIRST_DELAY;
  };

  obstacles.update = dt => {
    for (let i = debris.length - 1; i >= 0; i--) {
      if (!debris[i].update(dt)) { debris[i].dispose(); debris.splice(i, 1); }
    }
    if (!race.started || race.finished || dt <= 0) return;

    if (isAuthority() && obstacles.active.length < MAX_ACTIVE && (timer -= dt) <= 0) {
      spawn();
      timer = between(INTERVAL);
    }
    for (const ob of [...obstacles.active]) {
      animate(ob, dt);
      steerBots(ob);
      if (ob.solid) {
        const hitter = race.field.find(racer => !racer.remote && racer.dead <= 0 && !(racer.isPlayer && (car.wrecked > 0 || car.overturned)) && touches(racer, ob));
        if (hitter) { crash(hitter, ob); continue; }
      }
      if (passedByAll(ob)) { scene.remove(ob.group); ob.visual.dispose(); obstacles.active.splice(obstacles.active.indexOf(ob), 1); }
    }
  };

  return obstacles;
}
