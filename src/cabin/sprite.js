import * as THREE from 'three';
import { VIEW } from '../config.js';

export const HALF_HEIGHT = Math.tan(VIEW.fov * Math.PI / 360);
export const HALF_WIDTH = HALF_HEIGHT * (VIEW.width / VIEW.height);

// Onde um pixel da cabine (com a cabeça centrada) aparece na tela com a cabeça girada.
export function projectCabinPixel(px, py, look) {
  const x = (px / VIEW.width * 2 - 1) * HALF_WIDTH;
  const y = (1 - py / VIEW.height * 2) * HALF_HEIGHT;
  const z = -1;
  const cy = Math.cos(look.yaw), sy = Math.sin(look.yaw), cp = Math.cos(look.pitch), sp = Math.sin(look.pitch);
  const x1 = cy * x - sy * z, z1 = sy * x + cy * z;
  const y2 = cp * y + sp * z1, z2 = Math.min(-sp * y + cp * z1, -0.05);    // atrás da câmera vira fora da tela
  return {
    x: (x1 / -z2 / HALF_WIDTH + 1) / 2 * VIEW.width,
    y: (1 - y2 / -z2 / HALF_HEIGHT) / 2 * VIEW.height,
  };
}

// Imagem 2D presa à cabine, posicionada em pixels da tela (com a cabeça centrada).
// `source` é um canvas ou o caminho de um PNG. O tamanho na tela é o tamanho da imagem, 1:1.
export class Sprite {
  // `legibleWhenReduced` evita que texto perca pixels quando o sprite encolhe na tela.
  constructor(parent, source, { x, y, depth, anchor = 'topleft', legibleWhenReduced = false }) {
    this.depth = depth;
    this.anchor = anchor;
    this.x = x;
    this.y = y;

    const isImagePath = typeof source === 'string';
    this.texture = isImagePath
      ? new THREE.TextureLoader().load(source, () => this.#fit())
      : new THREE.CanvasTexture(source);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = legibleWhenReduced ? THREE.LinearMipmapLinearFilter : THREE.NearestFilter;
    this.texture.generateMipmaps = legibleWhenReduced;

    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: this.texture, alphaTest: 0.5 }),
    );
    parent.add(this.mesh);
    if (isImagePath) this.mesh.visible = false;
    else this.#fit();
  }

  #fit() {
    this.mesh.visible = true;
    const { width, height } = this.texture.image;
    const unit = 2 * HALF_WIDTH * this.depth / VIEW.width;   // tamanho de 1 pixel nessa profundidade
    this.mesh.scale.set(width * unit, height * unit, 1);
    this.moveTo(this.x, this.y);
  }

  // Move o ponto de ancoragem para o pixel (x, y) da tela.
  moveTo(x, y) {
    this.x = x;
    this.y = y;
    const image = this.texture.image;
    if (!image || !image.width) return;
    const [ax, ay] = this.anchor === 'center' ? [image.width / 2, image.height / 2]
      : this.anchor === 'topleft' ? [0, 0] : this.anchor;
    const cx = x - ax + image.width / 2, cy = y - ay + image.height / 2;
    this.mesh.position.set(
      (cx / VIEW.width * 2 - 1) * HALF_WIDTH * this.depth,
      (1 - cy / VIEW.height * 2) * HALF_HEIGHT * this.depth,
      -this.depth,
    );
  }

  set rotation(angle) { this.mesh.rotation.z = angle; }
  refresh() { this.texture.needsUpdate = true; }

  dispose() {
    this.mesh.parent?.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.texture.dispose();
  }
}
