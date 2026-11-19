// Qualidade gráfica escolhida nas configurações. Só muda o que se vê, nunca a corrida: online cada um usa a sua.
// `worldScale`: fração da resolução (VIEW) em que o mundo é desenhado; a cabine e o HUD seguem na resolução cheia.
// `viewLimit`: até onde se enxerga, em metros (a neblina fecha antes disso).
// `mirrorEvery`: o retrovisor redesenha a cada tantos quadros; 0 desliga (vidro escuro).
// `particles`: fração das partículas de clima (poeira, chuva, neve).

export const QUALITY = {
  low: { label: 'BAIXA', worldScale: 0.75, viewLimit: 170, mirrorEvery: 0, particles: 0.35 },
  medium: { label: 'MEDIA', worldScale: 1, viewLimit: 260, mirrorEvery: 3, particles: 0.7 },
  high: { label: 'ALTA', worldScale: 1, viewLimit: Infinity, mirrorEvery: 2, particles: 1 },
};
export const QUALITY_LEVELS = ['low', 'medium', 'high'];
export const DEFAULT_QUALITY = 'high';

export const qualityOf = level => QUALITY[level] ?? QUALITY[DEFAULT_QUALITY];
