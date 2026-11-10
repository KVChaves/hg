// Obstáculos da pista. Quem decide onde e como cada um aparece (cai, tomba, atravessa, fica parado) são os pontos
// de perigo de hazardKinds.js. `damage` é a fração da vida padrão do carro; `hp` é quanto de tiro ele aguenta
// (o revólver dá 34 por tiro); `radius`: a bola de neve rola enquanto atravessa.

export const OBSTACLE_TYPES = {
  stalactite: { id: 'stalactite', hitText: 'NA ESTALACTITE', halfLength: 1.4, halfWidth: 1.3, damage: 0.25, hp: 70, debris: [0x9ad8f0, 0xd8f4ff] },
  snowball: { id: 'snowball', hitText: 'NA BOLA DE NEVE', halfLength: 1.8, halfWidth: 1.8, damage: 0.3, hp: 120, radius: 1.7, debris: [0xe6eef6, 0xb8c8d8] },
  tree: { id: 'tree', hitText: 'NA ARVORE', halfLength: 1.1, length: 9, damage: 0.3, hp: 140, debris: [0x5a3a20, 0x2f7a2a, 0x3a8c30] },
  animal: { id: 'animal', hitText: 'NO ANIMAL', halfLength: 1.6, halfWidth: 1.0, damage: 0.15, hp: 60, debris: [0xc88a3a, 0x2a1a10] },
  rock: { id: 'rock', hitText: 'NA ROCHA', halfLength: 1.7, halfWidth: 1.7, damage: 0.3, hp: 150, debris: [0x7c7870, 0x6a665e] },
  tires: { id: 'tires', hitText: 'NOS PNEUS', halfLength: 1.1, halfWidth: 1.2, damage: 0.12, hp: 40, debris: [0x161618, 0x303034] },
  cones: { id: 'cones', hitText: 'NOS CONES', halfLength: 0.8, halfWidth: 1.7, damage: 0.06, hp: 25, debris: [0xf06a10, 0xf0f0f0] },
  kaiju: { id: 'kaiju', hitText: 'NA GODZILINHA', halfLength: 2.2, halfWidth: 1.8, damage: 0.4, hp: 220, debris: [0x3a9a4a, 0xc03030, 0xffee40] },
  barrels: { id: 'barrels', hitText: 'NOS BARRIS', halfLength: 1.2, halfWidth: 1.4, damage: 0.2, hp: 45, debris: [0xb02820, 0xe8c020] },
  bigTire: { id: 'bigTire', hitText: 'NO PNEU', halfLength: 1.1, halfWidth: 1.4, damage: 0.2, hp: 80, radius: 1.4, debris: [0x161618, 0x303034, 0xf0d020] },
  crates: { id: 'crates', hitText: 'NAS CAIXAS', halfLength: 1.3, halfWidth: 1.6, damage: 0.18, hp: 60, debris: [0x8a6030, 0x9a7038] },
};

