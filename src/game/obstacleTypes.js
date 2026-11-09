// Obstáculos da pista: aparecem à frente do líder, ficam até alguém bater (ou quebrarem a tiro) e variam por bioma.
// `behavior`: drop (pende do alto e cai quando alguém chega perto), topple (árvore que tomba atravessando a pista),
// roll (rola pela pista e para), wander (anda de um lado a outro) e static (fica parado).
// `damage` é a fração da vida padrão do carro; `hp` é quanto de tiro ele aguenta (o revólver dá 34 por tiro).

export const OBSTACLE_TYPES = {
  stalactite: { id: 'stalactite', behavior: 'drop', hitText: 'NA ESTALACTITE', halfLength: 1.4, halfWidth: 1.3, damage: 0.25, hp: 70, debris: [0x9ad8f0, 0xd8f4ff] },
  snowball: { id: 'snowball', behavior: 'roll', hitText: 'NA BOLA DE NEVE', halfLength: 1.8, halfWidth: 1.8, damage: 0.3, hp: 120, rollSpeed: 22, rollDistance: 45, radius: 1.7, debris: [0xe6eef6, 0xb8c8d8] },
  tree: { id: 'tree', behavior: 'topple', hitText: 'NA ARVORE', halfLength: 1.1, length: 9, damage: 0.3, hp: 140, debris: [0x5a3a20, 0x2f7a2a, 0x3a8c30] },
  animal: { id: 'animal', behavior: 'wander', hitText: 'NO ANIMAL', halfLength: 1.6, halfWidth: 1.0, damage: 0.15, hp: 60, speed: 1.8, debris: [0xc88a3a, 0x2a1a10] },
  rock: { id: 'rock', behavior: 'drop', hitText: 'NA ROCHA', halfLength: 1.7, halfWidth: 1.7, damage: 0.3, hp: 150, debris: [0x7c7870, 0x6a665e] },
  tires: { id: 'tires', behavior: 'static', hitText: 'NOS PNEUS', halfLength: 1.1, halfWidth: 1.2, damage: 0.12, hp: 40, debris: [0x161618, 0x303034] },
  cones: { id: 'cones', behavior: 'static', hitText: 'NOS CONES', halfLength: 0.8, halfWidth: 1.7, damage: 0.06, hp: 25, debris: [0xf06a10, 0xf0f0f0] },
  kaiju: { id: 'kaiju', behavior: 'wander', hitText: 'NA GODZILINHA', halfLength: 2.2, halfWidth: 1.8, damage: 0.4, hp: 220, speed: 1.2, debris: [0x3a9a4a, 0xc03030, 0xffee40] },
  barrels: { id: 'barrels', behavior: 'static', hitText: 'NOS BARRIS', halfLength: 1.2, halfWidth: 1.4, damage: 0.2, hp: 45, debris: [0xb02820, 0xe8c020] },
  crates: { id: 'crates', behavior: 'static', hitText: 'NAS CAIXAS', halfLength: 1.3, halfWidth: 1.6, damage: 0.18, hp: 60, debris: [0x8a6030, 0x9a7038] },
};

export const BIOME_OBSTACLES = {
  winterMountain: ['stalactite', 'snowball'],
  jungle: ['tree', 'animal'],
  stadium: ['tires', 'cones'],
  forest: ['rock'],
  neonTokyo: ['kaiju'],
  fireFactory: ['barrels', 'crates'],
};
