import * as THREE from 'three';

// Aparência dos obstáculos e dos cacos quando eles quebram. A origem do grupo fica no chão; `body` é o que se anima.

const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });
function add(parent, geometry, color, x = 0, y = 0, z = 0, extra) {
  const mesh = new THREE.Mesh(geometry, basic(color, extra));
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cone = (r, h, sides = 6) => new THREE.ConeGeometry(r, h, sides);
const cylinder = (rTop, rBottom, h, sides = 8) => new THREE.CylinderGeometry(rTop, rBottom, h, sides);
const ball = (r, detail = 1) => new THREE.IcosahedronGeometry(r, detail);

const BUILDERS = {
  stalactite(body) {
    const down = (r, h) => { const g = cone(r, h); g.rotateX(Math.PI); return g; };   // ponta para baixo, cravada no chão
    add(body, down(0.9, 3.4), 0x9ad8f0, 0, 1.7, 0);
    add(body, down(0.5, 2.2), 0xc8ecfa, 0.8, 1.1, 0.3);
    add(body, down(0.45, 1.8), 0xc8ecfa, -0.7, 0.9, -0.4);
  },
  snowball(body) {
    add(body, ball(1.7), 0xe6eef6, 0, 1.7, 0);
    add(body, ball(0.9), 0xb8c8d8, 0.9, 2.1, 0.9);
    add(body, ball(0.7), 0xb8c8d8, -1.1, 1.2, -0.9);
  },
  tree(body) {                                       // base na origem, tronco para cima (tomba girando em z)
    add(body, cylinder(0.35, 0.5, 8.5, 6), 0x5a3a20, 0, 4.25, 0);
    add(body, ball(2.0), 0x2f7a2a, 0, 8.2, 0);
    add(body, ball(1.5), 0x3a8c30, 1.1, 6.6, 0.6);
    add(body, ball(1.4), 0x2a6a24, -1.1, 7.2, -0.5);
  },
  animal(body) {                                     // de frente para +x
    add(body, box(1.7, 0.85, 0.9), 0xc88a3a, 0, 0.95, 0);
    add(body, box(0.6, 0.55, 0.6), 0xc88a3a, 1.05, 1.15, 0);
    add(body, box(0.15, 0.2, 0.15), 0x2a1a10, 1.15, 1.5, 0.2);
    add(body, box(0.15, 0.2, 0.15), 0x2a1a10, 1.15, 1.5, -0.2);
    add(body, box(0.8, 0.14, 0.14), 0xc88a3a, -1.2, 1.15, 0);
    for (const [x, z] of [[0.6, 0.32], [0.6, -0.32], [-0.6, 0.32], [-0.6, -0.32]]) add(body, box(0.2, 0.55, 0.2), 0x2a1a10, x, 0.28, z);
    for (const [x, y, z] of [[-0.4, 1.2, 0.46], [0.2, 1.0, 0.46], [-0.1, 1.2, -0.46], [0.5, 1.1, -0.46], [-0.3, 1.4, 0.1]]) add(body, box(0.26, 0.26, 0.1), 0x2a1a10, x, y, z);
  },
  rock(body) {
    add(body, new THREE.DodecahedronGeometry(1.6, 0), 0x7c7870, 0, 1.2, 0).scale.set(1, 0.8, 1.1);
    add(body, new THREE.DodecahedronGeometry(0.9, 0), 0x6a665e, 1.3, 0.7, 0.5);
    add(body, new THREE.DodecahedronGeometry(0.6, 0), 0x8a867e, -1.2, 0.5, -0.6);
  },
  tires(body) {
    const tire = () => { const g = new THREE.TorusGeometry(0.5, 0.22, 6, 10); g.rotateX(Math.PI / 2); return g; };
    add(body, tire(), 0x161618, -0.55, 0.22, 0);
    add(body, tire(), 0x161618, 0.55, 0.22, 0.1);
    add(body, tire(), 0x232326, 0, 0.66, 0.05);
  },
  bigTire(body) {                                    // dois pneus de pé, girando em volta do eixo (z): o corpo fica no centro
    body.position.y = 1.4;
    for (const z of [-0.5, 0.5]) {
      add(body, new THREE.TorusGeometry(1.0, 0.42, 8, 14), 0x161618, 0, 0, z);
      add(body, cylinder(0.62, 0.62, 0.3, 10).rotateX(Math.PI / 2), 0xb8b8c0, 0, 0, z);
      add(body, box(0.5, 0.18, 0.32), 0xf0d020, 0.8, 0.8, z * 1.5);   // faixa amarela: dá para ver que está rolando
    }
  },
  cones(body) {
    for (const x of [-1.1, 0, 1.1]) {
      add(body, cone(0.4, 1.1, 8), 0xf06a10, x, 0.55, 0);
      add(body, cylinder(0.26, 0.29, 0.18), 0xf0f0f0, x, 0.6, 0);
      add(body, box(0.9, 0.06, 0.9), 0x303034, x, 0.03, 0);
    }
  },
  barrels(body) {
    for (const [x, z] of [[-0.6, 0], [0.6, 0.2], [0, -0.7]]) {
      add(body, cylinder(0.45, 0.45, 1.1), 0xb02820, x, 0.55, z);
      add(body, cylinder(0.47, 0.47, 0.14), 0xe8c020, x, 0.75, z);
    }
  },
  crates(body) {
    add(body, box(1.3, 1.3, 1.3), 0x8a6030, -0.7, 0.65, 0);
    add(body, box(1.1, 1.1, 1.1), 0x9a7038, 0.75, 0.55, 0.2);
    add(body, box(0.9, 0.9, 0.9), 0x7a5028, -0.7, 1.75, 0);
  },
  kaiju(body) {                                      // de frente para +x
    add(body, box(2.0, 3.0, 1.6), 0x3a9a4a, 0, 2.1, 0);
    add(body, box(1.2, 1.8, 0.1), 0x8ad07a, 0.2, 1.9, 0.82);
    add(body, box(1.1, 1.0, 1.0), 0x3a9a4a, 1.1, 3.9, 0);
    add(body, box(0.12, 0.12, 0.12), 0xffee40, 1.68, 4.1, 0.3, { fog: false });
    add(body, box(0.12, 0.12, 0.12), 0xffee40, 1.68, 4.1, -0.3, { fog: false });
    for (let i = 0; i < 4; i++) add(body, cone(0.3, 0.9, 4), 0xc03030, -0.9 + i * 0.55, 3.8 - i * 0.25, 0);
    add(body, box(2.0, 0.6, 0.6), 0x2f8a3e, -1.9, 1.2, 0);
    for (const z of [0.5, -0.5]) {
      add(body, box(0.8, 1.2, 0.7), 0x2f8a3e, 0, 0.6, z);
      add(body, box(0.7, 0.3, 0.3), 0x3a9a4a, 0.8, 2.6, z * 1.8);
    }
  },
};

export function createObstacleVisual(id) {
  const group = new THREE.Group(), body = new THREE.Group();
  group.add(body);
  BUILDERS[id](body);
  return {
    group, body,
    dispose() {
      group.traverse(object => { object.geometry?.dispose(); object.material?.dispose(); });
    },
  };
}

// Cacos que voam e caem quando o obstáculo quebra.
const GRAVITY = 22, DEBRIS_LIFE = 0.9, DUST_LIFE = 1.4;
const shard = box(0.3, 0.3, 0.3);

// `dust`: em vez de estourar, os pedaços miúdos só caem do ponto (o aviso antes de algo despencar).
export function createDebris(scene, position, colors, count = 12, { dust = false } = {}) {
  const group = new THREE.Group();
  group.position.copy(position);
  const pieces = [];
  for (let i = 0; i < count; i++) {
    const mesh = add(group, shard, colors[i % colors.length], (Math.random() - 0.5) * 2, dust ? Math.random() : 0.8, (Math.random() - 0.5) * 2);
    mesh.scale.setScalar(dust ? 0.25 + Math.random() * 0.4 : 0.6 + Math.random() * 1.2);
    pieces.push(dust ? { mesh, vx: (Math.random() - 0.5), vy: -Math.random() * 3, vz: (Math.random() - 0.5) } : { mesh, vx: (Math.random() - 0.5) * 9, vy: 4 + Math.random() * 7, vz: (Math.random() - 0.5) * 9 });
  }
  scene.add(group);
  let age = 0;
  return {
    update(dt) {
      age += dt;
      for (const p of pieces) {
        p.vy -= GRAVITY * dt;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y = Math.max(0, p.mesh.position.y + p.vy * dt);
        p.mesh.position.z += p.vz * dt;
        p.mesh.rotation.x += p.vx * dt;
        p.mesh.rotation.z += p.vz * dt;
      }
      return age < (dust ? DUST_LIFE : DEBRIS_LIFE);
    },
    dispose() {
      scene.remove(group);
      for (const p of pieces) p.mesh.material.dispose();
    },
  };
}

// Sombra no chão de onde algo vai cair: cresce enquanto o objeto se aproxima, para dar tempo de desviar.
const shadowGeometry = new THREE.CircleGeometry(1, 16);
shadowGeometry.rotateX(-Math.PI / 2);
export function createShadow(radius) {
  const mesh = new THREE.Mesh(shadowGeometry, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
  mesh.position.y = 0.05;
  mesh.userData.radius = radius;
  return mesh;
}
