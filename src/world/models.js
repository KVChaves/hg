import * as THREE from 'three';

// Modelos .glb do jogo original, lidos sem biblioteca extra (só o que eles usam: malhas, nós e textura embutida ou à parte).
// `useModel(id, { glb, texture, zUp })` começa a carregar ao abrir o jogo; `modelParts(id, { height })` devolve as partes prontas
// para `scatter` e companhia: [{ geometry, material }], com a base em y = 0, centrado em x/z e com a altura pedida (m).
// Enquanto o modelo não chegou, devolve [] e quem chama simplesmente não coloca nada.

const COMPONENTS = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const WIDTHS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const TEXTURE_SIZE = 128;

const registry = new Map();     // id → { glb, texture, zUp, ready: bool, primitives: [{ geometry, texture }] }

function readAccessor(json, bin, index) {
  const accessor = json.accessors[index], view = json.bufferViews[accessor.bufferView];
  const Type = COMPONENTS[accessor.componentType], width = WIDTHS[accessor.type];
  const start = bin.byteOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const stride = view.byteStride && view.byteStride !== width * Type.BYTES_PER_ELEMENT ? view.byteStride : 0;
  if (!stride) return new Type(bin.buffer.slice(start, start + accessor.count * width * Type.BYTES_PER_ELEMENT));
  const out = new Type(accessor.count * width), source = new DataView(bin.buffer, start);
  const getter = { 5126: 'getFloat32', 5123: 'getUint16', 5125: 'getUint32', 5121: 'getUint8' }[accessor.componentType];
  for (let i = 0; i < accessor.count; i++) {
    for (let k = 0; k < width; k++) out[i * width + k] = source[getter](i * stride + k * Type.BYTES_PER_ELEMENT, true);
  }
  return out;
}

function parseGlb(buffer) {
  const view = new DataView(buffer);
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)));
  const binStart = 20 + jsonLength + 8;
  return { json, bin: new Uint8Array(buffer, binStart, buffer.byteLength - binStart) };
}

function embeddedImage(json, bin, index) {
  const view = json.bufferViews[json.images[index].bufferView], start = bin.byteOffset + (view.byteOffset ?? 0);
  return new Blob([bin.buffer.slice(start, start + view.byteLength)], { type: json.images[index].mimeType });
}

function collectPrimitives(json, bin) {
  const primitives = [], local = new THREE.Matrix4();
  const visit = (nodeIndex, parent) => {
    const node = json.nodes[nodeIndex];
    local.compose(
      new THREE.Vector3(...(node.translation ?? [0, 0, 0])),
      new THREE.Quaternion(...(node.rotation ?? [0, 0, 0, 1])),
      new THREE.Vector3(...(node.scale ?? [1, 1, 1])),
    );
    const world = parent.clone().multiply(local);
    if (node.mesh !== undefined) {
      for (const primitive of json.meshes[node.mesh].primitives) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(readAccessor(json, bin, primitive.attributes.POSITION), 3));
        if (primitive.attributes.TEXCOORD_0 !== undefined) geometry.setAttribute('uv', new THREE.BufferAttribute(readAccessor(json, bin, primitive.attributes.TEXCOORD_0), 2));
        if (primitive.indices !== undefined) geometry.setIndex(new THREE.BufferAttribute(readAccessor(json, bin, primitive.indices), 1));
        geometry.applyMatrix4(world);
        const material = json.materials?.[primitive.material];
        const textureIndex = material?.pbrMetallicRoughness?.baseColorTexture?.index;
        const imageIndex = textureIndex === undefined ? undefined : json.textures[textureIndex].source;
        primitives.push({ geometry, imageIndex });
      }
    }
    for (const child of node.children ?? []) visit(child, world);
  };
  for (const root of json.scenes[json.scene ?? 0].nodes) visit(root, new THREE.Matrix4());
  return primitives;
}

function pixelCanvasTexture(image) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.min(TEXTURE_SIZE, Math.max(image.width, 8));
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.flipY = false;                         // as coordenadas do glTF começam no canto de cima
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

const loadImage = src => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error(`não carregou ${src}`));
  image.src = src;
});

export function useModel(id, { glb, texture = null, zUp = true }) {
  const entry = { glb, texture, zUp, ready: false, primitives: [] };
  registry.set(id, entry);
  fetch(glb).then(response => response.arrayBuffer()).then(async buffer => {
    const { json, bin } = parseGlb(buffer);
    const external = texture ? pixelCanvasTexture(await loadImage(texture)) : null;
    for (const { geometry, imageIndex } of collectPrimitives(json, bin)) {
      let map = external;
      if (!map && imageIndex !== undefined) {
        const url = URL.createObjectURL(embeddedImage(json, bin, json.textures[imageIndex].source ?? imageIndex));
        map = pixelCanvasTexture(await loadImage(url));
        URL.revokeObjectURL(url);
      }
      entry.primitives.push({ geometry, map });
    }
    entry.ready = true;
  }).catch(error => console.warn(`modelo ${id}:`, error.message));
  return id;
}

// Partes prontas para instanciar. Sem a textura, o modelo sai de uma cor só (`fallback`).
export function modelParts(id, { height, fallback = 0x8a8a90 }) {
  const entry = registry.get(id);
  if (!entry?.ready) return [];
  const box = new THREE.Box3();
  const geometries = entry.primitives.map(({ geometry }) => {
    const copy = geometry.clone();
    if (entry.zUp) copy.rotateX(-Math.PI / 2);                  // z para cima → y para cima
    box.union(copy.computeBoundingBox() || copy.boundingBox);
    return copy;
  });
  const size = box.getSize(new THREE.Vector3()), centerX = (box.min.x + box.max.x) / 2, centerZ = (box.min.z + box.max.z) / 2;
  const scale = height / Math.max(size.y, 1e-6);
  return geometries.map((geometry, i) => {
    geometry.translate(-centerX, -box.min.y, -centerZ);
    geometry.scale(scale, scale, scale);
    geometry.computeBoundingBox();
    const { map } = entry.primitives[i];
    return { geometry, material: new THREE.MeshBasicMaterial(map ? { map, alphaTest: 0.5, side: THREE.DoubleSide } : { color: fallback, side: THREE.DoubleSide }) };
  });
}
