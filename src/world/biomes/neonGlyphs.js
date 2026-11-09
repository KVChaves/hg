import * as THREE from 'three';
import { pixelTexture } from '../textures.js';

// Letreiro com sinais abstratos em colunas, cor branca para o tom de cada placa pintar por cima.
export function glyphTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#301830';
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = '#ffffff';
  for (let column = 0; column < 3; column++) {
    for (let row = 0; row < 3; row++) {
      const x = 2 + column * 10, y = 2 + row * 10;
      ctx.fillRect(x + Math.floor(Math.random() * 4), y, 2, 8);
      ctx.fillRect(x, y + Math.floor(Math.random() * 6), 8, 2);
      if (Math.random() < 0.6) ctx.fillRect(x + 1, y + 6, 6, 1);
    }
  }
  const texture = pixelTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
