import { fitsBudget, maxUpgradeLevel, NO_UPGRADES, UPGRADES } from './shop.js';
import { MAX_TRAP_SLOTS, TRAP_TYPES } from './trapTypes.js';
import { WEAPON_TYPES } from './weaponTypes.js';

// Arma, itens do bagageiro e melhorias comprados na garagem, salvos no navegador.
// `trapIds` e `trapCounts` têm sempre uma posição por vaga do bagageiro; vaga vazia é null e 0.
const STORAGE_KEY = 'halfgrip.equipment';
const DEFAULT = { weaponId: 'revolver', trapIds: ['spikes', 'oil', 'dynamite'] };

const quantityFor = (id, saved) => {
  const count = Number(saved);
  return Math.max(1, Math.min(TRAP_TYPES[id].maxCharges, Number.isInteger(count) && count > 0 ? count : TRAP_TYPES[id].charges));
};

// Cada item uma vez só, nas primeiras vagas, com a quantidade salva.
function trunkFrom(ids, counts) {
  const entries = [];
  ids.forEach((id, i) => {
    if (TRAP_TYPES[id] && !entries.some(entry => entry.id === id)) entries.push({ id, count: quantityFor(id, counts?.[i]) });
  });
  return {
    trapIds: Array.from({ length: MAX_TRAP_SLOTS }, (_, i) => entries[i]?.id ?? null),
    trapCounts: Array.from({ length: MAX_TRAP_SLOTS }, (_, i) => entries[i]?.count ?? 0),
  };
}

function savedLevels(saved) {
  const levels = {};
  for (const id of Object.keys(UPGRADES)) {
    const level = Number(saved?.[id]);
    levels[id] = Number.isInteger(level) ? Math.max(0, Math.min(maxUpgradeLevel(id), level)) : 0;
  }
  return levels;
}

export function loadEquipment() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { /* sem armazenamento: usa o padrão */ }

  const equipment = {
    weaponId: WEAPON_TYPES[saved.weaponId] ? saved.weaponId : DEFAULT.weaponId,
    ...trunkFrom(Array.isArray(saved.trapIds) ? saved.trapIds : DEFAULT.trapIds, saved.trapCounts),
    upgrades: savedLevels(saved.upgrades),
  };
  // Se os preços mudaram e a compra salva não cabe mais, desfaz o que for preciso.
  if (!fitsBudget(equipment)) equipment.upgrades = { ...NO_UPGRADES };
  if (!fitsBudget(equipment)) Object.assign(equipment, { weaponId: DEFAULT.weaponId, ...trunkFrom(DEFAULT.trapIds) });
  return equipment;
}

export function saveEquipment(equipment) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(equipment)); } catch { /* sem armazenamento: não persiste */ }
}
