// Armas de fogo disponíveis. Com toda a munição e sem errar, cada uma causa cerca de 1000 de dano;
// o preço (`price`, em reais) depende de quão fácil é aproveitar esse dano numa corrida.

export const WEAPON_TYPES = {
  revolver: {
    id: 'revolver', family: 'revolver', label: 'REVOLVER', price: 150, summary: 'PRECISO A MEIA DISTANCIA',
    damage: 34, interval: 0.38, range: 160, magazine: 6, reserve: 24, roundTime: 0.42, recoil: 1,
  },
  shotgun: {
    id: 'shotgun', family: 'shotgun', label: 'ESCOPETA', price: 260, summary: 'DEVASTADORA DE PERTO',
    damage: 80, falloff: { full: 15, zero: 50, min: 5 }, interval: 0.45, range: 60,
    magazine: 2, reserve: 12, roundTime: 0.6, recoil: 1.5,
  },
  smg: {
    id: 'smg', family: 'smg', label: 'SUBMETRALHADORA', price: 300, summary: 'SEGURE O CLIQUE',
    damage: 11, interval: 0.09, range: 110, magazine: 30, reserve: 60, roundTime: 1.6, recoil: 0.35,
    automatic: true, reloadsWholeMagazine: true, bloom: { perShot: 0.012, max: 0.07, decay: 0.12 },
  },
  rifle: {
    id: 'rifle', family: 'rifle', label: 'RIFLE', price: 220, summary: 'LONGO ALCANCE E TIRO LENTO',
    damage: 50, interval: 1.1, range: 230, magazine: 5, reserve: 15, roundTime: 0.55, recoil: 1.3,
  },
  magnum: {
    id: 'magnum', family: 'revolver', style: 'revolver', label: 'REVOLVER PESADO', price: 200, summary: 'DEVAGAR E PESADO',
    damage: 70, interval: 0.7, range: 150, magazine: 4, reserve: 10, roundTime: 0.5, recoil: 1.8,
  },
  sniper: {
    id: 'sniper', family: 'rifle', style: 'bolt', label: 'SNIPER', price: 280, summary: 'UM TIRO, ALCANCE ENORME',
    damage: 120, interval: 1.6, range: 320, magazine: 1, reserve: 8, roundTime: 0.9, recoil: 2.2,
  },
  autoshotgun: {
    id: 'autoshotgun', family: 'shotgun', style: 'autoshotgun', label: 'ESCOPETA AUTO', price: 320, summary: 'ESCOPETA QUE ATIRA SEGURANDO',
    damage: 40, falloff: { full: 12, zero: 40, min: 4 }, interval: 0.28, range: 50, magazine: 6, reserve: 18, roundTime: 0.45, recoil: 1.2,
    automatic: true, bloom: { perShot: 0.02, max: 0.08, decay: 0.15 },
  },
  crossbow: {
    id: 'crossbow', family: 'rifle', style: 'crossbow', label: 'BESTA EXPLOSIVA', price: 340, summary: 'FLECHA QUE EXPLODE EM AREA',
    damage: 90, splash: { radius: 6, min: 0.35 }, tracer: 0xff8a30, interval: 1.4, range: 140, magazine: 1, reserve: 8, roundTime: 1.1, recoil: 1.4,
  },
  flamethrower: {
    id: 'flamethrower', family: 'smg', style: 'flame', label: 'LANCA-CHAMAS', price: 260, summary: 'CHAMAS DE CURTO ALCANCE',
    damage: 4, interval: 0.06, range: 16, magazine: 80, reserve: 160, roundTime: 2.2, recoil: 0.1, tracer: 0xff6a18,
    automatic: true, reloadsWholeMagazine: true,
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
