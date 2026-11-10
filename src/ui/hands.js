import { VIEW } from '../config.js';
import { smooth } from '../art/shade.js';
import { projectCabinPixel } from '../cabin/sprite.js';
import { createGunAnimator, MAGAZINE_SEAT_AT } from './guns/gunAnimator.js';
import { createGunEffects } from './guns/gunEffects.js';
import { createGunRig } from './guns/gunRig.js';
import { paintFistHolding, paintGunHand, paintLeftFist, paintRightFist } from './handArt.js';

// Mãos do piloto e arma. A esquerda fica sempre no volante; a direita segue a ação:
// volante (parado), alavanca (trocando marcha), registro do nitro, botão da armadilha,
// arma (atirando) ou munição (recarregando).

// Posição no aro em radianos: 120 graus entre as mãos, simétricas em relação ao topo.
const GRIP_LEFT_ANGLE = -Math.PI * 5 / 6, GRIP_RIGHT_ANGLE = -Math.PI / 6;
const FIST_TILT = 0.4;                                     // quanto o punho acompanha a curva do aro

const GUN_REST = { x: 480, y: 40 };                // pendurado no teto (pixel da cabine)
const GUN_AIM = { x: 483, y: 182 };                // apontando (pixel da tela)
const CASING_FLOOR_Y = 262;                        // altura do painel, onde as cápsulas quicam
const CASING_SOUND_GAP = 0.1;                      // várias cápsulas juntas soam como uma

const HOLD_AFTER_SHOT = 1.6, SHIFT_DURATION = 0.4, JUST_SHOT_TIME = 0.25;
const REQUEST_LIFETIME = 0.6, BUTTON_PRESS_TIME = 0.16, BUTTON_PRESS_DEPTH = 2, BUTTON_REACH = 14;
const GUN_BLEND_SPEED = 26, RELOAD_BLEND_SPEED = 10, HAND_TRAVEL_TIME = 0.13;
const NITRO_HAND_TWIST = -0.35, NITRO_SHAKE_SPEED = 40;

// Recuo como mola: o tiro empurra e a arma volta balançando. Cada arma tem o seu jeito (art.recoil).
const RECOIL_IMPULSE = 11, SHAKE_TIME = 0.1;
const SWAY_FROM_MOUSE = 7, SWAY_LIMIT = 14, SWAY_SPEED = 10, BREATHE_SPEED = 1.7, BREATHE_SIZE = 1.2;
const DRAW_TUMBLE = 0.6;                           // giro da arma ao sair do teto
const BOLT_GRAB = 6;                               // o punho fechado segura o ferrolho (ou a bomba) pelos dedos

const lerp = (a, b, t) => a + (b - a) * t;
const ease = (current, target, speed, dt) => current + (target - current) * (1 - Math.exp(-speed * dt));

