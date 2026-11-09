import { MENU_MUSIC, PHASE_MUSIC, SOUND_FILES } from './soundFiles.js';
import { effectiveRpm, ENGINE_LAYERS, engineMix } from './engineMix.js';
import { WEAPON_SOUNDS } from './weaponSounds.js';
import { familyOf } from '../game/weaponTypes.js';

// Som do jogo: efeitos e motor pelo Web Audio; música por streaming, sem carregar tudo na memória.

const VOLUME = { master: 0.9, engineCoasting: 0.3, engineThrottle: 0.5, accelerate: 0.45, gearShift: 0.3, horn: 0.7, start: 0.8, finish: 0.9, drift: 0.45, uiClick: 0.8, menuMusic: 0.7 };
const ENGINE_DELAY_AFTER_START = 0.9, SMOOTHING = 0.05, FADE_OUT = 0.08, NITRO_PITCH = 1.06;
const LAUNCH_MAX_KMH = 15, GEAR_SOUND_MIN_KMH = 2;
const FIRE_PITCH_VARIATION = 0.07;                         // evita que tiros seguidos soem idênticos

const ENEMY_SHOT_VOLUME = 0.55;
const DISTANCE_FALLOFF = 18;                               // metros em que um som da pista cai pela metade
const WORLD_SOUND_RANGE = 120, DRIFT_FADE_IN = 0.04;

// Sons que acontecem na pista. minGap: segundos mínimos entre repetições, para não empilhar;
// sons com o mesmo `gapGroup` contam juntos.
const WORLD_SOUNDS = {
  crash: { volume: 0.7, minGap: 0.8 },
  itemCollected: { volume: 2, minGap: 0.1 },              // o arquivo é bem mais baixo que os outros
  carHit: { volume: 0.55, minGap: 1, gapGroup: 'collision' },
  carPunched: { volume: 0.8, minGap: 1, gapGroup: 'collision' },
  dynamite: { volume: 0.9, minGap: 0.1 },
  harpoon: { volume: 0.55, minGap: 0.1 },
  harpoonHit: { volume: 0.7, minGap: 0.1 },
  extinguisher: { volume: 1.8, minGap: 0.1 },                 // o arquivo é bem mais baixo que os outros
  oil: { volume: 0.9, minGap: 0.3 },
  paint: { volume: 0.9, minGap: 0.3 },
  smoke: { volume: 2, minGap: 0.6 },                      // o arquivo é bem mais baixo que os outros
};

// Vários momentos usam o mesmo arquivo; cada um é carregado uma vez só.
const weaponSoundFiles = () => [...new Set(Object.values(WEAPON_SOUNDS).flatMap(moments => Object.values(moments).flatMap(sound => [sound.url, sound.fallback ?? sound.url, ...(sound.remote ? [sound.remote.url] : [])])))]
  .map(url => [url, url]);
const FIRE_LOOP_HOLD = 0.15, REMOTE_BURST_GAP = 0.3;   // segundos
const firePitch = () => 1 + (Math.random() - 0.5) * FIRE_PITCH_VARIATION;

