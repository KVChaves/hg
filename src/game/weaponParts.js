import { WEAPON_TYPES } from './weaponTypes.js';

// Peças de combate de cada arma: cano, empunhadura, carregador e munição. Cada variante tem preço (sai do mesmo
// orçamento da garagem, e só conta a da arma equipada) e troca uma vantagem por uma desvantagem.
// `buildWeapon` devolve a arma com as peças aplicadas. O jogador e os bots usam a mesma função, e o `id` continua o
// da arma: aparência, som e animação não mudam (a cor, o padrão e o acessório da oficina seguem só visuais).
//
// Efeitos, como multiplicadores (1 não muda nada):
//   damage     dano por tiro               interval   tempo entre tiros (menor = atira mais rápido)
//   kick       força do recuo              recover    quão rápido a mira volta sozinha
//   bloom      quanto a rajada abre (só nas automáticas)
//   roundTime  tempo de recarga (por bala ou pelo pente inteiro)
//   reserve    balas de reserva (a arma começa descarregada, então é o total da corrida)
//   reach      distância em que a escopeta perde o dano (falloff)
// Somas: `magazine` (balas a mais no pente, por arma em EXTRA_ROUNDS), `impact` (balanço por ponto de dano).
// `ammo`: tipo de munição; muda o dano contra escudo e blindagem (ver bulletHit).
//
// O pente só muda de tamanho onde o desenho da arma não mostra as balas (submetralhadora, metralhadora e rifle).
// Alcance não é vantagem vendida: quase todas as armas já alcançam além da distância em que os pilotos se enxergam.

const BULLETS = ['revolver', 'magnum', 'smg', 'heavymg', 'rifle', 'sniper', 'shotgun', 'autoshotgun'];
const SHOTGUNS = ['shotgun', 'autoshotgun'];
// Armas em que o recuo pesa: atiram rápido o bastante para a mira ainda não ter voltado no tiro seguinte. Nas lentas
// (rifle, revólver pesado, sniper, besta, granada) peça de recuo seria vantagem ou desvantagem de graça.
const RECOIL_MATTERS = ['revolver', 'shotgun', 'smg', 'heavymg', 'autoshotgun'];
const ALL = Object.keys(WEAPON_TYPES);
export const EXTRA_ROUNDS = { smg: 10, heavymg: 25, rifle: 2 };
const IMPACT_SHAKE = 0.007;                          // balanço da munição de impacto por ponto de dano do tiro

export const WEAPON_PART_KEYS = ['barrel', 'grip', 'magazine', 'ammo'];
export const DEFAULT_WEAPON_PARTS = { barrel: 'stock', grip: 'stock', magazine: 'stock', ammo: 'stock' };

const STOCK = { name: 'Original', price: 0, summary: 'SEM EFEITO', stats: {}, only: ALL };

export const WEAPON_PARTS = {
  barrel: {
    label: 'Cano', short: 'CANO',
    variants: {
      stock: STOCK,
      compensator: { name: 'Compensador', price: 50, summary: 'RECUO -40%, DANO -8%', stats: { kick: 0.6, damage: 0.92 }, only: RECOIL_MATTERS },
      heavy: { name: 'Pesado', price: 70, summary: 'DANO +15%, ATIRA 20% MAIS DEVAGAR, RESERVA -15%', stats: { damage: 1.15, interval: 1.2, reserve: 0.85 }, only: ALL.filter(id => id !== 'grenade') },
      short: { name: 'Curto', price: 60, summary: 'ATIRA 15% MAIS RAPIDO, RECUO +35%, RAJADA ABRE +25%', stats: { interval: 0.85, kick: 1.35, bloom: 1.25 }, only: RECOIL_MATTERS },
      choke: { name: 'Choke', price: 60, summary: 'O DANO DURA 35% MAIS LONGE, DANO -12%', stats: { reach: 1.35, damage: 0.88 }, only: SHOTGUNS },
    },
  },
  grip: {
    label: 'Empunhadura', short: 'EMPUNH',
    variants: {
      stock: STOCK,
      firm: { name: 'Firme', price: 45, summary: 'A MIRA VOLTA 60% MAIS RAPIDO, RECARGA +15%', stats: { recover: 1.6, roundTime: 1.15 }, only: RECOIL_MATTERS },
      light: { name: 'Leve', price: 45, summary: 'RECARGA -15%, RECUO +25%', stats: { roundTime: 0.85, kick: 1.25 }, only: RECOIL_MATTERS },
    },
  },
  magazine: {
    label: 'Carregador', short: 'PENTE',
    variants: {
      stock: STOCK,
      extended: { name: 'Estendido', price: 60, summary: id => `+${EXTRA_ROUNDS[id]} BALAS NO PENTE, RECARGA +30%`, stats: { magazine: 1, roundTime: 1.3 }, only: Object.keys(EXTRA_ROUNDS) },
      quick: { name: 'Rapido', price: 50, summary: 'RECARGA -25%, RESERVA -20%', stats: { roundTime: 0.75, reserve: 0.8 }, only: ALL },
      belt: { name: 'Cinto', price: 60, summary: 'RESERVA +20%, RECARGA +25%', stats: { reserve: 1.2, roundTime: 1.25 }, only: ALL },
    },
  },
  ammo: {
    label: 'Municao', short: 'MUNIC',
    variants: {
      stock: STOCK,
      pierce: { name: 'Perfurante', price: 60, summary: 'ATRAVESSA METADE DO ESCUDO E DA BLINDAGEM, DANO -12%', stats: { damage: 0.88, ammo: 'pierce' }, only: BULLETS },
      hollow: { name: 'Ponta oca', price: 60, summary: 'DANO +15%, MAS -40% NO ESCUDO E A BLINDAGEM SEGURA O DOBRO', stats: { damage: 1.15, ammo: 'hollow' }, only: BULLETS },
      impact: { name: 'Impacto', price: 50, summary: 'BALANCA O CARRO ATINGIDO, DANO -12%', stats: { damage: 0.88, impact: IMPACT_SHAKE }, only: BULLETS },
    },
  },
};

