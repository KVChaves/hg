import * as THREE from 'three';
import { VIEW, SKY_COLOR } from '../config.js';

// Renderiza em baixa resolução; o CSS amplia com pixels nítidos.
export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(VIEW.width, VIEW.height, false);
  renderer.autoClear = false;
  renderer.setClearColor(SKY_COLOR);
  return renderer;
}
