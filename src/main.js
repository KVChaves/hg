import * as THREE from 'three';
import { MAX_RACERS, VIEW } from './config.js';
import { createAudioSystem } from './audio/audioSystem.js';
import { createRenderer } from './core/renderer.js';
import { isLocked, keys, look, setupInput } from './core/input.js';
import { createCabin } from './cabin/cabin.js';
import { loadLoadout } from './cabin/loadout.js';
import { bearingFrom, createCar, updateCar } from './game/car.js';
import { readGearbox } from './game/gearbox.js';
import { createOpponentCombat } from './game/opponentCombat.js';
import { createOpponents } from './game/opponents.js';
import { createRace } from './game/race.js';
import { createTraps } from './game/traps.js';
import { flipElevation } from './game/carFlip.js';
import { rigElevation } from './game/carRoll.js';
import { createMatch } from './game/championship.js';
import { createHarpoon, createPullReceiver } from './game/harpoon.js';
import { loadPlayerName, savePlayerName } from './game/playerProfile.js';
import { loadEquipment } from './game/equipment.js';
import { upgradeFactor } from './game/shop.js';
import { addRaceResult } from './game/raceResults.js';
import { createRoadsideHelp } from './game/roadsideHelp.js';
import { loadSettings } from './game/settings.js';
import { loadWeaponCustoms } from './game/weaponCustomization.js';
import { createWeapon } from './game/weapon.js';
import { createLapSupplies } from './game/lapSupplies.js';
import { createOnlineMatch } from './net/onlineMatch.js';
import { createRoomClient, LEFT_REASONS } from './net/roomClient.js';
import { createDriftTracker } from './game/driftTracker.js';
import { createGarageScreen } from './ui/garage/garageScreen.js';
import { createFeatFeed } from './ui/featFeed.js';
import { createHands } from './ui/hands.js';
import { createHud } from './ui/hud.js';
import { createMainMenu } from './ui/mainMenu.js';
import { createMultiplayerScreen } from './ui/multiplayerScreen.js';
import { createPodiumScreen } from './ui/podiumScreen.js';
import { isClickable, pointerOnStage } from './ui/panelKit.js';
import { createMatchSetupScreen } from './ui/matchSetupScreen.js';
import { createResultsScreen } from './ui/resultsScreen.js';
import { createWeaponWorkshop } from './ui/weaponWorkshop.js';
import { createCarDamageEffects } from './world/carDamageEffects.js';
import { createExternalView } from './world/externalView.js';
import { createFoamEffect } from './world/foamEffect.js';
import { BIOMES, pickBiome } from './world/biomes/index.js';
import { createHarpoonVisual } from './world/harpoonVisual.js';
import { createRoadsideNpcs } from './world/roadsideNpcs.js';
import { createWorldScene } from './world/scenery.js';

const MAX_FRAME_TIME = 0.05;
const PLAYER_CAR_SEED = 11;
const NO_KEYS = {};                                  // comandos do carro destruído ou capotado
const DAMAGE_EFFECT_RANGE = 150;                     // além disso não vale gastar partículas
const PAN_FULL_DISTANCE = 6;                         // perto disso o som vem do próprio carro, sem lado

const glCanvas = document.getElementById('gl');
const hudCanvas = document.getElementById('hud');
const renderer = createRenderer(glCanvas);
const camera = new THREE.PerspectiveCamera(VIEW.fov, VIEW.width / VIEW.height, 0.1, 400);
const world = createWorldScene();
let biome = BIOMES[0];
world.buildMap(biome, 1);                            // mapa de fundo, antes da primeira corrida

const car = createCar();
const opponents = createOpponents(world, MAX_RACERS - 1);

// Som que acontece num ponto da pista: mais baixo de longe e vindo do lado certo.
function playAt(name, x, z, strength) {
  const distance = Math.hypot(x - car.x, z - car.z);
  const pan = -Math.sin(bearingFrom(car, look, x, z)) * Math.min(1, distance / PAN_FULL_DISTANCE);
  audio.playWorldSound(name, distance, pan, strength);
}

const outOfAction = () => car.wrecked > 0 || car.overturned;
const featFeed = createFeatFeed();

let matchKills = 0;

function creditKill(victim) {
  weapon.kills++;
  matchKills++;
  featFeed.announce('DESTRUIDO');
  if (victim) featFeed.setCount(victim, 'Abate', weapon.kills);
}

