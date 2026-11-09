// Carros que o jogador guardou na garagem: aparência, cabine e compras. Salvos no navegador.

const STORAGE_KEY = 'halfgrip.savedCars';
export const SAVED_CAR_SLOTS = 6;
export const CAR_NAME_LENGTH = 16;

export function loadSavedCars() {
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { /* sem armazenamento: começa vazio */ }
  return Array.from({ length: SAVED_CAR_SLOTS }, (_, i) => (Array.isArray(saved) && saved[i]) || null);
}

export function storeSavedCars(slots) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(slots)); } catch { /* sem armazenamento: vale só nesta sessão */ }
}
