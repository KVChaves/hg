import * as THREE from 'three';

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