function announceTrapCatch(racer, type) {
  featFeed.announce(`CAIU ${type.caughtText}`);
  featFeed.addCount(racer, 'Armadilha');
}

// `owner` nulo: a armadilha é do jogador deste navegador.
function onTrapCaught(racer, type, owner) {
  if (owner?.remote) online.sendCaught(racer, type, owner);
  else if (!owner && !racer.isPlayer) announceTrapCatch(racer, type);
}

function onRacerDestroyed(victim, killer) {
  if (killer?.isPlayer) creditKill(victim);
  else if (killer?.remote) online.sendKill(victim, killer);
}

const DRIFT_GRADES = [[3, 'DRIFT INSANO'], [1.6, 'GRANDE DRIFT'], [0, 'DRIFT']];
const driftTracker = createDriftTracker(car, duration => {
  const [, title] = DRIFT_GRADES.find(([minimum]) => duration >= minimum);
  featFeed.announce(`${title} ${duration.toFixed(1)}s`);
});

const race = createRace(car, opponents, { onCrash: playAt, onDestroyed: onRacerDestroyed });
const net = createRoomClient();
let online = null;                                   // criado mais abaixo; os sistemas só avisam quando há partida online
const pulls = createPullReceiver(car);
const weapon = createWeapon({ scene: world, camera, targets: opponents, shooter: race.field[0], canReload: () => race.started, onFired: (id, from, end) => online.sendShot(id, from, end), onHit: target => featFeed.addCount(target, 'Acerto'), onKill: creditKill });   // só recarrega depois do GO
const harpoon = createHarpoon({ owner: race.field[0], car, race, visual: createHarpoonVisual(world), onSound: playAt, onRemotePull: (target, shooter) => online.sendPull(target, shooter), onHooked: target => {
  featFeed.announce('ARPOADO');
  featFeed.addCount(target, 'Arpao');
} });
const foam = createFoamEffect(world);
const traps = createTraps({ scene: world, car, race, harpoon, onCaught: onTrapCaught, onSound: playAt, onExtinguisher: racer => { foam.spray(racer); online.sendExtinguisher(racer); }, onPlaced: (type, dist, lane, owner) => online.sendTrap(type, dist, lane, owner) });
const combat = createOpponentCombat({
  scene: world, car, race, opponents, traps, look, onSound: playAt,
  onShot: (weaponId, distance, pan) => audio.playEnemyShot(weaponId, distance, pan),
  onDestroyed: (x, z) => playAt('crash', x, z),
  onBotShot: (id, from, to) => online.sendShot(id, from, to),
  onRemotePull: (target, shooter) => online.sendPull(target, shooter),
});
const roadsideNpcs = createRoadsideNpcs(world);
const roadsideHelp = createRoadsideHelp({
  race, car, weapon, traps,
  onPlayerOffer: offer => roadsideNpcs.show(offer),
  onPlayerPickup: item => {
    roadsideNpcs.hideItems(item);
    audio.playWorldSound('itemCollected', 0, 0);
  },
});
const lapSupplies = createLapSupplies({
  race,
  suppliesFor: racer => roadsideHelp.suppliesFor(racer),
  onPlayerSupplied: ({ nitro, ammo, items }) => {
    const percent = value => `${Math.round(value * 100)}%`;
    featFeed.announce('SUPRIMENTOS');
    roadsideHelp.showMessage([`+NITRO ${percent(nitro)}`, `+MUNICAO ${percent(ammo)}`, ...items.map(label => `+${label}`)].join(' '));
    audio.playWorldSound('itemCollected', 0, 0);
  },
});
const damageEffects = createCarDamageEffects(world, MAX_RACERS);
const racerConditions = Array.from({ length: MAX_RACERS }, () => ({}));
let activeConditions = racerConditions;
const cabin = createCabin({ camera, car, loadout: loadLoadout() });
const customs = loadWeaponCustoms();
const equipment = loadEquipment();
const hands = createHands({
  weapon,
  customs,
  onGunSound: moment => audio.playWeaponSound(weapon.type.id, moment),
  traps,
  look,
  cabin,
  isAiming: () => Boolean(keys.AimButton),
  wantsFire: () => Boolean(keys.FireButton) && !externalView.active && !outOfAction(),
  wantsNitro: () => Boolean(keys.Space) && car.nitro > 0 && race.started && !inMenus() && !outOfAction(),
});

