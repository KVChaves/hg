import { WEAPON_TYPES } from './weaponTypes.js';

// Carros que o jogador guardou na garagem: aparência, cabine e compras. Salvos no navegador.

const STORAGE_KEY = 'halfgrip.savedCars';
export const SAVED_CAR_SLOTS = 6;
export const CAR_NAME_LENGTH = 16;

export function loadSavedCars() {
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { /* sem armazenamento: começa vazio */ }
  const slots = Array.from({ length: SAVED_CAR_SLOTS }, (_, i) => (Array.isArray(saved) && saved[i]) || null);
  // Arma que saiu do jogo (o lança-chamas, por exemplo) vira o revólver.
  for (const slot of slots) if (slot?.equipment && !WEAPON_TYPES[slot.equipment.weaponId]) slot.equipment.weaponId = 'revolver';
  return slots;
}

export function storeSavedCars(slots) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(slots)); } catch { /* sem armazenamento: vale só nesta sessão */ }
}
