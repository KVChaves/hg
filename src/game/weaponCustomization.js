import { WEAPON_TYPES } from './weaponTypes.js';

// Personalização visual das armas, guardada por arma. Cor nula = cor original.

export const WEAPON_PATTERNS = {
  none: { name: 'Liso' },
  camo: { name: 'Camuflado' },
  tiger: { name: 'Tigre' },
  engraved: { name: 'Gravado' },
  worn: { name: 'Desgastado' },
};

export const WEAPON_ACCESSORIES = {
  revolver: { none: { name: 'Nenhum' }, compensator: { name: 'Compensador' }, laser: { name: 'Mira laser' } },
  shotgun: { none: { name: 'Nenhum' }, shells: { name: 'Porta-cartuchos' }, strap: { name: 'Fita no cabo' } },
  smg: { none: { name: 'Nenhum' }, suppressor: { name: 'Silenciador' }, longMag: { name: 'Pente longo' } },
  rifle: { none: { name: 'Nenhum' }, scope: { name: 'Luneta' }, sling: { name: 'Bandoleira' } },
};

const STORAGE_KEY = 'halfgrip.weapons';
const COLOR_KEYS = ['metal', 'grip', 'pattern', 'flash'];

function sanitize(id, saved = {}) {
  const pattern = WEAPON_PATTERNS[saved.options?.pattern] ? saved.options.pattern : 'none';
  const accessory = WEAPON_ACCESSORIES[id][saved.options?.accessory] ? saved.options.accessory : 'none';
  const colors = Object.fromEntries(COLOR_KEYS.map(key => [key, Number.isInteger(saved.colors?.[key]) ? saved.colors[key] : null]));
  return { options: { pattern, accessory }, colors };
}

export function loadWeaponCustoms() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { /* sem armazenamento: usa o padrão */ }
  return Object.fromEntries(Object.keys(WEAPON_TYPES).map(id => [id, sanitize(id, saved[id])]));
}

export function saveWeaponCustoms(customs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(customs)); } catch { /* sem armazenamento: não persiste */ }
}
