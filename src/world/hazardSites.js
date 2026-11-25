import * as THREE from 'three';
import { TRACK_WIDTH } from '../config.js';
import { ctxText, textWidth } from '../art/font.js';
import { HAZARD_KINDS } from '../game/hazardKinds.js';
import { TUNNEL_HEIGHT } from '../game/mapLayout.js';
import { gustAt, raceClock, track, trackAt } from './track.js';
import { pixelTexture } from './textures.js';
import { pirateShip } from './pirateShip.js';
import { enableCulling } from './instancing.js';

// O motivo de cada ponto de perigo, no cenário: paredão de onde caem pedras, encosta de neve, placa de travessia
// de animais, guindaste, obras sinalizadas, faixa de pedestres do kaiju... Assim o jogador vê de longe que ali
// tem perigo e aprende a pista. Os obstáculos em si ficam em game/obstacles.js.

const HALF = TRACK_WIDTH / 2, SIGN_AHEAD = 45;
const SHIP_FROM_ROAD = 10, SHIP_BELOW_DECK = 2.6;   // navio dos canhões: o casco quase encosta no píer (os canos ficam a 14,5 m do centro, hazardKinds.cannonFire.arc)
const solid = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });

// Ponto ao lado da pista: `lateral` positivo é à direita de quem corre; `up` é a altura sobre o chão dali.
// Fora da estrada o ponto se afasta o tanto do acostamento largo (`track.shoulder`), para o carro não atravessar
// placas e paredões no acostamento; `keep` deixa onde está (o que precisa ficar debruçado sobre a pista).
function spot(dist, lateral, up = 0, onRoad = false, keep = false) {
  if (!keep && Math.abs(lateral) > HALF) lateral += Math.sign(lateral) * track.shoulder;
  const t = trackAt(dist), x = t.x - t.tz * lateral, z = t.z + t.tx * lateral;
  const ground = onRoad || Math.abs(lateral) <= HALF ? t.y : Math.max(t.y, track.heightAt(x, z));
  return { x, y: ground + up, z, yaw: Math.atan2(-t.tx, -t.tz) };
}

function put(group, geometry, material, { x, y, z, yaw }, rotation = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.rotation.order = 'YXZ';
  mesh.rotation.set(rotation.x ?? 0, yaw + (rotation.y ?? 0), rotation.z ?? 0);
  group.add(mesh);
  return mesh;
}

// Placa de beira de estrada: losango amarelo de aviso ou retângulo com texto.
function signTexture(draw) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  draw(canvas.getContext('2d'));
  return pixelTexture(canvas);
}
const diamondSign = paintIcon => signTexture(ctx => {
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(32, 16); ctx.lineTo(16, 32); ctx.lineTo(0, 16); ctx.fill();
  ctx.fillStyle = '#f0c020';
  ctx.beginPath(); ctx.moveTo(16, 2); ctx.lineTo(30, 16); ctx.lineTo(16, 30); ctx.lineTo(2, 16); ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  paintIcon(ctx);
});
const textSign = (text, background, color) => signTexture(ctx => {
  ctx.fillStyle = background;
  ctx.fillRect(0, 8, 32, 16);
  ctxText(ctx, text, Math.round(16 - textWidth(text) / 2), 13, color);
});

function addSign(group, dist, texture) {
  const at = spot(dist, HALF + 3);
  put(group, new THREE.BoxGeometry(0.15, 2.6, 0.15), solid(0x4a4a4a), { ...at, y: at.y + 1.3 });
  put(group, new THREE.PlaneGeometry(1.8, 1.8), new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }), { ...at, y: at.y + 2.9 });
}

