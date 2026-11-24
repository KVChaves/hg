import * as THREE from 'three';
import { VIEW, SKY_COLOR } from '../config.js';

// Renderiza em baixa resolução; o CSS amplia com pixels nítidos.
export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(VIEW.width, VIEW.height, false);
  renderer.autoClear = false;
  renderer.localClippingEnabled = true;              // camuflagem: o carro some atrás de um plano (world/car/carModel.js)
  renderer.setClearColor(SKY_COLOR);
  return renderer;
}

// Desenha o mundo numa fração da resolução e amplia para a tela inteira com pixels nítidos, para a cabine
// e o HUD continuarem na resolução cheia por cima. Com `scale` 1 desenha direto, sem passo extra.
export function createWorldPass(renderer) {
  let target = null;
  const blitScene = new THREE.Scene(), blitCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false }));
  quad.frustumCulled = false;
  blitScene.add(quad);

  return {
    setScale(scale) {
      target?.dispose();
      target = null;
      if (scale < 1) {
        target = new THREE.WebGLRenderTarget(Math.round(VIEW.width * scale), Math.round(VIEW.height * scale), {
          minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false,
        });
      }
      quad.material.map = target?.texture ?? null;
      quad.material.needsUpdate = true;
    },
    // Limpa a tela e desenha `scene` vista por `camera`.
    render(scene, camera) {
      if (!target) {
        renderer.clear();
        renderer.render(scene, camera);
        return;
      }
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.clear();
      renderer.render(blitScene, blitCamera);
    },
  };
}