function applyEquipment({ weaponId, trapIds, trapCounts, upgrades }) {
  weapon.equip(weaponId, upgradeFactor('ammo', upgrades.ammo));
  weapon.setTracerColor(customs[weaponId].colors.flash);
  cabin.setWeapon(weapon.type, weapon.maxReserve);
  traps.setLoadout(trapIds.flatMap((id, slot) => (id ? [{ id, count: trapCounts[slot] }] : [])));
  car.armor = upgradeFactor('life', upgrades.life);
  car.nitroCapacity = upgradeFactor('nitro', upgrades.nitro);
}

const stage = document.getElementById('stage');
const settings = loadSettings();
const audio = createAudioSystem(settings);
const SETTING_APPLIERS = {
  music: value => audio.setMusicVolume(value),
  menuMusic: value => audio.setMenuMusicVolume(value),
  effects: value => audio.setEffectsVolume(value),
  sensitivity: () => {},                             // a entrada lê o valor direto de `settings`
};
const mainMenu = createMainMenu({
  stage,
  settings,
  net,
  onSingleplayer: () => matchSetup.open(),
  onMultiplayer: () => multiplayer.open(),
  onSettingChange: (key, value) => SETTING_APPLIERS[key](value),
  onEffectsPreview: () => audio.playWeaponSound('revolver', 'fire'),
  onQuit: () => window.close(),                      // o navegador só permite em abas abertas por script
});
let playerName = loadPlayerName();
const changePlayerName = name => {
  playerName = name;
  savePlayerName(name);
};
const multiplayer = createMultiplayerScreen({
  stage,
  net,
  getName: () => playerName,
  setName: changePlayerName,
  onBack: () => { net.leave(); mainMenu.open(); },
});
const matchSetup = createMatchSetupScreen({
  stage,
  onContinue: () => garage.open(),
  onBack: () => mainMenu.open(),
});
const results = createResultsScreen({
  stage,
  onNext: () => garage.openBetweenRaces(TIME_BETWEEN_RACES),
  onFinished: () => podium.open(match),
  localName: () => race.field[0].name,
});
const podium = createPodiumScreen({
  stage,
  localName: () => race.field[0].name,
  getRoster: () => online.readyRoster(),
  onKick: id => net.kick(id),
  onReady: () => {
    if (online.active) online.markReady();
    else location.reload();                          // recarregar volta ao menu com tudo zerado
  },
});
const workshop = createWeaponWorkshop({
  stage,
  customs,
  onChange: id => {
    hands.rebuildGun(id);
    if (id === weapon.type.id) weapon.setTracerColor(customs[id].colors.flash);
  },
  // Só depois deste clique, senão ele acionaria a garagem. Se o intervalo acabou nesse meio-tempo, a corrida já começou.
  onClose: () => setTimeout(() => { if (!match || garage.isBetweenRaces()) garage.open(); }),
});
const garage = createGarageScreen({
  stage,
  cabin,
  customs,
  equipment,
  getName: () => playerName,
  setName: changePlayerName,
  isNameLocked: () => online.active,                 // online o nome é o da sala
  getReadyRoster: () => online.readyRoster(),
  onKickPlayer: id => net.kick(id),
  onOpenWorkshop: id => workshop.open(id),
  onProceed: () => {
    externalView.applySpec(garage.carSpec());
    startMatch(matchSetup.config);
  },
  onBetweenRacesEnd: () => {
    workshop.isOpen = false;                         // o tempo vale também para quem está na oficina
    externalView.applySpec(garage.carSpec());
    if (online.active) {
      if (!garage.isOpen) garage.open();
      online.markReady();
    } else {
      startNextRace();
    }
  },
  onBack: () => mainMenu.open(),
});
const externalView = createExternalView({ scene: world, car, look, initialSpec: garage.carSpec(), seed: PLAYER_CAR_SEED });
applyEquipment(equipment);
const drawHud = createHud(hudCanvas, { featFeed, mainMenu, multiplayer, podium, matchSetup, results, matchLabel: () => `CORRIDA ${match ? match.currentRace : 1} DE ${match ? match.raceCount : 1}`, biomeName: () => biome.name, race, weapon, hands, garage, workshop, externalView, isLocked, combat, car, roadsideHelp, traps, opponents, activeCamera: () => (externalView.active ? externalView.camera : camera), isBehindCabin: (x, y, z) => cabin.isBehindCabin(x, y, z), isInSmoke: (x, z) => car.effects.smoke > 0 || traps.smokeBlocks(car.x, car.z, x, z) });
const inMenus = () => mainMenu.isOpen || multiplayer.isOpen || podium.isOpen || matchSetup.isOpen || results.isOpen || garage.isOpen || workshop.isOpen;

