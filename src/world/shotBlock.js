import * as THREE from 'three';
import { TRACK_WIDTH } from '../config.js';
import { nearestIndex, track } from './track.js';

// O que segura bala: o chão, a estrada e as estruturas do mapa (túneis, castelo, muros, pontes, penhascos...).
// `distance(origin, dir, far)` devolve em quantos metros a reta bate em algo sólido, ou Infinity.
//
// Chão e estrada são feitos por conta, andando pela reta (barato, vale para o jogador e para os bots):
//   chão     a grade do terreno que é desenhada (scenery.addGround), com altura interpolada entre os vértices
//   estrada  a faixa de asfalto, zebra e acostamento na altura `track.py`, onde ela existe (sem vão, ponte ou piso próprio)
// As estruturas são malhas de verdade, testadas com o raio do three.js. Efeitos transparentes (água rala, brilho,
// fumaça) e o que estiver escondido não seguram nada; árvores e enfeites do bioma ficam de fora.

const STEP = 0.75;                                   // metros entre os pontos testados na reta
const ROAD_SKIN = 2;                                 // abaixo disso da superfície já não é a estrada (o vão embaixo de uma rampa)
const MIN_OPACITY = 0.5;
// Logo além da beira da estrada a descida do barranco é uma faixa própria (scenery.addRoad), mais fina que a grade:
// ali o chão só conta depois desta folga, para a grade grossa não engolir tiro rente ao asfalto.
const ROAD_MARGIN = 6;

export function createShotBlock() {
  let ground = null, solids = [], roadHalf = TRACK_WIDTH / 2;
  const raycaster = new THREE.Raycaster();

  // `field`: { minX, minZ, cellX, cellZ, nx, nz, heights } (nx + 1 colunas por nz + 1 linhas).
  function setGround(field) { ground = field; }
  // `half`: meia largura do que é piso na altura da estrada (asfalto, zebra e acostamento).
  function setRoad(half) { roadHalf = half; }
  function setSolids(meshes) { solids = meshes; }

  function groundAt(x, z) {
    const { minX, minZ, cellX, cellZ, nx, nz, heights } = ground;
    const fx = Math.max(0, Math.min(nx - 1e-6, (x - minX) / cellX)), fz = Math.max(0, Math.min(nz - 1e-6, (z - minZ) / cellZ));
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, row = nx + 1;
    const a = heights[j * row + i], b = heights[j * row + i + 1], c = heights[(j + 1) * row + i], d = heights[(j + 1) * row + i + 1];
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  }

  const hasRoad = k => track.gap[k] !== 1 && !(track.bridge?.[k] > 0) && track.ownFloor?.[k] !== 1 && !(track.split?.[k] > 0);

  function marchDistance(origin, dir, far) {
    if (!ground || !track.count) return Infinity;
    let index = -1;
    for (let d = STEP; d <= far; d += STEP) {
      const x = origin.x + dir.x * d, y = origin.y + dir.y * d, z = origin.z + dir.z * d;
      index = nearestIndex(x, z, index);
      const n = Math.hypot(track.tx[index], track.tz[index]) || 1;
      const lane = Math.abs(-(x - track.px[index]) * (track.tz[index] / n) + (z - track.pz[index]) * (track.tx[index] / n));
      // Sobre a estrada vale a altura dela: a grade do chão é grossa e, interpolada ali, poderia passar da pista.
      if (lane <= roadHalf && hasRoad(index)) {
        const surface = track.py[index];
        if (y <= surface && y >= surface - ROAD_SKIN) return d;
        continue;
      }
      if (lane > roadHalf + ROAD_MARGIN && y < groundAt(x, z)) return d;
    }
    return Infinity;
  }

  const blocks = object => {
    if (!object.visible) return false;
    const material = Array.isArray(object.material) ? object.material[0] : object.material;
    return !material || !(material.blending === THREE.AdditiveBlending || (material.transparent && material.opacity < MIN_OPACITY));
  };

  function distance(origin, dir, far) {
    const march = marchDistance(origin, dir, far);
    if (!solids.length) return march;
    raycaster.set(origin, dir);
    raycaster.near = 0;
    raycaster.far = Math.min(far, march);
    const hit = raycaster.intersectObjects(solids.filter(blocks), false)[0];
    return hit ? hit.distance : march;
  }

  return { setGround, setRoad, setSolids, distance };
}

// Malhas que seguram bala dentro de `roots` (grupos das estruturas).
export function collectSolids(roots) {
  const meshes = [];
  for (const root of roots) root.traverse(object => { if (object.isMesh) meshes.push(object); });
  return meshes;
}
