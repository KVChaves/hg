import * as THREE from 'three';
import { VIEW } from '../config.js';
import { ctxText, textWidth } from '../art/font.js';

// Feitos do jogador: uma palavra curta no meio da tela e, presos ao carro atingido, os contadores.

const HEADLINE_LIFE = 1.6, TAG_LIFE = 2, FADE_TIME = 0.4;
const HEADLINE = { x: 275, y: 12 };                  // no teto da cabine, longe da pista
const LINE_ORDER = ['Abate', 'Armadilha', 'Arpao', 'Acerto'];
const TAG_HEIGHT = 2.7, LINE_HEIGHT = 16, TEXT_SCALE = 2;   // os contadores ficam acima do carro, sem cobrir ele
const SCREEN = { left: 8, right: VIEW.width - 8, top: 60 };
const point = new THREE.Vector3(), inCamera = new THREE.Vector3();

// Contorno preto para o branco aparecer também sobre a neve.
function drawLine(ctx, text, x, y) {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) ctxText(ctx, text, x + dx, y + dy, '#000000', TEXT_SCALE);
  ctxText(ctx, text, x, y, '#ffffff', TEXT_SCALE);
}

export function createFeatFeed() {
  let headline = null;
  const tags = [];                                   // { racer, counts: { Acerto: 3 }, age }

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
    const width = Math.max(...lines.map(line => textWidth(line, TEXT_SCALE)));
    const x = Math.max(SCREEN.left, Math.min(SCREEN.right - width, Math.round((point.x + 1) / 2 * VIEW.width - width / 2)));
    const y = Math.max(SCREEN.top, Math.round((1 - point.y) / 2 * VIEW.height) - lines.length * LINE_HEIGHT);
    ctx.globalAlpha = Math.min(1, (TAG_LIFE - age) / FADE_TIME);
    lines.forEach((line, i) => drawLine(ctx, line, x, y + i * LINE_HEIGHT));
  }

  return {
    get headline() { return headline?.text ?? ''; },
    tags,
    announce(text) { headline = { text, age: 0 }; },
    // Soma 1 ao contador enquanto a etiqueta daquele carro ainda está na tela.
    addCount(racer, label) {
      const { counts } = tagFor(racer);
      counts[label] = (counts[label] ?? 0) + 1;
    },
    setCount(racer, label, value) { tagFor(racer).counts[label] = value; },
    update(dt) {
      if (headline && (headline.age += dt) >= HEADLINE_LIFE) headline = null;
      for (let i = tags.length - 1; i >= 0; i--) {
        if ((tags[i].age += dt) >= TAG_LIFE) tags.splice(i, 1);
      }
    },
    reset() {
      headline = null;
      tags.length = 0;
    },
    draw(ctx, camera) {
      camera.updateMatrixWorld();
      for (const tag of tags) drawTag(ctx, camera, tag);
      if (headline) {
        ctx.globalAlpha = Math.min(1, (HEADLINE_LIFE - headline.age) / FADE_TIME);
        drawLine(ctx, headline.text, Math.round(HEADLINE.x - textWidth(headline.text, TEXT_SCALE) / 2), HEADLINE.y);
      }
      ctx.globalAlpha = 1;
    },
  };
}
