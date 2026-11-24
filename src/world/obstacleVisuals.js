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
  tumbleweed(body) {                                 // bola de galhos secos: rola ao atravessar
    add(body, ball(1.2), 0xb89a5a, 0, 1.2, 0);
    for (const [rx, ry] of [[0, 0], [Math.PI / 2, 0], [0, Math.PI / 2]]) {
      const ring = new THREE.TorusGeometry(1.25, 0.1, 5, 12);
      ring.rotateX(rx); ring.rotateY(ry);
      add(body, ring, 0x8a6e3a, 0, 1.2, 0);
    }
    add(body, ball(0.7, 0), 0xa08448, 0.5, 1.5, 0.4);
  },
  camel(body) {                                      // de frente para +x
    const fur = 0xc89a5a, dark = 0x8a6a3a;
    add(body, box(2.2, 0.95, 0.95), fur, 0, 1.85, 0);
    add(body, cone(0.5, 0.9, 6), fur, -0.35, 2.7, 0);
    add(body, cone(0.5, 0.9, 6), fur, 0.5, 2.65, 0);
    add(body, box(0.5, 1.3, 0.5), fur, 1.25, 2.5, 0).rotation.z = -0.35;
    add(body, box(0.8, 0.45, 0.45), fur, 1.75, 3.2, 0);
    add(body, box(0.1, 0.1, 0.1), 0x1a1208, 1.95, 3.35, 0.2);
    add(body, box(0.1, 0.1, 0.1), 0x1a1208, 1.95, 3.35, -0.2);
    add(body, box(0.15, 0.7, 0.15), dark, -1.2, 1.7, 0);
    add(body, box(1.5, 0.12, 0.98), 0xb02828, 0, 2.35, 0);   // manta
    for (const [x, z] of [[0.8, 0.32], [0.8, -0.32], [-0.8, 0.32], [-0.8, -0.32]]) add(body, box(0.22, 1.45, 0.22), dark, x, 0.72, z);
  },
  cactus(body) {
    const green = 0x3a8a3a, light = 0x5aa84a;
    add(body, cylinder(0.45, 0.5, 3.4, 8), green, 0, 1.7, 0);
    add(body, box(0.9, 0.3, 0.3), green, -0.7, 1.9, 0);
    add(body, cylinder(0.25, 0.28, 1.3, 6), light, -1.15, 2.5, 0);
    add(body, box(0.9, 0.3, 0.3), green, 0.7, 1.4, 0);
    add(body, cylinder(0.25, 0.28, 1.1, 6), light, 1.15, 1.95, 0);
    add(body, ball(0.18, 0), 0xe8a0c0, 0, 3.5, 0);
  },
  pillar(body) {                                     // base na origem, coluna para cima (tomba girando em z)
    const bands = [0xc88a50, 0xa86a38, 0xe0b078, 0xb87a44, 0xd09860];
    bands.forEach((color, i) => add(body, cylinder(0.85 - i * 0.04, 0.95 - i * 0.04, 1.7, 7), color, 0, 0.85 + i * 1.7, 0));
    add(body, cylinder(1.3, 0.85, 0.8, 7), 0xa86a38, 0, 9.0, 0);
  },
  crab(body) {                                       // de frente para +x (anda de lado)
    add(body, box(1.1, 0.4, 0.8), 0xd84a2a, 0, 0.45, 0);
    add(body, box(0.25, 0.25, 0.5), 0xf08060, 0.55, 0.65, 0.55);
    add(body, box(0.25, 0.25, 0.5), 0xf08060, 0.55, 0.65, -0.55);
    for (const z of [0.4, -0.4]) add(body, box(0.1, 0.35, 0.1), 0x1a1208, 0.45, 0.8, z * 0.5);
    for (const z of [-1, 1]) for (const x of [-0.3, 0, 0.3]) add(body, box(0.08, 0.08, 0.5), 0xb83a20, x, 0.2, z * 0.6);
  },
  beachBall(body) {                                  // rola ao atravessar
    const part = (color, from) => add(body, new THREE.SphereGeometry(1.3, 12, 8, from, Math.PI / 3), color, 0, 1.3, 0);
    [[0xe83a3a, 0], [0xffffff, Math.PI / 3], [0xf0d030, Math.PI * 2 / 3], [0xffffff, Math.PI], [0x3a7ae8, Math.PI * 4 / 3], [0xffffff, Math.PI * 5 / 3]].forEach(([color, from]) => part(color, from));
  },
  umbrella(body) {
    add(body, cylinder(0.06, 0.06, 2.6, 5), 0xd8d8d0, 0, 1.3, 0);
    add(body, cone(1.8, 0.8, 8), 0xe83a3a, 0, 2.7, 0);
    add(body, cone(1.82, 0.4, 8), 0xffffff, 0, 2.55, 0);
    add(body, box(1.6, 0.06, 1.0), 0x3a7ae8, 0.2, 0.04, 1.4);   // toalha
  },
  coconut(body) {
    for (const [x, z, r] of [[0, 0, 0.55], [0.7, 0.3, 0.45], [-0.5, 0.5, 0.4]]) {
      add(body, ball(r), 0x6a4a28, x, r, z);
      add(body, ball(0.1, 0), 0x2a1a10, x + r * 0.3, r * 1.7, z);
    }
  },
  meteor(body) {
    add(body, new THREE.DodecahedronGeometry(1.5, 0), 0x4a4440, 0, 1.4, 0).scale.set(1, 0.85, 1.1);
    add(body, new THREE.DodecahedronGeometry(0.8, 0), 0xff8a30, 0.5, 1.7, 0.4, { fog: false });
    add(body, new THREE.DodecahedronGeometry(0.5, 0), 0xffd070, -0.8, 1.0, -0.5, { fog: false });
  },
  rover(body) {                                      // de frente para +x
    add(body, box(2.6, 0.7, 1.5), 0xd8d8e0, 0, 1.0, 0);
    add(body, box(1.2, 0.6, 1.1), 0xb0b4c0, 0.3, 1.65, 0);
    add(body, box(1.0, 0.08, 1.8), 0x2848a8, -0.7, 2.1, 0);
    add(body, cylinder(0.04, 0.04, 1.4, 4), 0x8a8e9a, -1.1, 2.0, 0.5);
    add(body, box(0.3, 0.3, 0.3), 0xf0f0ff, 1.5, 1.2, 0.4, { fog: false });
    for (const x of [-1, 0, 1]) for (const z of [0.85, -0.85]) add(body, cylinder(0.4, 0.4, 0.3, 8).rotateX(Math.PI / 2), 0x303038, x, 0.4, z);
  },
  antenna(body) {                                    // base na origem, mastro para cima (tomba girando em z)
    add(body, cylinder(0.15, 0.25, 8.5, 6), 0xb8bcc8, 0, 4.25, 0);
    for (const y of [2, 4.5, 7]) add(body, box(0.9, 0.12, 0.12), 0x6a6e7a, 0, y, 0);
    add(body, cone(1.3, 0.8, 8).rotateX(Math.PI), 0xe8eaf0, 0, 8.9, 0);
    add(body, box(0.25, 0.25, 0.25), 0xe84030, 0, 9.5, 0, { fog: false });
  },
  crystal(body) {
    for (const [x, z, h, t] of [[0, 0, 2.6, 0.1], [0.8, 0.4, 1.7, -0.25], [-0.7, 0.3, 1.9, 0.3], [0.2, -0.7, 1.4, 0.15]]) {
      const mesh = add(body, cone(0.5, h, 5), 0x40e0f0, x, h / 2, z, { fog: false });
      mesh.rotation.z = t;
    }
  },
  cannonball(body) {                                 // bala de ferro meio afundada nas tábuas, com o cais rachado em volta
    add(body, ball(1.0, 1), 0x2a2a2e, 0, 0.75, 0);
    add(body, ball(0.35, 0), 0x5a5a60, 0.45, 1.35, 0.3);     // brilho
    for (let i = 0; i < 6; i++) add(body, box(1.2, 0.12, 0.3), 0x6a4a2a, Math.cos(i) * 1.3, 0.06, Math.sin(i) * 1.3).rotation.y = i;   // lascas
  },
  rollingBarrel(body) {                              // deitado, eixo ao longo da pista (z): o corpo fica no eixo e rola
    body.position.y = 0.8;
    add(body, cylinder(0.8, 0.8, 1.6, 10).rotateX(Math.PI / 2), 0x7a4a24);
    for (const z of [-0.55, 0.55]) add(body, cylinder(0.83, 0.83, 0.12, 10).rotateX(Math.PI / 2), 0x3a3a3a, 0, 0, z);
    for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {   // aduelas claras: dá para ver que está rolando
      add(body, box(0.18, 0.06, 1.5), 0xa8743c, Math.cos(angle) * 0.8, Math.sin(angle) * 0.8, 0).rotation.z = angle;
    }
  },
  barrier(body) {                                    // dois rolos infláveis empilhados, de través na pista (eixo x), com listras
    const roll = (y, radius) => {
      add(body, cylinder(radius, radius, 1.4, 10).rotateZ(Math.PI / 2), 0xd02820, 0, y, 0);
      for (const x of [-0.7, 0.7]) add(body, ball(radius, 1), 0xd02820, x, y, 0);   // pontas arredondadas: 2,2 m, a largura de um carro
      for (const x of [-0.35, 0.35]) add(body, cylinder(radius + 0.03, radius + 0.03, 0.26, 10).rotateZ(Math.PI / 2), 0xf0ece4, x, y, 0);
    };
    roll(0.42, 0.42);
    roll(1.2, 0.38);
    add(body, box(0.12, 0.2, 0.12), 0x3a3a40, 0.6, 1.62, 0);   // válvula
    for (const x of [-0.65, 0.65]) add(body, box(0.5, 0.06, 1.0), 0x7a1810, x, 0.03, 0);   // abas no chão
  },
  boar(body) {                                       // de frente para +x: corpo baixo e peludo, focinho comprido e presas
    const fur = 0x4a3a2e, dark = 0x2a201a;
    add(body, box(1.6, 0.85, 0.8), fur, 0, 0.85, 0);
    add(body, box(1.2, 0.25, 0.5), dark, -0.1, 1.38, 0);           // crina no lombo
    add(body, box(0.6, 0.55, 0.6), fur, 0.95, 0.85, 0);
    add(body, box(0.4, 0.3, 0.36), 0x6a5040, 1.38, 0.72, 0);       // focinho
    for (const z of [0.16, -0.16]) {
      add(body, box(0.24, 0.08, 0.06), 0xf0ead8, 1.45, 0.9, z);    // presas
      add(body, box(0.14, 0.22, 0.12), dark, 0.85, 1.22, z * 1.4); // orelhas
    }
    for (const [x, z] of [[0.55, 0.24], [0.55, -0.24], [-0.55, 0.24], [-0.55, -0.24]]) add(body, box(0.16, 0.5, 0.16), dark, x, 0.25, z);
  },
  deer(body) {                                       // de frente para +x: corpo alto e fino, pescoço erguido, galhada
    const fur = 0x9a6a3a, dark = 0x5a3a1e, belly = 0xe8dcc8;
    add(body, box(1.6, 0.75, 0.62), fur, 0, 1.45, 0);
    add(body, box(1.2, 0.2, 0.5), belly, 0, 1.08, 0);
    add(body, box(0.32, 0.9, 0.3), fur, 0.85, 2.0, 0).rotation.z = -0.4;   // pescoço
    add(body, box(0.62, 0.36, 0.34), fur, 1.25, 2.42, 0);
    add(body, box(0.2, 0.16, 0.24), 0x2a1a10, 1.58, 2.36, 0);   // focinho
    for (const z of [0.15, -0.15]) {
      add(body, box(0.08, 0.6, 0.08), dark, 1.15, 2.85, z * 1.4);
      add(body, box(0.36, 0.07, 0.07), dark, 1.0, 3.05, z * 2.2);
      add(body, box(0.07, 0.32, 0.07), dark, 0.88, 3.25, z * 2.6);
      add(body, box(0.2, 0.08, 0.14), fur, 1.0, 2.62, z * 2.4);   // orelhas
    }
    add(body, box(0.22, 0.24, 0.2), belly, -0.86, 1.62, 0);       // rabo branco
    for (const [x, z] of [[0.62, 0.2], [0.62, -0.2], [-0.6, 0.2], [-0.6, -0.2]]) add(body, box(0.14, 1.08, 0.14), dark, x, 0.54, z);
  },
  carriage(body) {                                   // de frente para +x: cavalo na frente, cocheiro e caixa com teto atrás
    const wood = 0x7a4a24, trim = 0xc8a040, red = 0x8a2a2a, horse = 0x4a3020;
    add(body, box(3.2, 1.7, 2.1), red, -1.3, 2.0, 0);              // caixa
    add(body, box(3.4, 0.18, 2.3), trim, -1.3, 1.12, 0);
    add(body, box(3.5, 0.3, 2.4), wood, -1.3, 3.0, 0);             // teto
    add(body, box(2.6, 0.5, 1.8), wood, -1.3, 3.35, 0);
    for (const z of [1.06, -1.06]) add(body, box(1.0, 0.7, 0.05), 0x2a2018, -1.3, 2.25, z);   // janelas
    add(body, box(0.8, 0.9, 1.6), wood, 0.65, 1.5, 0);             // banco do cocheiro
    add(body, box(0.45, 0.8, 0.45), 0x3a5a8a, 0.6, 2.35, 0);        // cocheiro
    add(body, box(0.36, 0.36, 0.36), 0xd8a880, 0.6, 2.95, 0);
    add(body, box(0.5, 0.12, 0.5), 0x2a2018, 0.6, 3.2, 0);
    for (const z of [0.5, -0.5]) add(body, box(2.4, 0.1, 0.1), wood, 1.9, 1.2, z);   // varais
    add(body, box(1.7, 0.8, 0.7), horse, 2.7, 1.75, 0);             // cavalo
    add(body, box(0.4, 0.9, 0.36), horse, 3.55, 2.3, 0).rotation.z = -0.5;
    add(body, box(0.7, 0.34, 0.34), horse, 3.85, 2.7, 0);
    add(body, box(0.6, 0.12, 0.12), 0x1a120a, 3.4, 2.55, 0);        // crina
    add(body, box(0.5, 0.5, 0.16), 0x1a120a, 1.85, 1.75, 0);        // rabo
    const legs = [];
    for (const [x, z] of [[3.25, 0.22], [3.25, -0.22], [2.15, 0.22], [2.15, -0.22]]) {
      const leg = add(body, box(0.16, 1.2, 0.16), 0x2a1a10, x, 0.6, z);
      legs.push(leg);
    }
    const wheels = [];
    for (const x of [-0.2, -2.4]) for (const z of [1.2, -1.2]) {
      const wheel = new THREE.Group();
      wheel.position.set(x, 0.75, z);
      add(wheel, cylinder(0.75, 0.75, 0.14, 10), wood).rotation.x = Math.PI / 2;
      add(wheel, box(1.4, 0.1, 0.16), 0x3a2414);                   // raios
      add(wheel, box(0.1, 1.4, 0.16), 0x3a2414);
      body.add(wheel);
      wheels.push(wheel);
    }
    let travelled = 0;
    // As rodas giram e as patas do cavalo marcam o passo conforme a carroça anda.
    return {
      roll(step) {
        travelled += step;
        for (const wheel of wheels) wheel.rotation.z = -travelled / 0.75;
        legs.forEach((leg, i) => { leg.rotation.z = Math.sin(travelled * 2.2 + (i % 2) * Math.PI) * 0.35; });
      },
    };
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
  const extra = BUILDERS[id](body) ?? {};           // `roll(passo)`: o que anda pela pista anima rodas e patas
  return {
    group, body, ...extra,
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
