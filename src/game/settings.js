// Configurações do jogador, guardadas no navegador.

// Limites de cada ajuste. `music` é a música da corrida, `menuMusic` a de fora dela e `effects` multiplica todos os efeitos sonoros.
export const SETTINGS_RANGE = { music: [0, 1], menuMusic: [0, 1], effects: [0, 1], sensitivity: [0.25, 3] };

const DEFAULTS = { music: 0.35, effects: 1, sensitivity: 1 };
const MENU_MUSIC_SHARE = 0.5;                        // sem ajuste salvo, a música do menu fica na metade da música da corrida
const STORAGE_KEY = 'halfgrip.settings';

function defaultFor(key, saved) {
  if (key !== 'menuMusic') return DEFAULTS[key];
  return (Number.isFinite(saved.music) ? saved.music : DEFAULTS.music) * MENU_MUSIC_SHARE;
}

export function loadSettings() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { /* sem armazenamento: usa o padrão */ }
  return Object.fromEntries(Object.entries(SETTINGS_RANGE).map(([key, [low, high]]) => {
    const value = Number.isFinite(saved[key]) ? saved[key] : defaultFor(key, saved);
    return [key, Math.max(low, Math.min(high, value))];
  }));
}

export function saveSettings(settings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* sem armazenamento: não persiste */ }
}