// `settings` traz os volumes escolhidos pelo jogador.
export function createAudioSystem(settings) {
  const context = new AudioContext();
  const master = context.createGain();
  master.gain.value = VOLUME.master * settings.effects;
  master.connect(context.destination);

  const buffers = {};
  async function load(name, url) {
    try {
      const response = await fetch(url);
      buffers[name] = await context.decodeAudioData(await response.arrayBuffer());
    } catch (error) {
      console.warn(`Som não carregado: ${url}`, error);
    }
  }
  const ready = Promise.all([...Object.entries(SOUND_FILES), ...weaponSoundFiles()].map(([name, url]) => load(name, url)));

  const music = new Audio(PHASE_MUSIC.forestField);
  music.loop = true;
  music.volume = settings.music;

  // Música fora da corrida: uma lista que começa em uma faixa sorteada e segue em ordem.
  const menuMusic = new Audio();
  menuMusic.volume = settings.menuMusic * VOLUME.menuMusic;
  let menuTrack = Math.floor(Math.random() * MENU_MUSIC.length), menuMusicWanted = false;
  menuMusic.src = MENU_MUSIC[menuTrack];
  const playMenuMusic = () => menuMusic.play().catch(() => { /* bloqueado pelo navegador: tenta de novo no próximo clique */ });
  menuMusic.addEventListener('ended', () => {
    menuTrack = (menuTrack + 1) % MENU_MUSIC.length;
    menuMusic.src = MENU_MUSIC[menuTrack];
    if (menuMusicWanted) playMenuMusic();
  });

  // Navegadores só liberam áudio depois de uma ação do jogador.
  const resume = () => {
    if (context.state === 'suspended') context.resume();
    if (menuMusicWanted && menuMusic.paused) playMenuMusic();
  };
  addEventListener('pointerdown', resume);
  addEventListener('keydown', resume);

  // `raceTheme`: já largou uma corrida. O tema da pista segue tocando entre as corridas, e o menu só volta recarregando a página.
  let raceOn = false, raceTheme = false, engineTimer = 0;

  function play(name, volume, { loop = false, rate = 1, pan = 0 } = {}) {
    if (!buffers[name]) return null;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffers[name];
    source.loop = loop;
    source.playbackRate.value = rate;
    gain.gain.value = volume;
    source.connect(gain);
    if (pan) {
      const panner = context.createStereoPanner();
      panner.pan.value = pan;
      gain.connect(panner).connect(master);
    } else {
      gain.connect(master);
    }
    source.start();
    return { source, gain };
  }

  function stop(sound) {
    if (!sound) return;
    sound.gain.gain.setTargetAtTime(0, context.currentTime, FADE_OUT / 3);
    sound.source.stop(context.currentTime + FADE_OUT);
  }

  // Motor: as quatro camadas tocam sempre; só os volumes e a afinação mudam.
  let engine = null;

  function startEngine() {
    engine = ENGINE_LAYERS.map(name => play(name, 0, { loop: true }));
  }

  function updateEngine(gear, throttle, nitroOpen) {
    if (!engine || engine.includes(null)) return;
    const mix = engineMix(effectiveRpm(gear.rpm, gear.kmh));
    const volume = throttle ? VOLUME.engineThrottle : VOLUME.engineCoasting;
    const now = context.currentTime;
    engine.forEach((layer, i) => {
      layer.gain.gain.setTargetAtTime(mix[i].gain * volume, now, SMOOTHING);
      layer.source.playbackRate.setTargetAtTime(mix[i].rate * (nitroOpen ? NITRO_PITCH : 1), now, SMOOTHING);
    });
  }

  let launch = null, hornSound = null, wasThrottle = false, lastGear = null, finished = false;
  let reloadSound = null;

  // Som novo que ainda não existe como arquivo: toca o `fallback` (o da arma parecida).
  const resolveSound = sound => (sound.fallback && !buffers[sound.url] ? { url: sound.fallback, volume: sound.fallbackVolume } : sound);
  const soundsOf = weaponId => WEAPON_SOUNDS[weaponId] ?? WEAPON_SOUNDS[familyOf(weaponId)];

  // Lança-chamas: cada tiro renova o laço; quando os tiros param, `updateFireLoop` o apaga.
  let fireLoop = null, fireLoopUntil = 0, nextRemoteBurst = 0;
  function holdFireLoop(sound) {
    fireLoop ??= play(sound.url, sound.volume, { loop: true });
    fireLoopUntil = performance.now() / 1000 + FIRE_LOOP_HOLD;
  }
  function updateFireLoop() {
    if (!fireLoop || performance.now() / 1000 < fireLoopUntil) return;
    stop(fireLoop);
    fireLoop = null;
  }

  function playWeaponSound(weaponId, moment) {
    // O som de abrir a arma pode ser mais longo que uma recarga curta.
    if (moment === 'reloadEnd') { stop(reloadSound); reloadSound = null; }
    const original = soundsOf(weaponId)[moment];
    if (original?.loop && buffers[original.url]) { holdFireLoop(original); return; }
    const sound = original && resolveSound(original);
    if (!sound) return;
    const voice = play(sound.url, sound.volume, { rate: moment === 'fire' ? firePitch() : 1 });
    if (moment === 'reloadStart') reloadSound = voice;
  }

  // Tiro de um adversário: mais baixo de longe e vindo do lado em que ele está (`pan` de -1 a 1).
  function playEnemyShot(weaponId, distance, pan) {
    if (distance > WORLD_SOUND_RANGE) return;
    const fire = soundsOf(weaponId).fire;
    if (fire.remote) {                                // rajada contínua de outro jogador: não empilha uma voz por tiro
      const now = performance.now() / 1000;
      if (now < nextRemoteBurst) return;
      nextRemoteBurst = now + REMOTE_BURST_GAP;
    }
    const { url, volume } = resolveSound(fire.remote ?? fire);
    play(url, volume * ENEMY_SHOT_VOLUME / (1 + distance / DISTANCE_FALLOFF), { rate: firePitch(), pan });
  }

  // `strength` de 0 a 1 escala o volume (batida leve ou forte).
  const nextWorldSound = {};
  function playWorldSound(name, distance, pan, strength = 1) {
    const sound = WORLD_SOUNDS[name], now = performance.now() / 1000;
    const gapKey = sound?.gapGroup ?? name;
    if (!sound || distance > WORLD_SOUND_RANGE || now < (nextWorldSound[gapKey] ?? 0)) return;
    nextWorldSound[gapKey] = now + sound.minGap;
    play(name, sound.volume * strength / (1 + distance / DISTANCE_FALLOFF), { pan });
  }

  let driftSound = null;
  function updateDrift(drifting) {
    if (drifting && !driftSound) {
      driftSound = play('drift', 0, { loop: true });
      driftSound?.gain.gain.setTargetAtTime(VOLUME.drift, context.currentTime, DRIFT_FADE_IN);
    }
    if (!drifting && driftSound) { stop(driftSound); driftSound = null; }
  }

  function updateLaunch(throttle, kmh, racing) {
    if (throttle && !wasThrottle && racing && kmh < LAUNCH_MAX_KMH) launch = play('accelerate', VOLUME.accelerate);
    if (!throttle && wasThrottle) { stop(launch); launch = null; }
    wasThrottle = throttle;
  }

  function updateHorn(pressed) {
    if (pressed && !hornSound) hornSound = play('horn', VOLUME.horn, { loop: true });
    if (!pressed && hornSound) { stop(hornSound); hornSound = null; }
  }

  function updateGear(gear) {
    if (lastGear !== null && gear.index !== lastGear && gear.kmh > GEAR_SOUND_MIN_KMH) play('gearShift', VOLUME.gearShift);
    lastGear = gear.index;
  }

  // Quando a aba fica oculta o jogo para; o som precisa parar junto.
  document.addEventListener('visibilitychange', () => {
    if (menuMusicWanted) {
      if (document.hidden) menuMusic.pause();
      else playMenuMusic();
    }
    if (raceTheme) {
      if (document.hidden) music.pause();
      else music.play().catch(() => { /* bloqueado pelo navegador: tenta na próxima largada */ });
    }
    if (!raceOn) return;
    if (document.hidden) context.suspend();
    else context.resume();
  });

  // Fim da corrida: cala motor e derrapagem. A música da pista continua até a próxima largada.
  function stopRace() {
    if (!raceOn) return;
    raceOn = false;
    clearTimeout(engineTimer);
    if (engine) engine.forEach(stop);
    engine = null;
    for (const sound of [launch, hornSound, driftSound]) stop(sound);
    launch = hornSound = driftSound = null;
    wasThrottle = finished = false;
    lastGear = null;
  }

  return {
    ready,
    stopRace,
    setMusicVolume(volume) { music.volume = volume; },
    setMenuMusicVolume(volume) { menuMusic.volume = volume * VOLUME.menuMusic; },
    setPhase(phase) {
      const url = new URL(PHASE_MUSIC[phase], location.href).href;
      if (music.src !== url) music.src = url;
    },
    setEffectsVolume(volume) { master.gain.value = VOLUME.master * volume; },
    // `wanted`: o jogador está fora da corrida. A faixa continua de onde parou.
    setMenuMusic(outOfRace) {
      const wanted = outOfRace && !raceTheme;
      if (wanted === menuMusicWanted) return;
      menuMusicWanted = wanted;
      if (wanted) playMenuMusic();
      else menuMusic.pause();
    },
    // A partida online acabou e a sala voltou para a lobby: o tema da pista dá lugar à música do menu.
    returnToMenu() {
      raceTheme = false;
      music.pause();
    },
    musicElements: () => ({ menu: menuMusic, race: music }),
    playUiClick() { play('uiClick', VOLUME.uiClick); },
    playWeaponSound,
    playEnemyShot,
    playWorldSound,
    startRace() {
      if (raceOn) return;
      raceOn = raceTheme = true;
      resume();
      play('start', VOLUME.start);
      music.currentTime = 0;                         // biomas com a mesma música também recomeçam do início
      music.play().catch(() => { /* bloqueado pelo navegador: toca sem música */ });
      engineTimer = setTimeout(startEngine, ENGINE_DELAY_AFTER_START * 1000);
    },
    update({ gear, race, keys, nitroOpen, drifting }) {
      updateFireLoop();
      if (!raceOn) return;
      const throttle = Boolean(race.started && (keys.KeyW || keys.ArrowUp));
      updateEngine(gear, throttle, nitroOpen);
      updateLaunch(throttle, gear.kmh, race.started);
      updateHorn(Boolean(keys.KeyH));
      updateGear(gear);
      updateDrift(drifting);
      if (race.finished && !finished) {
        finished = true;
        play('raceFinish', VOLUME.finish);
      }
    },
  };
}
