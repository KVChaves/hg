import { PARTS } from './parts/index.js';

// Peças escolhidas pelo jogador, salvas no navegador.
const STORAGE_KEY = 'halfgrip.loadout';

export function loadLoadout() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { /* sem armazenamento: usa o padrão */ }

  const loadout = {}, colors = {};   // cor nula = cor original da peça
  for (const kind in PARTS) {
    loadout[kind] = PARTS[kind].options[saved[kind]] ? saved[kind] : PARTS[kind].default;
    colors[kind] = Number.isInteger(saved.colors?.[kind]) ? saved.colors[kind] : null;
  }
  loadout.colors = colors;
  return loadout;
}

export function saveLoadout(loadout) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(loadout)); } catch { /* sem armazenamento: não persiste */ }
}
