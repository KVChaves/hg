import * as THREE from 'three';
import { damageOpponent } from './opponents.js';
import { damageAtDistance, shakeAtDistance, WEAPON_TYPES } from './weaponTypes.js';
import { partHit } from './carParts.js';
import { groundHit } from '../world/track.js';

const DEFAULT_TRACER = 0xffe9a0;
const HIT_PART_TIME = 0.7;
const ROUND_PICKUP_AT = 0.5, OUT_OF_AMMO_NOTICE = 1, TRACER_LENGTH = 120, DRY_FIRE_INTERVAL = 0.35;

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
    flash: 0, hitMarker: 0, hitPart: null, hitPartTime: 0, kills: 0, sinceShot: Infinity, shots: 0, landed: 0, dryFires: 0,   // `landed`: disparos que machucaram algum carro (mira)
  };

  // `reserveFactor` é a melhoria de munição comprada.
  weapon.equip = (id, reserveFactor = 1) => {
    const type = WEAPON_TYPES[id];
    // A arma começa descarregada: a primeira recarga é por conta do piloto.
    Object.assign(weapon, { type, ammo: 0, capacity: type.magazine, maxReserve: Math.ceil(type.reserve * reserveFactor), reserve: Math.ceil(type.reserve * reserveFactor), isReloading: false, carryingRound: false, roundProgress: 0, roundsToLoad: 0, cooldown: 0, flash: 0, hitMarker: 0, outOfAmmo: 0, kills: 0, sinceShot: Infinity });
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
      const amount = weapon.type.damage * (1 - (1 - min) * distance / radius);
      if (target.isObstacle) { onObstacleHit(target, amount); continue; }
      hurt = true;
      if (damageOpponent(target, amount, shooter)) { onKill(target, 'splash'); weapon.hitMarker = 0.4; }
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
    weapon.cooldown = type.interval;
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
        if (damageOpponent(target, damageAtDistance(type, hits[0].distance) * part.multiplier, shooter, shakeAtDistance(type, hits[0].distance))) {
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
  };

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
    if (weapon.isReloading) loadRounds(dt);
    if (weapon.type.automatic && triggerHeld && dt > 0) weapon.fire();
    if (tracerTime > 0 && (tracerTime -= dt) <= 0) tracer.visible = false;
  };

  return weapon;
}
