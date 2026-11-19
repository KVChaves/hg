import * as THREE from 'three';
import { CAR_MAX_HP, TRACK_WIDTH } from '../config.js';
import { track, trackAt, wrapDistance } from '../world/track.js';
import { crashDamage } from './car.js';
import { damageOpponent } from './opponents.js';

// Raios da tempestade elétrica (bioma com `lightning`). De tempos em tempos um raio mira um carro: aparece no chão,
// à frente dele, um círculo azul que vai se enchendo; quando enche, o raio cai. Quem estiver dentro leva dano, perde
// velocidade, roda e fica sem nitro por uns segundos (pane elétrica). Dá para ver e desviar: o alvo fica onde o
// carro vai estar se seguir reto, então basta trocar de faixa ou frear. Entre um raio e outro o céu pisca sozinho.
//
// `config` (do bioma): interval [mín, máx] segundos entre raios, warning (segundos de aviso), radius (m),
// damage (fração da vida), emp (segundos sem nitro). Online cada navegador mira o próprio carro, e o admin mira
// também os bots, como os pontos de perigo.

const ROAD_LIMIT = TRACK_WIDTH / 2 - 1.2, AIM_SPREAD = 2.2;
const HIT_SLOWDOWN = 0.55, HIT_SPIN = 2.4, PLAYER_SHARE = 0.55;
const BOT_DODGE_CHANCE = 0.6, BOT_DODGE_SIGHT = 70, BOT_DODGE_CLEARANCE = 2.6;
const BOLT_TIME = 0.28, BOLT_HEIGHT = 60, BOLT_SEGMENTS = 9, BOLT_JITTER = 2.4, FLASH_RANGE = 260;
const SKY_FLASH_EVERY = [4, 9], FLASH_DECAY = 7;
const THUNDER_DELAY = [0.4, 2.2], THUNDER_NEAR = 40;   // o trovão do relâmpago do céu chega depois do clarão
const SKY_THUNDER = ['thunderFar', 'thunderRoll'];
const RING_COLOR = 0x70d8ff, BOLT_COLOR = 0xe8f4ff, PILLAR_HEIGHT = 26;

const between = ([low, high]) => low + Math.random() * (high - low);
const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));

