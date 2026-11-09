import * as THREE from 'three';
import { VIEW } from '../config.js';
import { ctxText, textWidth } from '../art/font.js';

// Nome discreto sobre os carros próximos: aparece aos poucos conforme a distância diminui.

const FADE_START = 48, FULL_AT = 22, MAX_ALPHA = 0.7, HEIGHT_ABOVE_CAR = 1.9;
const point = new THREE.Vector3(), inCamera = new THREE.Vector3();

// `isHidden(x, y, z)` diz se o ponto está atrás de algo da cabine.
export function drawRacerNames(ctx, camera, racers, isHidden) {
  camera.updateMatrixWorld();
  for (const racer of racers) {
    point.set(racer.wx, racer.wy + HEIGHT_ABOVE_CAR, racer.wz);
    inCamera.copy(point).applyMatrix4(camera.matrixWorldInverse);
    if (inCamera.z >= 0) continue;
    const distance = inCamera.length();
    if (distance >= FADE_START) continue;

    point.project(camera);
    if (Math.abs(point.x) > 1 || Math.abs(point.y) > 1) continue;
    if (isHidden?.(racer.wx, racer.wy + HEIGHT_ABOVE_CAR, racer.wz)) continue;

    const x = Math.round((point.x + 1) / 2 * VIEW.width - textWidth(racer.name) / 2);
    const y = Math.round((1 - point.y) / 2 * VIEW.height);
    ctx.globalAlpha = MAX_ALPHA * Math.min(1, (FADE_START - distance) / (FADE_START - FULL_AT));
    ctxText(ctx, racer.name, x + 1, y + 1, '#000000');
    ctxText(ctx, racer.name, x, y, '#e8e4d8');
  }
  ctx.globalAlpha = 1;
}
