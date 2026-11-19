import { alignToTwist } from '../world/track.js';
import * as THREE from 'three';
import { VIEW } from '../config.js';
import { pixelTexture } from '../world/textures.js';
import { Raster, CLEAR } from '../art/raster.js';
import { dither } from '../art/shade.js';
import { DEPTH, LAYOUT } from './layout.js';
import { HALF_HEIGHT, HALF_WIDTH, Sprite } from './sprite.js';

// Retrovisor: moldura pintada com um furo; atrás dela, um plano com a câmera traseira.

const FRAME_W = 116, FRAME_H = 42;
const MIRROR_FAR = 150;                              // metros: lá atrás, mais longe que isso, é só neblina num vidro deste tamanho
const DARK_GLASS = 0x1a1e24;                         // espelho desligado (qualidade baixa)
const FRAME_OUTLINE = [[1, 19], [4, 16], [31, 13], [83, 11], [110, 11], [113, 15], [113, 35], [110, 37], [5, 41], [2, 37]];
const GLASS_OUTLINE = [[4, 20], [6, 18], [32, 15], [83, 13], [109, 13], [111, 16], [111, 34], [109, 35], [6, 39], [4, 36]];

function paintFrame() {
  const r = new Raster(FRAME_W, FRAME_H);
  r.rect(52, 0, 9, 13, (x, y) => dither(x, y, 0.5, [0x120d0a, 0x1e1712], 1));
  r.poly(FRAME_OUTLINE, (x, y) => dither(x, y, 0.5, [0x2c231d, 0x423830], 1));
  r.poly(GLASS_OUTLINE, CLEAR);
  return r.commit();
}

// Máscara do vidro. É desenhada invertida porque o plano é espelhado em X.
function paintGlassMask() {
  const r = new Raster(FRAME_W, FRAME_H);
  r.rect(0, 0, FRAME_W, FRAME_H, 0x000000);
  r.poly(GLASS_OUTLINE.map(([x, y]) => [FRAME_W - x, y]), 0xffffff);
  return r.commit();
}

export function createMirror(parent, car, rig) {
  new Sprite(parent, paintFrame(), { ...LAYOUT.mirror, depth: DEPTH.mirrorFrame });

  const target = new THREE.WebGLRenderTarget(FRAME_W, FRAME_H, {
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false,
  });
  const d = DEPTH.mirrorGlass, unit = 2 * HALF_WIDTH * d / VIEW.width;
  const cx = LAYOUT.mirror.x + FRAME_W / 2, cy = LAYOUT.mirror.y + FRAME_H / 2;
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(FRAME_W * unit, FRAME_H * unit),
    new THREE.MeshBasicMaterial({ map: target.texture, alphaMap: pixelTexture(paintGlassMask()), alphaTest: 0.5, side: THREE.DoubleSide }),
  );
  glass.userData.keepsColor = true;                  // o espelho mostra o mundo, já com a cor certa
  glass.position.set((cx / VIEW.width * 2 - 1) * HALF_WIDTH * d, (1 - cy / VIEW.height * 2) * HALF_HEIGHT * d, -d);
  glass.scale.x = -1;                          // imagem espelhada
  parent.add(glass);

  const camera = new THREE.PerspectiveCamera(33, FRAME_W / FRAME_H, 0.1, MIRROR_FAR);
  camera.rotation.order = 'YXZ';
  const eyePosition = new THREE.Vector3();

  // Redesenhar a cena inteira a cada quadro custa quase o mesmo que a vista da frente; num espelho deste tamanho
  // ninguém nota a imagem trocar a cada poucos quadros. `every` 0 desliga o espelho (vidro escuro).
  let every = 1, frame = 0, blanked = false;
  const savedClear = new THREE.Color();
  function blank(renderer) {
    renderer.getClearColor(savedClear);
    const alpha = renderer.getClearAlpha();
    renderer.setRenderTarget(target);
    renderer.setClearColor(DARK_GLASS, 1);
    renderer.clear();
    renderer.setClearColor(savedClear, alpha);
    renderer.setRenderTarget(null);
  }

  // `far`: até onde a vista da frente enxerga; o espelho nunca vai além de MIRROR_FAR.
  const render = (renderer, worldScene, far = MIRROR_FAR) => {
    if (every === 0) {
      if (!blanked) blank(renderer);
      blanked = true;
      return;
    }
    blanked = false;
    if (frame++ % every) return;
    const wantedFar = Math.min(MIRROR_FAR, far);
    if (camera.far !== wantedFar) {
      camera.far = wantedFar;
      camera.updateProjectionMatrix();
    }
    rig.getWorldPosition(eyePosition);
    camera.position.copy(eyePosition);
    camera.rotation.set(-car.pitch, car.yaw + Math.PI, -car.twist);
    alignToTwist(camera, car, -1);
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(worldScene, camera);
    renderer.setRenderTarget(null);
  };
  render.setEvery = value => {
    every = value;
    frame = 0;
  };
  return render;
}
