// Arquivos de som do jogo.

const CAR = 'assets/audio/car';
const TRAPS = 'assets/audio/traps';
const EFFECTS = 'assets/audio/effects';

export const SOUND_FILES = {
  engineIdle: `${CAR}/engine-idle.wav`,
  engineLow: `${CAR}/engine-low.wav`,
  engineMid: `${CAR}/engine-mid.wav`,
  engineHigh: `${CAR}/engine-high.wav`,
  accelerate: `${CAR}/accelerate.mp3`,
  gearShift: `${CAR}/gear-shift.mp3`,
  horn: `${CAR}/horn.wav`,
  start: `${CAR}/start.mp3`,
  raceFinish: 'assets/audio/effects/race-finish.mp3',
  itemCollected: 'assets/audio/effects/item-collected.mp3',
  uiClick: 'assets/audio/effects/ui-click.mp3',
  uiHover: `${EFFECTS}/ui-hover.mp3`,
  // Contagem da largada: um bipe em 3, 2 e 1 e um mais agudo no "vai".
  countdown: `${EFFECTS}/countdown.mp3`,
  countdownGo: `${EFFECTS}/countdown-go.mp3`,
  kill: `${EFFECTS}/kill.mp3`,
  ricochet: `${EFFECTS}/ricochet.mp3`,
  nitro: `${CAR}/nitro.mp3`,
  land: `${CAR}/land.mp3`,
  // Obstáculos quebrando: o material decide o som (veja OBSTACLE_SOUND em game/obstacles.js); o resto usa `crash`.
  obstacleWood: `${EFFECTS}/obstacles/wood.mp3`,
  obstacleFlesh: `${EFFECTS}/obstacles/flesh.mp3`,
  obstacleIce: `${EFFECTS}/obstacles/ice.mp3`,
  obstacleCrystal: `${EFFECTS}/obstacles/crystal.mp3`,
  obstacleRock: `${EFFECTS}/obstacles/rock.mp3`,
  obstacleMetal: `${EFFECTS}/obstacles/metal.mp3`,
  // Trovão: o raio que cai na pista, o que rola perto e o que ronca longe (relâmpagos do céu).
  thunderClose: `${EFFECTS}/thunder-close.mp3`,
  thunderRoll: `${EFFECTS}/thunder-roll.mp3`,
  thunderFar: `${EFFECTS}/thunder-far.mp3`,
  buy: `${EFFECTS}/buy.mp3`,
  message: `${EFFECTS}/message.mp3`,
  // Ambientes em laço (sem emenda); quais tocam em cada bioma está em PHASE_AMBIENCE.
  ambRain: 'assets/audio/ambience/rain.mp3',
  ambBeach: 'assets/audio/ambience/beach.mp3',
  ambDesert: 'assets/audio/ambience/desert.mp3',
  drift: `${CAR}/drift.wav`,
  crash: `${CAR}/crash.mp3`,
  carHit: `${CAR}/hit.mp3`,
  carPunched: `${CAR}/punched.mp3`,
  // Bala batendo na lataria do próprio carro: quatro variações, sorteadas a cada acerto.
  bulletHit1: `${CAR}/bullet-hit-1.mp3`,
  bulletHit2: `${CAR}/bullet-hit-2.mp3`,
  bulletHit3: `${CAR}/bullet-hit-3.mp3`,
  bulletHit4: `${CAR}/bullet-hit-4.mp3`,
  // Armadilhas: o nome é o id em game/trapTypes.js.
  spikes: `${TRAPS}/spikes.mp3`,
  dynamite: `${TRAPS}/dynamite.mp3`,
  oil: `${TRAPS}/oil.mp3`,
  paint: `${TRAPS}/paint.mp3`,
  smoke: `${TRAPS}/smoke.mp3`,
  harpoon: `${TRAPS}/harpoon.mp3`,
  harpoonHit: `${TRAPS}/harpoon-hit.mp3`,
  extinguisher: `${TRAPS}/extinguisher.mp3`,
  // Escudo, EMP e mina teleguiada.
  shield: `${TRAPS}/shield.mp3`,
  // Camuflagem e barreira inflável ainda sem som próprio: usam o do escudo e o da fumaça (o chiado de encher).
  cloak: `${TRAPS}/invisible.mp3`,
  barrier: `${TRAPS}/inflate.mp3`,
  emp: `${TRAPS}/emp.mp3`,
  mineLaunch: `${TRAPS}/mine-launch.mp3`,
  mineStick: `${TRAPS}/mine-stick.mp3`,
  mineBeep: `${TRAPS}/mine-beep.mp3`,
  mine: `${TRAPS}/mine-explosion.mp3`,
  // Fogo da besta incendiária: o estalo ao pegar e o laço do próprio carro queimando.
  fire: `${TRAPS}/fire.mp3`,
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
  kingsRoad: 'assets/audio/music/kings-road.mp3',
  piratePort: 'assets/audio/music/pirate.mp3',   // ainda sem música própria: usa a da praia (troque por pirate-port.mp3)
};


// Ambiente de cada bioma (o nome é o mesmo de PHASE_MUSIC): [som, volume]. Toca por baixo da música durante a corrida.
// Biomas que não aparecem aqui ficam só com a música. O cânion de vento empresta o vento do deserto, e a chuva
// cobre os três biomas em que cai chuva (os de `weather.streak`).
export const PHASE_AMBIENCE = {
  beach: [['ambBeach', 0.8]],
  piratePort: [['ambBeach', 0.7]],
  desert: [['ambDesert', 0.8]],
  windCanyon: [['ambDesert', 1]],
  jungle: [['ambRain', 0.7]],
  neonTokyo: [['ambRain', 0.55]],
  stormSwamp: [['ambRain', 1]],
};
