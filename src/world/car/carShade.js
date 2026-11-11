import * as THREE from 'three';

// Ferramentas para as peças 3D do carro (para-choques, detalhes de pneu, suspensão e vidro). O material não recebe luz,
// então cada face ganha um tom pelo ângulo em relação a uma luz fixa; sem isso as peças viram manchas chapadas.

const LIGHT = new THREE.Vector3(0.35, 0.8, -0.5).normalize();
const AMBIENT = 0.5;
const material = new THREE.MeshBasicMaterial({ vertexColors: true });

function shadeGeometry(geometry, hex) {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  flat.computeVertexNormals();
  const normals = flat.attributes.normal, count = normals.count, colors = new Float32Array(count * 3);
  const base = new THREE.Color(hex), normal = new THREE.Vector3();
  // Normais por face: o filete facetado mantém a aparência de poucos polígonos do resto do jogo.
  for (let i = 0; i < count; i += 3) {
    normal.set(0, 0, 0);
    for (let k = 0; k < 3; k++) normal.add(new THREE.Vector3().fromBufferAttribute(normals, i + k));
    normal.normalize();
    const light = AMBIENT + (1 - AMBIENT) * Math.max(0, normal.dot(LIGHT)) * 1.15;
    for (let k = 0; k < 3; k++) {
      const at = (i + k) * 3;
      colors[at] = Math.min(1, base.r * light);
      colors[at + 1] = Math.min(1, base.g * light);
      colors[at + 2] = Math.min(1, base.b * light);
    }
  }
  flat.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return flat;
}

// Conjunto de peças que se descarta junto: guarda as geometrias criadas para liberar depois.
export function createPartSet() {
  const group = new THREE.Group(), geometries = [];

  // Peças não contam como acerto: o tiro passa direto e vale para o carro.
  function add(geometry, color, { position = [0, 0, 0], rotation = [0, 0, 0], parent = group } = {}) {
    const shaded = shadeGeometry(geometry, color);
    geometry.dispose();
    geometries.push(shaded);
    const mesh = new THREE.Mesh(shaded, material);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.raycast = () => {};
    parent.add(mesh);
    return mesh;
  }

  const box = (width, height, depth, color, position, rotation, parent) => add(new THREE.BoxGeometry(width, height, depth), color, { position, rotation, parent });

  // Cilindro (ou tronco) entre dois pontos.
  function bar(from, to, radius, color, { radiusEnd = radius, sides = 6, parent } = {}) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), direction = b.clone().sub(a);
    const geometry = new THREE.CylinderGeometry(radiusEnd, radius, direction.length(), sides);
    const mesh = add(geometry, color, { position: a.clone().add(b).multiplyScalar(0.5).toArray(), parent });
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return mesh;
  }

  // Prisma: perfil no plano (z, y) esticado de x0 a x1. Serve para cunhas e chanfros.
  function prism(profile, xa, xb, color) {
    const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb);
    const shape = new THREE.Shape(profile.map(([z, y]) => new THREE.Vector2(z, y)));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: x1 - x0, bevelEnabled: false });
    geometry.rotateY(-Math.PI / 2);                  // z do perfil continua em z; a espessura vira x
    geometry.translate(x1, 0, 0);
    return add(geometry, color);
  }

  const cone = (radius, length, color, position, rotation, sides = 5) => add(new THREE.ConeGeometry(radius, length, sides), color, { position, rotation });

  return {
    group, add, box, bar, prism, cone,
    dispose() {
      geometries.forEach(geometry => geometry.dispose());
      group.parent?.remove(group);
    },
  };
}
