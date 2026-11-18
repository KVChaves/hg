import * as THREE from 'three';
import { LOOK, MAX_RACERS, VIEW, WINDOW_VIEW } from './config.js';
import { createAudioSystem } from './audio/audioSystem.js';
import { createRenderer } from './core/renderer.js';
import { clampLook, isLocked, keys, look, setupInput } from './core/input.js';
import { createCabin } from './cabin/cabin.js';
import { loadLoadout } from './cabin/loadout.js';
import { bearingFrom, createCar, updateCar } from './game/car.js';
import { readGearbox } from './game/gearbox.js';
import { createOpponentCombat } from './game/opponentCombat.js';
import { createOpponents } from './game/opponents.js';
import { createRace } from './game/race.js';
import { createTraps } from './game/traps.js';
import { cutByShot } from './game/tether.js';
import { createMines } from './game/mines.js';
import { createEmp } from './game/emp.js';
import { shieldLevel } from './game/shield.js';
import { createPowerVisuals } from './world/powerVisuals.js';
import { createBurning } from './game/burning.js';
import { flipElevation } from './game/carFlip.js';
import { rigElevation } from './game/carRoll.js';
import { createMatch } from './game/championship.js';
import { createHarpoon, createPullReceiver } from './game/harpoon.js';
import { loadPlayerName, savePlayerName } from './game/playerProfile.js';
import { partStats } from './game/carUpgrades.js';
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
import { createFeats } from './ui/feats.js';
import { createKillFeed } from './ui/killFeed.js';
import { createHands } from './ui/hands.js';
import { createScope } from './ui/scope.js';
import { createPauseMenu } from './ui/pauseMenu.js';
import { createHud } from './ui/hud.js';
import { createMainMenu } from './ui/mainMenu.js';
import { createMultiplayerScreen } from './ui/multiplayerScreen.js';
import { createPodiumScreen } from './ui/podiumScreen.js';
import { isClickable, pointerOnStage } from './ui/panelKit.js';
import { createMatchSetupScreen } from './ui/matchSetupScreen.js';
import { createResultsScreen } from './ui/resultsScreen.js';
import { createMatchTable } from './ui/matchTable.js';
import { createVoteScreen } from './ui/voteScreen.js';
import { createWeaponWorkshop } from './ui/weaponWorkshop.js';
import { createCarDamageEffects } from './world/carDamageEffects.js';
import { createWindowView } from './world/windowView.js';
import { createCarLights } from './world/car/carLights.js';
import { darkZoneAt, gustAt, stormAt, track, trackAt } from './world/track.js';
import { setSurface, setWeatherGrip } from './game/surface.js';
import { setGravity } from './game/flight.js';
import { findRivals } from './game/rivals.js';
import { createSpectator } from './game/spectator.js';
import { giveKillReward } from './game/killReward.js';
import { createObstacles } from './game/obstacles.js';
import { createLightning } from './game/lightning.js';
import { createFoamEffect } from './world/foamEffect.js';
import { BIOMES, pickMatchBiome } from './world/biomes/index.js';
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
const killFeed = createKillFeed();

// Todo carro destruído com autor vira linha no feed; se foi o jogador, a tela de destruído mostra quem foi.
function announceDestruction(victim, killer) {
  if (!victim) return;
  if (victim.isPlayer) car.destroyedBy = killer?.name ?? null;
  killFeed.add(victim, killer);
}

// `cause`: como o jogador destruiu (ver ui/feats.js); muda a mensagem.
function creditKill(victim, cause) {
  announceDestruction(victim, race.field.find(racer => racer.isPlayer));
  weapon.kills++;
  matchKills++;
  feats.kill(victim, cause);
  rewardKillFor(race.field.find(racer => racer.isPlayer));
  if (victim) featFeed.setCount(victim, 'Abate', weapon.kills);
}

// Abate rende itens conforme a posição de quem abateu (jogador ou bot): líder ganha pouco, quem está atrás ganha mais.
// Só quem é simulado neste navegador recebe aqui; os outros recebem no navegador que os simula.
function rewardKillFor(racer) {
  if (!racer || racer.remote || !race.started || race.finished) return;
  const supplies = roadsideHelp.suppliesFor(racer);
  if (!supplies) return;
  const rank = racer.isPlayer ? race.rank : race.order.findIndex(entry => entry.name === racer.name) + 1;
  const labels = giveKillReward(supplies, rank || race.field.length, race.field.length);
  if (!racer.isPlayer) return;
  roadsideHelp.showMessage(labels.map(label => `+${label}`).join(' '));
  audio.playWorldSound('itemCollected', 0, 0);
}