export const fitsWeapon = (key, variantId, weaponId) => Boolean(WEAPON_PARTS[key].variants[variantId]?.only.includes(weaponId));
// Variantes que essa arma aceita, na ordem da tabela.
export const variantsFor = (key, weaponId) => Object.entries(WEAPON_PARTS[key].variants).filter(([, variant]) => variant.only.includes(weaponId));
export const partSummary = (variant, weaponId) => (typeof variant.summary === 'function' ? variant.summary(weaponId) : variant.summary);

// Peças de uma arma; o que não existe ou não serve nela volta ao original.
export function sanitizeWeaponParts(weaponId, saved) {
  return Object.fromEntries(WEAPON_PART_KEYS.map(key => [key, fitsWeapon(key, saved?.[key], weaponId) ? saved[key] : 'stock']));
}
export function savedWeaponParts(saved) {
  return Object.fromEntries(Object.keys(WEAPON_TYPES).map(id => [id, sanitizeWeaponParts(id, saved?.[id])]));
}

export const weaponPartsCost = (weaponId, parts) => WEAPON_PART_KEYS.reduce((sum, key) => {
  const id = parts?.[key];
  return sum + (fitsWeapon(key, id, weaponId) ? WEAPON_PARTS[key].variants[id].price : 0);
}, 0);

// A arma `weaponId` com as peças `parts` ({ barrel, grip, magazine, ammo }).
export function buildWeapon(weaponId, parts) {
  const base = WEAPON_TYPES[weaponId], chosen = sanitizeWeaponParts(weaponId, parts);
  const m = { damage: 1, interval: 1, kick: 1, recover: 1, bloom: 1, roundTime: 1, reserve: 1, reach: 1, magazine: 0, impact: 0, ammo: null };
  for (const key of WEAPON_PART_KEYS) {
    for (const [name, value] of Object.entries(WEAPON_PARTS[key].variants[chosen[key]].stats)) {
      if (name === 'ammo') m.ammo = value;
      else if (name === 'magazine' || name === 'impact') m[name] += value;
      else m[name] *= value;
    }
  }
  const type = {
    ...base, parts: chosen, ammo: m.ammo,
    damage: base.damage * m.damage,
    interval: base.interval * m.interval,
    roundTime: base.roundTime * m.roundTime,
    reserve: Math.max(1, Math.round(base.reserve * m.reserve)),
    magazine: base.magazine + (m.magazine ? EXTRA_ROUNDS[weaponId] : 0),
    recoil: base.recoil * m.kick,                    // o tranco visual acompanha o recuo de verdade
    kick: { up: base.kick.up * m.kick, side: base.kick.side * m.kick, recover: base.kick.recover * m.recover },
  };
  if (base.spinUp) type.spinUp = { ...base.spinUp, startInterval: base.spinUp.startInterval * m.interval };
  if (base.bloom) type.bloom = { ...base.bloom, perShot: base.bloom.perShot * m.bloom, max: base.bloom.max * m.bloom };
  if (base.falloff) {
    type.falloff = { full: base.falloff.full * m.reach, zero: base.falloff.zero * m.reach, min: base.falloff.min * m.damage };
    type.range = Math.max(base.range, Math.ceil(type.falloff.zero));
  }
  if (m.impact) type.shake = (base.shake ?? 0) + base.damage * m.impact;
  return type;
}

// Dano de bala depois da proteção do alvo. `armor`: fator de dano de bala das peças do carro (1 sem blindagem;
// carUpgrades limita a 0,5). `shielded`: escudo ligado. Devolve o dano e a fração dele que passa direto pelo escudo
// (shield.absorbShield). Vale igual em todos os navegadores: o tipo de munição viaja junto com o acerto.
const PIERCE_SHARE = 0.5, HOLLOW_ARMOR = 2, HOLLOW_SHIELD = 0.6, MIN_ARMOR = 0.2;
export function bulletHit(kind, amount, armor = 1, shielded = false) {
  if (kind === 'pierce') return { amount: amount * (1 - (1 - armor) * PIERCE_SHARE), pierce: PIERCE_SHARE };
  if (kind === 'hollow') return { amount: amount * Math.max(MIN_ARMOR, 1 - (1 - armor) * HOLLOW_ARMOR) * (shielded ? HOLLOW_SHIELD : 1), pierce: 0 };
  return { amount: amount * armor, pierce: 0 };
}
