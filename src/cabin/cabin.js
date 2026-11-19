import { poseFlippingCar } from '../game/carFlip.js';
import { poseRig } from '../game/carRoll.js';
import * as THREE from 'three';
import { gradientMap } from '../art/recolor.js';
import { colorRamp } from '../art/shade.js';
import { EYE, VIEW, WINDOW_VIEW } from '../config.js';
import { createCharmPendulum } from './charmPendulum.js';
import { createDashboard } from './dashboard.js';
import { createHandoff } from './handoff.js';
import { DEPTH, LAYOUT } from './layout.js';
import { saveLoadout } from './loadout.js';
import { createMirror } from './mirror.js';
import { createScoreboard } from './scoreboard.js';
import { PARTS } from './parts/index.js';
import { buildShell, isShellMaterial, setShellAmbient, setShellTint } from './shell/shell.js';
import { HALF_HEIGHT } from './sprite.js';
import { Sprite } from './sprite.js';
import { alignToTwist } from '../world/track.js';
import { createWindshieldCracks } from './windshieldCracks.js';
import { createWindshieldEffects } from './windshieldEffects.js';

const STEER_VISUAL = 1.4;
const KNOB_SMOOTHING = 0.25;
const CABIN_BASE_COLOR = [75, 40, 37];   // tom médio da pintura original da cabine

const resolveImage = image => (typeof image === 'function' ? image() : image);
const tinted = (image, color) => {
  const source = resolveImage(image);
  return color === null || typeof source === 'string' ? source : gradientMap(source, color);
};
const cabinTint = color => (color === null ? [1, 1, 1] : [color >> 16 & 255, color >> 8 & 255, color & 255]
  .map((channel, i) => Math.max(0.15, Math.min(3.5, channel / CABIN_BASE_COLOR[i]))));

// Monta a cabine em volta da câmera. Tudo fica num grupo no olho do piloto, que acompanha o carro.
const ROOF_LINE = 62, DASH_LINE = 232;                // pixels da tela: acima e abaixo disso a cabine cobre a vista

