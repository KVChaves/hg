// Nome do piloto, salvo no navegador. Só usa o que a fonte do jogo desenha; o servidor aplica a mesma regra.

const STORAGE_KEY = 'halfgrip.playerName';
export const NAME_LENGTH = 12;
export const DEFAULT_NAME = 'Piloto';

export function cleanPlayerName(value) {
  const text = String(value).normalize('NFKD').replace(/[^A-Za-z0-9 ]/g, '').replace(/ +/g, ' ').trim();
  return text.slice(0, NAME_LENGTH).trim() || DEFAULT_NAME;
}

export function loadPlayerName() {
  try { return cleanPlayerName(localStorage.getItem(STORAGE_KEY) ?? DEFAULT_NAME); } catch { return DEFAULT_NAME; }
}

export function savePlayerName(name) {
  try { localStorage.setItem(STORAGE_KEY, name); } catch { /* sem armazenamento: vale só nesta sessão */ }
}