function announceTrapCatch(racer, type) {
  feats.trapCaught(`CAIU ${type.caughtText}`);
  featFeed.addCount(racer, 'Armadilha');
}

// `owner` nulo: a armadilha é do jogador deste navegador.
function onTrapCaught(racer, type, owner) {
  if (owner?.remote) online.sendCaught(racer, type, owner);
  else if (!owner && !racer.isPlayer) announceTrapCatch(racer, type);
}

function onRacerDestroyed(victim, killer, cause) {
  if (!killer?.isPlayer) announceDestruction(victim, killer);   // o do jogador entra por creditKill
  if (victim.isPlayer) feats.playerDestroyed(killer);
  if (killer?.isPlayer) creditKill(victim, cause);
  else if (killer?.remote) online.sendKill(victim, killer);
  else rewardKillFor(killer);                        // bot simulado aqui
}

const driftTracker = createDriftTracker(car, duration => feats.drift(duration));

const race = createRace(car, opponents, {
  onCrash: playAt, onDestroyed: onRacerDestroyed,
  onBlast: (x, y, z) => { combat.explodeAt(x, y, z); playAt('dynamite', x, z, 1); },   // para-choque explosivo
});
const feats = createFeats({ featFeed, race, car, driftTracker });
const net = createRoomClient();
let online = null;                                   // criado mais abaixo; os sistemas só avisam quando há partida online
const pulls = createPullReceiver(car);
const burning = createBurning({
  race, car, onDestroyed: onRacerDestroyed,
  onIgnite: (racer, attacker) => {
    playAt('fire', racer.x, racer.z);
    if (attacker?.isPlayer) featFeed.addCount(racer, 'Fogo');
  },
  onRemoteIgnite: (racer, seconds, attacker) => racer.onRemoteIgnite?.(seconds, attacker),
});
const weapon = createWeapon({ scene: world, camera, targets: opponents, shooter: race.field[0], canReload: () => race.started, onFired: (id, from, end) => { online.sendShot(id, from, end); cutByShot(from, end); }, onHit: target => { featFeed.addCount(target, 'Acerto'); feats.hit(); }, onKill: creditKill, extraTargets: () => obstacles.active, onObstacleHit: (ob, damage) => obstacles.shoot(ob, damage), onSplash: point => { combat.explodeAt(point.x, point.y, point.z); playAt('dynamite', point.x, point.z); },
  onIgnite: (target, seconds) => burning.ignite(target, race.field[0], seconds),
  onGroundFire: ground => traps.burnGround(ground.dist, ground.lane, null, race.field[0]) });   // só recarrega depois do GO
const harpoon = createHarpoon({ owner: race.field[0], car, race, holdToExtend: false, aimYaw: () => car.yaw + look.yaw, visual: createHarpoonVisual(world), onSound: playAt, onRemotePull: (target, shooter) => online.sendPull(target, shooter), onTetherEnd: target => online.sendPullEnd(target, race.field[0]), onHooked: target => {
  featFeed.announce('ARPOADO', { color: '#8ad0ff' });
  featFeed.addCount(target, 'Arpao');
} });
const foam = createFoamEffect(world);
const powerVisuals = createPowerVisuals(world);
const mines = createMines({
  scene: world, race, car, onSound: playAt,
  onExplode: (x, y, z) => combat.explodeAt(x, y, z),
  onAttach: mine => online.sendMine(mine),
  onKill: (victim, killer) => {
    onRacerDestroyed(victim, killer);
    if (!killer.isPlayer && !killer.remote) rewardKillFor(killer);
  },
});
const emp = createEmp({ race, mines, visuals: powerVisuals, onSound: playAt, onPulse: racer => online.sendEmp(racer) });

