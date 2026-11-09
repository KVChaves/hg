import { createRoadsideNpcs } from './roadsideNpcs.js';

// Os NPCs logo antes da linha de chegada: um de cada lado da pista, com a caixa de suprimentos acima da cabeça.

export function createSupplyCrates(scene) {
  const npcs = createRoadsideNpcs(scene);
  const crates = [-1, 1].map(side => ({ id: 'crate', side }));

  return {
    // `station` nula tira os dois da pista.
    show(station) { npcs.show(station && { dist: station.dist, items: crates }); },
    // Quem entregou comemora e os dois ficam de mãos vazias.
    taken(side) { npcs.hideItems(crates.find(crate => crate.side === side)); },
    update(dt, carX, carZ) { npcs.update(dt, carX, carZ); },
  };
}