const BUILDERS = {
  // Paredão de pedra na beira, debruçado sobre a pista, com blocos soltos no alto.
  rockfall(group, { dist, side }) {
    const rock = new THREE.DodecahedronGeometry(1, 0), colors = [0x6a5e54, 0x7c7066, 0x5a4e46];
    const stones = [];                               // o paredão inteiro numa só chamada de desenho
    const stone = (color, at, width, height = width) => stones.push({ color, at, width, height });
    for (let along = -16; along <= 16; along += 3) {
      for (let level = 0; level < 5; level++) {
        const lateral = side * (12 + level * -0.6 + Math.random() * 3), size = 2.4 + Math.random() * 1.6;
        stone(colors[Math.floor(Math.random() * colors.length)], spot(dist + along + Math.random() * 2, lateral, level * 3), size, size * 0.9);
      }
    }
    for (let i = 0; i < 4; i++) {                    // pedras soltas na beirada do alto: é de lá que elas caem
      stone(0x8a7e72, spot(dist - 6 + i * 4, side * (HALF + 2.5), 13.5), 1.1 + Math.random() * 0.5);
    }
    const wall = new THREE.InstancedMesh(rock, solid(0xffffff), stones.length), dummy = new THREE.Object3D(), tint = new THREE.Color();
    stones.forEach(({ color, at, width, height }, i) => {
      dummy.position.set(at.x, at.y, at.z);
      dummy.rotation.set(0, at.yaw, 0);
      dummy.scale.set(width, height, width);
      dummy.updateMatrix();
      wall.setMatrixAt(i, dummy.matrix);
      wall.setColorAt(i, tint.setHex(color));
    });
    enableCulling(wall);
    group.add(wall);
    addSign(group, dist - SIGN_AHEAD, diamondSign(ctx => { for (const [x, y, s] of [[12, 9, 5], [18, 15, 4], [11, 19, 6]]) ctx.fillRect(x, y, s, s); }));
  },

  // Pingentes grandes no teto, logo depois da boca do túnel de gelo.
  icicles(group, { dist }) {
    const icicle = new THREE.ConeGeometry(0.6, 1, 5);
    icicle.rotateX(Math.PI);
    icicle.translate(0, -0.5, 0);
    for (let i = 0; i < 26; i++) {
      const lateral = (Math.random() * 2 - 1) * (HALF - 0.5), roof = TUNNEL_HEIGHT * Math.sqrt(1 - (lateral / (HALF + 4)) ** 2);
      const mesh = put(group, icicle, solid(i % 2 ? 0xc4ecf8 : 0x9ad8f0), spot(dist - 8 + Math.random() * 16, lateral, roof, true));
      mesh.scale.set(1, 1 + Math.random() * 1.6, 1);
    }
  },

  // Encosta de neve subindo de um lado: as bolas descem dali e atravessam a pista.
  snowslope(group, { dist, side }) {
    const rows = 12, pos = [], index = [];
    for (let i = 0; i <= rows; i++) {
      const along = -16 + 32 * i / rows;
      for (const [lateral, up] of [[HALF + 4, 0.4], [HALF + 28, 18]]) {
        const p = spot(dist + along, side * lateral, up);
        pos.push(p.x, p.y, p.z);
      }
      if (i < rows) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geometry.setIndex(index);
    group.add(new THREE.Mesh(geometry, solid(0xeef4fa, { side: THREE.DoubleSide })));
    const lump = new THREE.IcosahedronGeometry(1, 0);
    for (let i = 0; i < 10; i++) {
      const u = Math.random(), mesh = put(group, lump, solid(0xd8e4f0), spot(dist - 14 + Math.random() * 28, side * (HALF + 4 + u * 24), 0.4 + u * 17.6));
      mesh.scale.setScalar(0.8 + Math.random() * 1.2);
    }
    addSign(group, dist - SIGN_AHEAD, diamondSign(ctx => { ctx.beginPath(); ctx.arc(16, 18, 6, 0, Math.PI * 2); ctx.fill(); }));
  },

  // A árvore torta é o próprio obstáculo; aqui só as raízes levantando a terra na beira.
  leaningTree(group, { dist, side }) {
    const root = new THREE.BoxGeometry(0.4, 0.4, 2.4);
    for (let i = 0; i < 4; i++) put(group, root, solid(0x4a3018), spot(dist + (i - 1.5) * 0.7, side * (HALF - 0.8), 0.15), { y: (i - 1.5) * 0.5 });
  },

  // Trilha de terra cruzando a estrada e placa de animais na pista.
  animalCrossing(group, { dist }) {
    const trail = new THREE.PlaneGeometry(TRACK_WIDTH + 6, 3);
    trail.rotateX(-Math.PI / 2);
    put(group, trail, solid(0x5a4228, { polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), spot(dist, 0, 0.03, true), { y: Math.PI / 2 });
    addSign(group, dist - SIGN_AHEAD, diamondSign(ctx => { ctx.fillRect(9, 13, 13, 6); ctx.fillRect(20, 10, 5, 5); for (const x of [10, 13, 18, 21]) ctx.fillRect(x, 19, 2, 5); }));
  },

  // Navio pirata atracado de lado para a pista, com os canos para fora das portinholas: é dele que vêm as balas.
  cannonFire(group, { dist, side }, onUpdate) {
    const t = trackAt(dist), lateral = side * (HALF + SHIP_FROM_ROAD);
    const ship = pirateShip(0x1a1a1a, { cannons: side > 0 ? -1 : 1 });   // canos virados para a pista
    const y = t.y - SHIP_BELOW_DECK;
    ship.position.set(t.x - t.tz * lateral, y, t.z + t.tx * lateral);
    ship.rotation.y = Math.atan2(-t.tx, -t.tz) + Math.PI / 2;           // proa no sentido da pista
    group.add(ship);
    onUpdate?.(time => {
      ship.position.y = y + Math.sin(time * 0.9 + dist) * 0.2;
      ship.rotation.z = Math.sin(time * 0.7 + dist) * 0.03;
    });
    addSign(group, dist - SIGN_AHEAD, textSign('FOGO', '#1a1a1a', '#f0d030'));
  },

  // Atracadouro de carga preso ao píer, com barris empilhados: de lá eles escapam e atravessam a pista rolando.
  barrelRoll(group, { dist, side }) {
    const wood = solid(0x6a4a2a), dock = spot(dist, side * (HALF + 9.5), 0, true);
    put(group, new THREE.BoxGeometry(9, 0.5, 16), wood, { ...dock, y: dock.y - 0.25 });
    for (const along of [-7, 7]) for (const out of [-4, 4]) {
      const pile = spot(dist + along, side * (HALF + 9.5 + out), 0, true);
      put(group, new THREE.CylinderGeometry(0.4, 0.45, 9, 6), solid(0x3a2a1a), { ...pile, y: pile.y - 4.5 });
    }
    const barrel = new THREE.CylinderGeometry(0.75, 0.75, 1.5, 9), colors = [0x7a4a24, 0x6a3e1e, 0x8a5a2c];
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 4 - row; i++) put(group, barrel, solid(colors[(i + row) % 3]), spot(dist - 3 + i * 1.6 + row * 0.8, side * (HALF + 10), 0.75 + row * 1.4, true), { x: Math.PI / 2 });
    }
    addSign(group, dist - SIGN_AHEAD, diamondSign(ctx => { ctx.fillRect(10, 12, 12, 9); ctx.fillStyle = '#f0c020'; ctx.fillRect(10, 14, 12, 1); ctx.fillRect(10, 18, 12, 1); }));
  },

  // Travessia de cervos na mata: a mesma trilha de terra e a placa de animais.
  deerCrossing(group, site) { BUILDERS.animalCrossing(group, site); },
  boarCrossing(group, site) { BUILDERS.animalCrossing(group, site); },

  // Guindaste na beira com a carga pendurada sobre a faixa do lado dele.
  crane(group, { dist, side }) {
    const yellow = solid(0xe8b020), dark = solid(0x2a2622);
    const base = spot(dist, side * (HALF + 7));
    put(group, new THREE.BoxGeometry(1.2, 18, 1.2), yellow, { ...base, y: base.y + 9 });
    put(group, new THREE.BoxGeometry(3, 1.2, 3), dark, { ...base, y: base.y + 0.6 });
    const arm = spot(dist, side * 8, 0, true);        // do topo da torre até em cima da faixa (x local é o lado da pista)
    put(group, new THREE.BoxGeometry(12, 0.8, 0.8), yellow, { ...arm, y: base.y + 17 });
    const hook = spot(dist, side * 3, 0, true);
    put(group, new THREE.BoxGeometry(0.08, 3.5, 0.08), dark, { ...hook, y: hook.y + 15.2 });
    for (let i = 0; i < 3; i++) put(group, new THREE.CylinderGeometry(0.5, 0.5, 1.2, 8), solid(0xb02820), spot(dist + i * 1.1 - 1, side * (HALF + 9), 0.6));
    addSign(group, dist - SIGN_AHEAD, diamondSign(ctx => { ctx.fillRect(14, 6, 3, 18); ctx.fillRect(14, 6, 12, 3); ctx.fillRect(22, 9, 1, 7); ctx.fillRect(20, 16, 5, 4); }));
  },

  // Obras: placa, cavaletes listrados na beira e luz piscando. Os cones e pneus são os obstáculos.
  roadworks(group, { dist, side }, onUpdate) {
    addSign(group, dist - SIGN_AHEAD, textSign('OBRAS', '#f06a10', '#1a1a1a'));
    addSign(group, dist - SIGN_AHEAD + 18, diamondSign(ctx => { ctx.fillRect(10, 20, 12, 3); ctx.fillRect(14, 10, 4, 10); }));
    const stripes = signTexture(ctx => { for (let x = 0; x < 32; x += 8) { ctx.fillStyle = '#f06a10'; ctx.fillRect(x, 0, 4, 32); ctx.fillStyle = '#f0f0f0'; ctx.fillRect(x + 4, 0, 4, 32); } });
    const lamp = solid(0xffd020, { fog: false }), lamps = [];
    for (const along of [-10, -3, 4, 11]) {
      const at = spot(dist + along, side * (HALF - 0.6), 0, true);
      put(group, new THREE.BoxGeometry(2.2, 0.9, 0.12), new THREE.MeshBasicMaterial({ map: stripes }), { ...at, y: at.y + 1 }, { y: Math.PI / 2 });
      lamps.push(put(group, new THREE.BoxGeometry(0.25, 0.25, 0.25), lamp, { ...at, y: at.y + 1.6 }));
    }
    onUpdate?.(time => { const on = Math.floor(time * 2.5) % 2 === 0; for (const mesh of lamps) mesh.visible = on; });
  },

  // Saída do box dos dois lados: garagem com pilhas de pneus, faixa zebrada no chão e placa BOX. Os pneus gigantes
  // escapam de um lado e rolam atravessando a pista.
  pitTires(group, { dist }) {
    const zebra = new THREE.PlaneGeometry(TRACK_WIDTH + 6, 1.2);
    zebra.rotateX(-Math.PI / 2);
    for (const [along, color] of [[-2.4, 0xd82020], [-1.2, 0xf0ece4], [1.2, 0xf0ece4], [2.4, 0xd82020]]) {
      put(group, zebra, solid(color, { polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), spot(dist + along, 0, 0.03, true), { y: Math.PI / 2 });
    }
    const tire = new THREE.CylinderGeometry(0.7, 0.7, 0.45, 10);
    for (const side of [-1, 1]) {
      const garage = spot(dist, side * (HALF + 9));
      put(group, new THREE.BoxGeometry(14, 6, 8), solid(0x6a6c78), { ...garage, y: garage.y + 3 });
      put(group, new THREE.BoxGeometry(14.4, 0.8, 8.4), solid(0x2060c0), { ...garage, y: garage.y + 6.2 });
      for (let stack = 0; stack < 3; stack++) {
        for (let level = 0; level < 4; level++) put(group, tire, solid(level % 2 ? 0x232326 : 0x161618), spot(dist - 6 + stack * 6, side * (HALF + 3.5), 0.23 + level * 0.45));
      }
    }
    addSign(group, dist - SIGN_AHEAD, textSign('BOX', '#2060c0', '#ffffff'));
    addSign(group, dist - SIGN_AHEAD + 18, diamondSign(ctx => { ctx.beginPath(); ctx.arc(16, 17, 7, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#f0c020'; ctx.beginPath(); ctx.arc(16, 17, 3, 0, Math.PI * 2); ctx.fill(); }));
  },

  // Mato seco rolando de um lado: placa de vento e moitas secas na beira, de onde vêm as bolas.
  tumbleweeds(group, { dist, side }) {
    const brush = new THREE.IcosahedronGeometry(1, 0);
    for (let i = 0; i < 9; i++) {
      const mesh = put(group, brush, solid(i % 2 ? 0xa08448 : 0xb89a5a), spot(dist - 12 + Math.random() * 24, side * (HALF + 3 + Math.random() * 10), 0.6));
      mesh.scale.set(0.8 + Math.random(), 0.6 + Math.random() * 0.6, 0.8 + Math.random());
    }
    addSign(group, dist - SIGN_AHEAD, diamondSign(ctx => { ctx.beginPath(); ctx.arc(16, 17, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#f0c020'; ctx.fillRect(8, 16, 16, 2); }));
  },

  // Rota de caravana cruzando a estrada, com palmeiras de oásis na beira e placa de camelos.
  camelCrossing(group, { dist }) {
    const trail = new THREE.PlaneGeometry(TRACK_WIDTH + 6, 3.5);
    trail.rotateX(-Math.PI / 2);
    put(group, trail, solid(0xb88c4a, { polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), spot(dist, 0, 0.03, true), { y: Math.PI / 2 });
    for (const side of [-1, 1]) {
      const at = spot(dist + 5, side * (HALF + 5));
      put(group, new THREE.CylinderGeometry(0.25, 0.4, 7, 6), solid(0x6a4a28), { ...at, y: at.y + 3.5 }, { z: side * 0.12 });
      for (let leaf = 0; leaf < 5; leaf++) put(group, new THREE.BoxGeometry(4, 0.12, 0.7), solid(0x3a8a3a), { ...at, y: at.y + 7 }, { y: leaf * 1.26, z: -0.35 });
    }
    addSign(group, dist - SIGN_AHEAD, diamondSign(ctx => { ctx.fillRect(8, 14, 14, 5); ctx.fillRect(18, 8, 4, 8); ctx.fillRect(22, 8, 3, 3); for (const x of [9, 12, 18, 21]) ctx.fillRect(x, 19, 2, 6); ctx.fillRect(12, 11, 3, 3); }));
  },

  // Cactos na faixa interditada, com cerca de estacas e placa de aviso. Os cactos grandes são os obstáculos.
  cactusPatch(group, { dist, side }) {
    addSign(group, dist - SIGN_AHEAD, textSign('CACTOS', '#3a8a3a', '#f0f0f0'));
    const post = new THREE.BoxGeometry(0.25, 1.4, 0.25), bar = new THREE.BoxGeometry(0.15, 0.2, 3);
    for (let along = -9; along <= 9; along += 3) {
      const at = spot(dist + along, side * (HALF - 0.5), 0, true);
      put(group, post, solid(0x6a4a28), { ...at, y: at.y + 0.7 });
      put(group, bar, solid(0x8a6a3a), { ...at, y: at.y + 1.1 }, { y: Math.PI / 2 });
    }
    const small = new THREE.CylinderGeometry(0.22, 0.26, 1.2, 6);
    for (let i = 0; i < 6; i++) put(group, small, solid(0x4a9a3a), spot(dist - 8 + i * 3.2, side * (HALF + 3 + Math.random() * 4), 0.6));
  },

  // Mesa de arenito na beira com a coluna rachada: ela é o obstáculo; aqui ficam o entulho e a placa.
  sandPillar(group, { dist, side }) {
    const chunk = new THREE.DodecahedronGeometry(1, 0), colors = [0xc88a50, 0xa86a38, 0xe0b078];
    for (let i = 0; i < 8; i++) {
      const mesh = put(group, chunk, solid(colors[i % 3]), spot(dist - 5 + Math.random() * 10, side * (HALF + 1 + Math.random() * 5), 0.5));
      mesh.scale.setScalar(0.5 + Math.random() * 0.9);
    }
    addSign(group, dist - SIGN_AHEAD, diamondSign(ctx => { ctx.fillRect(14, 6, 5, 16); ctx.fillRect(10, 22, 13, 3); }));
  },

  // Trilha de siris na areia cruzando a pista e placa de aviso.
  crabCrossing(group, { dist }) {
    const trail = new THREE.PlaneGeometry(TRACK_WIDTH + 6, 3);
    trail.rotateX(-Math.PI / 2);
    put(group, trail, solid(0xc8a870, { polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), spot(dist, 0, 0.03, true), { y: Math.PI / 2 });
    const rock = new THREE.DodecahedronGeometry(0.7, 0);
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) put(group, rock, solid(0x8a7a68), spot(dist - 3 + i * 3, side * (HALF + 2 + Math.random() * 2), 0.3));
    addSign(group, dist - SIGN_AHEAD, diamondSign(ctx => { ctx.fillRect(10, 14, 12, 5); ctx.fillRect(8, 11, 3, 4); ctx.fillRect(21, 11, 3, 4); for (const x of [10, 13, 18, 21]) ctx.fillRect(x, 19, 2, 4); }));
  },

  // Rede de vôlei na beira de onde as bolas escapam e rolam atravessando a pista.
  beachBalls(group, { dist, side }) {
    const net = spot(dist, side * (HALF + 6));
    for (const along of [-3, 3]) put(group, new THREE.CylinderGeometry(0.1, 0.1, 3, 5), solid(0xe8e4dc), { ...net, x: net.x + Math.cos(net.yaw) * along, z: net.z - Math.sin(net.yaw) * along, y: net.y + 1.5 });
    put(group, new THREE.BoxGeometry(6, 1, 0.05), solid(0xf0f0f0), { ...net, y: net.y + 2.4 });
    const ball = new THREE.IcosahedronGeometry(0.5, 0);
    for (let i = 0; i < 4; i++) put(group, ball, solid([0xe83a3a, 0xf0d030, 0x3a7ae8, 0xffffff][i]), spot(dist - 8 + i * 5, side * (HALF + 4 + Math.random() * 3), 0.5));
    addSign(group, dist - SIGN_AHEAD, diamondSign(ctx => { ctx.beginPath(); ctx.arc(16, 17, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#f0c020'; ctx.fillRect(10, 16, 12, 2); }));
  },

  // Guarda-sóis e toalhas na faixa interditada; o grande é o obstáculo.
  umbrellaPatch(group, { dist, side }) {
    addSign(group, dist - SIGN_AHEAD, textSign('PRAIA', '#2a9ab8', '#ffffff'));
    const towel = new THREE.BoxGeometry(1.4, 0.05, 2.4);
    [0xe83a3a, 0x3a7ae8, 0xf0d030, 0x3aa860].forEach((color, i) => put(group, towel, solid(color), spot(dist - 9 + i * 6, side * (HALF + 2.5 + (i % 2) * 2), 0.04), { y: i }));
    const pole = new THREE.CylinderGeometry(0.05, 0.05, 2.4, 5), canopy = new THREE.ConeGeometry(1.6, 0.7, 8);
    for (let i = 0; i < 3; i++) {
      const at = spot(dist - 6 + i * 6, side * (HALF + 5), 0);
      put(group, pole, solid(0xd8d8d0), { ...at, y: at.y + 1.2 });
      put(group, canopy, solid([0x3a7ae8, 0xf0d030, 0xe83a3a][i]), { ...at, y: at.y + 2.6 });
    }
  },

  // Coqueiro torto sobre a pista com cocos pendurados: é de lá que eles caem.
  coconutFall(group, { dist, side }) {
    const base = spot(dist, side * (HALF + 2.5), 0, false, true), lean = -side * 0.5;
    put(group, new THREE.CylinderGeometry(0.3, 0.5, 11, 6), solid(0x7a5a38), { ...base, y: base.y + 5.5 }, { z: lean });
    const top = spot(dist, side * (HALF + 2.5 - Math.sin(-lean) * 5.4), 0, false, true);
    for (let leaf = 0; leaf < 6; leaf++) put(group, new THREE.BoxGeometry(5, 0.15, 1.1), solid(leaf % 2 ? 0x2f8a3a : 0x3aa048), { ...top, y: top.y + 10.6 }, { y: leaf * 1.05, z: -0.3 });
    const coconut = new THREE.IcosahedronGeometry(0.45, 0);
    for (let i = 0; i < 4; i++) put(group, coconut, solid(0x6a4a28), spot(dist - 1.2 + i * 0.8, side * (HALF + 0.4), 10.2, false, true));
    addSign(group, dist - SIGN_AHEAD, diamondSign(ctx => { ctx.beginPath(); ctx.arc(16, 20, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(15, 7, 2, 8); }));
  },

  // Borda de cratera com rochas incandescentes no alto: de lá caem os meteoros.
  meteorShower(group, { dist, side }) {
    const rock = new THREE.DodecahedronGeometry(1, 0), glow = new THREE.DodecahedronGeometry(1, 0);
    for (let along = -14; along <= 14; along += 3.5) for (let level = 0; level < 3; level++) {
      const size = 2 + Math.random() * 1.6, mesh = put(group, rock, solid(level % 2 ? 0x4a4650 : 0x5a5660), spot(dist + along + Math.random() * 2, side * (12 - level * 0.6 + Math.random() * 3), level * 3.2));
      mesh.scale.set(size, size * 0.9, size);
    }
    for (let i = 0; i < 3; i++) put(group, glow, solid(0xff8a30, { fog: false }), spot(dist - 5 + i * 5, side * (HALF + 2.5), 19)).scale.setScalar(0.9 + Math.random() * 0.4);
    addSign(group, dist - SIGN_AHEAD, diamondSign(ctx => { ctx.beginPath(); ctx.arc(13, 20, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(16, 8, 3, 3); ctx.fillRect(19, 5, 3, 3); ctx.fillRect(22, 2, 3, 3); }));
  },

  // Marcas de esteira de rover cruzando a pista, balizas luminosas e placa.
  roverCrossing(group, { dist }) {
    const trail = new THREE.PlaneGeometry(TRACK_WIDTH + 6, 3.2);
    trail.rotateX(-Math.PI / 2);
    put(group, trail, solid(0x5a5e6a, { polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), spot(dist, 0, 0.03, true), { y: Math.PI / 2 });
    const beacon = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    for (const side of [-1, 1]) {
      const at = spot(dist, side * (HALF + 1.6));
      put(group, new THREE.CylinderGeometry(0.08, 0.08, 2.4, 5), solid(0xb8bcc8), { ...at, y: at.y + 1.2 });
      put(group, beacon, solid(0xffb020, { fog: false }), { ...at, y: at.y + 2.5 });
    }
    addSign(group, dist - SIGN_AHEAD, diamondSign(ctx => { ctx.fillRect(8, 15, 16, 5); ctx.fillRect(12, 11, 7, 4); for (const x of [10, 15, 20]) ctx.fillRect(x, 20, 3, 3); }));
  },

  // Base e escombros da antena que tomba.
  brokenAntenna(group, { dist, side }) {
    const base = spot(dist, side * (HALF - 0.8), 0.2);
    put(group, new THREE.CylinderGeometry(1, 1.3, 0.6, 7), solid(0x6a6e7a), { ...base, y: base.y + 0.1 });
    const chunk = new THREE.DodecahedronGeometry(0.5, 0);
    for (let i = 0; i < 5; i++) put(group, chunk, solid(i % 2 ? 0xb8bcc8 : 0x8a8e9a), spot(dist - 3 + i * 1.5, side * (HALF + 1 + Math.random() * 2.5), 0.4));
    addSign(group, dist - SIGN_AHEAD, diamondSign(ctx => { ctx.fillRect(15, 6, 2, 16); ctx.fillRect(11, 9, 10, 2); ctx.fillRect(12, 22, 8, 2); }));
  },

  // Cristais luminosos na faixa interditada, com cerca de balizas.
  crystalPatch(group, { dist, side }) {
    addSign(group, dist - SIGN_AHEAD, textSign('GEMAS', '#2a90c0', '#ffffff'));
    const post = new THREE.CylinderGeometry(0.08, 0.08, 1.4, 5), lamp = new THREE.BoxGeometry(0.25, 0.25, 0.25);
    for (let along = -9; along <= 9; along += 3) {
      const at = spot(dist + along, side * (HALF - 0.5), 0, true);
      put(group, post, solid(0xb8bcc8), { ...at, y: at.y + 0.7 });
      put(group, lamp, solid(0x40e0f0, { fog: false }), { ...at, y: at.y + 1.5 });
    }
    const small = new THREE.ConeGeometry(0.3, 1.2, 5);
    for (let i = 0; i < 6; i++) put(group, small, solid(0x40e0f0, { fog: false }), spot(dist - 8 + i * 3.2, side * (HALF + 3 + Math.random() * 4), 0.6));
  },

  // Cruzamento: faixa de pedestres e semáforos piscando no amarelo dos dois lados.
  kaijuCrossing(group, { dist }, onUpdate) {
    const stripe = new THREE.PlaneGeometry(0.9, 4);
    stripe.rotateX(-Math.PI / 2);
    const paint = solid(0xf0f0f0, { polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    for (let lateral = -HALF + 0.8; lateral < HALF; lateral += 1.8) put(group, stripe, paint, spot(dist, lateral, 0.03, true));
    const lights = [];
    for (const lateral of [-(HALF + 2), HALF + 2]) {
      const at = spot(dist - 4, lateral);
      put(group, new THREE.BoxGeometry(0.25, 5, 0.25), solid(0x2a2a30), { ...at, y: at.y + 2.5 });
      put(group, new THREE.BoxGeometry(0.6, 1.6, 0.5), solid(0x18181c), { ...at, y: at.y + 5.4 });
      lights.push(put(group, new THREE.BoxGeometry(0.4, 0.4, 0.55), solid(0xffb020, { fog: false }), { ...at, y: at.y + 5.4 }));
    }
    addSign(group, dist - SIGN_AHEAD, diamondSign(ctx => { ctx.fillRect(13, 7, 6, 10); ctx.fillRect(10, 17, 4, 7); ctx.fillRect(18, 17, 4, 7); ctx.fillRect(19, 9, 6, 2); }));
    onUpdate?.(time => { const on = Math.floor(time * 2) % 2 === 0; for (const mesh of lights) mesh.visible = on; });
  },
};

export function buildHazardSites(group, layout, onUpdate) {
  for (const site of layout.hazards) BUILDERS[site.kind]?.(group, site, onUpdate);
}

// Placa larga (64x32) para textos maiores, como NEVE ou ESTEIRA.
function wideSign(text, background, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = background;
  ctx.fillRect(0, 6, 64, 20);
  ctxText(ctx, text, Math.round(32 - textWidth(text) / 2), 13, color);
  return pixelTexture(canvas);
}
function addWideSign(group, dist, texture, side = 1) {
  const at = spot(dist, side * (HALF + 3));
  put(group, new THREE.BoxGeometry(0.15, 2.6, 0.15), solid(0x4a4a4a), { ...at, y: at.y + 1.3 });
  put(group, new THREE.PlaneGeometry(3.6, 1.8), new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }), { ...at, y: at.y + 2.9 });
}

// Faixa sobre a pista entre duas distâncias e duas posições laterais, um tico acima do asfalto. `tile`: metros por repetição da imagem.
function roadStrip(from, to, lateralA, lateralB, tile, lift = 0.03) {
  const rows = Math.max(1, Math.round((to - from) / track.step)), pos = [], uv = [], index = [];
  for (let i = 0; i <= rows; i++) {
    const d = from + (to - from) * i / rows;
    for (const [lateral, u] of [[lateralA, 0], [lateralB, 1]]) {
      const p = spot(d, lateral, lift, true);
      pos.push(p.x, p.y, p.z);
      uv.push(u, (d - from) / tile);
    }
    if (i < rows) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(index);
  return geometry;
}
const overRoadMaterial = (extra = {}) => ({ side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5, ...extra });

// Aviso do clima pesado (areia, temporal, nevasca): placas e bandeirolas balançando antes da entrada, e, se a pista
// alaga, uma lâmina d'água ondulando por cima dela. A neblina e as partículas ficam em scenery.js e main.js.
export function buildStormSites(group, layout, onUpdate) {
  for (const { start, length, label, flooded, waterColor } of layout.storms ?? []) {
    addWideSign(group, start - 110, wideSign(label, '#d89040', '#1a1a1a'));
    addSign(group, start - 60, diamondSign(ctx => { for (const y of [11, 16, 21]) ctx.fillRect(7, y, 18 - (y % 2) * 4, 2); }));
    const flags = [];
    for (const side of [-1, 1]) {
      const at = spot(start - 20, side * (HALF + 2.5));
      put(group, new THREE.BoxGeometry(0.15, 5, 0.15), solid(0x4a3a28), { ...at, y: at.y + 2.5 });
      flags.push(put(group, new THREE.BoxGeometry(0.1, 0.9, 1.8), solid(0xc83a2a), { ...at, y: at.y + 4.4 }));
    }
    onUpdate?.(time => flags.forEach((flag, i) => { flag.rotation.y = Math.sin(time * 6 + i) * 0.5 + 0.4; }));
    if (flooded) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 32;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = waterColor; ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#8ac0d0'; for (let i = 0; i < 14; i++) ctx.fillRect(Math.random() * 28, Math.random() * 32, 3 + Math.random() * 4, 1);
      const texture = pixelTexture(canvas);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      const water = new THREE.Mesh(roadStrip(start, start + length, -HALF - 0.2, HALF + 0.2, 8, 0.05), new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.5, depthWrite: false, ...overRoadMaterial() }));
      group.add(water);
      onUpdate?.(time => { texture.offset.y = time * 0.15; texture.offset.x = Math.sin(time * 0.7) * 0.1; water.material.opacity = 0.45 + Math.sin(time * 2) * 0.06; });
    }
  }
}

// Esteiras rolantes: duas faixas de setas em movimento, uma em cada metade da pista, correndo em sentidos opostos.
export function buildBeltSites(group, layout, onUpdate) {
  const make = forward => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 16;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = forward ? '#3a3226' : '#2a2c3a'; ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = forward ? '#f0b020' : '#d84020';
    for (let k = 0; k < 5; k++) {                    // seta em V; v cresce no sentido da corrida
      const y = forward ? 4 + k : 11 - k;
      ctx.fillRect(7 - k, y, 2, 1); ctx.fillRect(7 + k, y, 2, 1);
    }
    const texture = pixelTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
  };
  for (const { start, length, dir } of layout.belts ?? []) {
    const textures = [];
    // Metade esquerda (lateral < 0) vai no sentido `dir`, a direita no contrário.
    for (const [a, b, direction] of [[-HALF, -0.15, dir], [0.15, HALF, -dir]]) {
      const texture = make(direction > 0);
      textures.push([texture, direction]);
      group.add(new THREE.Mesh(roadStrip(start, start + length, a, b, 4, 0.04), new THREE.MeshBasicMaterial({ map: texture, ...overRoadMaterial() })));
    }
    onUpdate?.(time => { for (const [texture, direction] of textures) texture.offset.y = -time * 1.4 * direction; });
    addWideSign(group, start - 55, wideSign('ESTEIRA', '#e8b018', '#1a1a1a'), 1);
    addWideSign(group, start - 55, wideSign('ESTEIRA', '#e8b018', '#1a1a1a'), -1);
    const lampMaterial = solid(0xff5010, { fog: false });
    for (const along of [0, length]) for (const side of [-1, 1]) put(group, new THREE.BoxGeometry(0.5, 0.5, 0.5), lampMaterial, spot(start + along, side * (HALF + 1.2), 1.2));
    onUpdate?.(time => { lampMaterial.visible = Math.floor(time * 3) % 2 === 0; });
  }
}

// Trecho de muro aberto para a travessia (o que atravessa vem de fora da pista). `side` -1 ou 1.
const OPENING = 12;
export function wallOpenAt(layout, k, side) {
  const distance = k * track.step;
  return layout.hazards.some(site => {
    const kind = HAZARD_KINDS[site.kind];
    if (!kind.opening || (kind.motion !== 'cross' && site.side !== side)) return false;
    const offset = ((distance - site.dist) % track.length + track.length + track.length / 2) % track.length - track.length / 2;
    return Math.abs(offset) < OPENING;
  });
}

// Rajadas de vento (cânion): birutas dos dois lados apontam para onde o vento vai empurrar e se enchem conforme a
// rajada se arma. Antes do trecho, placa VENTO. A física fica em track.js (gustAt) e race.js.
const SOCK_EVERY = 32, SOCK_POLE = 5.5, SOCK_LENGTH = 2.6;
export function buildGustSites(group, layout, onUpdate) {
  const pole = new THREE.BoxGeometry(0.18, SOCK_POLE, 0.18), poleMaterial = solid(0x6a6460);
  const sock = new THREE.CylinderGeometry(0.22, 0.55, SOCK_LENGTH, 6, 1, true);
  sock.translate(0, SOCK_LENGTH / 2, 0);
  const band = new THREE.CylinderGeometry(0.4, 0.46, 0.5, 6, 1, true);
  band.translate(0, SOCK_LENGTH * 0.45, 0);
  const sockMaterial = solid(0xf06a18, { side: THREE.DoubleSide }), bandMaterial = solid(0xf4f0e8, { side: THREE.DoubleSide });
  for (const zone of layout.gusts ?? []) {
    const socks = [];
    for (let along = 6; along < zone.length; along += SOCK_EVERY) {
      for (const side of [-1, 1]) {
        const at = spot(zone.start + along, side * (HALF + 2.2));
        put(group, pole, poleMaterial, { ...at, y: at.y + SOCK_POLE / 2 });
        const pivot = new THREE.Group();
        pivot.position.set(at.x, at.y + SOCK_POLE - 0.2, at.z);
        pivot.rotation.order = 'YXZ';
        pivot.rotation.y = at.yaw;
        const arm = new THREE.Group();
        arm.add(new THREE.Mesh(sock, sockMaterial), new THREE.Mesh(band, bandMaterial));
        pivot.add(arm);
        group.add(pivot);
        socks.push({ arm, dist: zone.start + along, phase: Math.random() * 6 });
      }
    }
    addWideSign(group, zone.start - 50, wideSign('VENTO', '#e8e0d0', '#2a2420'), 1);
    addWideSign(group, zone.start - 50, wideSign('VENTO', '#e8e0d0', '#2a2420'), -1);
    onUpdate?.(time => {
      for (const s of socks) {
        const gust = gustAt(s.dist, raceClock.time);
        const strength = gust ? Math.min(1, gust.level + gust.warn * 0.45) : 0, dir = gust?.dir ?? 1;
        const flutter = Math.sin(time * (8 + strength * 14) + s.phase) * (0.05 + strength * 0.08);
        s.arm.rotation.z = Math.PI + dir * (0.15 + strength * 0.85) * Math.PI / 2 + flutter;   // de pendurada a esticada de lado
      }
    });
  }
}

// Placas de turbo (salar): faixa de setas correndo para a frente, com borda acesa, e pontinhos no chão mostrando o
// caminho até ela. A do salto grande tem placa TURBO dos dois lados.
const GUIDE_AHEAD = 45, GUIDE_EVERY = 5;
export function buildBoostSites(group, layout, onUpdate) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 16;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0e2a3a'; ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = '#30f0ff';
  for (let k = 0; k < 6; k++) { ctx.fillRect(7 - k, 3 + k, 2, 2); ctx.fillRect(7 + k, 3 + k, 2, 2); }
  ctx.fillStyle = '#f040c0';
  for (let k = 0; k < 4; k++) { ctx.fillRect(7 - k, 10 + k, 1, 1); ctx.fillRect(8 + k, 10 + k, 1, 1); }
  const texture = pixelTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  const padMaterial = new THREE.MeshBasicMaterial({ map: texture, fog: false, ...overRoadMaterial() });
  const edgeMaterial = new THREE.MeshBasicMaterial({ color: 0x30f0ff, fog: false, ...overRoadMaterial() });
  const guideMaterial = new THREE.MeshBasicMaterial({ color: 0x30f0ff, fog: false, transparent: true, opacity: 0.8, ...overRoadMaterial() });
  for (const pad of layout.boosts ?? []) {
    const a = pad.lane - pad.half, b = pad.lane + pad.half;
    group.add(new THREE.Mesh(roadStrip(pad.start, pad.start + pad.length, a, b, pad.half * 2, 0.05), padMaterial));
    for (const lateral of [a, b]) group.add(new THREE.Mesh(roadStrip(pad.start, pad.start + pad.length, lateral - 0.2, lateral + 0.2, 4, 0.06), edgeMaterial));
    for (let d = GUIDE_EVERY; d <= GUIDE_AHEAD; d += GUIDE_EVERY) {
      group.add(new THREE.Mesh(roadStrip(pad.start - d, pad.start - d + 1.2, pad.lane - 0.4, pad.lane + 0.4, 2, 0.05), guideMaterial));
    }
    if (pad.jump) {
      addWideSign(group, pad.start - 70, wideSign('TURBO', '#30f0ff', '#0e2a3a'), 1);
      addWideSign(group, pad.start - 70, wideSign('TURBO', '#30f0ff', '#0e2a3a'), -1);
    }
  }
  onUpdate?.(time => {
    texture.offset.y = -time * 3;
    guideMaterial.opacity = 0.45 + 0.4 * (Math.floor(time * 4) % 2);
  });
}
