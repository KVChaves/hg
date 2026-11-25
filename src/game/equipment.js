import { DEFAULT_PARTS, isPartId, PART_KEYS } from './carUpgrades.js';
import { fitsBudget, maxUpgradeLevel, NO_UPGRADES, UPGRADES } from './shop.js';
import { TRAP_TYPES } from './trapTypes.js';
import { WEAPON_TYPES } from './weaponTypes.js';
import { DEFAULT_WEAPON_PARTS, savedWeaponParts } from './weaponParts.js';

// Arma, itens do bagageiro e melhorias comprados na garagem, salvos no navegador.
// `trunk` é { idDoItem: quantidade } com todos os tipos de item (0 = não leva), cada um limitado ao seu `maxCharges`.
const STORAGE_KEY = 'halfgrip.equipment';
const DEFAULT = { weaponId: 'revolver', trunk: { spikes: 3, oil: 3, dynamite: 2 } };

const clampCount = (id, value) => {
  const count = Number(value);
  return Number.isInteger(count) ? Math.max(0, Math.min(TRAP_TYPES[id].maxCharges, count)) : 0;
};

export const emptyTrunk = () => Object.fromEntries(Object.keys(TRAP_TYPES).map(id => [id, 0]));

// Aceita o formato atual ({ trunk }) e o antigo de vagas ({ trapIds, trapCounts }).
export function savedTrunk(saved) {
  const trunk = emptyTrunk();
  if (saved?.trunk && typeof saved.trunk === 'object') {
    for (const id of Object.keys(trunk)) trunk[id] = clampCount(id, saved.trunk[id]);
  } else if (Array.isArray(saved?.trapIds)) {
    saved.trapIds.forEach((id, i) => { if (TRAP_TYPES[id]) trunk[id] = Math.max(1, clampCount(id, saved.trapCounts?.[i] ?? TRAP_TYPES[id].charges)); });
  } else {
    return savedTrunk({ trunk: DEFAULT.trunk });
  }
  return trunk;
}

function savedLevels(saved) {
  const levels = {};
  for (const id of Object.keys(UPGRADES)) {
    const level = Number(saved?.[id]);
    levels[id] = Number.isInteger(level) ? Math.max(0, Math.min(maxUpgradeLevel(id), level)) : 0;
  }
  return levels;
}

// Peças de desempenho do carro; qualquer valor desconhecido volta ao padrão.
export function savedParts(saved) {
  return Object.fromEntries(PART_KEYS.map(key => [key, isPartId(key, saved?.[key]) ? saved[key] : DEFAULT_PARTS[key]]));
}

export function loadEquipment() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { /* sem armazenamento: usa o padrão */ }

  const equipment = {
    weaponId: WEAPON_TYPES[saved.weaponId] ? saved.weaponId : DEFAULT.weaponId,
    trunk: savedTrunk(saved),
    upgrades: savedLevels(saved.upgrades),
    parts: savedParts(saved.parts),
    weaponParts: savedWeaponParts(saved.weaponParts),
  };
  // Se os preços mudaram e a compra salva não cabe mais, desfaz o que for preciso.
  if (!fitsBudget(equipment)) equipment.weaponParts[equipment.weaponId] = { ...DEFAULT_WEAPON_PARTS };
  if (!fitsBudget(equipment)) equipment.parts = { ...DEFAULT_PARTS };
  if (!fitsBudget(equipment)) equipment.upgrades = { ...NO_UPGRADES };
  if (!fitsBudget(equipment)) Object.assign(equipment, { weaponId: DEFAULT.weaponId, trunk: savedTrunk({ trunk: DEFAULT.trunk }) });
  return equipment;
}

export function saveEquipment(equipment) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(equipment)); } catch { /* sem armazenamento: não persiste */ }
}
