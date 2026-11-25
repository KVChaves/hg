import * as THREE from 'three';
import { CASTLE_HALF, CASTLE_JUMP } from '../game/mapLayout.js';
import { deckGeometry, masonryTexture, plankTexture, slabGeometry } from './epicVisuals.js';
import { enableCulling } from './instancing.js';
import { pixelTexture } from './textures.js';
import { CASTLE_RADIUS, track, trackAt, turnAt } from './track.js';

// O castelo da Estrada do Rei (trecho `castle` de mapLayout.js): ponte levadiça de tábuas meio erguida (a rampa),
// portaria com o vão baixo por onde o carro voa, pátio estreito de muralhas altas com piso de mármore e tapete,
// torres nas duas curvas de 90°, torre de menagem, portão de saída e a descida de pedra.
// A viga de cima do portão fica em `gate.height`; o arco do salto passa sempre por baixo dela (flight.js).

const INNER = CASTLE_HALF + 0.65;                    // face de dentro das muralhas (o carro para a meia largura dela)
const WALL_THICK = 2.6, WALL_HIGH = 9, MERLON = { width: 1.4, height: 1.3, every: 3 };
const GATEHOUSE_HALF = 15, GATEHOUSE_HIGH = 14, EXIT_OPENING = 8;
const TOWER = { radius: 4.4, above: 17, roof: 7.5 }, KEEP = { half: 8, above: 30 };
const BASE_SINK = 4, CHAIN_LINK = 0.9, TORCH_EVERY = 14, BANNER_EVERY = 26;
const PARAPET = { height: 0.85, thickness: 0.7 };

const yawOf = t => Math.atan2(-t.tx, -t.tz);
const at = (distance, lateral, up = 0) => {
  const t = trackAt(distance);
  return new THREE.Vector3(t.x - t.tz * lateral, t.y + up, t.z + t.tx * lateral);
};
const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });

// Caixa alinhada com a pista em `distance`: largura de lado, altura e comprimento ao longo dela.
function boxAt(group, material, distance, lateral, up, width, height, depth) {
  const t = trackAt(distance), mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(t.x - t.tz * lateral, t.y + up, t.z + t.tx * lateral);
  mesh.rotation.y = yawOf(t);
  group.add(mesh);
  return mesh;
}

function canvas(width, height, draw) {
  const element = document.createElement('canvas');
  element.width = width; element.height = height;
  draw(element.getContext('2d'), width, height);
  const texture = pixelTexture(element);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// Mármore em xadrez (creme e ardósia) com rejunte fino e veios: cada imagem cobre 2 x 2 lajotas.
const floorTexture = ({ light, dark, grout }) => canvas(16, 16, (ctx) => {
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
    ctx.fillStyle = (x + y) % 2 ? dark : light;
    ctx.fillRect(x * 8, y * 8, 8, 8);
  }
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  for (let i = 0; i < 6; i++) ctx.fillRect(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), 2, 1);
  ctx.fillStyle = grout;
  for (const k of [0, 8]) { ctx.fillRect(k, 0, 1, 16); ctx.fillRect(0, k, 16, 1); }
});

// Tapete vermelho com barra dourada e losangos: a imagem atravessa a largura dele e se repete a cada 3 m.
const carpetTexture = ({ carpet, trim }) => canvas(16, 16, (ctx) => {
  ctx.fillStyle = carpet; ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = trim; ctx.fillRect(0, 0, 2, 16); ctx.fillRect(14, 0, 2, 16);
  ctx.fillRect(7, 3, 2, 2); ctx.fillRect(6, 5, 4, 2); ctx.fillRect(7, 7, 2, 2);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(2, 0, 1, 16); ctx.fillRect(13, 0, 1, 16);
});

// Estandarte: faixa de pano com uma cruz e borda, cortado em ponta embaixo.
const bannerTexture = (cloth, emblem) => canvas(8, 24, (ctx) => {
  ctx.fillStyle = cloth; ctx.fillRect(0, 0, 8, 20);
  ctx.beginPath(); ctx.moveTo(0, 20); ctx.lineTo(8, 20); ctx.lineTo(4, 24); ctx.fill();
  ctx.fillStyle = emblem; ctx.fillRect(3, 4, 2, 10); ctx.fillRect(1, 7, 6, 2); ctx.fillRect(0, 0, 8, 1);
});

