// Armas de fogo disponíveis. Com toda a munição e sem errar, cada uma causa cerca de 1000 de dano;
// o preço (`price`, em reais) depende de quão fácil é aproveitar esse dano numa corrida.

export const WEAPON_TYPES = {
  revolver: {
    id: 'revolver', label: 'REVOLVER', price: 150, summary: 'PRECISO A MEIA DISTANCIA',
    damage: 34, interval: 0.38, range: 160, magazine: 6, reserve: 24, roundTime: 0.42, recoil: 1,
  },
  shotgun: {
    id: 'shotgun', label: 'ESCOPETA', price: 260, summary: 'DEVASTADORA DE PERTO',
    damage: 80, falloff: { full: 15, zero: 50, min: 5 }, interval: 0.45, range: 60,
    magazine: 2, reserve: 12, roundTime: 0.6, recoil: 1.5,
  },
  smg: {
    id: 'smg', label: 'SUBMETRALHADORA', price: 300, summary: 'SEGURE O CLIQUE',
    damage: 11, interval: 0.09, range: 110, magazine: 30, reserve: 60, roundTime: 1.6, recoil: 0.35,
    automatic: true, reloadsWholeMagazine: true, bloom: { perShot: 0.012, max: 0.07, decay: 0.12 },
  },
  rifle: {
    id: 'rifle', label: 'RIFLE', price: 220, summary: 'LONGO ALCANCE E TIRO LENTO',
    damage: 50, interval: 1.1, range: 230, magazine: 5, reserve: 15, roundTime: 0.55, recoil: 1.3,
  },
};

export function damageAtDistance(type, distance) {
  if (!type.falloff) return type.damage;
  const { full, zero, min } = type.falloff;
  const t = Math.max(0, Math.min(1, (distance - full) / (zero - full)));
  return type.damage + (min - type.damage) * t;
}
