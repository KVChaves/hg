import * as THREE from 'three';
import { TRACK_WIDTH } from '../config.js';
import { ctxText, textWidth } from '../art/font.js';
import { HAZARD_KINDS } from '../game/hazardKinds.js';
import { TUNNEL_HEIGHT } from '../game/mapLayout.js';
import { track, trackAt } from './track.js';
import { pixelTexture } from './textures.js';

// O motivo de cada ponto de perigo, no cenário: paredão de onde caem pedras, encosta de neve, placa de travessia
// de animais, guindaste, obras sinalizadas, faixa de pedestres do kaiju... Assim o jogador vê de longe que ali
// tem perigo e aprende a pista. Os obstáculos em si ficam em game/obstacles.js.

const HALF = TRACK_WIDTH / 2, SIGN_AHEAD = 45;
const solid = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });

// Ponto ao lado da pista: `lateral` positivo é à direita de quem corre; `up` é a altura sobre o chão dali.
function spot(dist, lateral, up = 0, onRoad = false) {
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
    for (let along = -16; along <= 16; along += 3) {
      for (let level = 0; level < 5; level++) {
        const lateral = side * (12 + level * -0.6 + Math.random() * 3), size = 2.4 + Math.random() * 1.6;
        const mesh = put(group, rock, solid(colors[Math.floor(Math.random() * colors.length)]), spot(dist + along + Math.random() * 2, lateral, level * 3));
        mesh.scale.set(size, size * 0.9, size);
      }
    }
    for (let i = 0; i < 4; i++) {                    // pedras soltas na beirada do alto: é de lá que elas caem
      const mesh = put(group, rock, solid(0x8a7e72), spot(dist - 6 + i * 4, side * (HALF + 2.5), 13.5));
      mesh.scale.setScalar(1.1 + Math.random() * 0.5);
    }
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
