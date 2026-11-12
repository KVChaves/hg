import * as THREE from 'three';
import { loadPng, pngNow } from '../cabin/pngPixels.js';

export function pixelTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

export function noiseTexture(base, variation, size = 64) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const k = (Math.random() - 0.5) * variation;
      ctx.fillStyle = `rgb(${base[0] + k | 0},${base[1] + k * 0.6 | 0},${base[2] + k * 0.5 | 0})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const tex = pixelTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Textura de chão ou estrada tirada de um PNG do jogo original. Declare no bioma com `image: useImage(caminho)`:
// a imagem começa a carregar ao abrir o jogo e, se ainda não chegou quando o mapa é montado, o bioma usa o ruído de sempre.
export const useImage = path => { loadPng(path).catch(() => {}); return path; };

// `shade` escurece (menor que 1) ou clareia a imagem para combinar com a luz do bioma.
export function imageCanvas(path, size = 64, shade = 1) {
  const image = pngNow(path);
  if (!image) return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0, size, size);
  if (shade !== 1) {
    ctx.globalCompositeOperation = shade < 1 ? 'source-atop' : 'lighter';
    ctx.fillStyle = shade < 1 ? `rgba(0,0,0,${1 - shade})` : `rgba(255,255,255,${shade - 1})`;
    ctx.fillRect(0, 0, size, size);
  }
  return canvas;
}

export function surfaceTexture({ base, variation, image, shade, size = 64 }) {
  const canvas = image && imageCanvas(image, size, shade);
  if (!canvas) return noiseTexture(base, variation);
  const texture = pixelTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
