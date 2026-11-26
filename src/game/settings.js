// Configurações do jogador, guardadas no navegador.

import { DEFAULT_QUALITY, QUALITY_LEVELS } from './quality.js';
import { sanitizeCrosshair } from '../ui/crosshair.js';

// Limites de cada ajuste. `music` é a música da corrida, `menuMusic` a de fora dela e `effects` multiplica todos os efeitos sonoros.
export const SETTINGS_RANGE = { music: [0, 1], menuMusic: [0, 1], effects: [0, 1], sensitivity: [0.25, 3] };

// Ações que o jogador pode remapear: cada uma tem duas teclas (ou botões do mouse: Mouse0 esquerdo, Mouse1 meio, Mouse2 direito).
export const ACTIONS = [
  { id: 'accelerate', label: 'ACELERAR', keys: ['KeyW', 'ArrowUp'] },
  { id: 'brake', label: 'FREAR / RE', keys: ['KeyS', 'ArrowDown'] },
  { id: 'left', label: 'ESQUERDA', keys: ['KeyA', 'ArrowLeft'] },
  { id: 'right', label: 'DIREITA', keys: ['KeyD', 'ArrowRight'] },
  { id: 'nitro', label: 'NITRO', keys: ['Space', ''] },
  { id: 'handbrake', label: 'FREIO DE MAO', keys: ['ShiftLeft', 'ShiftRight'] },
  { id: 'horn', label: 'BUZINA', keys: ['KeyH', ''] },
  { id: 'fire', label: 'ATIRAR', keys: ['Mouse0', ''] },
  { id: 'aim', label: 'MIRAR', keys: ['Mouse2', ''] },
  { id: 'reload', label: 'RECARREGAR', keys: ['KeyR', ''] },
  { id: 'trap', label: 'USAR ITEM', keys: ['KeyE', ''] },
  { id: 'recenter', label: 'CENTRALIZAR CAMERA', keys: ['KeyC', ''] },
  { id: 'rearView', label: 'OLHAR PARA TRAS', keys: ['KeyQ', ''] },
  { id: 'scoreboard', label: 'TABELA DA PARTIDA', keys: ['Tab', ''] },
  { id: 'chat', label: 'ABRIR CHAT', keys: ['Enter', ''] },
];
export const defaultBindings = () => Object.fromEntries(ACTIONS.map(action => [action.id, [...action.keys]]));

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
  const settings = Object.fromEntries(Object.entries(SETTINGS_RANGE).map(([key, [low, high]]) => {
    const value = Number.isFinite(saved[key]) ? saved[key] : defaultFor(key, saved);
    return [key, Math.max(low, Math.min(high, value))];
  }));
  settings.quality = QUALITY_LEVELS.includes(saved.quality) ? saved.quality : DEFAULT_QUALITY;   // qualidade gráfica (game/quality.js)
  settings.crosshair = sanitizeCrosshair(saved.crosshair);                                       // mira da arma (ui/crosshair.js)
  const savedBindings = saved.bindings ?? {};
  settings.bindings = Object.fromEntries(ACTIONS.map(({ id, keys }) => {
    const slots = savedBindings[id];
    return [id, Array.isArray(slots) && slots.length === 2 && slots.every(code => typeof code === 'string') ? [...slots] : [...keys]];
  }));
  return settings;
}

export function saveSettings(settings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* sem armazenamento: não persiste */ }
}

const CODE_NAMES = {
  Space: 'ESPACO', ShiftLeft: 'SHIFT ESQ', ShiftRight: 'SHIFT DIR', ControlLeft: 'CTRL ESQ', ControlRight: 'CTRL DIR', AltLeft: 'ALT ESQ', AltRight: 'ALT DIR',
  ArrowUp: 'SETA CIMA', ArrowDown: 'SETA BAIXO', ArrowLeft: 'SETA ESQ', ArrowRight: 'SETA DIR', Enter: 'ENTER', Tab: 'TAB', Backspace: 'BACKSPACE',
  Mouse0: 'MOUSE ESQ', Mouse1: 'MOUSE MEIO', Mouse2: 'MOUSE DIR', Backquote: '`', Minus: '-', Equal: '=', Comma: ',', Period: '.', Slash: '/', Semicolon: ';',
};

// Nome curto de uma tecla na fonte do jogo (só maiúsculas, números e alguns símbolos).
export function codeLabel(code) {
  if (!code) return '-';
  if (CODE_NAMES[code]) return CODE_NAMES[code];
  return code.replace(/^Key|^Digit/, '').replace(/^Numpad/, 'NUM ').toUpperCase().replace(/[^A-Z0-9 ]/g, '');
}

// As teclas de uma ação, juntas: "W / SETA CIMA".
export const bindingLabel = (settings, action) => settings.bindings[action].filter(Boolean).map(codeLabel).join(' / ') || '-';
