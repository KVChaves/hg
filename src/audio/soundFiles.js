// Arquivos de som do jogo.

const CAR = 'assets/audio/car';
const TRAPS = 'assets/audio/traps';
const EFFECTS = 'assets/audio/effects';

export const SOUND_FILES = {
  engineIdle: `${CAR}/engine-idle.wav`,
  engineLow: `${CAR}/engine-low.wav`,
  engineMid: `${CAR}/engine-mid.wav`,
  engineHigh: `${CAR}/engine-high.wav`,
  accelerate: `${CAR}/accelerate.wav`,
  gearShift: `${CAR}/gear-shift.wav`,
  horn: `${CAR}/horn.wav`,
  start: `${CAR}/start.wav`,
  raceFinish: 'assets/audio/effects/race-finish.wav',
  itemCollected: 'assets/audio/effects/item-collected.wav',
  uiClick: 'assets/audio/effects/ui-click.mp3',
  uiHover: `${EFFECTS}/ui-hover.wav`,
  // Contagem da largada: um bipe em 3, 2 e 1 e um mais agudo no "vai".
  countdown: `${EFFECTS}/countdown.wav`,
  countdownGo: `${EFFECTS}/countdown-go.wav`,
  kill: `${EFFECTS}/kill.wav`,
  ricochet: `${EFFECTS}/ricochet.wav`,
  nitro: `${CAR}/nitro.wav`,
  land: `${CAR}/land.wav`,
  // Obstáculos quebrando: o material decide o som (veja OBSTACLE_SOUND em game/obstacles.js); o resto usa `crash`.
  obstacleWood: `${EFFECTS}/obstacles/wood.wav`,
  obstacleFlesh: `${EFFECTS}/obstacles/flesh.wav`,
  obstacleIce: `${EFFECTS}/obstacles/ice.wav`,
  obstacleCrystal: `${EFFECTS}/obstacles/crystal.wav`,
  obstacleRock: `${EFFECTS}/obstacles/rock.wav`,
  obstacleMetal: `${EFFECTS}/obstacles/metal.wav`,
  // Trovão: o raio que cai na pista, o que rola perto e o que ronca longe (relâmpagos do céu).
  thunderClose: `${EFFECTS}/thunder-close.wav`,
  thunderRoll: `${EFFECTS}/thunder-roll.wav`,
  thunderFar: `${EFFECTS}/thunder-far.wav`,
  buy: `${EFFECTS}/buy.wav`,
  message: `${EFFECTS}/message.wav`,
  // Ambientes em laço (sem emenda); quais tocam em cada bioma está em PHASE_AMBIENCE.
  ambRain: 'assets/audio/ambience/rain.mp3',
  ambBeach: 'assets/audio/ambience/beach.mp3',
  ambDesert: 'assets/audio/ambience/desert.mp3',
  drift: `${CAR}/drift.wav`,
  crash: `${CAR}/crash.wav`,
  carHit: `${CAR}/hit.wav`,
  carPunched: `${CAR}/punched.wav`,
  // Bala batendo na lataria do próprio carro: quatro variações, sorteadas a cada acerto.
  bulletHit1: `${CAR}/bullet-hit-1.wav`,
  bulletHit2: `${CAR}/bullet-hit-2.wav`,
  bulletHit3: `${CAR}/bullet-hit-3.wav`,
  bulletHit4: `${CAR}/bullet-hit-4.wav`,
  // Armadilhas: o nome é o id em game/trapTypes.js.
  spikes: `${TRAPS}/spikes.wav`,
  dynamite: `${TRAPS}/dynamite.wav`,
  oil: `${TRAPS}/oil.wav`,
  paint: `${TRAPS}/paint.wav`,
  smoke: `${TRAPS}/smoke.wav`,
  harpoon: `${TRAPS}/harpoon.wav`,
  harpoonHit: `${TRAPS}/harpoon-hit.wav`,
  extinguisher: `${TRAPS}/extinguisher.wav`,
  // Escudo, EMP e mina teleguiada.
  shield: `${TRAPS}/shield.mp3`,
  emp: `${TRAPS}/emp.mp3`,
  mineLaunch: `${TRAPS}/mine-launch.mp3`,
  mineStick: `${TRAPS}/mine-stick.mp3`,
  mineBeep: `${TRAPS}/mine-beep.mp3`,
  mine: `${TRAPS}/mine-explosion.mp3`,
  // Fogo da besta incendiária: o estalo ao pegar e o laço do próprio carro queimando.
  fire: `${TRAPS}/fire.wav`,
  burning: `${TRAPS}/burning.wav`,
};

// Tocam em sequência em tudo o que não é corrida: menus, salas, garagem e resultados.
export const MENU_MUSIC = ['01', '02', '03', '04', '05'].map(name => `assets/audio/music/menu/${name}.mp3`);

// Uma música por bioma (o nome é o campo `music` em world/biomes).
export const PHASE_MUSIC = {
  beach: 'assets/audio/music/beach.mp3',
  space: 'assets/audio/music/space.mp3',
  desert: 'assets/audio/music/desert.mp3',
  fireFactory: 'assets/audio/music/fire-factory.mp3',
  forestField: 'assets/audio/music/forest-field.mp3',
  jungle: 'assets/audio/music/jungle.mp3',
  neonTokyo: 'assets/audio/music/neon-tokyo.mp3',
  stadium: 'assets/audio/music/stadium.mp3',
  winterMountain: 'assets/audio/music/winter-mountain.mp3',
  windCanyon: 'assets/audio/music/wind-canyon.mp3',
  saltFlats: 'assets/audio/music/salt-flats.mp3',
  stormSwamp: 'assets/audio/music/storm-swamp.mp3',
};


// Ambiente de cada bioma (o nome é o mesmo de PHASE_MUSIC): [som, volume]. Toca por baixo da música durante a corrida.
// Biomas que não aparecem aqui ficam só com a música. O cânion de vento empresta o vento do deserto, e a chuva
// cobre os três biomas em que cai chuva (os de `weather.streak`).
export const PHASE_AMBIENCE = {
  beach: [['ambBeach', 0.8]],
  desert: [['ambDesert', 0.8]],
  windCanyon: [['ambDesert', 1]],
  jungle: [['ambRain', 0.7]],
  neonTokyo: [['ambRain', 0.55]],
  stormSwamp: [['ambRain', 1]],
};