// Faixa plana que acompanha a pista de `from` a `to`, de `left` a `right` m do centro, `lift` m acima dela.
// A textura fica presa ao mundo: u de lado (a cada `tile` m) e v ao longo da pista.
function floorGeometry(from, to, left, right, lift, tile) {
  const steps = Math.max(1, Math.round((to - from) / track.step * 2)), pos = [], uv = [], index = [];
  for (let i = 0; i <= steps; i++) {
    const distance = from + (to - from) * i / steps, t = trackAt(distance);
    for (const lateral of [left, right]) {
      pos.push(t.x - t.tz * lateral, t.y + lift, t.z + t.tx * lateral);
      uv.push((lateral - left) / tile, (distance - from) / tile);
    }
    if (i < steps) index.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(index);
  return geometry;
}

// Ameias no topo de uma muralha que acompanha a pista (`lateral` é o meio dela), instanciadas.
function addMerlons(from, to, lateral, top, list) {
  for (let d = from + MERLON.every / 2; d < to; d += MERLON.every) list.push({ d, lateral, top });
}

function buildMerlons(group, material, list) {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(MERLON.width, MERLON.height, MERLON.width), material, list.length);
  const matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  list.forEach(({ d, lateral, top }, i) => {
    const t = trackAt(d), position = at(d, lateral, top + MERLON.height / 2);
    rotation.setFromAxisAngle(up, yawOf(t));
    matrix.compose(position, rotation, scale);
    mesh.setMatrixAt(i, matrix);
  });
  enableCulling(mesh);
  group.add(mesh);
}

// Torre redonda com telhado cônico e bandeira, do chão até `above` m acima do pátio.
function addTower(group, { block: stone, roof, flag }, position, floorY, groundY, { radius = TOWER.radius, above = TOWER.above } = {}) {
  const bottom = groundY - BASE_SINK, height = floorY + above - bottom;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.08, height, 10), stone);
  body.position.set(position.x, bottom + height / 2, position.z);
  group.add(body);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(radius + 0.6, radius + 0.6, 1.2, 10), stone);   // parapeito no alto
  ring.position.set(position.x, floorY + above + 0.6, position.z);
  group.add(ring);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(radius + 0.9, TOWER.roof, 10), roof);
  cap.position.set(position.x, floorY + above + 1.2 + TOWER.roof / 2, position.z);
  group.add(cap);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.4, 4), basic(0x3a3028));
  const tip = floorY + above + 1.2 + TOWER.roof;
  pole.position.set(position.x, tip + 1.6, position.z);
  group.add(pole);
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.3), flag);
  banner.position.set(position.x + 1.2, tip + 2.6, position.z);
  group.add(banner);
  return banner;
}

// Portaria: muralha atravessada na pista com um vão de `opening` m de altura e a largura do pátio, grade levantada
// e ameias. `from` é a face de fora; a muralha vai até `from + depth`.
function addGatehouse(group, mats, from, depth, opening, merlons) {
  const middle = from + depth / 2, side = GATEHOUSE_HALF - INNER;
  for (const sign of [-1, 1]) boxAt(group, mats.block, middle, sign * (INNER + side / 2), GATEHOUSE_HIGH / 2 - BASE_SINK / 2, side, GATEHOUSE_HIGH + BASE_SINK, depth);
  boxAt(group, mats.block, middle, 0, opening + (GATEHOUSE_HIGH - opening) / 2, INNER * 2, GATEHOUSE_HIGH - opening, depth);
  // Grade levantada: as pontas dos ferros aparecem logo acima do vão, sem descer nele.
  for (let lateral = -INNER + 1; lateral < INNER; lateral += 1.4) boxAt(group, mats.iron, from - 0.3, lateral, opening + 0.9, 0.18, 1.8, 0.18);
  boxAt(group, mats.iron, from - 0.3, 0, opening + 1.5, INNER * 2, 0.22, 0.22);
  for (let lateral = -GATEHOUSE_HALF + 0.7; lateral < GATEHOUSE_HALF; lateral += MERLON.every) {
    for (const along of [from + 0.7, from + depth - 0.7]) merlons.push({ d: along, lateral, top: GATEHOUSE_HIGH });
  }
}