// Linhas de estado dos poderes sobre o jogador, desenhadas pelo HUD.
function powerStatus() {
  if (car.wrecked > 0) return [];
  const lines = [], me = race.field[0], fuse = mines.fuseOn(me);
  if (car.effects.shield > 0) lines.push({ text: `ESCUDO ${Math.round(shieldLevel(me, 1) * 100)}%`, color: '#6cc0ff' });
  if (car.effects.emp > 0) lines.push({ text: `EMP ${car.effects.emp.toFixed(1)}S: SEM NITRO E TIRO`, color: '#ff6a50' });
  if (harpoon.tetherLeft > 0) lines.push({ text: `ARPAO PRESO ${harpoon.tetherLeft.toFixed(1)}S: E SOLTA`, color: '#ffd060' });
  const hooked = pulls.leftFor(me);
  if (hooked > 0) lines.push({ text: `PRESO NO ARPAO ${hooked.toFixed(1)}S: NITRO OU EMP SOLTA`, color: '#ffd060' });
  if (fuse > 0) lines.push({ text: `MINA GRUDADA ${fuse.toFixed(1)}S: USE O EMP`, color: '#ff4030' });
  // Rajada de vento (cânion): avisa de que lado ela vai empurrar, para dar tempo de contraesterçar.
  const gust = track.gusts.length ? gustAt(race.playerDist, race.time) : null;
  if (gust && (gust.warn > 0.05 || gust.level > 0.05)) {
    const label = gust.level > 0.3 ? 'RAJADA' : 'VENTO VINDO';
    lines.push({ text: gust.dir > 0 ? `${label} >>>` : `<<< ${label}`, color: gust.level > 0.3 ? '#ff9a40' : '#f0e0a0' });
  }
  if (car.boost > 0) lines.push({ text: 'TURBO!', color: '#30f0ff' });
  return lines;
}
const traps = createTraps({ scene: world, car, race, harpoon, burning, mines, emp, onCaught: onTrapCaught, onSound: playAt, onExtinguisher: racer => { foam.spray(racer); online.sendExtinguisher(racer); }, onPlaced: (type, dist, lane, owner, id) => online.sendTrap(type, dist, lane, owner, id), onDetonated: id => online.sendTrapBoom(id) });
const obstacles = createObstacles({
  scene: world, race, car, onSound: playAt,
  isAuthority: () => !online.active || net.isAdmin,
  onPlayerHit: type => featFeed.announce(`BATEU ${type.hitText}`, { color: '#f06050' }),
  onSpawned: ob => online.sendObstacle(ob),
  onBroken: ob => online.sendObstacleBreak(ob),
});
const lightning = createLightning({
  scene: world, race, car, onSound: playAt,
  isAuthority: () => !online.active || net.isAdmin,
  onPlayerHit: () => featFeed.announce('ATINGIDO PELO RAIO', { color: '#70d8ff' }),
});
const combat = createOpponentCombat({
  scene: world, car, race, opponents, traps, burning, look, onSound: playAt,
  onShot: (weaponId, distance, pan) => audio.playEnemyShot(weaponId, distance, pan),
  onDestroyed: (x, z) => playAt('crash', x, z),
  onBotShot: (id, from, to) => { online.sendShot(id, from, to); cutByShot(from, to); },
  onRemotePull: (target, shooter) => online.sendPull(target, shooter),
  onTetherEnd: (target, shooter) => online.sendPullEnd(target, shooter),
  onPlayerShot: () => audio.playBulletHit(),
  onKill: (victim, killer) => {
    announceDestruction(victim, killer);
    if (victim.isPlayer) feats.playerDestroyed(killer);
    rewardKillFor(killer);
  },
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
    featFeed.announce('SUPRIMENTOS', { color: '#6fe070' });
    roadsideHelp.showMessage([`+NITRO ${percent(nitro)}`, `+MUNICAO ${percent(ammo)}`, ...items.map(label => `+${label}`)].join(' '));
    audio.playWorldSound('itemCollected', 0, 0);
  },
  onLeaderReward: ({ ammo, items }) => {
    featFeed.announce('BONUS DO LIDER', { color: '#ffe060' });
    roadsideHelp.showMessage([`+MUNICAO ${Math.round(ammo * 100)}%`, ...items.map(label => `+${label}`)].join(' '));
    audio.playWorldSound('itemCollected', 0, 0);
  },
});
const damageEffects = createCarDamageEffects(world, MAX_RACERS, () => (spectator.active ? spectator.camera : camera));
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
  wantsFire: () => Boolean(keys.FireButton) && !traps.aiming && !outOfAction(),
  wantsNitro: () => Boolean(keys.Space) && car.nitro > 0 && !car.nitroLocked && race.started && !car.airborne && car.sunk <= 0 && !inMenus() && !outOfAction(),   // no ar o registro não abre
});
const scope = createScope({
  camera, weapon, hands, car,
  isAiming: () => Boolean(keys.AimButton),
  canAim: () => !spectator.active && !inMenus() && !outOfAction(),
});

