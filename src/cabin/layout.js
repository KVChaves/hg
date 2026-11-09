// Onde cada elemento fica na tela, em pixels da resolução interna (640x360).
// O enquadramento segue a imagem de referência.

export const LAYOUT = {
  wheel: { x: 272, y: 312 },            // centro do volante
  instruments: { x: 234, y: 271 },      // canto superior esquerdo
  // Entre o volante e o câmbio, fora do alcance de qualquer volante girando.
  trapDisplay: { x: 344, y: 236 },
  trapButton: { x: 356, y: 258 },       // botão que solta a armadilha, logo abaixo do indicador
  trapButtonSize: 16,
  ammo: { x: 503, y: 252 },
  nitro: { x: 468, y: 280 },
  nitroNozzle: { x: 490, y: 280 },      // saída do fogo
  nitroValve: { x: 520, y: 298 },       // onde a mão abre o registro
  health: { x: 73, y: 160 },
  mirror: { x: 328, y: 62 },
  scoreboard: { x: 535, y: 38 },
  charm: { x: 380, y: 100 },            // ponto do retrovisor de onde o enfeite pende
  // Pontos da grade em H onde a base da alavanca encosta.
  gate: { columns: [400, 417, 433], rows: [292, 307, 322] },
};

// Profundidade de cada camada (quanto menor, mais perto do olho).
export const DEPTH = { wheel: 0.5, shifter: 0.55, gauges: 0.7, charm: 0.71, mirrorFrame: 0.72, mirrorGlass: 0.74, shell: 1, windshield: 1.02 };
