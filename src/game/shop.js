import { partsCost } from './carUpgrades.js';
import { TRAP_TYPES } from './trapTypes.js';
import { WEAPON_TYPES } from './weaponTypes.js';
import { weaponPartsCost } from './weaponParts.js';

// Orçamento de cada piloto. Arma e itens têm o preço em weaponTypes e trapTypes; aqui ficam as melhorias.
// O preço de um nível é o total até ele, então descer um nível devolve a diferença.
// Personalização visual é de graça.

export const BUDGET = 1150;

export const UPGRADES = {
  life: { label: 'VIDA', levels: [{ price: 0, factor: 1 }, { price: 140, factor: 1.2 }, { price: 290, factor: 1.4 }, { price: 480, factor: 1.65 }] },
  nitro: { label: 'NITRO', levels: [{ price: 0, factor: 1 }, { price: 70, factor: 1.3 }, { price: 140, factor: 1.6 }, { price: 230, factor: 2 }] },
  ammo: { label: 'MUNICAO', levels: [{ price: 0, factor: 1 }, { price: 70, factor: 1.2 }, { price: 150, factor: 1.4 }, { price: 250, factor: 1.8 }] },
};

export const NO_UPGRADES = { life: 0, nitro: 0, ammo: 0 };
export const maxUpgradeLevel = id => UPGRADES[id].levels.length - 1;
export const upgradeFactor = (id, level) => UPGRADES[id].levels[level].factor;
export const upgradePrice = (id, level) => UPGRADES[id].levels[level].price;

// `loadout` é { weaponId, trunk, upgrades, parts, weaponParts }; `trunk` é { idDoItem: quantidade } e itens ausentes valem 0.
// `weaponParts` guarda as peças de combate de cada arma ({ idDaArma: { barrel, grip, magazine, ammo } }); só as da
// arma equipada entram na conta.
export const trunkCost = trunk => Object.entries(trunk).reduce((sum, [id, count]) => sum + (TRAP_TYPES[id] ? TRAP_TYPES[id].price * count : 0), 0);
export const trunkUnits = trunk => Object.values(trunk).reduce((sum, count) => sum + count, 0);

export function loadoutCost({ weaponId, trunk, upgrades, parts: carParts, weaponParts }) {
  const items = trunkCost(trunk);
  const upgradesCost = Object.keys(UPGRADES).reduce((sum, id) => sum + upgradePrice(id, upgrades[id]), 0);
  return WEAPON_TYPES[weaponId].price + weaponPartsCost(weaponId, weaponParts?.[weaponId]) + items + upgradesCost + partsCost(carParts);
}

export const fitsBudget = loadout => loadoutCost(loadout) <= BUDGET;
