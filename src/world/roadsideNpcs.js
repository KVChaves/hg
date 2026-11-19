import * as THREE from 'three';
import { Raster } from '../art/raster.js';
import { rasterText, textWidth } from '../art/font.js';
import { dither, vnoise } from '../art/shade.js';
import { CREW_SIZE, CREW_SKINS, SIGN_HAND, paintCrewMember, plotHelpIcon, roleIdFor } from '../art/roadsideCrew.js';
import { itemLabel, NPC_LANE } from '../game/roadsideHelp.js';
import { pixelTexture } from './textures.js';
import { trackAt } from './track.js';

// Os dois NPCs que o jogador vê na beira da pista. Cada um se veste conforme o item que oferece
// (ver art/roadsideCrew.js) e ergue num cabo uma placa de papelão com o nome exato do que vai entregar.

const NPC_SIZE = [1.35, 1.9], NPC_PIXEL = NPC_SIZE[0] / CREW_SIZE.width;
const SIGN_PIXEL = 0.056;                            // a placa é desenhada maior que o NPC para ler de longe
const SIGN_MIN_WIDTH = 44, SIGN_HEIGHT = 38, STICK = 8;
const FRAMES_PER_SECOND = 9, STEP_LOOP = [0, 1, 2, 1];
const HOP_SPEED = 7, HOP_HEIGHT = 0.16, CHEER_HOP_SPEED = 11, CHEER_HOP_HEIGHT = 0.5;
const SWAY_SPEED = 3.5, SWAY_TILT = 0.06, SIGN_SWAY_SPEED = 5, SIGN_SWAY = 0.16;
const DODGE_START = 16, DODGE_END = 6, DODGE_DISTANCE = 1.8;  // metros: o NPC pula para fora quando o carro chega

// Mão da placa em relação ao pé do NPC, em metros: para o lado (direita da tela) e para cima.
const HAND_SIDE = (SIGN_HAND[0] - CREW_SIZE.width / 2) * NPC_PIXEL;
const HAND_UP = (CREW_SIZE.height - SIGN_HAND[1]) * NPC_PIXEL;

const CARDBOARD = [0x8a6232, 0xa87a40, 0xc09454, 0xd4ac6c];

// Placa de papelão com o ícone e o nome do item, presa num cabo de madeira que desce até a mão.
function paintSign(item) {
  const label = itemLabel(item);
  const width = Math.max(SIGN_MIN_WIDTH, textWidth(label) + 7), height = SIGN_HEIGHT + STICK;
  const r = new Raster(width, height), mid = Math.floor(width / 2);
  r.rect(mid - 1, SIGN_HEIGHT - 2, 3, STICK + 2, 0x4a3018);
  r.rect(mid - 1, SIGN_HEIGHT - 2, 1, STICK + 2, 0x7a5430);
  r.poly([[0, 1], [width - 2, 0], [width, SIGN_HEIGHT - 2], [1, SIGN_HEIGHT]], 0x3a2410);
  r.poly([[2, 3], [width - 3, 2], [width - 2, SIGN_HEIGHT - 4], [3, SIGN_HEIGHT - 2]],
    (x, y) => dither(x, y, 0.6 + (vnoise(x / 6, y / 9) - 0.5) * 0.3, CARDBOARD, 0.5));
  r.poly([[width - 9, 2], [width - 3, 2], [width - 3, 7]], 0x6a4826);      // canto rasgado
  plotHelpIcon(r, item, mid - 12, 1);
  r.rect(3, 26, width - 6, 10, 0xf4ead0);                                 // etiqueta de papel com o nome, para ler de longe
  r.rect(3, 35, width - 6, 1, 0xb89a68);
  rasterText(r, label, Math.floor((width - textWidth(label)) / 2) + 1, 28, 0x100804);
  return r.commit();
}

function sprite(scene, map, center) {
  const object = new THREE.Sprite(new THREE.SpriteMaterial({ map, alphaTest: 0.5 }));
  object.center.set(...center);
  object.visible = false;
  scene.add(object);
  return object;
}

// Texturas são iguais para todas as duplas de NPCs; cada uma é feita na primeira vez que aparece.
const looks = new Map(), signs = new Map();

function lookFor(roleId, skin) {
  const key = `${roleId}|${skin}`;
  if (!looks.has(key)) {
    const frames = pose => [-1, 0, 1].map(step => pixelTexture(paintCrewMember(roleId, CREW_SKINS[skin], { pose, step })));
    looks.set(key, { sign: frames('sign'), lowered: frames('lowered'), cheer: pixelTexture(paintCrewMember(roleId, CREW_SKINS[skin], { pose: 'cheer' })) });
  }
  return looks.get(key);
}

