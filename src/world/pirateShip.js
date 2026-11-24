import * as THREE from 'three';
import { pixelTexture } from './textures.js';
import { coneGeometry, shadedPart } from './biomes/plants.js';

// Navio pirata do Porto dos Piratas (cenário do mar e dos canhões que atiram na pista, hazardSites.js).

// Bandeira negra com caveira e ossos cruzados.
function flagTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 16; canvas.height = 10;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#141414'; ctx.fillRect(0, 0, 16, 10);
  ctx.fillStyle = '#f0ece0'; ctx.fillRect(6, 1, 4, 4); ctx.fillRect(7, 5, 2, 1);
  for (let i = 0; i < 6; i++) { ctx.fillRect(4 + i * 1.4, 6 + i * 0.5, 1, 1); ctx.fillRect(4 + i * 1.4, 9 - i * 0.5, 1, 1); }
  return pixelTexture(canvas);
}

// Navio pirata: casco escuro com castelo de popa, portinholas dos canhões, três mastros com velas e a bandeira negra.
// A frente fica para +x. Devolve um grupo (os navios são clones dele, com a mesma geometria).
export function pirateShip(sailColor, { cannons = 0 } = {}) {
  const ship = new THREE.Group();
  const hull = shadedPart([
    { geometry: new THREE.BoxGeometry(20, 3.6, 6).translate(0, 1.2, 0), color: 0x4a2e18 },
    { geometry: coneGeometry([0, 0, 0], 3.4, 6, 4).rotateZ(-Math.PI / 2).rotateX(Math.PI / 4).scale(1, 0.75, 1).translate(13, 1.4, 0), color: 0x4a2e18 },   // proa
    { geometry: new THREE.BoxGeometry(5.4, 3, 6.2).translate(-7.6, 4.4, 0), color: 0x5a3a20 },                     // castelo de popa
    { geometry: new THREE.BoxGeometry(20.2, 0.5, 6.2).translate(0, 3.1, 0), color: 0xc8a040 },                    // friso dourado
    ...[-5, -1.5, 2, 5.5].flatMap(x => [1, -1].map(side => ({ geometry: new THREE.BoxGeometry(0.9, 0.8, 0.1).translate(x, 2.1, side * 3.05), color: 0x141414 }))),   // portinholas
    ...[-4, 2.5, 8].map(x => ({ geometry: new THREE.CylinderGeometry(0.22, 0.3, 17, 6).translate(x, 11, 0), color: 0x3a2410 })),   // mastros
    ...[-4, 2.5, 8].flatMap(x => [8, 13.5].map(y => ({ geometry: new THREE.BoxGeometry(0.25, 0.25, 7).translate(x, y + 2.3, 0), color: 0x3a2410 }))),   // vergas
  ]);
  ship.add(new THREE.Mesh(hull.geometry, hull.material));
  const sail = new THREE.MeshBasicMaterial({ color: sailColor, side: THREE.DoubleSide });
  for (const x of [-4, 2.5, 8]) for (const [y, w, h] of [[7.2, 6.6, 4.6], [12.7, 5.4, 4.2]]) {
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 2, 1), sail);
    const pos = cloth.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) if (Math.abs(pos.getX(i)) < 0.01) pos.setZ(i, 0.9);   // estufada pelo vento
    cloth.rotation.y = Math.PI / 2;
    cloth.position.set(x + 0.3, y, 0);
    ship.add(cloth);
  }
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.9), new THREE.MeshBasicMaterial({ map: flagTexture(), side: THREE.DoubleSide }));
  flag.position.set(2.5 - 1.5, 20.4, 0);
  ship.add(flag);
  // `cannons` (-1 ou 1): canos para fora das portinholas desse lado (z), para os que atiram na pista.
  if (cannons) {
    const iron = new THREE.MeshBasicMaterial({ color: 0x1e1e22 });
    for (const x of [-5, -1.5, 2, 5.5]) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 2.2, 7), iron);
      barrel.rotation.x = cannons * Math.PI / 2;
      barrel.position.set(x, 2.1, cannons * 3.6);
      ship.add(barrel);
    }
  }
  return ship;
}

