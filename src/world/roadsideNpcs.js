import * as THREE from 'three';
import { Raster } from '../art/raster.js';
import { rasterText, textWidth } from '../art/font.js';
import { plotTrapIcon } from '../art/trapIcons.js';
import { HELP_ITEMS, itemLabel, NPC_LANE } from '../game/roadsideHelp.js';
import { TRAP_TYPES } from '../game/trapTypes.js';
import { pixelTexture } from './textures.js';
import { trackAt } from './track.js';

// Os dois NPCs que o jogador vê na beira da pista, acenando com o item oferecido acima da cabeça.

const PLATE_WIDTH = 58, PLATE_HEIGHT = 38, CRATE_SIZE = 30;
const NPC_SIZE = [1.35, 1.9], ITEM_SIZE = [3.24, 2.12], ITEM_HEIGHT = 3.2, ITEM_BOB = 0.12, ITEM_BOB_SPEED = 3;
const FRAMES_PER_SECOND = 9, WAVE_LOOP = [0, 1, 2, 1];  // quadros do aceno, indo e voltando
const HOP_SPEED = 7, HOP_HEIGHT = 0.16, CHEER_HOP_SPEED = 11, CHEER_HOP_HEIGHT = 0.5;
const SWAY_SPEED = 3.5, SWAY_TILT = 0.09;
const DODGE_START = 16, DODGE_END = 6, DODGE_DISTANCE = 1.8;  // metros: o NPC pula para fora quando o carro chega

// Cores dos dois NPCs: jaqueta, calça, pele e chapéu.
const OUTFITS = [
  [0x3060b0, 0x2a2a34, 0xd8a878, 0xb04020],
  [0xc08020, 0x384028, 0xb88058, 0x204868],
];

// Ângulos do braço que acena, em radianos; negativo é para cima.
const WAVE_ANGLES = [-1.25, -0.8, -0.35];
const SHOULDER = [23, 17], ARM_LENGTH = 13, X = 4;   // X centraliza o corpo na imagem, que é larga por causa do braço

function paintNpc([jacket, pants, skin, hat], { armAngle, step, cheering = false }) {
  const r = new Raster(36, 50);
  r.rect(X + 9, 32, 4, 17 - Math.max(0, step) * 2, pants);        // pernas: uma levanta de cada vez
  r.rect(X + 15, 32, 4, 17 - Math.max(0, -step) * 2, pants);
  r.rect(X + 8, 47 - Math.max(0, step) * 2, 5, 3, 0x141010);
  r.rect(X + 15, 47 - Math.max(0, -step) * 2, 5, 3, 0x141010);
  r.rect(X + 8, 15, 12, 18, jacket);                              // tronco
  r.rect(X + 8, 15, 2, 18, 0x101018);

  if (cheering) {                                                 // os dois braços para o alto
    r.line(X + 9, 17, X + 3, 3, jacket, 3);
    r.disc(X + 3, 3, 2, skin);
  } else {
    r.line(X + 9, 17, X + 5, 30, jacket, 3);
  }
  const hand = [SHOULDER[0] + Math.cos(armAngle) * ARM_LENGTH, SHOULDER[1] + Math.sin(armAngle) * ARM_LENGTH];
  r.line(SHOULDER[0], SHOULDER[1], hand[0], hand[1], jacket, 3);
  r.disc(hand[0], hand[1], 2, skin);

  r.disc(X + 14, 10, 5, skin);                                    // cabeça
  r.rect(X + 9, 3, 10, 3, hat);                                   // chapéu
  r.rect(X + 7, 6, 14, 2, hat);
  r.rect(X + 12, 10, 1, 1, 0x101010);
  r.rect(X + 16, 10, 1, 1, 0x101010);
  return r.commit();
}

// Desenho de cada item, com o círculo centrado em (cx, cy).
const ITEM_ICONS = {
  ammo(r, ox, oy) {
    for (const x of [4, 10, 16]) {
      r.rect(ox + x, oy + 9, 5, 12, 0xd0a040);
      r.poly([[ox + x, oy + 9], [ox + x + 2.5, oy + 3], [ox + x + 5, oy + 9]], 0xa86a30);
      r.rect(ox + x, oy + 18, 5, 3, 0x8a6020);
    }
  },
  nitro(r, ox, oy) {
    r.rect(ox + 8, oy + 5, 8, 16, 0xe8c020);
    r.rect(ox + 8, oy + 5, 2, 16, 0xfff0a0);
    r.rect(ox + 10, oy + 2, 4, 3, 0x9a9aa2);
    r.rect(ox + 8, oy + 11, 8, 4, 0x1a1a22);
    r.rect(ox + 11, oy + 12, 2, 2, 0xe8e8e8);
  },
};

// Placa com o ícone e, embaixo, o nome exato do que o NPC vai entregar.
function paintItemPlate(plotIcon, label) {
  const r = new Raster(PLATE_WIDTH, PLATE_HEIGHT), ox = (PLATE_WIDTH - 24) / 2;
  r.disc(ox + 12, 12, 12, 0x101014);
  r.disc(ox + 12, 12, 10.5, 0xe8e0c8);
  plotIcon(r, ox, 0);
  r.rect(0, 25, PLATE_WIDTH, 13, 0x101014);
  rasterText(r, label, Math.floor((PLATE_WIDTH - textWidth(label)) / 2), 28, 0xffe9a0);
  return r.commit();
}