function signFor(item) {
  const key = itemLabel(item) + (item.slot ? `|${item.slot.type.id}` : '');
  if (!signs.has(key)) signs.set(key, pixelTexture(paintSign(item)));
  return signs.get(key);
}

export function createRoadsideNpcs(scene) {
  const npcs = [0, 1].map(() => ({
    body: sprite(scene, null, [0.5, 0]), sign: sprite(scene, null, [0.5, 0]),
    look: null, crew: null, pose: 'sign', x: 0, y: 0, z: 0, outX: 0, outZ: 0, phase: Math.random() * 6,
  }));
  for (const npc of npcs) npc.body.scale.set(NPC_SIZE[0], NPC_SIZE[1], 1);
  let clock = 0, showing = false, items = [];

  function setTexture(object, map) {
    if (object.material.map === map) return;
    object.material.map = map;
    object.material.needsUpdate = true;
  }

  return {
    // `offer` nulo some com os dois.
    show(offer) {
      showing = Boolean(offer);
      items = offer ? offer.items : [];
      npcs.forEach((npc, i) => {
        npc.body.visible = npc.sign.visible = showing;
        npc.pose = 'sign';
        if (!showing) return;
        const item = offer.items[i], t = trackAt(offer.dist), lane = item.side * NPC_LANE;
        npc.x = t.x - t.tz * lane;
        npc.z = t.z + t.tx * lane;
        npc.y = t.y;
        npc.outX = -t.tz * item.side;
        npc.outZ = t.tx * item.side;
        // A dupla do nitro azul é a mesma equipe: a pele muda para não parecerem gêmeos.
        const skin = Math.floor(Math.random() * CREW_SKINS.length + i) % CREW_SKINS.length;
        npc.crew = { roleId: roleIdFor(item), skin: CREW_SKINS[skin] };
        npc.look = lookFor(npc.crew.roleId, skin);
        const plate = signFor(item);
        setTexture(npc.sign, plate);
        npc.sign.scale.set(plate.image.width * SIGN_PIXEL, plate.image.height * SIGN_PIXEL, 1);
      });
    },
    // Item entregue: quem deu comemora de mãos vazias e o outro abaixa a placa.
    // Devolve quem entregou (roupa e posição) para a cabine mostrar o braço entrando pela janela.
    hideItems(taken) {
      let giver = null;
      npcs.forEach((npc, i) => {
        npc.sign.visible = false;
        npc.pose = items[i] === taken ? 'cheer' : 'lowered';
        if (items[i] === taken) giver = { ...npc.crew, x: npc.x, y: npc.y + NPC_SIZE[1] * 0.6, z: npc.z };
      });
      return giver;
    },
    // `carX` e `carZ`: o NPC pula para fora do caminho quando o carro se aproxima.
    update(dt, carX, carZ) {
      if (!showing) return;
      clock += dt;
      const frame = STEP_LOOP[Math.floor(clock * FRAMES_PER_SECOND) % STEP_LOOP.length];
      for (const npc of npcs) {
        const time = clock + npc.phase, cheering = npc.pose === 'cheer';
        setTexture(npc.body, cheering ? npc.look.cheer : npc.look[npc.pose][frame]);

        const hop = Math.abs(Math.sin(time * (cheering ? CHEER_HOP_SPEED : HOP_SPEED))) * (cheering ? CHEER_HOP_HEIGHT : HOP_HEIGHT);
        const toX = npc.x - carX, toZ = npc.z - carZ, distance = Math.hypot(toX, toZ) || 1;
        const closeness = (DODGE_START - distance) / (DODGE_START - DODGE_END);
        const dodge = Math.max(0, Math.min(1, closeness)) * DODGE_DISTANCE;
        const x = npc.x + npc.outX * dodge, z = npc.z + npc.outZ * dodge;
        const tilt = Math.sin(time * SWAY_SPEED) * SWAY_TILT;

        npc.body.position.set(x, npc.y + hop, z);
        npc.body.material.rotation = tilt;
        if (!npc.sign.visible) continue;
        // A placa fica na mão: o ponto acompanha o balanço do corpo e a placa abana em volta do cabo.
        const rightX = -toZ / distance, rightZ = toX / distance;        // direita da tela, olhando do carro
        const side = HAND_SIDE * Math.cos(tilt) - HAND_UP * Math.sin(tilt), up = HAND_SIDE * Math.sin(tilt) + HAND_UP * Math.cos(tilt);
        npc.sign.position.set(x + rightX * side, npc.y + hop + up, z + rightZ * side);
        npc.sign.material.rotation = tilt + Math.sin(time * SIGN_SWAY_SPEED) * SIGN_SWAY;
      }
    },
  };
}
