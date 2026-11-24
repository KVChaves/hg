// Pontos de perigo: lugares fixos de cada pista, com motivo no cenário (paredão, guindaste, travessia...), em que
// um obstáculo aparece quando um carro chega perto. Depois o ponto recarrega. Os biomas pedem os seus em
// `layout.hazards` ([{ kind, count }]); hazardSites.js desenha o cenário e obstacles.js faz o resto.
//
// `obstacle`: tipo (ou lista, sorteada) de obstacleTypes.js. `motion`:
//   drop   — cai do alto (`height` m) numa faixa `lanes` [de, até] do lado do ponto, com sombra e poeira antes;
//   topple — árvore que fica de pé inclinada e tomba atravessando a pista, balançando antes;
//   cross  — atravessa a pista de um lado para o outro a `speed` m/s, depois de esperar na beira;
//   static — fica na faixa interditada até alguém bater (ou quebrar a tiro);
//   drive  — anda pela pista no sentido da corrida a `speed` m/s numa faixa `lanes` do lado do ponto, por `travel`
//            metros (a reta que o ponto reserva), e então para. Sai quando todos passaram.
// `warning`: segundos de aviso antes de ficar perigoso. `range`: metros à frente do carro em que o ponto dispara;
// é calculado para o perigo ficar pronto mais ou menos quando o carro chega. `idle`: o obstáculo já fica no
// lugar, esperando (árvore torta, obras). `opening`: abre o muro nesse ponto, para a travessia vir de fora.
// `atTunnel`: fica logo depois da entrada de um túnel fechado. `zone`: só dentro desse trecho da pista (track.zones,
// como a mata fechada da Estrada do Rei).

export const HAZARD_KINDS = {
  rockfall: { obstacle: 'rock', motion: 'drop', height: 14, lanes: [0.5, 4.5], warning: 1.3, range: 62 },
  icicles: { obstacle: 'stalactite', motion: 'drop', height: 6.5, lanes: [-4, 4], warning: 1.1, range: 58, atTunnel: true },
  snowslope: { obstacle: 'snowball', motion: 'cross', speed: 9, warning: 0.8, range: 66, opening: true },
  leaningTree: { obstacle: 'tree', motion: 'topple', warning: 1.1, range: 58, idle: true },
  animalCrossing: { obstacle: 'animal', motion: 'cross', speed: 5, warning: 0.9, range: 72, opening: true },
  crane: { obstacle: ['barrels', 'crates'], motion: 'drop', height: 13, lanes: [1.5, 4.5], warning: 1.4, range: 64 },
  roadworks: { obstacle: ['cones', 'tires'], motion: 'static', lanes: [2.5, 4], idle: true },
  pitTires: { obstacle: 'bigTire', motion: 'cross', speed: 10, warning: 0.8, range: 70, opening: true },
  tumbleweeds: { obstacle: 'tumbleweed', motion: 'cross', speed: 11, warning: 0.7, range: 68, opening: true },
  camelCrossing: { obstacle: 'camel', motion: 'cross', speed: 3.4, warning: 1.2, range: 80, opening: true },
  cactusPatch: { obstacle: 'cactus', motion: 'static', lanes: [2.5, 4.2], idle: true },
  sandPillar: { obstacle: 'pillar', motion: 'topple', warning: 1.2, range: 60, idle: true },
  crabCrossing: { obstacle: 'crab', motion: 'cross', speed: 6, warning: 0.9, range: 70, opening: true },
  beachBalls: { obstacle: 'beachBall', motion: 'cross', speed: 9, warning: 0.8, range: 68, opening: true },
  umbrellaPatch: { obstacle: 'umbrella', motion: 'static', lanes: [2.5, 4.2], idle: true },
  coconutFall: { obstacle: 'coconut', motion: 'drop', height: 11, lanes: [-4.5, 4.5], warning: 1.1, range: 58 },
  meteorShower: { obstacle: 'meteor', motion: 'drop', height: 22, lanes: [-4.5, 4.5], warning: 1.3, range: 66 },
  roverCrossing: { obstacle: 'rover', motion: 'cross', speed: 4, warning: 1.3, range: 85, opening: true },
  brokenAntenna: { obstacle: 'antenna', motion: 'topple', warning: 1.1, range: 58, idle: true },
  crystalPatch: { obstacle: 'crystal', motion: 'static', lanes: [2.5, 4.2], idle: true },
  deerCrossing: { obstacle: 'deer', motion: 'cross', speed: 7, warning: 0.8, range: 70, opening: true, zone: 'forest' },
  boarCrossing: { obstacle: 'boar', motion: 'cross', speed: 11, warning: 0.6, range: 64, opening: true, zone: 'forest' },
  carriage: { obstacle: 'carriage', motion: 'drive', speed: 3.5, lanes: [2.6, 5.2], travel: 100, idle: true },
  // `arc` (só no canhão): a bala sai do costado do navio, a `from` m do centro, `muzzle` m de altura, e voa em arco
  // de `apex` m até a mira em `time` s; enquanto avisa, a mira pisca no chão (obstacles.js).
  cannonFire: { obstacle: 'cannonball', motion: 'drop', height: 24, lanes: [-5, 5], warning: 1.6, range: 75, arc: { from: 14.5, muzzle: 2.2, apex: 7, time: 0.8 } },
  barrelRoll: { obstacle: 'rollingBarrel', motion: 'cross', speed: 8, warning: 0.8, range: 68, opening: true },
  kaijuCrossing: { obstacle: 'kaiju', motion: 'cross', speed: 3.2, warning: 1.5, range: 95, opening: true },
};
