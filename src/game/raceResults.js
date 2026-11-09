// Ranking local: as melhores corridas deste navegador. Melhor posição primeiro; no empate, o menor tempo.

const STORAGE_KEY = 'halfgrip.ranking';
const MAX_RESULTS = 10;

export function loadRaceResults() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

// `result` é { position, racers (quantos correram), time (segundos), kills }.
export function addRaceResult(result) {
  const results = [...loadRaceResults(), result]
    .sort((a, b) => a.position - b.position || a.time - b.time)
    .slice(0, MAX_RESULTS);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(results)); } catch { /* sem armazenamento: não persiste */ }
}