// Caixa de madeira que o NPC segura acima da cabeça.
function paintCrate() {
  const r = new Raster(CRATE_SIZE, CRATE_SIZE);
  r.rect(0, 0, CRATE_SIZE, CRATE_SIZE, 0x2a1a0c);
  r.rect(2, 2, CRATE_SIZE - 4, CRATE_SIZE - 4, 0xb07a3c);
  for (const y of [10, 19]) r.rect(2, y, CRATE_SIZE - 4, 1, 0x7a5024);
  r.line(2, 2, CRATE_SIZE - 3, CRATE_SIZE - 3, 0x7a5024, 2);
  r.rect(2, 2, CRATE_SIZE - 4, 1, 0xd8a868);
  return r.commit();
}

function createPlates() {
  const plates = { crate: pixelTexture(paintCrate()) };
  for (const [id, plot] of Object.entries(ITEM_ICONS)) plates[id] = pixelTexture(paintItemPlate(plot, HELP_ITEMS[id]));
  for (const type of Object.values(TRAP_TYPES)) {
    plates[type.id] = pixelTexture(paintItemPlate((r, ox) => plotTrapIcon(r, type.id, ox + 3, 5), type.label));
  }
  return plates;
}

function sprite(scene, map, center) {
  const object = new THREE.Sprite(new THREE.SpriteMaterial({ map, alphaTest: 0.5 }));
  object.center.set(...center);
  object.visible = false;
  scene.add(object);
  return object;
}

let sharedPlates = null;                             // as placas são iguais para todas as duplas de NPCs

export function createRoadsideNpcs(scene) {
  const icons = sharedPlates ??= createPlates();

  // Placas com quantia (como o nitro) são criadas na primeira vez que aparecem.
  function plateFor(item) {
    if (item.slot) return icons[item.slot.type.id];
    if (!item.amount) return icons[item.id];
    const label = itemLabel(item);
    icons[label] ??= pixelTexture(paintItemPlate(ITEM_ICONS[item.id], label));
    return icons[label];
  }
  const npcs = OUTFITS.map(outfit => {
    const wave = WAVE_ANGLES.map((armAngle, i) => pixelTexture(paintNpc(outfit, { armAngle, step: i - 1 })));
    const cheer = pixelTexture(paintNpc(outfit, { armAngle: -1.25, step: 0, cheering: true }));
    const body = sprite(scene, wave[0], [0.5, 0]);
    body.scale.set(NPC_SIZE[0], NPC_SIZE[1], 1);
    const item = sprite(scene, icons.ammo, [0.5, 0.5]);
    item.scale.set(ITEM_SIZE[0], ITEM_SIZE[1], 1);
    return { wave, cheer, body, item, x: 0, y: 0, z: 0, outX: 0, outZ: 0, itemHeight: ITEM_HEIGHT, cheering: false, phase: Math.random() * 6 };
  });
  let clock = 0, showing = false, items = [];

  function setBodyTexture(npc, map) {
    if (npc.body.material.map === map) return;
    npc.body.material.map = map;
    npc.body.material.needsUpdate = true;
  }

  return {
    // `offer` nulo some com os dois.
    show(offer) {
      showing = Boolean(offer);
      items = offer ? offer.items : [];
      npcs.forEach((npc, i) => {
        npc.body.visible = npc.item.visible = showing;
        npc.cheering = false;
        if (!showing) return;
        const { side } = offer.items[i], t = trackAt(offer.dist), lane = side * NPC_LANE;
        npc.x = t.x - t.tz * lane;
        npc.z = t.z + t.tx * lane;
        npc.y = t.y;
        npc.outX = -t.tz * side;
        npc.outZ = t.tx * side;
        const plate = plateFor(offer.items[i]), { width, height } = plate.image;
        npc.item.material.map = plate;
        npc.item.material.needsUpdate = true;
        npc.item.scale.set(width * ITEM_SIZE[0] / PLATE_WIDTH, height * ITEM_SIZE[1] / PLATE_HEIGHT, 1);
        npc.itemHeight = ITEM_HEIGHT + (height / PLATE_HEIGHT - 1) * ITEM_SIZE[1] / 2;    // placa mais alta sobe para não entrar no NPC
      });
    },
    // Item entregue: quem deu comemora e os dois ficam de mãos vazias.
    hideItems(taken) {
      npcs.forEach((npc, i) => {
        npc.item.visible = false;
        npc.cheering = items[i] === taken;
      });
    },
    // `carX` e `carZ`: o NPC pula para fora do caminho quando o carro se aproxima.
    update(dt, carX, carZ) {
      if (!showing) return;
      clock += dt;
      const frame = WAVE_LOOP[Math.floor(clock * FRAMES_PER_SECOND) % WAVE_LOOP.length];
      for (const npc of npcs) {
        const time = clock + npc.phase;
        setBodyTexture(npc, npc.cheering ? npc.cheer : npc.wave[frame]);

        const hop = Math.abs(Math.sin(time * (npc.cheering ? CHEER_HOP_SPEED : HOP_SPEED))) * (npc.cheering ? CHEER_HOP_HEIGHT : HOP_HEIGHT);
        const closeness = (DODGE_START - Math.hypot(npc.x - carX, npc.z - carZ)) / (DODGE_START - DODGE_END);
        const dodge = Math.max(0, Math.min(1, closeness)) * DODGE_DISTANCE;
        const x = npc.x + npc.outX * dodge, z = npc.z + npc.outZ * dodge;

        npc.body.position.set(x, npc.y + hop, z);
        npc.body.material.rotation = Math.sin(time * SWAY_SPEED) * SWAY_TILT;
        npc.item.position.set(x, npc.y + npc.itemHeight + hop + Math.sin(time * ITEM_BOB_SPEED) * ITEM_BOB, z);
      }
    },
  };
}
