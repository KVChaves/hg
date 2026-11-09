import * as THREE from 'three';
import { track } from './track.js';
import { pixelTexture } from './textures.js';

// Muros dos dois lados da pista, com o visual do bioma. Acompanham `track.wall`, que é o limite da colisão;
// o centro do carro para nesse limite, então o muro fica meia largura de carro além dele.

const CAR_HALF_WIDTH = 1.05, BURIED = 1.2, TEXTURE_WIDTH = 128, TEXTURE_HEIGHT = 32;

function wallMaterial(style) {
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_WIDTH;
  canvas.height = TEXTURE_HEIGHT;
  style.paint(canvas.getContext('2d'), TEXTURE_WIDTH, TEXTURE_HEIGHT);
  const texture = pixelTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  return new THREE.MeshBasicMaterial({ map: texture, alphaTest: 0.5, side: THREE.DoubleSide });
}

function wallGeometry(side, style, isCovered) {
  const { count, step, px, py, pz, tx, tz, wall, heightAt } = track;
  const pos = new Float32Array((count + 1) * 6), uv = new Float32Array((count + 1) * 4), index = [];
  for (let i = 0; i <= count; i++) {
    const k = i % count, lateral = side * (wall[k] + CAR_HALF_WIDTH);
    const x = px[k] - tz[k] * lateral, z = pz[k] + tx[k] * lateral, ground = heightAt(x, z);
    const a = i * 2, u = -side * i * step / style.tile;   // de dentro da pista, a textura fica na mesma direção dos dois lados
    // A base entra na terra e o topo acompanha o que estiver mais alto, estrada ou barranco.
    const base = track.drop[k] > 0 ? py[k] : Math.min(py[k], ground);     // nas plataformas o muro assenta nelas, não no fundo do abismo
    pos.set([x, base - BURIED, z, x, Math.max(py[k], ground) + style.height, z], a * 3);
    uv.set([u, 0, u, 1], a * 2);
    if (i < count && !isCovered(k)) index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(index);
  return geometry;
}

// Dentro dos túneis fechados e do tubo a parede deles faz esse papel; nos saltos não há muro.
export function buildWalls(group, layout, style) {
  const solid = layout.tunnels.filter(tunnel => !tunnel.open);
  const isCovered = k => track.gap[k] === 1 || track.roll[k] !== 0 || solid.some(({ start, length }) => {
    const offset = ((k * track.step - start) % track.length + track.length) % track.length;
    return offset < length;
  });
  const material = wallMaterial(style);
  for (const side of [-1, 1]) group.add(new THREE.Mesh(wallGeometry(side, style, isCovered), material));
}
