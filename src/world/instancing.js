import * as THREE from 'three';

// Objetos instanciados (árvores, prédios, postes...) espalhados pela pista inteira. Com o corte de visão desligado,
// a placa de vídeo processa todos eles a cada quadro, mesmo os que ficaram para trás. Aqui eles são repartidos em
// blocos de BLOCK metros, cada um com a esfera que envolve as suas instâncias, e o Three.js pula os blocos fora da tela.

const BLOCK = 160;                                   // metros: maior junta menos chamadas de desenho; menor corta mais
const MIN_TO_SPLIT = 24;                             // com poucas instâncias, um bloco só (ainda assim com a esfera certa)
// Peças com versão simples (`geometry.userData.far`) usam blocos menores e trocam para ela quando o bloco inteiro
// está a mais de DETAIL_RANGE metros da câmera. O THREE.LOD escolhe por câmera (frente, retrovisor, espectador).
const LOD_BLOCK = 96, DETAIL_RANGE = 40;

const matrix = new THREE.Matrix4(), color = new THREE.Color(), sphere = new THREE.Sphere();
const area = new THREE.Box3(), piece = new THREE.Box3();

// Uma geometria que reaproveita os buffers de `geometry` (nada é copiado nem reenviado à placa) com a própria esfera.
function shareGeometry(geometry, boundingSphere) {
  const view = new THREE.BufferGeometry();
  view.index = geometry.index;
  view.attributes = geometry.attributes;
  view.morphAttributes = geometry.morphAttributes;
  view.groups = geometry.groups;
  view.drawRange = geometry.drawRange;
  view.boundingSphere = boundingSphere;
  return view;
}

// Esfera que envolve as instâncias `indices` de `mesh`, no espaço do próprio mesh.
function sphereOf(mesh, indices) {
  const { geometry } = mesh;
  if (!geometry.boundingSphere) geometry.computeBoundingSphere();
  area.makeEmpty();
  for (const i of indices) {
    mesh.getMatrixAt(i, matrix);
    area.union(sphere.copy(geometry.boundingSphere).applyMatrix4(matrix).getBoundingBox(piece));
  }
  return area.getBoundingSphere(new THREE.Sphere());
}

// Instâncias de `meshes` (as partes de uma mesma peça, com as mesmas matrizes) agrupadas por bloco do chão.
function blocksOf(mesh, count, size) {
  const blocks = new Map();
  for (let i = 0; i < count; i++) {
    mesh.getMatrixAt(i, matrix);
    const key = count < MIN_TO_SPLIT ? 0 : `${Math.floor(matrix.elements[12] / size)},${Math.floor(matrix.elements[14] / size)}`;
    if (!blocks.has(key)) blocks.set(key, []);
    blocks.get(key).push(i);
  }
  return [...blocks.values()];
}

// As instâncias `indices` de `source` num mesh próprio, com a esfera delas e o corte de visão ligado.
function blockMesh(source, indices) {
  const mesh = new THREE.InstancedMesh(shareGeometry(source.geometry, sphereOf(source, indices)), source.material, indices.length);
  indices.forEach((from, to) => {
    source.getMatrixAt(from, matrix);
    mesh.setMatrixAt(to, matrix);
    if (source.instanceColor) {
      source.getColorAt(from, color);                  // no r128 getColorAt só preenche `color`, não o devolve
      mesh.setColorAt(to, color);
    }
  });
  mesh.frustumCulled = true;                           // no r128 o InstancedMesh nasce com o corte desligado
  mesh.renderOrder = source.renderOrder;
  return mesh;
}

// O bloco inteiro de perto e a sua versão simples de longe, com as mesmas matrizes e cores.
function detailLevels(mesh, farGeometry) {
  const { center, radius } = mesh.geometry.boundingSphere;
  const far = new THREE.InstancedMesh(shareGeometry(farGeometry, mesh.geometry.boundingSphere), mesh.material, mesh.count);
  far.instanceMatrix = mesh.instanceMatrix;
  far.instanceColor = mesh.instanceColor;
  far.frustumCulled = true;
  far.renderOrder = mesh.renderOrder;
  // O LOD mede a distância até a própria posição: fica no centro do bloco, e os filhos desfazem o deslocamento.
  const lod = new THREE.LOD();
  lod.position.copy(center);
  for (const [child, distance] of [[mesh, 0], [far, radius + DETAIL_RANGE]]) {
    child.position.copy(center).negate();
    lod.addLevel(child, distance);
  }
  return lod;
}

// Cria em `group` uma cópia de cada mesh de `meshes`, repartida em blocos e com o corte de visão ligado.
// Os meshes de origem só guardam as matrizes e cores: não entram na cena. `count` é quantas instâncias valem.
export function addCulledInstances(group, meshes, count) {
  if (!count) return;
  const bySize = new Map();
  for (const source of meshes) {
    const far = source.geometry.userData.far, size = far ? LOD_BLOCK : BLOCK;
    if (!bySize.has(size)) bySize.set(size, blocksOf(meshes[0], count, size));
    for (const indices of bySize.get(size)) {
      const mesh = blockMesh(source, indices);
      group.add(far ? detailLevels(mesh, far) : mesh);
    }
  }
}

// Instâncias que não se movem e já estão na cena: só ganham a esfera certa e voltam a ter o corte de visão.
export function enableCulling(mesh) {
  const indices = Array.from({ length: mesh.count }, (_, i) => i);
  mesh.geometry = shareGeometry(mesh.geometry, sphereOf(mesh, indices));
  mesh.frustumCulled = true;
}
