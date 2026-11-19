// Obstáculos da pista. Quem decide onde e como cada um aparece (cai, tomba, atravessa, fica parado) são os pontos
// de perigo de hazardKinds.js. `keep` é a fração da velocidade que sobra na batida e `spin` o giro causado; `damage` é a fração da vida padrão do carro; `hp` é quanto de tiro ele aguenta
// (o revólver dá 34 por tiro); `radius`: a bola de neve rola enquanto atravessa.

export const OBSTACLE_TYPES = {
  stalactite: { id: 'stalactite', keep: 0.45, spin: 0, hitText: 'NA ESTALACTITE', halfLength: 1.4, halfWidth: 1.3, damage: 0.25, hp: 70, debris: [0x9ad8f0, 0xd8f4ff] },
  snowball: { id: 'snowball', keep: 0.35, spin: 1.2, hitText: 'NA BOLA DE NEVE', halfLength: 1.8, halfWidth: 1.8, damage: 0.3, hp: 120, radius: 1.7, debris: [0xe6eef6, 0xb8c8d8] },
  tree: { id: 'tree', keep: 0.2, spin: 1.5, hitText: 'NA ARVORE', halfLength: 1.1, length: 9, damage: 0.3, hp: 140, debris: [0x5a3a20, 0x2f7a2a, 0x3a8c30] },
  animal: { id: 'animal', keep: 0.6, spin: 0.8, hitText: 'NO ANIMAL', halfLength: 1.6, halfWidth: 1.0, damage: 0.15, hp: 60, debris: [0xc88a3a, 0x2a1a10] },
  rock: { id: 'rock', keep: 0.15, spin: 2.0, hitText: 'NA ROCHA', halfLength: 1.7, halfWidth: 1.7, damage: 0.3, hp: 150, debris: [0x7c7870, 0x6a665e] },
  tires: { id: 'tires', keep: 0.6, spin: 0.6, hitText: 'NOS PNEUS', halfLength: 1.1, halfWidth: 1.2, damage: 0.12, hp: 40, debris: [0x161618, 0x303034] },
  cones: { id: 'cones', keep: 0.9, spin: 0, hitText: 'NOS CONES', halfLength: 0.8, halfWidth: 1.7, damage: 0.06, hp: 25, debris: [0xf06a10, 0xf0f0f0] },
  kaiju: { id: 'kaiju', keep: 0.12, spin: 2.2, hitText: 'NA GODZILINHA', halfLength: 2.2, halfWidth: 1.8, damage: 0.4, hp: 220, debris: [0x3a9a4a, 0xc03030, 0xffee40] },
  barrels: { id: 'barrels', keep: 0.5, spin: 1.0, hitText: 'NOS BARRIS', halfLength: 1.2, halfWidth: 1.4, damage: 0.2, hp: 45, debris: [0xb02820, 0xe8c020] },
  bigTire: { id: 'bigTire', keep: 0.5, spin: 1.2, hitText: 'NO PNEU', halfLength: 1.1, halfWidth: 1.4, damage: 0.2, hp: 80, radius: 1.4, debris: [0x161618, 0x303034, 0xf0d020] },
  tumbleweed: { id: 'tumbleweed', keep: 0.85, spin: 0, hitText: 'NO MATO SECO', halfLength: 1.3, halfWidth: 1.3, damage: 0.1, hp: 30, radius: 1.2, debris: [0xb89a5a, 0x8a6e3a] },
  camel: { id: 'camel', keep: 0.4, spin: 1.2, hitText: 'NO CAMELO', halfLength: 1.9, halfWidth: 1.0, damage: 0.25, hp: 110, debris: [0xc89a5a, 0x8a6a3a] },
  cactus: { id: 'cactus', keep: 0.5, spin: 0.8, hitText: 'NO CACTO', halfLength: 1.0, halfWidth: 1.1, damage: 0.2, hp: 70, debris: [0x3a8a3a, 0x5aa84a, 0xe8a0c0] },
  pillar: { id: 'pillar', keep: 0.15, spin: 1.8, hitText: 'NA COLUNA DE ARENITO', halfLength: 1.2, length: 9, damage: 0.32, hp: 150, debris: [0xc88a50, 0xa86a38, 0xe0b078] },
  crab: { id: 'crab', keep: 0.85, spin: 0, hitText: 'NO SIRI', halfLength: 0.9, halfWidth: 0.9, damage: 0.1, hp: 30, debris: [0xd84a2a, 0xf08060] },
  beachBall: { id: 'beachBall', keep: 0.85, spin: 0.3, hitText: 'NA BOLA DE PRAIA', halfLength: 1.3, halfWidth: 1.3, damage: 0.12, hp: 30, radius: 1.3, debris: [0xe83a3a, 0xf0d030, 0x3a7ae8, 0xffffff] },
  umbrella: { id: 'umbrella', keep: 0.7, spin: 0.4, hitText: 'NO GUARDA-SOL', halfLength: 1.0, halfWidth: 1.6, damage: 0.15, hp: 45, debris: [0xe83a3a, 0xffffff, 0xd8b070] },
  coconut: { id: 'coconut', keep: 0.7, spin: 0.4, hitText: 'NO COCO', halfLength: 0.9, halfWidth: 0.9, damage: 0.18, hp: 35, debris: [0x6a4a28, 0xf0ead8] },
  meteor: { id: 'meteor', keep: 0.2, spin: 2.0, hitText: 'NO METEORO', halfLength: 1.5, halfWidth: 1.5, damage: 0.3, hp: 150, debris: [0x4a4440, 0xff8a30, 0x8a8480] },
  rover: { id: 'rover', keep: 0.3, spin: 1.5, hitText: 'NO ROVER', halfLength: 2.0, halfWidth: 1.3, damage: 0.25, hp: 120, debris: [0xd8d8e0, 0x2848a8, 0x303038] },
  antenna: { id: 'antenna', keep: 0.25, spin: 1.2, hitText: 'NA ANTENA', halfLength: 1.0, length: 9, damage: 0.3, hp: 140, debris: [0xb8bcc8, 0xe84030, 0x6a6e7a] },
  crystal: { id: 'crystal', keep: 0.5, spin: 0.9, hitText: 'NOS CRISTAIS', halfLength: 1.0, halfWidth: 1.4, damage: 0.2, hp: 70, debris: [0x40e0f0, 0xa0f4ff, 0x2a90c0] },
  crates: { id: 'crates', keep: 0.55, spin: 0.7, hitText: 'NAS CAIXAS', halfLength: 1.3, halfWidth: 1.6, damage: 0.18, hp: 60, debris: [0x8a6030, 0x9a7038] },
};