setupInput(stage, {
  onFire: () => { if (!externalView.active && !outOfAction()) hands.requestFire(); },
  onReload: weapon.reload,
  onDropTrap: () => {
    traps.explainDenied();
    hands.requestTrap();
  },
  onCycleTrap: traps.cycle,
  canLockPointer: () => !inMenus(),
  sensitivity: () => settings.sensitivity,
  isTyping: () => garage.isTyping() || multiplayer.isTyping(),
});
stage.addEventListener('click', event => {
  if (!inMenus()) return;
  const { x, y } = pointerOnStage(event, stage);
  if (isClickable(x, y)) audio.playUiClick();
}, true);
race.reset();

// Na cabine o próprio carro não aparece, então ele só solta fumaça vista de fora.
const elevationOf = (state, timer) => (timer > 0 ? flipElevation(state.flip, timer) : rigElevation(state.rig));

function readRacerConditions() {
  Object.assign(racerConditions[0], { x: car.wx, z: car.wz, yaw: car.yaw, vx: car.vx, vz: car.vz, health: car.health, elevation: car.wy + elevationOf(car, car.wrecked), visible: externalView.active });
  opponents.forEach((op, i) => {
    const yaw = op.group.rotation.y;
    Object.assign(racerConditions[i + 1], {
      x: op.wx, z: op.wz, yaw, vx: -Math.sin(yaw) * op.v, vz: -Math.cos(yaw) * op.v, health: op.hp / op.maxHp, elevation: op.wy + elevationOf(op, op.dead),
      visible: Math.hypot(op.x - car.x, op.z - car.z) < DAMAGE_EFFECT_RANGE,
    });
  });
  return activeConditions;
}

const NEUTRAL_AMBIENT = 0xffffff;                    // na garagem a cabine mostra as cores reais
const TIME_BETWEEN_RACES = 45;                       // segundos na garagem antes da próxima corrida
const RESULTS_DELAY = 2.5;                           // segundos entre cruzar a linha e ver os resultados
let match = null, raceRecorded = false, sinceFinish = 0;

function setRacerCount(cars) {
  race.setRacerCount(cars);
  activeConditions = racerConditions.slice(0, cars);
}

online = createOnlineMatch({
  net, scene: world, race, car, opponents, combat, traps, foam, harpoon, pulls, weapon, look, garage, results, podium, playAt, setRacerCount, creditKill, announceTrapCatch,
  getSpec: () => garage.carSpec(),
  setMatch: created => {
    match = created;
    matchKills = 0;
  },
  getMatchKills: () => matchKills,
  getMatch: () => match,
  getBiome: () => biome,
  beginRace,
});
net.onStarted = room => {
  multiplayer.close();
  online.start(room);
};
net.onRoomChange = room => online.onRoomChange(room);
net.onEnded = () => {
  online.returnToLobby();
  audio.returnToMenu();
  multiplayer.open();
};
// Quem cai da sala no meio da partida volta para a lista de salas, com a página zerada.
const LEFT_NOTICE_KEY = 'halfgrip.notice';
net.onLeft = reason => {
  if (!online.active) return;
  sessionStorage.setItem(LEFT_NOTICE_KEY, LEFT_REASONS[reason] ?? '');
  location.reload();
};
const pendingNotice = sessionStorage.getItem(LEFT_NOTICE_KEY);
if (pendingNotice !== null) {
  sessionStorage.removeItem(LEFT_NOTICE_KEY);
  mainMenu.isOpen = false;
  multiplayer.open(pendingNotice);
}

function startMatch({ cars, races }) {
  setRacerCount(cars);
  race.setPlayerName(playerName);
  for (const op of opponents) op.name = op.profile.name === playerName ? `${playerName} Bot` : op.profile.name;   // nomes únicos na tabela
  match = createMatch({ racerNames: race.field.map(racer => racer.name), raceCount: races });
  startNextRace();
}

