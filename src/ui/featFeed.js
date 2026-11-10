import * as THREE from 'three';
import { VIEW } from '../config.js';
import { ctxText, textWidth } from '../art/font.js';

// Feitos do jogador: uma pilha de mensagens à direita da mira e, presos ao carro atingido, os contadores.
// Cada mensagem entra estourando (maior, branca e tremendo), assenta na cor dela e some aos poucos. A mesma
// mensagem de novo, ainda na tela, vira contador (x2, x3). Mensagens "ao vivo" (drift, tempo no ar) ficam
// atualizando enquanto acontecem e, no fim, viram o resultado.

const LIFE = 2.2, BIG_LIFE = 2.8, FADE_TIME = 0.45, MAX_SHOWN = 5;
const POP_TIME = 0.1, FLASH_TIME = 0.05, SHAKE_TIME = 0.3, SHAKE_SIZE = 3, SLIDE_SPEED = 14;
const STACK = { x: 398, bottom: 160 };               // à direita da mira, acima da arma e longe do placar
const LINE_ORDER = ['Abate', 'Armadilha', 'Arpao', 'Fogo', 'Acerto'];
const TAG_HEIGHT = 2.7, LINE_HEIGHT = 16, TEXT_SCALE = 2;   // os contadores ficam acima do carro, sem cobrir ele
const TAG_LIFE = 2;
const SCREEN = { left: 8, right: VIEW.width - 8, top: 60 };
const point = new THREE.Vector3(), inCamera = new THREE.Vector3();

// Contorno preto para o texto aparecer também sobre a neve.
function drawLine(ctx, text, x, y, color = '#ffffff', scale = TEXT_SCALE) {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) ctxText(ctx, text, x + dx * Math.max(1, scale - 1), y + dy * Math.max(1, scale - 1), '#000000', scale);
  ctxText(ctx, text, x, y, color, scale);
}

const lineHeight = entry => (entry.big ? 3 : 2) * 7 + 7;

export function createFeatFeed() {
  const entries = [];                                // { key, text, color, big, count, age, life, live, y }
  const tags = [];                                   // { racer, counts: { Acerto: 3 }, age }
  let born = 0;

  function tagFor(racer) {
    let tag = tags.find(candidate => candidate.racer === racer);
    if (!tag) tags.push(tag = { racer, counts: {}, age: 0 });
    tag.age = 0;
    return tag;
  }

  function drawTag(ctx, camera, { racer, counts, age }) {
    point.set(racer.wx, racer.wy + TAG_HEIGHT, racer.wz);
    inCamera.copy(point).applyMatrix4(camera.matrixWorldInverse);
    if (inCamera.z >= 0) return;
    point.project(camera);
    const lines = LINE_ORDER.filter(label => counts[label]).map(label => `${label} x${counts[label]}`);
    if (!lines.length) return;
    const width = Math.max(...lines.map(line => textWidth(line, TEXT_SCALE)));
    const x = Math.max(SCREEN.left, Math.min(SCREEN.right - width, Math.round((point.x + 1) / 2 * VIEW.width - width / 2)));
    const y = Math.max(SCREEN.top, Math.round((1 - point.y) / 2 * VIEW.height) - lines.length * LINE_HEIGHT);
    ctx.globalAlpha = Math.min(1, (TAG_LIFE - age) / FADE_TIME);
    lines.forEach((line, i) => drawLine(ctx, line, x, y + i * LINE_HEIGHT));
  }

  // `key` junta repetições (padrão: o próprio texto); `big` para os feitos grandes (abates).
  function push(text, { key = text, color = '#ffffff', big = false, live = false } = {}) {
    let entry = entries.find(candidate => candidate.key === key);
    if (entry) {
      if (!entry.live && !live) entry.count++;
      Object.assign(entry, { text, color, big: big || entry.big, age: entry.live && live ? Math.max(entry.age, POP_TIME + SHAKE_TIME) : 0, live });
    } else {
      entry = { key, text, color, big, count: 1, age: 0, live, y: null, born: born++ };
      for (const other of entries) if (other.y !== null) other.y -= lineHeight(entry);   // as antigas abrem espaço na hora
      entries.push(entry);
      while (entries.length > MAX_SHOWN) {
        const oldest = entries.findIndex(candidate => !candidate.live);
        if (oldest < 0) break;
        entries.splice(oldest, 1);
      }
    }
    entry.seen = true;
    entry.life = big ? BIG_LIFE : LIFE;
    return entry;
  }

  function drawEntry(ctx, entry, y) {
    const { age, life, big, count } = entry;
    const text = count > 1 ? `${entry.text} x${count}` : entry.text;
    const scale = (big ? 3 : 2) + (age < POP_TIME ? 1 : 0);
    const shake = age < POP_TIME + SHAKE_TIME ? Math.round(Math.sin(age * 90) * SHAKE_SIZE * (1 - age / (POP_TIME + SHAKE_TIME))) : 0;
    const color = age < FLASH_TIME ? '#ffffff' : entry.color;
    ctx.globalAlpha = entry.live ? 1 : Math.max(0, Math.min(1, (life - age) / FADE_TIME));
    drawLine(ctx, text, Math.round(STACK.x - textWidth(text, scale) / 2) + shake, Math.round(y - (scale - (big ? 3 : 2)) * 4), color, scale);
  }

  return {
    get headline() { return entries.at(-1)?.text ?? ''; },
    tags,
    announce(text, options) { push(text, options); },
    // Mensagem que muda enquanto acontece (drift, tempo no ar): chame a cada quadro; parou de chamar, ela some.
    live(key, text, color) { push(text, { key, color, live: true }); },
    // Fecha a mensagem ao vivo com o resultado, que estoura de novo.
    finish(key, text, { color = '#ffffff', big = false } = {}) {
      const entry = entries.find(candidate => candidate.key === key);
      if (!entry) { push(text, { key, color, big }); return; }
      Object.assign(entry, { text, color, big, live: false, age: 0, count: 1, life: big ? BIG_LIFE : LIFE });
    },
    // Soma 1 ao contador enquanto a etiqueta daquele carro ainda está na tela.
    addCount(racer, label) {
      const { counts } = tagFor(racer);
      counts[label] = (counts[label] ?? 0) + 1;
    },
    setCount(racer, label, value) { tagFor(racer).counts[label] = value; },
    update(dt) {
      for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        if (entry.live && !entry.seen) entry.live = false;   // parou de ser atualizada
        entry.seen = false;
        entry.age += dt;
        if (!entry.live && entry.age >= entry.life) entries.splice(i, 1);
      }
      // A mais nova fica embaixo; as outras sobem deslizando. `y` é o topo de cada linha; a pilha apoia na base.
      let bottom = STACK.bottom;
      for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i], top = bottom - lineHeight(entry);
        entry.y = entry.y === null ? top : entry.y + (top - entry.y) * (1 - Math.exp(-SLIDE_SPEED * dt));
        bottom = top;
      }
      for (let i = tags.length - 1; i >= 0; i--) {
        if ((tags[i].age += dt) >= TAG_LIFE) tags.splice(i, 1);
      }
    },
    reset() {
      entries.length = 0;
      tags.length = 0;
    },
    draw(ctx, camera) {
      camera.updateMatrixWorld();
      for (const tag of tags) drawTag(ctx, camera, tag);
      for (const entry of entries) drawEntry(ctx, entry, entry.y ?? STACK.bottom);
      ctx.globalAlpha = 1;
    },
  };
}