export function createLightning({ scene, race, car, isAuthority, onSound, onPlayerHit }) {
  let config = null, wait = 0, skyWait = 0, flash = 0;
  const strikes = [], thunders = [];                 // thunders: trovões esperando a hora de tocar
  const up = new THREE.Vector3(0, 1, 0), direction = new THREE.Vector3();

  function groundPoint(dist, lane) {
    const t = trackAt(dist);
    return { x: t.x - t.tz * lane, y: t.y, z: t.z + t.tx * lane, slope: t.slope, yaw: Math.atan2(-t.tx, -t.tz) };
  }

  // Círculo de aviso no chão: a borda pisca e o disco de dentro cresce até a borda quando o raio cai.
  function createMarker(dist, lane, radius) {
    const at = groundPoint(dist, lane), group = new THREE.Group();
    group.position.set(at.x, at.y + 0.12, at.z);
    group.rotation.order = 'YXZ';
    group.rotation.set(Math.atan(at.slope), at.yaw, 0);
    const extra = { color: RING_COLOR, fog: false, transparent: true, depthWrite: false, side: THREE.DoubleSide };
    const ringGeometry = new THREE.RingGeometry(radius - 0.9, radius, 24);
    ringGeometry.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({ ...extra, opacity: 0.9 }));
    const discGeometry = new THREE.CircleGeometry(radius, 24);
    discGeometry.rotateX(-Math.PI / 2);
    const disc = new THREE.Mesh(discGeometry, new THREE.MeshBasicMaterial({ ...extra, opacity: 0.35 }));
    disc.position.y = 0.02;
    // Coluna de luz em cima do círculo: deitado no chão ele some de longe, a coluna se vê da cabine.
    const pillarGeometry = new THREE.CylinderGeometry(radius * 0.35, radius * 0.9, PILLAR_HEIGHT, 8, 1, true);
    pillarGeometry.translate(0, PILLAR_HEIGHT / 2, 0);
    const pillar = new THREE.Mesh(pillarGeometry, new THREE.MeshBasicMaterial({ ...extra, opacity: 0.1 }));
    group.add(ring, disc, pillar);
    scene.add(group);
    return { group, ring, disc, pillar, at };
  }

  // Raio em zigue-zague do céu até o centro do círculo, com um galho.
  function createBolt(at) {
    const group = new THREE.Group(), material = new THREE.MeshBasicMaterial({ color: BOLT_COLOR, fog: false });
    const addSegment = (from, to, width) => {
      direction.subVectors(to, from);
      const length = direction.length();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, length, width), material);
      mesh.position.addVectors(from, to).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(up, direction.normalize());
      group.add(mesh);
    };
    let previous = new THREE.Vector3(at.x + between([-6, 6]), at.y + BOLT_HEIGHT, at.z + between([-6, 6]));
    for (let k = 1; k <= BOLT_SEGMENTS; k++) {
      const u = k / BOLT_SEGMENTS, jitter = k === BOLT_SEGMENTS ? 0 : BOLT_JITTER;
      const next = new THREE.Vector3(
        previous.x + (at.x - previous.x) / (BOLT_SEGMENTS - k + 1) + between([-jitter, jitter]),
        at.y + BOLT_HEIGHT * (1 - u),
        previous.z + (at.z - previous.z) / (BOLT_SEGMENTS - k + 1) + between([-jitter, jitter]),
      );
      addSegment(previous, next, 0.55 - u * 0.2);
      if (k === 4) {
        const tip = next.clone().add(new THREE.Vector3(between([-9, 9]), -12, between([-9, 9])));
        addSegment(next, tip, 0.25);
      }
      previous = next;
    }
    scene.add(group);
    return group;
  }

  function disposeGroup(group) {
    scene.remove(group);
    group.traverse(object => {
      object.geometry?.dispose();
      object.material?.dispose();
    });
  }

  // Quem pode ser alvo neste navegador: o próprio jogador e, sendo a autoridade, os bots.
  function candidates() {
    const list = [];
    for (const racer of race.field) {
      if (racer.remote || racer.dead > 0) continue;
      if (racer.isPlayer ? car.wrecked > 0 || car.sunk > 0 : !isAuthority()) continue;
      list.push(racer);
    }
    return list;
  }

  function aimAt(target) {
    const ahead = Math.max(0, target.v) * config.warning;
    const dist = target.dist + ahead, lane = clamp(target.lane + between([-AIM_SPREAD, AIM_SPREAD]), ROAD_LIMIT);
    const index = Math.floor((((dist % track.length) + track.length) % track.length) / track.step) % track.count;
    if (track.enclosed[index] || track.gap[index] || track.roll[index]) return false;   // dentro do túnel, no vão ou no tubo não cai raio
    strikes.push({ dist, lane, t: 0, marker: createMarker(dist, lane, config.radius), bolt: null });
    warnBots(dist, lane);
    return true;
  }

  // Os bots que vêm vindo às vezes percebem o círculo e desviam.
  function warnBots(dist, lane) {
    if (!isAuthority()) return;
    for (const racer of race.field) {
      if (racer.isPlayer || racer.remote || racer.dead > 0) continue;
      const behind = wrapDistance(dist - racer.dist);
      if (behind < 0 || behind > BOT_DODGE_SIGHT || Math.abs(racer.lane - lane) > config.radius + 1) continue;
      if (Math.random() > BOT_DODGE_CHANCE) continue;
      const side = racer.lane >= lane ? 1 : -1;
      let target = lane + side * (config.radius + BOT_DODGE_CLEARANCE);
      if (Math.abs(target) > ROAD_LIMIT) target = lane - side * (config.radius + BOT_DODGE_CLEARANCE);
      racer.laneTarget = clamp(target, ROAD_LIMIT);
      racer.laneHold = config.warning + 0.5;
    }
  }

  function strike(s) {
    s.bolt = createBolt(s.marker.at);
    const { at } = s.marker, distance = Math.hypot(at.x - car.x, at.z - car.z);
    flash = Math.max(flash, 1 - Math.min(1, distance / FLASH_RANGE) * 0.7);
    onSound('emp', at.x, at.z, 1);
    onSound('thunderClose', at.x, at.z, 1);
    for (const racer of race.field) {
      if (racer.remote || racer.dead > 0) continue;
      if (!racer.isPlayer && !isAuthority()) continue;
      if (Math.abs(wrapDistance(racer.dist - s.dist)) > config.radius + 1 || Math.abs(racer.lane - s.lane) > config.radius) continue;
      const spin = (Math.random() < 0.5 ? -1 : 1) * HIT_SPIN;
      if (racer.isPlayer) {
        if (car.airborne || car.sunk > 0 || car.wrecked > 0) continue;
        crashDamage(car, config.damage);
        car.vx *= HIT_SLOWDOWN;
        car.vz *= HIT_SLOWDOWN;
        car.spin += spin;
        car.effects.emp = Math.max(car.effects.emp, config.emp);
        car.effects.shock = Math.max(car.effects.shock, config.emp);
        onPlayerHit();
      } else {
        damageOpponent(racer, config.damage * CAR_MAX_HP, null);
        racer.v *= HIT_SLOWDOWN;
        racer.spin += spin;
        racer.effects.emp = Math.max(racer.effects.emp, config.emp);
        racer.effects.shock = Math.max(racer.effects.shock, config.emp);
      }
    }
  }

  function reset() {
    for (const s of strikes) {
      disposeGroup(s.marker.group);
      if (s.bolt) disposeGroup(s.bolt);
    }
    strikes.length = 0;
    thunders.length = 0;
    wait = config ? between(config.interval) + 3 : 0;
    skyWait = between(SKY_FLASH_EVERY);
    flash = 0;
  }

  return {
    // Chamado a cada corrida com o `lightning` do bioma (nulo desliga).
    configure(next) {
      config = next ?? null;
      reset();
    },
    reset,
    // Clarão do céu, de 0 a 1: main.js clareia a neblina e a cabine com ele.
    get flash() { return flash * (0.75 + Math.random() * 0.25); },
    update(dt) {
      flash *= Math.exp(-FLASH_DECAY * dt);
      if (!config || dt <= 0) return;
      for (let n = thunders.length - 1; n >= 0; n--) {
        const thunder = thunders[n];
        if ((thunder.delay -= dt) > 0) continue;
        onSound(thunder.name, thunder.x, thunder.z, 0.6);
        thunders.splice(n, 1);
      }
      if (race.started && !race.finished) {
        if ((wait -= dt) <= 0) {
          const list = candidates(), player = list.find(racer => racer.isPlayer), bots = list.filter(racer => !racer.isPlayer);
          const target = player && (Math.random() < PLAYER_SHARE || !bots.length) ? player : bots[Math.floor(Math.random() * bots.length)];
          wait = target && aimAt(target) ? between(config.interval) : 0.8;
        }
      }
      if ((skyWait -= dt) <= 0) {                    // relâmpago distante, sem raio na pista
        skyWait = between(SKY_FLASH_EVERY);
        flash = Math.max(flash, 0.35 + Math.random() * 0.3);
        thunders.push({ delay: between(THUNDER_DELAY), name: SKY_THUNDER[Math.floor(Math.random() * SKY_THUNDER.length)], x: car.x + between([-THUNDER_NEAR, THUNDER_NEAR]), z: car.z + between([-THUNDER_NEAR, THUNDER_NEAR]) });
      }
      for (let n = strikes.length - 1; n >= 0; n--) {
        const s = strikes[n];
        s.t += dt;
        if (s.t < config.warning) {
          const progress = s.t / config.warning;
          s.marker.disc.scale.setScalar(Math.max(0.05, progress));
          s.marker.ring.material.opacity = 0.45 + 0.55 * (Math.floor(s.t * (6 + progress * 14)) % 2);
          s.marker.pillar.material.opacity = 0.08 + progress * 0.32;
          continue;
        }
        if (!s.bolt) strike(s);
        s.bolt.visible = Math.floor(s.t * 30) % 3 !== 0;
        s.marker.disc.material.opacity = Math.max(0, 0.6 * (1 - (s.t - config.warning) / BOLT_TIME));
        s.marker.pillar.visible = false;
        if (s.t >= config.warning + BOLT_TIME) {
          disposeGroup(s.marker.group);
          disposeGroup(s.bolt);
          strikes.splice(n, 1);
        }
      }
    },
  };
}