// A largada de cada corrida é a ordem de chegada da anterior, invertida.
function startNextRace() {
  beginRace(pickBiome(biome), Math.floor(Math.random() * 1e9), match.nextGrid);
}

// `grid` são os nomes na ordem de largada; sem ele usa a largada padrão.
function beginRace(chosenBiome, seed, grid) {
  biome = chosenBiome;
  world.buildMap(biome, seed);
  audio.setPhase(biome.music);
  traps.reset();
  harpoon.reset();
  pulls.reset();
  foam.reset();
  featFeed.reset();
  driftTracker.reset();
  lapSupplies.reset();
  race.reset(grid);
  applyEquipment(equipment);
  combat.reset();
  roadsideHelp.reset();
  damageEffects.reset();
  look.yaw = look.pitch = 0;
  raceRecorded = false;
  sinceFinish = 0;
  audio.startRace();
}

function finishRaceFlow(frameTime) {
  if (!race.finished || results.isOpen || !match) return;
  if (!raceRecorded) {
    raceRecorded = true;
    match.recordRace(race.finishOrder);
    addRaceResult({ position: race.finalRank, racers: race.field.length, time: race.time, kills: weapon.kills });
  }
  if ((sinceFinish += frameTime) < RESULTS_DELAY) return;
  sinceFinish = -Infinity;                           // abre uma vez só
  audio.stopRace();
  document.exitPointerLock();
  results.open(match, race.finishResults, { waitsForHost: online.active });
}

function step(frameTime) {
  mainMenu.update();
  multiplayer.update();
  matchSetup.update();
  results.update();
  externalView.setActive(Boolean(keys.KeyQ) && !inMenus());
  const dt = inMenus() ? 0 : frameTime;              // a corrida fica parada nas telas de menu
  const driving = outOfAction() ? NO_KEYS : keys;
  updateCar(car, dt, driving, race.started, hands.isNitroReady());
  race.update(dt, traps.active);
  driftTracker.update(dt);
  lapSupplies.update();
  featFeed.update(dt);
  traps.update(dt);
  harpoon.update(dt);
  pulls.update(dt);
  foam.update(dt);
  combat.update(dt);
  roadsideHelp.update(dt);
  roadsideNpcs.update(dt, car.x, car.z);
  damageEffects.update(dt, readRacerConditions());
  world.updateMap(dt, car.x, car.y, car.z);
  cabin.setAmbient(garage.isOpen ? NEUTRAL_AMBIENT : biome.cabinTint);
  weapon.update(dt, driving.FireButton && !externalView.active && hands.isGunReady());
  const gear = readGearbox(car, driving.KeyW);
  cabin.update({ look, weapon, gear, race, traps, dt, frameTime });
  hands.update(dt, gear);
  externalView.update(dt);
  audio.update({ gear, race, keys: driving, nitroOpen: car.nitroActive, drifting: car.slipping });
  audio.setMenuMusic(inMenus());

  if (garage.isOpen || mainMenu.isOpen || multiplayer.isOpen || matchSetup.isOpen) garage.update(frameTime);
  workshop.update(frameTime);
  garage.tickBetweenRaces(frameTime);
  online.update(frameTime);
  if (mainMenu.isOpen || multiplayer.isOpen || matchSetup.isOpen || garage.isOpen && garage.view === 'car') {
    garage.renderCar(renderer);
  } else if (externalView.active) {
    renderer.clear();
    renderer.render(world, externalView.camera);
  } else {
    cabin.renderMirror(renderer, world);
    renderer.clear();
    renderer.render(world, camera);
    renderer.clearDepth();
    renderer.render(cabin.scene, camera);
  }
  drawHud();
  finishRaceFlow(frameTime);
}

let lastTime = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.max(0, Math.min((now - lastTime) / 1000, MAX_FRAME_TIME));
  lastTime = now;
  step(dt);
}
requestAnimationFrame(frame);

export const game = { roadsideNpcs, featFeed, podium, multiplayer, net, online: () => online, pulls, world, getBiome: () => biome, harpoon, matchSetup, results, getMatch: () => match, roadsideHelp, mainMenu, settings, step, keys, look, car, race, opponents, combat, weapon, traps, cabin, hands, audio, garage, workshop, externalView, renderer, glCanvas, hudCanvas };