export function createHands({ weapon, traps, look, cabin, customs, isAiming, wantsFire, wantsNitro, onGunSound }) {
  const leftFist = paintLeftFist();
  const rightFist = paintRightFist();
  const fists = { round: paintFistHolding('round'), shell: paintFistHolding('shell'), magazine: paintFistHolding('magazine'), bolt: paintFistHolding('bolt'), grenade: paintFistHolding('grenade') };
  const gunHand = paintGunHand(false);
  const gunHandFiring = paintGunHand(true);

  const rigs = {};
  const rigFor = id => (rigs[id] ??= createGunRig(id, customs[id]));
  let casingSoundWait = 0;
  const effects = createGunEffects(CASING_FLOOR_Y, () => {
    if (casingSoundWait > 0) return;
    casingSoundWait = CASING_SOUND_GAP;
    onGunSound('casing');
  });
  const rig = () => rigFor(weapon.type.id);
  const art = () => rig().art;

  let animator = null, animatorId = null, lastShots = 0, lastDryFires = 0;
  let aim = 0, reloading = 0, shiftTimer = 0, nitroClock = 0, lastGear = null;
  let fireRequest = 0, trapRequest = 0, buttonPress = 0;
  let recoil = 0, recoilVelocity = 0, swayX = 0, lastYaw = look.yaw, breatheClock = 0, flashSeed = 0;
  let state = 'wheel', travel = 1;
  let from = { x: VIEW.width, y: VIEW.height, angle: 0 };
  const hand = { x: VIEW.width, y: VIEW.height, angle: 0 };
  const gun = { x: 0, y: 0, angle: 0 };

  // A mão é uma só: cada frame ela tem um único destino, nesta ordem de prioridade.
  function chooseState() {
    if (weapon.isReloading) return 'reload';
    if (isAiming() || wantsFire() || fireRequest > 0 || weapon.sinceShot < JUST_SHOT_TIME || handOnAction()) return 'gun';
    if (trapRequest > 0 || buttonPress > 0) return 'trap';
    if (wantsNitro()) return 'nitro';
    if (weapon.sinceShot < HOLD_AFTER_SHOT) return 'gun';
    return shiftTimer > 0 ? 'shifter' : 'wheel';
  }

  const arrived = () => travel >= 1;
  // A mão está manobrando a arma (o ferrolho da sniper, a bomba do lança-granadas).
  const handOnAction = () => (animator?.pose.actionHand ?? 0) > 0;
  const isHoldingGun = () => state === 'gun' || state === 'reload';
  const isGunReady = () => state === 'gun' && arrived();
  const isNitroReady = () => state === 'nitro' && arrived();

  // Pedidos ficam guardados por um instante; se a mão seguir ocupada, são descartados.
  function requestFire() { fireRequest = REQUEST_LIFETIME; }
  function requestTrap() { if (traps.canDrop() && trapRequest <= 0 && buttonPress <= 0) trapRequest = REQUEST_LIFETIME; }

  function performArrivals() {
    if (fireRequest > 0 && isGunReady()) {
      weapon.fire();
      fireRequest = 0;
    }
    if (trapRequest > 0 && state === 'trap' && arrived()) {
      traps.drop();
      trapRequest = 0;
      buttonPress = BUTTON_PRESS_TIME;
    }
  }

  function syncAnimator() {
    if (animatorId === weapon.type.id) return;
    animatorId = weapon.type.id;
    animator = createGunAnimator(animatorId);
    lastShots = weapon.shots;
    lastDryFires = weapon.dryFires;
  }

  function onGunEvents(events) {
    const [ex, ey] = art().eject;
    for (const { eject = 0, sound } of events) {
      if (sound) onGunSound(sound);
      for (let i = 0; i < eject; i++) {
        const point = gunPoint(ex, ey);
        effects.ejectCasing(point.x, point.y, art().casing);
      }
    }
  }

  function animateGun(dt) {
    syncAnimator();
    casingSoundWait -= dt;
    if (weapon.shots !== lastShots) {
      lastShots = weapon.shots;
      animator.fire();
      recoilVelocity += weapon.type.recoil * RECOIL_IMPULSE;
      flashSeed = Math.random();
      const [mx, my] = art().muzzle;
      const muzzle = gunPoint(mx, my);
      effects.puffSmoke(muzzle.x, muzzle.y, art().smoke);
      onGunSound('fire');
    }
    if (weapon.dryFires !== lastDryFires) {
      lastDryFires = weapon.dryFires;
      onGunSound('dry');
    }
    onGunEvents(animator.update(dt, {
      reloading: weapon.isReloading, ammo: weapon.ammo, capacity: weapon.capacity,
      roundProgress: weapon.roundProgress, carrying: weapon.carryingRound,
    }));

    const { stiffness, damping } = art().recoil;
    recoilVelocity += (-stiffness * recoil - damping * recoilVelocity) * dt;
    recoil += recoilVelocity * dt;

    const mouseSpeed = dt > 0 ? (look.yaw - lastYaw) / dt : 0;
    lastYaw = look.yaw;
    swayX = ease(swayX, Math.max(-SWAY_LIMIT, Math.min(SWAY_LIMIT, mouseSpeed * SWAY_FROM_MOUSE)), SWAY_SPEED, dt);
    breatheClock += dt;
    effects.update(dt);
  }

  function update(dt, gear) {
    if (lastGear !== null && gear.index !== lastGear) shiftTimer = SHIFT_DURATION;
    lastGear = gear.index;
    shiftTimer -= dt;
    nitroClock += dt;
    fireRequest = Math.max(0, fireRequest - dt);
    trapRequest = Math.max(0, trapRequest - dt);
    buttonPress = Math.max(0, buttonPress - dt);

    const next = chooseState();
    if (next !== state) {
      from = { ...hand };
      state = next;
      travel = 0;
    }
    travel = Math.min(1, travel + dt / HAND_TRAVEL_TIME);
    performArrivals();
    cabin.setTrapButtonPressed(buttonPress > 0);

    aim = ease(aim, isHoldingGun() ? 1 : 0, GUN_BLEND_SPEED, dt);
    reloading = ease(reloading, weapon.isReloading ? 1 : 0, RELOAD_BLEND_SPEED, dt);
    animateGun(dt);
  }

  function placeGun() {
    const rest = projectCabinPixel(GUN_REST.x, GUN_REST.y, look);
    const pose = art().reload;
    const breathe = Math.sin(breatheClock * BREATHE_SPEED) * BREATHE_SIZE * aim;
    const { back, up, tilt, shake } = art().recoil;
    // Armas de rajada tremem enquanto atiram.
    const jitter = shake && weapon.sinceShot < SHAKE_TIME ? shake : 0;
    gun.x = lerp(lerp(rest.x, GUN_AIM.x, aim), pose.x, reloading) + recoil * back + swayX * aim + Math.round((Math.random() - 0.5) * 2 * jitter);
    gun.y = lerp(lerp(rest.y, GUN_AIM.y, aim), pose.y, reloading) - recoil * up + breathe + Math.round((Math.random() - 0.5) * 2 * jitter);
    gun.angle = lerp(0, pose.angle, reloading) + recoil * tilt + Math.sin(aim * Math.PI) * DRAW_TUMBLE * (1 - reloading);
  }

  function gunPoint(x, y) {
    const [px, py] = art().pivot;
    const dx = x - px, dy = y - py, c = Math.cos(gun.angle), s = Math.sin(gun.angle);
    return { x: gun.x + dx * c - dy * s, y: gun.y + dx * s + dy * c };
  }

  function rimPoint(angleOnRim, grips) {
    const a = angleOnRim + grips.wheel.steerAngle;
    const point = projectCabinPixel(
      grips.wheel.x + Math.cos(a) * grips.wheel.radius,
      grips.wheel.y + Math.sin(a) * grips.wheel.radius,
      look,
    );
    return { ...point, angle: (a + Math.PI / 2) * FIST_TILT };
  }

  function targetForState(grips) {
    switch (state) {
      case 'shifter': return { ...projectCabinPixel(grips.knob.x, grips.knob.y, look), angle: 0 };
      case 'nitro': {
        const shake = Math.round(Math.sin(nitroClock * NITRO_SHAKE_SPEED));
        return { ...projectCabinPixel(grips.nitro.x + shake, grips.nitro.y, look), angle: NITRO_HAND_TWIST };
      }
      case 'trap': {
        // Os dedos ficam no topo da imagem do punho: desce o centro para eles tocarem o botão.
        const push = buttonPress > 0 ? BUTTON_PRESS_DEPTH : 0;
        return { ...projectCabinPixel(grips.trapButton.x, grips.trapButton.y + BUTTON_REACH + push, look), angle: 0 };
      }
      case 'gun': {
        // No rifle, a mão acompanha a alavanca a cada ciclo; na sniper, vai até o ferrolho e volta.
        const [hx, hy] = art().hand;
        let x = hx, y = hy + (art().handFollowsLever ?? 0) * (animator?.pose.lever ?? 0);
        const path = animator && art().handPath?.(animator.pose);
        if (path?.weight > 0) {
          const t = smooth(path.weight);
          x = lerp(x, path.point[0], t);
          y = lerp(y, path.point[1] + BOLT_GRAB, t);
        }
        return { ...gunPoint(x, y), angle: gun.angle };
      }
      case 'reload': {
        // Vai da arma até a munição no painel e volta com ela.
        const [lx, ly] = art().load;
        const entry = gunPoint(lx, ly);
        const slot = cabin.ammoSlot(weapon.reserve, weapon.carryingRound);
        const belt = projectCabinPixel(slot.x, slot.y, look);
        const p = weapon.roundProgress;
        const reach = smooth(p < 0.5 ? p * 2 : 2 - p * 2);
        return { x: lerp(entry.x + 6, belt.x, reach), y: lerp(entry.y + 20, belt.y, reach), angle: 0 };
      }
      default: return rimPoint(GRIP_RIGHT_ANGLE, grips);
    }
  }

  function poseImage() {
    if (travel < 0.75) return rightFist;
    if (state === 'gun') {
      if (handOnAction() && animator.pose.actionHand > 0.5) return rightFist;
      return weapon.flash > 0 ? gunHandFiring : gunHand;
    }
    if (state === 'reload') {
      const delivered = art().carry === 'magazine' && weapon.roundProgress >= MAGAZINE_SEAT_AT;
      return weapon.carryingRound && !delivered ? fists[art().carry] : rightFist;
    }
    return rightFist;
  }

  function drawCentered(ctx, image, x, y, angle) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(angle);
    ctx.drawImage(image, -Math.floor(image.width / 2), -Math.floor(image.height / 2));
    ctx.restore();
  }

  function drawGun(ctx) {
    if (!animator) return;
    ctx.save();
    ctx.translate(Math.round(gun.x), Math.round(gun.y));
    ctx.rotate(gun.angle);
    rig().draw(ctx, animator.pose);
    if (weapon.flash > 0) rig().drawFlash(ctx, flashSeed);
    ctx.restore();
  }

  function draw(ctx) {
    const grips = cabin.grips();
    placeGun();

    const left = rimPoint(GRIP_LEFT_ANGLE, grips);
    drawCentered(ctx, leftFist, left.x, left.y, left.angle);

    drawGun(ctx);

    const target = targetForState(grips), t = smooth(travel);
    hand.x = lerp(from.x, target.x, t);
    hand.y = lerp(from.y, target.y, t);
    hand.angle = lerp(from.angle, target.angle, t);
    drawCentered(ctx, poseImage(), hand.x, hand.y, hand.angle);
    effects.draw(ctx);
  }

  // Refaz a arma depois de uma mudança na oficina.
  function rebuildGun(id) { delete rigs[id]; }

  return { update, draw, isHoldingGun, isGunReady, isNitroReady, requestFire, requestTrap, rebuildGun };
}