// Fileira de elos (caixas alternadas) de `a` até `b`.
function addChain(group, material, a, b) {
  const span = b.clone().sub(a), links = Math.max(1, Math.round(span.length() / CHAIN_LINK)), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < links; i++) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, CHAIN_LINK * 1.1, i % 2 ? 0.42 : 0.16), material);
    mesh.position.copy(a).addScaledVector(span, (i + 0.5) / links);
    mesh.quaternion.setFromUnitVectors(up, span.clone().normalize());
    group.add(mesh);
  }
}

// Pontos (x, z) cobertos pelo castelo, para o cenário não nascer dentro dele: perto da pista entre a ponte e o fim
// da descida, e a torre de menagem.
export function castleFootprint(layout) {
  const section = layout.epics.find(epic => epic.type === 'castle');
  if (!section) return () => false;
  const points = [], keep = keepSpot(section);
  for (let d = section.start - 20; d <= section.start + section.length + 10; d += 4) points.push(at(d, 0));
  const reach = (GATEHOUSE_HALF + 14) ** 2;
  return (x, z) => points.some(p => (p.x - x) ** 2 + (p.z - z) ** 2 < reach) || (keep && (keep.x - x) ** 2 + (keep.z - z) ** 2 < (KEEP.half + 10) ** 2);
}

// As curvas do pátio ([começo, fim] em metros), na ordem: turn1, turn2... (trackShapes.js marca quantas houver).
const turnsOf = castle => {
  const turns = [];
  for (let k = 1; castle[`turn${k}`] !== undefined; k++) turns.push([castle[`turn${k}`], castle[`turn${k}End`]]);
  return turns;
};

// A torre de menagem fica no meio do pátio: com o pátio em Π, entre a linha de entrada e a reta do fundo; com só
// duas curvas, ao lado da reta entre elas, do lado para onde a pista vai depois.
function keepSpot({ castle }) {
  const turns = turnsOf(castle);
  if (turns.length >= 4) {
    const back = at((turns[1][1] + turns[2][0]) / 2, 0), entry = at(turns[0][0], 0), leave = at(turns[3][1], 0);
    return back.clone().add(entry.add(leave).multiplyScalar(0.5)).multiplyScalar(0.5);
  }
  const middle = (castle.turn1End + castle.turn2) / 2, turn = Math.sign(turnAt((castle.turn2 + castle.turn2End) / 2)) || 1;
  return at(middle, turn * (INNER + WALL_THICK + KEEP.half + 4));
}

