import { useModel, modelParts } from '../models.js';

// Peças 3D do jogo original usadas como cenário. Começam a carregar quando o jogo abre; o bioma pede com `partsOf(id, altura)`.
// Cada modelo é ajustado para ter a altura pedida (em metros) e, se ainda não carregou, devolve lista vazia.

const GLB = 'assets/models/', TEX = 'assets/models/tex/';
const flat = (glb, texture) => ({ glb: GLB + glb, texture: texture ? TEX + texture + '.png' : null });
const upright = glb => ({ glb: GLB + glb, texture: null, zUp: false });      // já vêm de pé e com a textura dentro

const MODELS = {
  temple: flat('temple.glb', 'temple'),
  templeTall: flat('temple_tall.glb', 'temple_tall'),
  torii: flat('ARCH.glb', 'arch'),
  pagoda: flat('BUILDING_TRAIN1.glb', 'train1'),
  apartment: flat('small_building.glb', 'small_building'),
  warehouse: flat('building_2.glb', 'building_2'),
  whiteTower: flat('tall_building2.glb', 'tall_building2'),
  glassTower: flat('tall_building3.glb', 'tall_building3'),
  block: flat('large_building.glb', 'large_building'),
  waterTower: flat('wtr_twer.glb', 'wtr_tower'),
  chimneys: flat('tower_thing.glb', 'tower_thing'),
  factory: flat('factory.glb', 'factory'),
  container1: flat('container1.glb', 'container1'),
  container2: flat('container2.glb', 'container2'),
  container3: flat('container3.glb', 'container3'),
  sakura1: upright('SakuraTree1.glb'),
  sakura2: upright('SakuraTree2.glb'),
  barrel: { ...upright('ExplosiveBarrel.glb'), texture: TEX + 'barrel.png' },
  barrier: upright('BarrierTokyoTall.glb'),
};
for (const [id, spec] of Object.entries(MODELS)) useModel(id, spec);

// `tint` multiplica a textura (escurece/esfria) para combinar com a luz do bioma.
export function partsOf(id, height, tint = 0xffffff) {
  return modelParts(id, { height }).map(part => {
    part.material.color.setHex(tint);
    return part;
  });
}