export function createCabin({ camera, car, loadout }) {
  const scene = new THREE.Scene();
  const body = new THREE.Group();          // posição e rotação do carro
  body.rotation.order = 'YXZ';
  const cockpit = new THREE.Group();       // olho do piloto; a cabine é desenhada ao redor dele
  cockpit.position.set(EYE.x, EYE.y, EYE.z);
  body.add(cockpit);
  scene.add(body);

  const head = new THREE.Group();          // só a cabeça gira com o mouse
  head.rotation.order = 'YXZ';
  head.add(camera);
  cockpit.add(head);

  buildShell(cockpit);
  const dashboard = createDashboard(cockpit);
  const updateWindshield = createWindshieldEffects(cockpit);
  const updateCracks = createWindshieldCracks(cockpit);
  const renderMirror = createMirror(cockpit, car, cockpit);
  const updateScoreboard = createScoreboard(cockpit);
  const handoff = createHandoff(cockpit, { arm: DEPTH.handoffArm, item: DEPTH.handoffItem });

  const mounted = {};
  const options = {};
  const knob = { column: 1, row: 1 };
  const pendulum = createCharmPendulum();
  let lastYaw = car.yaw;
  let lastHealth = -1;

  const builders = {
    wheel(option, color) {
      return new Sprite(cockpit, tinted(option.image, color), { ...LAYOUT.wheel, depth: DEPTH.wheel, anchor: 'center' });
    },
    shifter(option, color) {
      const { columns, rows } = LAYOUT.gate;
      return new Sprite(cockpit, tinted(option.image, color), {
        x: columns[1], y: rows[1], depth: DEPTH.shifter, anchor: option.anchor,
      });
    },
    charm(option, color) {
      if (option.none) return { dispose() {} };
      pendulum.nudge();
      return new Sprite(cockpit, tinted(option.image, color), { ...LAYOUT.charm, depth: DEPTH.charm, anchor: 'center' });
    },
    nitro(option, color) {
      dashboard.setNitroPalette(color === null ? option.palette : colorRamp(color), option.style);
      return { dispose() {} };
    },
    // As mãos não são sprite da cabine: hands.js lê `loadout.hands` e desenha o estilo escolhido.
    hands() {
      return { dispose() {} };
    },
    cabinColor(option, color) {
      setShellTint(cabinTint(color));
      return { dispose() {} };
    },
    health(option, color) {
      const meter = option.create(color);
      meter.draw(1);
      const sprite = new Sprite(cockpit, meter.canvas, { ...LAYOUT[option.layout ?? 'health'], depth: DEPTH.gauges });
      sprite.draw = value => { meter.draw(value); sprite.refresh(); };
      meter.ready?.then(() => { lastHealth = -1; });   // quando as imagens chegam, desenha de novo
      return sprite;
    },
  };

  function mount(kind, id) {
    mounted[kind]?.dispose();
    options[kind] = PARTS[kind].options[id];
    mounted[kind] = builders[kind](options[kind], loadout.colors[kind]);
    loadout[kind] = id;
    if (kind === 'health') lastHealth = -1;
  }

  function setPart(kind, id) {
    mount(kind, id);
    saveLoadout(loadout);
  }

  function setPartColor(kind, color) {
    const position = kind === 'shifter' ? { x: mounted.shifter.x, y: mounted.shifter.y } : null;
    loadout.colors[kind] = color;
    mount(kind, loadout[kind]);
    if (position) mounted.shifter.moveTo(position.x, position.y);
    saveLoadout(loadout);
  }

  const gatePlate = new Sprite(cockpit, 'assets/cabin/gate.png', { ...LAYOUT.gatePlate, depth: DEPTH.plate });
  for (const kind in PARTS) mount(kind, loadout[kind]);

  function swingCharm(dt, frameTime) {
    const yawRate = dt > 0 ? (car.yaw - lastYaw) / dt : 0;
    lastYaw = car.yaw;
    const angle = pendulum.step(frameTime, { speed: car.speed, yawRate, bob: car.bob });

    const sprite = mounted.charm;
    if (!sprite.mesh) return;
    const reach = sprite.texture.image.height / 2;   // o giro é em volta do topo da imagem
    sprite.moveTo(LAYOUT.charm.x + Math.sin(angle) * reach, LAYOUT.charm.y + Math.cos(angle) * reach);
    sprite.rotation = angle;
  }

  function update({ look, gear, weapon, race, traps, rivals, dt, frameTime }) {
    const motion = Math.min(Math.abs(car.speed) * 3.6 / 60, 1);
    body.position.set(car.wx, car.wy + Math.sin(car.bob * 2.3) * 0.012 * motion, car.wz);
    body.rotation.set(car.pitch + Math.sin(car.bob * 1.7) * 0.004 * motion, car.yaw, car.roll + car.twist);
    if (car.wrecked > 0) poseFlippingCar(body, car.flip, car.wrecked);
    else if (car.rig.active) poseRig(body, car.rig);
    alignToTwist(body, car);
    head.rotation.set(look.pitch, look.yaw, 0);
    scene.updateMatrixWorld(true);

    mounted.wheel.rotation = -car.visualSteer * STEER_VISUAL;

    knob.column += (gear.gate[0] - knob.column) * KNOB_SMOOTHING;
    knob.row += (gear.gate[1] - knob.row) * KNOB_SMOOTHING;
    const { columns, rows } = LAYOUT.gate;
    mounted.shifter.moveTo(
      Math.round(columns[0] + (columns[2] - columns[0]) * knob.column / 2),
      Math.round(rows[0] + (rows[2] - rows[0]) * knob.row / 2),
    );

    if (Math.abs(car.health - lastHealth) > 0.01) {
      lastHealth = car.health;
      mounted.health.draw(car.health);
    }

    dashboard.update({ gear, nitroLevel: car.nitro, nitroOpen: car.nitroActive, nitroBlue: car.blueNitro > 0, reserveAmmo: weapon.reserve, trapSlot: traps.current, trapReady: traps.isReady(), dt });
    updateWindshield(car.effects, dt);
    updateCracks(Math.round(car.capsizes * car.parts.crack));   // vidro blindado racha menos
    swingCharm(dt, frameTime);
    handoff.update(dt);
    updateScoreboard(race, weapon.kills, rivals);
  }

  // Pontos, em pixels da cabine, onde as mãos do piloto seguram.
  function grips() {
    const { anchor, grip } = options.shifter;
    return {
      wheel: { ...LAYOUT.wheel, radius: options.wheel.gripRadius, steerAngle: car.visualSteer * STEER_VISUAL },
      knob: { x: mounted.shifter.x - anchor[0] + grip[0], y: mounted.shifter.y - anchor[1] + grip[1] },
      nitro: LAYOUT.nitroValve,
      trapButton: { x: LAYOUT.trapButton.x + LAYOUT.trapButtonSize / 2, y: LAYOUT.trapButton.y + LAYOUT.trapButtonSize / 2 },
    };
  }

  // A luz do bioma pinta toda a cabine, menos o espelho. Só refaz quando a cor muda.
  let ambient = 0xffffff;
  function setAmbient(hex) {
    if (hex === ambient) return;
    ambient = hex;
    setShellAmbient(hex);
    scene.traverse(object => {
      if (!object.material || object.userData.keepsColor || isShellMaterial(object.material)) return;
      object.material.color.setHex(hex);
    });
  }

  // Ponto do mundo atrás do teto ou do painel, olhando para a frente.
  const pointInCockpit = new THREE.Vector3();
  function isBehindCabin(x, y, z) {
    cockpit.worldToLocal(pointInCockpit.set(x, y, z));
    if (pointInCockpit.z >= 0) return false;
    const screenY = (1 - pointInCockpit.y / -pointInCockpit.z / HALF_HEIGHT) / 2 * VIEW.height;
    return screenY < ROOF_LINE || screenY > DASH_LINE;
  }

  // Um NPC da beira da pista entrega `item` pela janela do lado em que está (`giver`: roupa e posição no mundo).
  const giverInCockpit = new THREE.Vector3();
  function handOff(item, giver) {
    cockpit.worldToLocal(giverInCockpit.set(giver.x, giver.y, giver.z));
    handoff.start(item, giver, Math.sign(giverInCockpit.x) || 1);
  }

  // Visão pela janela: a cabeça sai pela janela do motorista. O interior não é desenhado (ver main.js).
  function setWindowView(on) {
    const { x, y, z } = WINDOW_VIEW.head;
    head.position.set(on ? x : 0, on ? y : 0, on ? z : 0);
  }

  return { scene, update, handOff, setAmbient, isBehindCabin, setWindowView, renderMirror, setPart, setPartColor, loadout, grips, setTrapButtonPressed: dashboard.setTrapButtonPressed, setWeapon: dashboard.setWeapon, ammoSlot: dashboard.ammoSlot };
}
