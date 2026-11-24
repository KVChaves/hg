// Qualidade gráfica escolhida nas configurações. Só muda o que se vê, nunca a corrida: online cada um usa a sua.
// `worldScale`: fração da resolução (VIEW) em que o mundo é desenhado; a cabine e o HUD seguem na resolução cheia.
// `viewLimit`: até onde se enxerga, em metros (a neblina fecha antes disso).
// `mirrorEvery`: o retrovisor redesenha a cada tantos quadros; 0 desliga (vidro escuro).
// `particles`: fração das partículas de clima (poeira, chuva, neve).
// `props`: fração das árvores, moitas e enfeites espalhados (scatter/nearRoad); as fileiras da beira ficam inteiras.
// `foliage`: detalhe dos tufos de copa e moita (0: 20 triângulos por tufo; 1: 80).

export const QUALITY = {
  low: { label: 'BAIXA', worldScale: 0.75, viewLimit: 170, mirrorEvery: 0, particles: 0.35, props: 0.5, foliage: 0 },
  medium: { label: 'MEDIA', worldScale: 1, viewLimit: 260, mirrorEvery: 3, particles: 0.7, props: 0.75, foliage: 0 },
  high: { label: 'ALTA', worldScale: 1, viewLimit: Infinity, mirrorEvery: 2, particles: 1, props: 1, foliage: 1 },
};
export const QUALITY_LEVELS = ['low', 'medium', 'high'];
export const DEFAULT_QUALITY = 'high';

export const qualityOf = level => QUALITY[level] ?? QUALITY[DEFAULT_QUALITY];

// Qualidade com que o cenário é montado. Vale a partir do próximo mapa carregado (as peças são feitas na montagem).
let scenery = qualityOf(DEFAULT_QUALITY);
export const sceneryQuality = () => scenery;
export const useSceneryQuality = level => { scenery = qualityOf(level); };
