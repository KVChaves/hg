// Armas de fogo disponíveis. Com toda a munição e sem errar, cada uma causa cerca de 1000 de dano;
// o preço (`price`, em reais) depende de quão fácil é aproveitar esse dano numa corrida.

export const WEAPON_TYPES = {
  revolver: {
    id: 'revolver', family: 'revolver', label: 'REVOLVER', price: 180, summary: 'PRECISO A MEIA DISTANCIA',
    damage: 34, interval: 0.38, range: 160, magazine: 6, reserve: 24, roundTime: 0.42, recoil: 1,
  },
  shotgun: {
    id: 'shotgun', family: 'shotgun', label: 'ESCOPETA', price: 260, summary: 'DEVASTADORA DE PERTO',
    damage: 80, falloff: { full: 15, zero: 50, min: 5 }, interval: 0.45, range: 60,
    magazine: 2, reserve: 10, roundTime: 0.6, recoil: 1.5,
  },
  smg: {
    id: 'smg', family: 'smg', label: 'SUBMETRALHADORA', price: 300, summary: 'SEGURE O CLIQUE',
    damage: 11, interval: 0.09, range: 110, magazine: 30, reserve: 60, roundTime: 1.6, recoil: 0.35,
    automatic: true, reloadsWholeMagazine: true, bloom: { perShot: 0.012, max: 0.07, decay: 0.12 },
  },
  rifle: {
    id: 'rifle', family: 'rifle', label: 'RIFLE', price: 240, summary: 'LONGO ALCANCE E TIRO LENTO',
    damage: 55, interval: 0.85, range: 230, magazine: 5, reserve: 13, roundTime: 0.55, recoil: 1.3,
  },
  magnum: {
    id: 'magnum', family: 'revolver', style: 'topbreak', label: 'REVOLVER PESADO', price: 230, summary: 'DEVAGAR E PESADO',
    damage: 70, interval: 0.75, range: 150, magazine: 4, reserve: 10, roundTime: 0.5, recoil: 1.8,
  },
  sniper: {
    id: 'sniper', family: 'rifle', style: 'bolt', label: 'SNIPER', price: 280, summary: 'UM TIRO, ALCANCE ENORME',
    damage: 120, interval: 1.6, range: 320, magazine: 1, reserve: 7, roundTime: 0.9, recoil: 2.2,
  },
  autoshotgun: {
    id: 'autoshotgun', family: 'shotgun', style: 'autoshotgun', label: 'ESCOPETA AUTO', price: 300, summary: 'ESCOPETA QUE ATIRA SEGURANDO',
    damage: 40, falloff: { full: 12, zero: 40, min: 4 }, interval: 0.28, range: 50, magazine: 6, reserve: 18, roundTime: 0.45, recoil: 1.2,
    automatic: true, bloom: { perShot: 0.02, max: 0.08, decay: 0.15 },
  },
  // `burn`: segundos em chamas para o carro atingido; errando, a flecha deixa o chão queimando (game/burning.js).
  crossbow: {
    id: 'crossbow', family: 'rifle', style: 'crossbow', label: 'BESTA INCENDIARIA', price: 280, summary: 'FLECHA QUE INCENDEIA CARRO E CHAO',
    damage: 100, burn: 8, tracer: 0xff7a20, interval: 1.25, range: 140, magazine: 1, reserve: 8, roundTime: 1, recoil: 1.4,
  },
  // `splash`: explode onde acerta (ou no chão, se errar) e machuca quem estiver em volta, menos quanto mais longe.
  grenade: {
    id: 'grenade', family: 'shotgun', style: 'pump', label: 'LANCA-GRANADAS', price: 340, summary: 'GRANADA QUE EXPLODE EM AREA',
    damage: 85, splash: { radius: 7, min: 0.35 }, tracer: 0xb0b070, interval: 1.1, range: 120, magazine: 3, reserve: 8, roundTime: 0.75, recoil: 1.7,
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