// Escapamento explosivo: com o nitro aberto, deixa fogo no asfalto logo atrás do carro.
const FIRE_TRAIL_INTERVAL = 0.12, FIRE_TRAIL_BEHIND = 12;
let fireTrailWait = 0;
function updateFireTrail(dt) {
  fireTrailWait -= dt;
  if (!car.nitroActive || car.parts.fireTrail <= 0 || fireTrailWait > 0) return;
  fireTrailWait = FIRE_TRAIL_INTERVAL;
  const me = race.field[0];
  traps.burnGround(me.dist - FIRE_TRAIL_BEHIND, me.lane, null, me);
}

function applyEquipment({ weaponId, trunk, upgrades, parts }) {
  weapon.equip(weaponId, upgradeFactor('ammo', upgrades.ammo));
  weapon.setTracerColor(customs[weaponId].colors.flash);
  cabin.setWeapon(weapon.type, weapon.maxReserve);
  traps.setLoadout(Object.entries(trunk).flatMap(([id, count]) => (count > 0 ? [{ id, count }] : [])));
  car.armor = upgradeFactor('life', upgrades.life);
  car.parts = partStats(parts);
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
  onGarage: () => garage.openFromMenu(),
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
  onGarage: () => garage.openFromMenu(() => multiplayer.open()),
  isWaiting: () => Boolean(net.room) && net.room.phase === 'playing' && !online.active,   // entrou com a partida em andamento
});
const matchSetup = createMatchSetupScreen({
  stage,
  // Corrida rápida pula a garagem: corre com o carro e as compras salvos.
  onContinue: () => {
    if (matchSetup.config.mode !== 'quick') { garage.open(); return; }
    windowView.applySpec(garage.carSpec());
    startMatch(matchSetup.matchConfig());
  },
  onBack: () => mainMenu.open(),
});
const voteScreen = createVoteScreen({ stage, onVote: biomeId => online?.castVote(biomeId) });   // votação do próximo mapa (multiplayer)
const results = createResultsScreen({
  stage,
  onNext: () => garage.openBetweenRaces(TIME_BETWEEN_RACES),
  onFinished: () => podium.open(match),
  localName: () => race.field[0].name,
  getUpcomingBiome: () => upcomingBiomeName(),
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
let garageReopening = false;
const workshop = createWeaponWorkshop({
  stage,
  customs,
  onChange: id => {
    hands.rebuildGun(id);
    if (id === weapon.type.id) weapon.setTracerColor(customs[id].colors.flash);
  },
  // Só depois deste clique, senão ele acionaria a garagem. Se o intervalo acabou nesse meio-tempo, a corrida já começou.
  onClose: () => {
    garageReopening = true;                          // neste intervalo nenhuma tela está aberta: o clique não pode capturar o mouse
    setTimeout(() => { garageReopening = false; if (!match || garage.isBetweenRaces()) garage.open(); });
  },
});
const garage = createGarageScreen({
  stage,
  cabin,
  customs,
  equipment,
  getName: () => (online.active ? race.field[0].name : playerName),   // online vale o nome confirmado pelo servidor
  setName: name => {
    changePlayerName(name);
    if (online.active || net.room) net.setName(name);
    else renameSoloDriver(name);
  },
  getReadyRoster: () => online.readyRoster(),
  getUpcomingBiome: () => upcomingBiomeName(),
  onKickPlayer: id => net.kick(id),
  onOpenWorkshop: id => workshop.open(id),
  onProceed: () => {
    windowView.applySpec(garage.carSpec());
    startMatch(matchSetup.matchConfig());
  },
  onBetweenRacesEnd: () => {
    workshop.isOpen = false;                         // o tempo vale também para quem está na oficina
    windowView.applySpec(garage.carSpec());
    if (online.active) {
      if (!garage.isOpen) garage.open();
      online.markReady();
    } else {
      startNextRace();
    }
  },
  onBack: () => mainMenu.open(),
});
const spectator = createSpectator({ opponents, race, camera: new THREE.PerspectiveCamera(VIEW.fov, VIEW.width / VIEW.height, 0.1, 400) });
const windowView = createWindowView({ scene: world, car, initialSpec: garage.carSpec(), seed: PLAYER_CAR_SEED });
applyEquipment(equipment);
// Pausa da corrida (ver os eventos de ESC mais abaixo).
const pause = createPauseMenu({
  stage,
  isOnline: () => online.active,
  onResume: () => stage.requestPointerLock()?.catch?.(() => {}),   // logo depois do ESC o navegador pode recusar: aí basta clicar
  onMainMenu: () => location.reload(),               // recarregar volta ao menu com tudo zerado (online, sai da sala)
  onQuit: () => window.close(),                      // o navegador só permite em abas abertas por script
});
const matchTable = createMatchTable({
  getMatch: () => match, race, localName: () => race.field[0].name,
  isBlocked: () => mainMenu.isOpen || multiplayer.isOpen || matchSetup.isOpen || podium.isOpen,   // ainda montando a partida ou já acabou
});
const drawHud = createHud(hudCanvas, { matchTable, isTableHeld: () => Boolean(keys.Tab) && !(garage.isTyping() || multiplayer.isTyping()), killFeed, pause, scope, featFeed, mainMenu, multiplayer, podium, matchSetup, results, voteScreen, matchLabel: () => `CORRIDA ${match ? match.currentRace : 1} DE ${match ? match.raceCount : 1}`, biomeName: () => biome.name, biomeChallenge: () => biome.challenge ?? [], race, weapon, hands, garage, workshop, windowView, spectator, spectatorExit: () => (online.active ? 'ENTER IR PARA A GARAGEM' : 'ENTER VER RESULTADOS'), isLocked, combat, car, roadsideHelp, traps, powerStatus, opponents, activeCamera: () => (spectator.active ? spectator.camera : camera), isBehindCabin: (x, y, z) => !spectator.active && cabin.isBehindCabin(x, y, z), isInSmoke: (x, z) => darkness.level > 0.5 || sandstorm.level > 0.6 || car.effects.smoke > 0 || traps.smokeBlocks(car.x, car.z, x, z) });
const inMenus = () => pause.isOpen || mainMenu.isOpen || multiplayer.isOpen || podium.isOpen || matchSetup.isOpen || results.isOpen || voteScreen.isOpen || garage.isOpen || workshop.isOpen;

// ESC (o navegador solta o mouse) ou perder o foco no meio da corrida abre a pausa; ESC de novo continua.
const inRaceView = () => !inMenus() && !garageReopening;
document.addEventListener('pointerlockchange', () => { if (!isLocked() && inRaceView()) pause.open(); });
addEventListener('keydown', event => {
  if (event.code !== 'Escape' || event.repeat || isLocked()) return;
  if (pause.isOpen) pause.resume();
  else if (inRaceView()) pause.open();
});

setupInput(stage, {
  onFire: () => {
    if (outOfAction()) return;
    if (traps.aiming) { traps.throwItem(car.yaw + look.yaw); return; }
    hands.requestFire();
  },
  onReload: weapon.reload,
  onDropTrap: () => {
    traps.explainDenied();
    hands.requestTrap();
  },
  onCycleTrap: traps.cycle,
  canLockPointer: () => !inMenus() && !garageReopening,
  sensitivity: () => settings.sensitivity * scope.sensitivity(),
  isTyping: () => garage.isTyping() || multiplayer.isTyping(),
  limits: () => (windowView.active ? WINDOW_VIEW : NORMAL_LOOK),
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
  Object.assign(racerConditions[0], { x: car.wx, z: car.wz, yaw: car.yaw, vx: car.vx, vz: car.vz, health: car.health, burning: car.effects.burning > 0, elevation: car.wy + elevationOf(car, car.wrecked), visible: windowView.active });
  opponents.forEach((op, i) => {
    const yaw = op.group.rotation.y;
    Object.assign(racerConditions[i + 1], {
      x: op.wx, z: op.wz, yaw, vx: -Math.sin(yaw) * op.v, vz: -Math.cos(yaw) * op.v, health: op.hp / op.maxHp, burning: op.effects.burning > 0 && op.dead <= 0, elevation: op.wy + elevationOf(op, op.dead),
      visible: Math.hypot(op.x - car.x, op.z - car.z) < DAMAGE_EFFECT_RANGE,
    });
  });
  return activeConditions;
}

const NEUTRAL_AMBIENT = 0xffffff;                    // na garagem a cabine mostra as cores reais

// Trechos escuros (caverna, túnel sem luz): a cena escurece, a cabine também, e os faróis acendem. O nível anda em
// degraus para a cabine não ser repintada a cada quadro.
const DARK_CABIN = 0x2a2a34, DARK_STEPS = 16, PULSE_PERIOD = 2.4;
const darkness = { level: 0 }, sandstorm = { level: 0 };
let stormZoneColor = 0xd2a868;
const playerLights = createCarLights({ beams: false, lamps: false });   // a mancha de luz na frente do jogador, vista da cabine
playerLights.group.rotation.order = 'YXZ';
world.add(playerLights.group);
const cabinTint = new THREE.Color(), darkCabin = new THREE.Color(DARK_CABIN), stormTint = new THREE.Color();
function updateDarkness() {
  const spot = inMenus() ? null : darkZoneAt(race.playerDist);
  // Túnel que pisca (neon): alterna breu e luz no ritmo da música.
  const blink = spot?.zone.pulse ? 0.12 + 0.88 * Math.min(1, Math.max(0, 0.5 + Math.sin(performance.now() / 1000 * Math.PI * 2 / PULSE_PERIOD) * 1.5)) : 1;
  darkness.level = spot ? Math.round(spot.level * blink * DARK_STEPS) / DARK_STEPS : 0;
  const storm = inMenus() || !track.stormZones.length ? null : stormAt(race.playerDist);
  sandstorm.level = storm ? Math.round(storm.level * DARK_STEPS) / DARK_STEPS : 0;
  if (storm) stormZoneColor = storm.zone.color;
  world.setStorm(sandstorm.level, storm?.zone ?? null);
  setWeatherGrip(sandstorm.level, storm?.zone.grip);
  world.setDarkness(darkness.level, spot?.zone.fog ?? [0, 0]);
  const flash = inMenus() ? 0 : lightning.flash;
  world.setFlash(flash);
  updateGustParticles();
  // Bioma noturno (`night`): faróis acesos a corrida toda.
  const night = Boolean(biome?.night) && !inMenus();
  const lit = racerDist => night || (track.darkZones.length > 0 && darkZoneAt(racerDist) !== null);
  for (const op of opponents) op.model.setLights(lit(op.dist));
  windowView.setLights(night || darkness.level > 0);
  playerLights.setOn((night || darkness.level > 0) && !windowView.active);
  playerLights.group.position.set(car.wx, car.wy, car.wz);
  playerLights.group.rotation.set(car.pitch, car.yaw, car.twist);
  cabinTint.setHex(biome.cabinTint).lerp(darkCabin, darkness.level);
  if (sandstorm.level > 0) cabinTint.lerp(stormTint.setHex(stormZoneColor), sandstorm.level * 0.6);
  if (flash > 0.05) cabinTint.lerp(flashTint, Math.round(flash * 4) / 4 * 0.7);   // em degraus, como a escuridão
  return cabinTint.getHex();
}
const flashTint = new THREE.Color(0xe0ecff);

// Na rajada a poeira do clima corre de lado na pista, no sentido do empurrão.
const GUST_PARTICLE_SPEED = 32;
function updateGustParticles() {
  const gust = !inMenus() && track.gusts.length ? gustAt(race.playerDist, race.time) : null;
  if (!gust) { world.setGust(0, 0); return; }
  const t = trackAt(race.playerDist), speed = gust.dir * Math.max(gust.level, gust.warn * 0.2) * GUST_PARTICLE_SPEED;
  world.setGust(-t.tz * speed, t.tx * speed);
}
const TIME_BETWEEN_RACES = 45;                       // segundos na garagem antes da próxima corrida
const RESULTS_DELAY = 2.5;                           // segundos entre cruzar a linha e ver os resultados
let match = null, raceRecorded = false, sinceFinish = 0;

function setRacerCount(cars) {
  race.setRacerCount(cars);
  activeConditions = racerConditions.slice(0, cars);
}

online = createOnlineMatch({
  onPlayerKilledBy: killer => { announceDestruction(race.field.find(racer => racer.isPlayer), killer); feats.playerDestroyed(killer); },
  onPlayerShot: () => audio.playBulletHit(),
  net, scene: world, race, car, opponents, combat, traps, mines, emp, burning, foam, harpoon, pulls, weapon, look, garage, results, podium, voteScreen, playAt, setRacerCount, creditKill, rewardKillFor, announceTrapCatch, obstacles,
  onLateJoin: () => multiplayer.close(),
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

// Entre as corridas o piloto muda de nome e continua com os pontos; o bot de mesmo nome cede, como na largada.
function renameSoloDriver(name) {
  if (!match || race.field[0].name === name) return;
  const rename = (racer, newName) => {
    match.renameRacer(racer.name, newName);
    race.renameRacer(racer, newName);
  };
  const bot = opponents.find(op => op.name === name);
  if (bot) rename(bot, `${name} Bot`);
  rename(race.field[0], name);
}

// Bioma escolhido na corrida rápida; nulo sorteia um a cada corrida.
let matchBiome = null;

function startMatch({ cars, races, biome: biomeId = 'random' }) {
  matchBiome = BIOMES.find(candidate => candidate.id === biomeId) ?? null;
  setRacerCount(cars);
  race.setPlayerName(playerName);
  for (const op of opponents) op.name = op.profile.name === playerName ? `${playerName} Bot` : op.profile.name;   // nomes únicos na tabela
  match = createMatch({ racerNames: race.field.map(racer => racer.name), raceCount: races });
  if (!matchBiome && previewedBiome) {               // o aviso da garagem vale para a primeira corrida
    match.biomesPlayed.push(previewedBiome.id);
    match.upcomingBiome = previewedBiome.id;
  }
  previewedBiome = null;
  startNextRace();
}

// A largada de cada corrida é a ordem de chegada da anterior.
function startNextRace() {
  const planned = BIOMES.find(candidate => candidate.id === match.upcomingBiome);
  match.upcomingBiome = null;
  beginRace(planned ?? matchBiome ?? pickMatchBiome(match.biomesPlayed), Math.floor(Math.random() * 1e9), match.nextGrid);
}

// Entre as corridas todos veem o bioma da próxima; online quem sorteia é o admin (net/onlineMatch.js).
function planUpcomingBiome() {
  if (!match.isOver && !match.upcomingBiome) match.upcomingBiome = (matchBiome ?? pickMatchBiome(match.biomesPlayed)).id;
}
// Antes da primeira corrida (a partida ainda não existe) o bioma é o escolhido na configuração ou um sorteado na hora.
let previewedBiome = null;
const firstBiome = () => BIOMES.find(candidate => candidate.id === matchSetup.matchConfig().biome) ?? (previewedBiome ??= pickMatchBiome([]));
const upcomingBiomeName = () => (match ? BIOMES.find(candidate => candidate.id === match.upcomingBiome)?.name ?? null : firstBiome().name);

// `grid` são os nomes na ordem de largada; sem ele usa a largada padrão.
function beginRace(chosenBiome, seed, grid) {
  biome = chosenBiome;
  setSurface(biome.surface);
  setGravity(biome.gravity ?? 9.81);
  world.buildMap(biome, seed);
  audio.setPhase(biome.music);
  traps.reset();
  mines.reset();
  powerVisuals.reset();
  harpoon.reset();
  pulls.reset();
  foam.reset();
  featFeed.reset();
  killFeed.reset();
  feats.reset();
  driftTracker.reset();
  lapSupplies.reset();
  race.reset(grid);
  applyEquipment(equipment);
  combat.reset();
  roadsideHelp.reset();
  obstacles.reset();
  lightning.configure(biome.lightning);
  damageEffects.reset();
  look.yaw = look.pitch = 0;
  raceRecorded = false;
  sinceFinish = 0;
  skipSpectate = false;
  spectator.reset();
  audio.startRace();
}

// Espectar vale depois de cruzar a linha: online até o fim da corrida; offline até o jogador apertar ENTER.
let skipSpectate = false;
const prevKeys = {};
const pressed = code => { const down = Boolean(keys[code]); const fresh = down && !prevKeys[code]; prevKeys[code] = down; return fresh; };
// Online, quem já cruzou a linha escolhe entre espectar (padrão) e ir à garagem enquanto os outros terminam. Nesse
// tempo a corrida segue rodando para todos (o admin simula os bots): só o carro dele fica sem controle.
const earlyGarage = () => online.active && race.crossed && !race.finished && (garage.isOpen || workshop.isOpen);
function goToGarageEarly() {
  document.exitPointerLock();
  windowView.applySpec(garage.carSpec());
  garage.openBetweenRaces(Infinity, { waitsForHost: true, waiting: true, waitLabel: 'ESPERANDO O FIM DA CORRIDA' });
}
const wantsSpectate = () => !inMenus() && !skipSpectate && spectator.hasTargets() && (online.active ? race.crossed && !race.finished : race.finished);

function finishRaceFlow(frameTime) {
  if (!race.finished || results.isOpen || !match) return;
  if (!raceRecorded) {
    raceRecorded = true;
    match.recordRace(race.finishOrder);
    if (!online.active) planUpcomingBiome();
    addRaceResult({ position: race.finalRank, racers: race.field.length, time: race.time, kills: weapon.kills });
  }
  if ((sinceFinish += frameTime) < RESULTS_DELAY) return;
  if (!online.active && !skipSpectate && spectator.hasTargets()) return;   // offline: espera o ENTER do espectador
  sinceFinish = -Infinity;                           // abre uma vez só
  audio.stopRace();
  document.exitPointerLock();
  if (online.active) { garage.closeAfterWait(); workshop.isOpen = false; }   // quem esperava na garagem vê os resultados e a votação por cima
  results.open(match, race.finishResults, { waitsForHost: online.active });
}

// Q segurado: a cabeça vai para fora da janela (dá para olhar e atirar para trás) e o carro fica mais lento.
// Ao soltar, a cabeça volta para dentro e o olhar volta aos limites da cabine.
const NORMAL_LOOK = { minYaw: -LOOK.maxYaw, maxYaw: LOOK.maxYaw, maxPitchUp: LOOK.maxPitchUp, maxPitchDown: LOOK.maxPitchDown };
function updateWindowView() {
  const wanted = Boolean(keys.KeyQ) && !inMenus() && !spectator.active && !outOfAction();
  if (wanted === windowView.active) return;
  windowView.setActive(wanted);
  cabin.setWindowView(wanted);
  car.leaning = wanted;
  if (!wanted) clampLook();
}

function step(frameTime) {
  mainMenu.update();
  multiplayer.update();
  matchSetup.update();
  results.update();
  const left = pressed('ArrowLeft'), right = pressed('ArrowRight'), enter = pressed('Enter');
  if (spectator.active) {
    if (left) spectator.cycle(-1);
    if (right) spectator.cycle(1);
    if (enter && !online.active) skipSpectate = true;
    else if (enter && online.active) goToGarageEarly();
  }
  spectator.update(frameTime, wantsSpectate());
  if (inMenus() && isLocked()) document.exitPointerLock();   // numa tela de menu o mouse nunca fica preso
  updateWindowView();
  // A corrida fica parada nas telas de menu; online a pausa não pode parar os outros, só tira o controle do carro.
  const dt = inMenus() && !(online.active && (pause.isOpen || earlyGarage())) ? 0 : frameTime;
  const driving = outOfAction() || spectator.active || pause.isOpen || earlyGarage() ? NO_KEYS : keys;
  updateCar(car, dt, driving, race.started, hands.isNitroReady());
  updateFireTrail(dt);
  race.update(dt, traps.active);
  driftTracker.update(dt);
  lapSupplies.update();
  featFeed.update(dt);
  killFeed.update(dt);
  feats.update(dt);
  traps.update(dt);
  mines.update(dt);
  powerVisuals.update(race.field, dt);
  burning.update(dt);
  obstacles.update(dt);
  lightning.update(dt);
  if (car.boostKick) {
    car.boostKick = false;
    playAt('itemCollected', car.x, car.z, 1);
  }
  harpoon.setHeld(Boolean(keys.KeyE) && !outOfAction());   // E de novo solta o cabo preso
  harpoon.update(dt);
  pulls.update(dt);
  foam.update(dt);
  combat.update(dt);
  roadsideHelp.update(dt);
  roadsideNpcs.update(dt, car.x, car.z);
  damageEffects.update(dt, readRacerConditions());
  world.updateMap(dt, car.x, car.y, car.z);
  const darkTint = updateDarkness();
  cabin.setAmbient(garage.isOpen ? NEUTRAL_AMBIENT : darkTint);
  weapon.update(dt, driving.FireButton && !traps.aiming && hands.isGunReady());
  const gear = readGearbox(car, driving.KeyW);
  cabin.update({ look, weapon, gear, race, traps, rivals: findRivals(race, opponents, car), dt, frameTime });
  hands.update(dt, gear);
  scope.update(frameTime);
  windowView.update(dt);
  audio.update({ gear, race, keys: driving, nitroOpen: car.nitroActive, drifting: car.slipping, burning: car.effects.burning > 0 && car.wrecked <= 0 });
  audio.setMenuMusic(inMenus());

  if (garage.isOpen || mainMenu.isOpen || multiplayer.isOpen || matchSetup.isOpen) garage.update(frameTime);
  workshop.update(frameTime);
  garage.tickBetweenRaces(frameTime);
  online.update(frameTime);
  if (mainMenu.isOpen || multiplayer.isOpen || matchSetup.isOpen || garage.isOpen && garage.view === 'car') {
    garage.renderCar(renderer);
  } else if (spectator.active) {
    renderer.clear();
    renderer.render(world, spectator.camera);
  } else if (windowView.active || scope.active) {
    renderer.clear();                                // pela janela e pela luneta não se vê a cabine
    renderer.render(world, camera);
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

export const game = { killFeed, lightning, getPause: () => pause.isOpen, beginRace, obstacles, lapSupplies, roadsideNpcs, featFeed, podium, multiplayer, net, online: () => online, pulls, world, getBiome: () => biome, harpoon, matchSetup, results, getMatch: () => match, roadsideHelp, mainMenu, settings, step, keys, look, car, race, opponents, combat, weapon, traps, burning, scope, cabin, hands, audio, garage, workshop, windowView, renderer, glCanvas, hudCanvas };
