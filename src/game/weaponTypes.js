// `shake` (escopetas): o carro atingido balança, com giro, empurrão lateral e inclinação; quanto mais perto, mais forte.
// Armas de fogo disponíveis. Com toda a munição e sem errar, cada uma causa cerca de 1000 de dano;
// o preço (`price`, em reais) depende de quão fácil é aproveitar esse dano numa corrida.

export const WEAPON_TYPES = {
  revolver: {
    id: 'revolver', family: 'revolver', label: 'REVOLVER', price: 150, summary: 'PRECISO A MEIA DISTANCIA',
    damage: 34, interval: 0.38, range: 160, magazine: 6, reserve: 24, roundTime: 0.42, recoil: 1,
  },
  shotgun: {
    id: 'shotgun', family: 'shotgun', label: 'ESCOPETA', price: 240, summary: 'DEVASTADORA DE PERTO',
    damage: 92, falloff: { full: 30, zero: 50, min: 5 }, shake: 1.4, interval: 0.45, range: 60,
    magazine: 2, reserve: 10, roundTime: 0.6, recoil: 1.5,
  },
  smg: {
    id: 'smg', family: 'smg', label: 'SUBMETRALHADORA', price: 240, summary: 'SEGURE O CLIQUE',
    damage: 13, interval: 0.09, range: 110, magazine: 30, reserve: 60, roundTime: 1.6, recoil: 0.35,
    automatic: true, reloadsWholeMagazine: true, bloom: { perShot: 0.012, max: 0.07, decay: 0.12 },
  },
  rifle: {
    id: 'rifle', family: 'rifle', label: 'RIFLE', price: 320, summary: 'LONGO ALCANCE E TIRO LENTO',
    damage: 75, interval: 0.75, range: 230, magazine: 5, reserve: 13, roundTime: 0.55, recoil: 1.3,
  },
  magnum: {
    id: 'magnum', family: 'revolver', style: 'topbreak', label: 'REVOLVER PESADO', price: 190, summary: 'DEVAGAR E PESADO',
    damage: 70, interval: 0.75, range: 150, magazine: 4, reserve: 10, roundTime: 0.5, recoil: 1.8,
  },
  sniper: {
    id: 'sniper', family: 'rifle', style: 'bolt', label: 'SNIPER', price: 340, summary: 'UM TIRO, ALCANCE ENORME',
    damage: 105, interval: 1.6, range: 320, magazine: 1, reserve: 7, roundTime: 0.9, recoil: 2.2,
  },
  autoshotgun: {
    id: 'autoshotgun', family: 'shotgun', style: 'autoshotgun', label: 'ESCOPETA AUTO', price: 320, summary: 'ESCOPETA QUE ATIRA SEGURANDO',
    damage: 48, falloff: { full: 30, zero: 42, min: 4 }, shake: 0.8, interval: 0.28, range: 50, magazine: 6, reserve: 18, roundTime: 0.45, recoil: 1.2,
    automatic: true, bloom: { perShot: 0.02, max: 0.08, decay: 0.15 },
  },
  // `burn`: segundos em chamas para o carro atingido; errando, a flecha deixa o chão queimando (game/burning.js).
  crossbow: {
    id: 'crossbow', family: 'rifle', style: 'crossbow', label: 'BESTA INCENDIARIA', price: 300, summary: 'FLECHA QUE INCENDEIA CARRO E CHAO',
    damage: 70, burn: 9, tracer: 0xff7a20, interval: 1.25, range: 140, magazine: 1, reserve: 8, roundTime: 1, recoil: 1.4,
  },
  // `splash`: explode onde acerta (ou no chão, se errar) e machuca quem estiver em volta, menos quanto mais longe.
  grenade: {
    id: 'grenade', family: 'shotgun', style: 'pump', label: 'LANCA-GRANADAS', price: 380, summary: 'GRANADA QUE EXPLODE EM AREA',
    damage: 85, splash: { radius: 7, min: 0.35 }, tracer: 0xb0b070, interval: 1.1, range: 120, magazine: 3, reserve: 8, roundTime: 0.75, recoil: 1.7,
  },
  // `spinUp`: os canos aceleram enquanto o gatilho está apertado. O intervalo vai de `startInterval` (parado) até
  // `interval` (girando no máximo) em `time` segundos, e solto os canos param em `spinDown` segundos.
  // `botBurst`: quantos tiros os bots dão por rajada (o padrão é curto demais para os canos chegarem a girar).
  heavymg: {
    id: 'heavymg', family: 'smg', style: 'gatling', label: 'METRALHADORA', price: 260, summary: 'QUANTO MAIS SEGURA, MAIS RAPIDO',
    damage: 10, interval: 0.06, spinUp: { startInterval: 0.16, time: 0.9, spinDown: 0.9 }, range: 100,
    magazine: 50, reserve: 50, roundTime: 2.4, recoil: 0.45, automatic: true, reloadsWholeMagazine: true, botBurst: [12, 24],
    bloom: { perShot: 0.005, max: 0.1, decay: 0.08 },
  },
};

// Aparência, som e animação seguem a família da arma (revolver, shotgun, smg ou rifle).
export const familyOf = id => WEAPON_TYPES[id]?.family ?? id;

export function damageAtDistance(type, distance) {
  if (!type.falloff) return type.damage;
  const { full, zero, min } = type.falloff;
  const t = Math.max(0, Math.min(1, (distance - full) / (zero - full)));
  return type.damage + (min - type.damage) * t;
}

// Força do balanço no carro atingido a `distance` metros: a mesma queda do dano, com um mínimo para o tiro longe ainda sacudir.
const SHAKE_MIN_SHARE = 0.25;
export function shakeAtDistance(type, distance) {
  if (!type.shake) return 0;
  return type.shake * Math.max(SHAKE_MIN_SHARE, damageAtDistance(type, distance) / type.damage);
}

// Intervalo entre tiros com os canos girando a `spin` (0 parado, 1 no máximo). Armas sem giro atiram sempre no mesmo ritmo.
export function fireInterval(type, spin = 1) {
  if (!type.spinUp) return type.interval;
  return type.spinUp.startInterval + (type.interval - type.spinUp.startInterval) * Math.max(0, Math.min(1, spin));
}

// Giro dos canos depois de `dt` segundos com o gatilho apertado (`held`) ou solto.
export function stepSpin(type, spin, held, dt) {
  if (!type.spinUp) return 0;
  return held ? Math.min(1, spin + dt / type.spinUp.time) : Math.max(0, spin - dt / type.spinUp.spinDown);
}