export function buildCastle(group, layout, biome, onUpdate) {
  const section = layout.epics.find(epic => epic.type === 'castle');
  if (!section) return;
  const look = biome.castle, { gate, castle } = section;
  const start = section.start, lip = start + CASTLE_JUMP.ramp, inside = gate.at + gate.depth, exitFrom = castle.exitGate - gate.depth;
  const end = section.start + section.length, floorY = trackAt(gate.at).y;
  const groundY = floorY - track.lift[Math.floor(gate.at / track.step) % track.count];   // chão de fora, sem o que a rampa ergueu
  const mats = {
    stone: new THREE.MeshBasicMaterial({ map: masonryTexture(look.stone), side: THREE.DoubleSide }),   // as muralhas se veem de dentro do pátio e de fora
    base: new THREE.MeshBasicMaterial({ map: masonryTexture(look.base ?? look.stone), side: THREE.DoubleSide }),
    roof: basic(look.roof), iron: basic(0x2a2a30), wood: basic(0x5a3a20), chain: basic(0x3a3a40),
    flag: new THREE.MeshBasicMaterial({ color: look.flag, side: THREE.DoubleSide }),
  };
  // Caixas e torres têm uv de 0 a 1 por face: a pedra delas repete mais, para não ficar gigante.
  const blockMap = masonryTexture(look.stone);
  blockMap.repeat.set(3, 3);
  mats.block = new THREE.MeshBasicMaterial({ map: blockMap, side: THREE.DoubleSide });
  const merlons = [];

  // Ponte levadiça: tábuas sobre vigas, com correntes do bico até o alto da portaria.
  const deckHalf = INNER, planks = new THREE.MeshBasicMaterial({ map: plankTexture(), side: THREE.DoubleSide });
  group.add(new THREE.Mesh(deckGeometry(start, lip, deckHalf), planks));
  group.add(new THREE.Mesh(slabGeometry(start, lip, -deckHalf, deckHalf, t => t.y - 0.02, t => t.y - 0.7), mats.wood));
  for (const sign of [-1, 1]) {
    group.add(new THREE.Mesh(slabGeometry(start, lip, sign > 0 ? deckHalf : -deckHalf - 0.5, sign > 0 ? deckHalf + 0.5 : -deckHalf, t => t.y + 0.45, t => t.y - 0.7), mats.wood));   // guarda de tábua
    addChain(group, mats.chain, at(lip, sign * (deckHalf + 0.4), 0.3), at(gate.at, sign * (deckHalf + 0.4), GATEHOUSE_HIGH - 3));
  }
  // Cabeceira de pedra sob o começo da ponte, até o fundo.
  group.add(new THREE.Mesh(slabGeometry(start, lip, -deckHalf + 0.6, deckHalf - 0.6, t => t.y - 0.7, () => section.floor - 3), mats.base));

  // Base de pedra do castelo, do pátio até o fundo do fosso, e o corredor de muralhas.
  const outer = INNER + WALL_THICK;
  group.add(new THREE.Mesh(slabGeometry(gate.at, castle.exitGate, -outer, outer, t => t.y - 0.05, () => section.floor - 3), mats.base));
  for (const sign of [-1, 1]) {
    const left = sign > 0 ? INNER : -outer, right = sign > 0 ? outer : -INNER;
    group.add(new THREE.Mesh(slabGeometry(inside, exitFrom, left, right, t => t.y + WALL_HIGH, t => t.y - 0.05), mats.stone));
    addMerlons(inside, exitFrom, sign * (outer - MERLON.width / 2), WALL_HIGH, merlons);
    addMerlons(inside, exitFrom, sign * (INNER + MERLON.width / 2), WALL_HIGH, merlons);
  }

  // Piso do pátio: mármore em xadrez e o tapete do rei no meio.
  const offset = n => ({ polygonOffset: true, polygonOffsetFactor: n, polygonOffsetUnits: n });
  const marble = new THREE.MeshBasicMaterial({ map: floorTexture(look.floor), ...offset(-2) });
  group.add(new THREE.Mesh(floorGeometry(gate.at, castle.exitGate, -INNER, INNER, 0, 2), marble));
  const carpet = new THREE.MeshBasicMaterial({ map: carpetTexture(look.floor), ...offset(-4) });
  group.add(new THREE.Mesh(floorGeometry(gate.at + 2, castle.exitGate - 2, -2.4, 2.4, 0.01, 4.8), carpet));

  // Portarias de entrada (vão baixo: é por ele que se voa) e de saída, com torres dos dois lados.
  addGatehouse(group, mats, gate.at, gate.depth, gate.height, merlons);
  addGatehouse(group, mats, exitFrom, gate.depth, EXIT_OPENING, merlons);
  const banners = [];
  for (const [distance, offsetAlong] of [[gate.at, 1.5], [exitFrom, gate.depth - 1.5]]) {
    for (const sign of [-1, 1]) banners.push(addTower(group, mats, at(distance + offsetAlong, sign * (GATEHOUSE_HALF + 2)), floorY, groundY));
  }
  // Torres no canto de fora de cada curva e uma menor no de dentro.
  const diagonal = CASTLE_RADIUS * (Math.SQRT2 - 1);
  for (const [from, to] of turnsOf(castle)) {
    const middle = (from + to) / 2, turn = Math.sign(turnAt(middle)) || 1;
    banners.push(addTower(group, mats, at(middle, -turn * (outer + diagonal + 1.5)), floorY, groundY));
    banners.push(addTower(group, mats, at(middle, turn * (INNER + 4.5)), floorY, groundY, { radius: 2.6, above: WALL_HIGH + 5 }));
  }
  // Torre de menagem.
  const keep = keepSpot(section), keepHeight = KEEP.above + BASE_SINK + (floorY - groundY);
  const keepBody = new THREE.Mesh(new THREE.BoxGeometry(KEEP.half * 2, keepHeight, KEEP.half * 2), mats.block);
  keepBody.position.set(keep.x, groundY - BASE_SINK + keepHeight / 2, keep.z);
  group.add(keepBody);
  for (let i = 0; i < 4; i++) {
    for (let k = -KEEP.half + 1; k < KEEP.half; k += 3) {
      const merlon = new THREE.Mesh(new THREE.BoxGeometry(MERLON.width, MERLON.height, MERLON.width), mats.block);
      const [x, z] = [[k, -KEEP.half + 0.7], [k, KEEP.half - 0.7], [-KEEP.half + 0.7, k], [KEEP.half - 0.7, k]][i];
      merlon.position.set(keep.x + x, floorY + KEEP.above + MERLON.height / 2, keep.z + z);
      group.add(merlon);
    }
  }
  banners.push(addTower(group, mats, new THREE.Vector3(keep.x + KEEP.half, 0, keep.z + KEEP.half), floorY + KEEP.above - TOWER.above + 4, groundY, { radius: 2.4, above: TOWER.above }));
  buildMerlons(group, mats.block, merlons);

  // Tochas acesas e estandartes do rei nas muralhas de dentro.
  const flame = basic(0xffa020, { fog: false }), bracket = basic(0x2a2420), flames = [];
  const clothes = look.banners.map(([cloth, emblem]) => new THREE.MeshBasicMaterial({ map: bannerTexture(cloth, emblem), alphaTest: 0.5, side: THREE.DoubleSide }));
  let flip = 0;
  for (let d = inside + 6; d < exitFrom - 4; d += TORCH_EVERY) {
    for (const sign of [-1, 1]) {
      boxAt(group, bracket, d, sign * (INNER - 0.25), 3.2, 0.5, 0.25, 0.25);
      flames.push(boxAt(group, flame, d, sign * (INNER - 0.45), 3.55, 0.35, 0.5, 0.35));
    }
  }
  for (let d = inside + 12; d < exitFrom - 6; d += BANNER_EVERY) {
    for (const sign of [-1, 1]) {
      const t = trackAt(d), cloth = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 6.6), clothes[flip++ % clothes.length]);
      const p = at(d, sign * (INNER - 0.08), WALL_HIGH - 3.8);
      cloth.position.copy(p);
      cloth.rotation.y = yawOf(t) + Math.PI / 2;
      group.add(cloth);
    }
  }
  onUpdate?.(time => {
    flames.forEach((mesh, i) => { mesh.scale.y = 0.8 + 0.35 * Math.abs(Math.sin(time * 9 + i * 1.7)); });
    banners.forEach((banner, i) => { banner.rotation.y = Math.sin(time * 2 + i) * 0.35; });
  });

  // Descida de pedra depois do portão de saída: muro de arrimo até o chão e mureta dos dois lados.
  group.add(new THREE.Mesh(slabGeometry(castle.exitGate, end, -INNER - PARAPET.thickness, INNER + PARAPET.thickness, t => t.y - 0.1, () => section.floor - 3), mats.base));
  for (const sign of [-1, 1]) {
    const left = sign > 0 ? INNER : -INNER - PARAPET.thickness, right = sign > 0 ? INNER + PARAPET.thickness : -INNER;
    group.add(new THREE.Mesh(slabGeometry(castle.exitGate, end, left, right, t => t.y + PARAPET.height, t => t.y - 0.1), mats.stone));
  }
  // Mureta que afunila a estrada até a largura da ponte, acompanhando o limite (track.wall).
  const funnelFrom = start - 40;
  for (const sign of [-1, 1]) {
    const pos = [], index = [];
    for (let d = funnelFrom, i = 0; d <= start; d += track.step, i++) {
      const k = Math.floor(((d % track.length) + track.length) % track.length / track.step) % track.count;
      const lateral = sign * (track.wall[k] + 1.05), p = at(d, lateral), q = at(d, lateral + sign * PARAPET.thickness);
      pos.push(p.x, p.y - 0.4, p.z, p.x, p.y + PARAPET.height, p.z, q.x, q.y + PARAPET.height, q.z);
      if (i > 0) { const a = (i - 1) * 3, b = i * 3; index.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2); }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geometry.setIndex(index);
    group.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: look.parapet ?? 0x9a948a, side: THREE.DoubleSide })));
  }
}
