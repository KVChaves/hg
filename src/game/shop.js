import { partsCost } from './carUpgrades.js';
import { TRAP_TYPES } from './trapTypes.js';
import { WEAPON_TYPES } from './weaponTypes.js';

// Orçamento de cada piloto. Arma e itens têm o preço em weaponTypes e trapTypes; aqui ficam as melhorias.
// O preço de um nível é o total até ele, então descer um nível devolve a diferença.
// Personalização visual é de graça.

export const BUDGET = 1000;

export const UPGRADES = {
  life: { label: 'VIDA', levels: [{ price: 0, factor: 1 }, { price: 120, factor: 1.2 }, { price: 250, factor: 1.4 }, { price: 420, factor: 1.7 }] },
  nitro: { label: 'NITRO', levels: [{ price: 0, factor: 1 }, { price: 80, factor: 1.25 }, { price: 170, factor: 1.5 }, { price: 280, factor: 2 }] },
  ammo: { label: 'MUNICAO', levels: [{ price: 0, factor: 1 }, { price: 60, factor: 1.25 }, { price: 130, factor: 1.5 }, { price: 220, factor: 2 }] },
};

export const NO_UPGRADES = { life: 0, nitro: 0, ammo: 0 };
export const maxUpgradeLevel = id => UPGRADES[id].levels.length - 1;
export const upgradeFactor = (id, level) => UPGRADES[id].levels[level].factor;
export const upgradePrice = (id, level) => UPGRADES[id].levels[level].price;

// `loadout` é { weaponId, trapIds, trapCounts, upgrades, parts }; vagas vazias do bagageiro são null.
export function loadoutCost({ weaponId, trapIds, trapCounts, upgrades, parts: carParts }) {
  const items = trapIds.reduce((sum, id, slot) => sum + (id ? TRAP_TYPES[id].price * trapCounts[slot] : 0), 0);
  const upgradesCost = Object.keys(UPGRADES).reduce((sum, id) => sum + upgradePrice(id, upgrades[id]), 0);
  return WEAPON_TYPES[weaponId].price + items + upgradesCost + partsCost(carParts);
}

export const fitsBudget = loadout => loadoutCost(loadout) <= BUDGET;
