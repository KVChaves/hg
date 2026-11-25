import * as THREE from 'three';
import { damageOpponent } from './opponents.js';
import { damageAtDistance, fireInterval, shakeAtDistance, stepSpin, WEAPON_TYPES } from './weaponTypes.js';
import { partHit } from './carParts.js';
import { groundHit } from '../world/track.js';

const DEFAULT_TRACER = 0xffe9a0;
const HIT_PART_TIME = 0.7;
const ROUND_PICKUP_AT = 0.5, OUT_OF_AMMO_NOTICE = 1, TRACER_LENGTH = 120, DRY_FIRE_INTERVAL = 0.35;
// Recuo (type.kick): a mira sobe um pouco a cada tiro e volta sozinha. `weapon.kick` é somado à direção da cabeça
// (cabin.js), separado de `look`, para não esbarrar no limite de quanto a cabeça levanta. O tiro sai da câmera,
// então vai para onde a mira foi empurrada.
const KICK_VARIATION = 0.3, MAX_KICK_PITCH = 0.2, MAX_KICK_YAW = 0.08;

// `onIgnite(alvo, segundos)`: a flecha incendiária acertou um carro. `onGroundFire(ponto)`: caiu no asfalto
// (ponto de world/track.js groundHit). A granada que erra explode onde bate no chão.
export function createWeapon({ scene, camera, targets, extraTargets = () => [], shooter, canReload, onFired, onHit, onKill, onObstacleHit, onSplash = () => {}, onIgnite = () => {}, onGroundFire = () => {} }) {
  const raycaster = new THREE.Raycaster();
  const aimOffset = new THREE.Vector2();
  const right = new THREE.Vector3();

  const tracer = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1), new THREE.MeshBasicMaterial({ color: DEFAULT_TRACER, fog: false }));
  tracer.visible = false;
  scene.add(tracer);
  let tracerTime = 0, bloom = 0;

  const weapon = {
    type: WEAPON_TYPES.revolver, ammo: 0, capacity: 0, reserve: 0, outOfAmmo: 0, cooldown: 0,
    isReloading: false, roundsToLoad: 0, roundProgress: 0, carryingRound: false,
    flash: 0, hitMarker: 0, hitPart: null, hitPartTime: 0, kills: 0, sinceShot: Infinity, spin: 0, shots: 0, landed: 0, dryFires: 0,   // `landed`: disparos que machucaram algum carro (mira)
    kick: { pitch: 0, yaw: 0 },
  };

  // `type` é a arma já montada com as peças (weaponParts.buildWeapon); `reserveFactor` é a melhoria de munição comprada.
  weapon.equip = (type, reserveFactor = 1) => {
    weapon.kick.pitch = weapon.kick.yaw = 0;
    // A arma começa descarregada: a primeira recarga é por conta do piloto.
    Object.assign(weapon, { type, ammo: 0, capacity: type.magazine, maxReserve: Math.ceil(type.reserve * reserveFactor), reserve: Math.ceil(type.reserve * reserveFactor), isReloading: false, carryingRound: false, roundProgress: 0, roundsToLoad: 0, cooldown: 0, flash: 0, hitMarker: 0, outOfAmmo: 0, kills: 0, sinceShot: Infinity, spin: 0 });
    raycaster.far = type.range;
    tracer.material.color.setHex(type.tracer ?? DEFAULT_TRACER);
    bloom = 0;
  };

  weapon.setTracerColor = color => tracer.material.color.setHex(color ?? weapon.type.tracer ?? DEFAULT_TRACER);

  weapon.reload = () => {
    if (!canReload() || weapon.isReloading || weapon.ammo >= weapon.capacity) return;
    if (weapon.reserve <= 0) { weapon.outOfAmmo = OUT_OF_AMMO_NOTICE; return; }
    weapon.isReloading = true;
    weapon.roundsToLoad = Math.min(weapon.capacity - weapon.ammo, weapon.reserve);
    weapon.roundProgress = 0;
    weapon.carryingRound = false;
  };

  function showTracer(origin, direction, end) {
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    const start = origin.clone().addScaledVector(right, 0.35).addScaledVector(direction, 0.6);
    start.y -= 0.25;
    tracer.position.copy(start).lerp(end, 0.5);
    tracer.scale.z = start.distanceTo(end);
    tracer.lookAt(end);
    tracer.visible = true;
    tracerTime = 0.06;
    onFired(weapon.type.id, start, end);
  }

  // Lança-granadas: explode onde acertou e machuca quem estiver em volta, menos quanto mais longe.
  // Devolve se a explosão machucou algum carro (o alvo direto não conta, já contou como acerto).
  function explodeAt(point, direct) {
    const { radius, min } = weapon.type.splash;
    let hurt = false;
    onSplash(point);
    for (const target of [...targets.filter(t => !t.dead), ...extraTargets()]) {
      if (target === direct) continue;
      const distance = target.group.position.distanceTo(point);
      if (distance > radius) continue;
      const share = 1 - (1 - min) * distance / radius, amount = weapon.type.damage * share;
      if (target.isObstacle) { onObstacleHit(target, amount); continue; }
      hurt = true;
      // Munição de impacto: a explosão também balança quem ela pega, menos nas bordas.
      if (damageOpponent(target, amount, shooter, (weapon.type.shake ?? 0) * share)) { onKill(target, 'splash'); weapon.hitMarker = 0.4; }
    }
    return hurt;
  }

  weapon.fire = () => {
    if (weapon.cooldown > 0 || weapon.isReloading || shooter.effects.emp > 0) return;
    if (weapon.ammo <= 0) {
      if (weapon.reserve <= 0) {
        weapon.dryFires++;
        weapon.cooldown = DRY_FIRE_INTERVAL;
      }
      weapon.reload();
      return;
    }
    const { type } = weapon;
    weapon.ammo--;
    weapon.cooldown = fireInterval(type, weapon.spin);
    weapon.flash = 0.07;
    weapon.shots++;
    weapon.sinceShot = 0;

    aimOffset.set((Math.random() - 0.5) * 2 * bloom, (Math.random() - 0.5) * 2 * bloom);
    if (type.bloom) bloom = Math.min(type.bloom.max, bloom + type.bloom.perShot);

    camera.updateMatrixWorld();
    raycaster.setFromCamera(aimOffset, camera);
    const hits = raycaster.intersectObjects([...targets.filter(t => !t.dead), ...extraTargets()].map(t => t.group), true);
    const { origin, direction } = raycaster.ray;
    let end = origin.clone().addScaledVector(direction, Math.min(type.range, TRACER_LENGTH)), landed = false;

    if (hits.length) {
      end = hits[0].point;
      weapon.hitMarker = 0.15;
      const target = hits[0].object.userData.opponent;
      if (target.isObstacle) {                      // obstáculos quebram a tiro e não contam como abate
        if (onObstacleHit(target, damageAtDistance(type, hits[0].distance))) weapon.hitMarker = 0.4;
      } else {
        landed = true;
        onHit(target);
        const part = partHit(hits[0].object, target.group.worldToLocal(hits[0].point.clone()));
        if (part.label) { weapon.hitPart = part.label; weapon.hitPartTime = HIT_PART_TIME; }
        if (damageOpponent(target, damageAtDistance(type, hits[0].distance) * part.multiplier, shooter, shakeAtDistance(type, hits[0].distance), type.ammo)) {
          onKill(target, 'shot');
          weapon.hitMarker = 0.4;
        }
      }
      if (type.burn && !target.isObstacle) onIgnite(target, type.burn);
      if (type.splash && explodeAt(end, target)) landed = true;
    } else if (type.splash || type.burn) {
      const ground = groundHit(origin, direction, type.range);
      if (ground) {
        end = new THREE.Vector3(ground.x, ground.y, ground.z);
        if (type.splash && explodeAt(end, null)) landed = true;
        if (type.burn) onGroundFire(ground);
      }
    }
    if (landed) weapon.landed++;
    showTracer(origin, direction, end);
    addKick(type.kick);
  };

  // O recuo vale para o próximo tiro: este já saiu.
  function addKick({ up, side }) {
    const { kick } = weapon;
    kick.pitch = Math.min(MAX_KICK_PITCH, kick.pitch + up * (1 + (Math.random() - 0.5) * 2 * KICK_VARIATION));
    kick.yaw = Math.max(-MAX_KICK_YAW, Math.min(MAX_KICK_YAW, kick.yaw + (Math.random() - 0.5) * 2 * side));
  }

  // Ciclo de recarga: a mão pega no meio do ciclo e coloca na arma no fim.
  // Armas de balas soltas repetem o ciclo por bala; a submetralhadora troca o pente num ciclo só.
  function loadRounds(dt) {
    const { type } = weapon;
    weapon.roundProgress += dt / type.roundTime;
    const amount = type.reloadsWholeMagazine ? weapon.roundsToLoad : 1;

    if (!weapon.carryingRound && weapon.roundProgress >= ROUND_PICKUP_AT) {
      weapon.carryingRound = true;
      weapon.reserve -= amount;
    }
    if (weapon.roundProgress < 1) return;

    weapon.ammo += amount;
    weapon.roundsToLoad -= amount;
    weapon.roundProgress = 0;
    weapon.carryingRound = false;
    if (weapon.roundsToLoad <= 0) weapon.isReloading = false;
  }

  weapon.update = (dt, triggerHeld) => {
    weapon.cooldown -= dt;
    weapon.sinceShot += dt;
    weapon.flash -= dt;
    weapon.hitMarker -= dt;
    weapon.hitPartTime -= dt;
    weapon.outOfAmmo -= dt;
    if (weapon.type.bloom) bloom = Math.max(0, bloom - weapon.type.bloom.decay * dt);
    const settle = Math.exp(-weapon.type.kick.recover * dt);
    weapon.kick.pitch *= settle;
    weapon.kick.yaw *= settle;
    if (weapon.isReloading) loadRounds(dt);
    // Metralhadora: os canos só giram com o gatilho apertado e a arma pronta para atirar.
    weapon.spin = stepSpin(weapon.type, weapon.spin, triggerHeld && !weapon.isReloading && weapon.ammo > 0 && shooter.effects.emp <= 0, dt);
    if (weapon.type.automatic && triggerHeld && dt > 0) weapon.fire();
    if (tracerTime > 0 && (tracerTime -= dt) <= 0) tracer.visible = false;
  };

  return weapon;
}
