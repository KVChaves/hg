// Arquivos de som do jogo.

const CAR = 'assets/audio/car';
const TRAPS = 'assets/audio/traps';

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
  drift: `${CAR}/drift.wav`,
  crash: `${CAR}/crash.wav`,
  carHit: `${CAR}/hit.wav`,
  carPunched: `${CAR}/punched.wav`,
  // Bala batendo na lataria do próprio carro: quatro variações, sorteadas a cada acerto.
  bulletHit1: `${CAR}/bullet-hit-1.wav`,
  bulletHit2: `${CAR}/bullet-hit-2.wav`,
  bulletHit3: `${CAR}/bullet-hit-3.wav`,
  bulletHit4: `${CAR}/bullet-hit-4.wav`,
  // Armadilhas: o nome é o id em game/trapTypes.js. Os espinhos ainda não têm som.
  dynamite: `${TRAPS}/dynamite.wav`,
  oil: `${TRAPS}/oil.wav`,
  paint: `${TRAPS}/paint.wav`,
  smoke: `${TRAPS}/smoke.wav`,
  harpoon: `${TRAPS}/harpoon.wav`,
  harpoonHit: `${TRAPS}/harpoon-hit.wav`,
  extinguisher: `${TRAPS}/extinguisher.wav`,
  // Fogo da besta incendiária: o estalo ao pegar e o laço do próprio carro queimando.
  fire: `${TRAPS}/fire.wav`,
  burning: `${TRAPS}/burning.wav`,
};

// Tocam em sequência em tudo o que não é corrida: menus, salas, garagem e resultados.
export const MENU_MUSIC = ['01', '02', '03', '04', '05'].map(name => `assets/audio/music/menu/${name}.mp3`);

// Uma música por bioma (o nome é o campo `music` em world/biomes).
export const PHASE_MUSIC = {
  fireFactory: 'assets/audio/music/fire-factory.mp3',
  forestField: 'assets/audio/music/forest-field.mp3',
  neonTokyo: 'assets/audio/music/neon-tokyo.mp3',
  stadium: 'assets/audio/music/stadium.mp3',
  winterMountain: 'assets/audio/music/winter-mountain.mp3',
};

