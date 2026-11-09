import * as THREE from 'three';
import { Raster } from '../../art/raster.js';
import { mix } from '../../art/shade.js';
import { pixelTexture } from '../textures.js';
import { CAR_SHAPES } from './carShapes.js';

// Acessórios colados no capô. `kind` vem de CAR_SLOTS.hood; cada um usa a cor escolhida.

const SLOPE_SPAN = 0.4;                               // metros para os dois lados ao medir a inclinação do capô
const DARK = 0x0a0a0c, METAL = 0x8a8c92;

const solid = color => new THREE.MeshBasicMaterial({ color });

function box(group, [w, h, d], [x, y, z], color) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), solid(color));
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

function paintDecal(draw) {
  const r = new Raster(64, 52);
  draw(r);
  return r.commit();
}

function decal(group, canvas) {
  const material = new THREE.MeshBasicMaterial({ map: pixelTexture(canvas), alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.98), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.012;
  group.add(mesh);
}

function starPoints(cx, cy, outer, inner) {
  return Array.from({ length: 10 }, (_, i) => {
    const angle = -Math.PI / 2 + i * Math.PI / 5, radius = i % 2 ? inner : outer;
    return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
  });
}

const BUILDERS = {
  skull(group, color) {
    const light = mix(color, 0xffffff, 0.15), shade = mix(color, 0, 0.3);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), solid(light));
    head.scale.set(1, 0.95, 1.15);
    head.position.set(0, 0.3, 0);
    group.add(head);
    box(group, [0.26, 0.11, 0.24], [0, 0.11, -0.05], shade);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.058, 0), solid(DARK));
      eye.position.set(side * 0.085, 0.32, -0.2);
      group.add(eye);
    }
    box(group, [0.05, 0.07, 0.03], [0, 0.23, -0.22], DARK);
    for (const x of [-0.08, 0, 0.08]) box(group, [0.05, 0.06, 0.02], [x, 0.11, -0.175], 0xf0ece0);
    box(group, [0.36, 0.05, 0.36], [0, 0.025, 0], DARK);
  },
  blower(group, color) {
    box(group, [0.62, 0.1, 0.72], [0, 0.05, 0], 0x1e1e22);
    box(group, [0.42, 0.24, 0.62], [0, 0.22, 0], color);
    box(group, [0.48, 0.03, 0.66], [0, 0.345, 0], mix(color, 0xffffff, 0.3));
    box(group, [0.5, 0.14, 0.34], [0, 0.42, -0.05], METAL);
    for (const x of [-0.12, 0.12]) box(group, [0.17, 0.1, 0.02], [x, 0.42, -0.225], DARK);
    const pulley = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 10), solid(METAL));
    pulley.rotation.x = Math.PI / 2;
    pulley.position.set(0, 0.2, -0.335);
    group.add(pulley);
    box(group, [0.05, 0.2, 0.02], [0, 0.18, -0.36], DARK);
    for (const x of [-0.27, 0.27]) box(group, [0.05, 0.05, 0.7], [x, 0.13, 0], 0xb02018);
  },
  scoop(group, color) {
    box(group, [0.74, 0.05, 1.0], [0, 0.025, 0.05], mix(color, 0, 0.25));
    box(group, [0.6, 0.13, 0.62], [0, 0.11, 0.16], color);
    box(group, [0.5, 0.09, 0.02], [0, 0.11, -0.16], DARK);
    box(group, [0.64, 0.03, 0.66], [0, 0.185, 0.16], mix(color, 0xffffff, 0.25));
  },
  horns(group, color) {
    box(group, [0.5, 0.08, 0.26], [0, 0.04, 0], mix(color, 0, 0.45));
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.6, 7), solid(color));
      horn.rotation.z = -side * 1.1;
      horn.position.set(side * 0.42, 0.22, 0);
      group.add(horn);
      box(group, [0.14, 0.13, 0.15], [side * 0.18, 0.13, 0], mix(color, 0, 0.3));
    }
  },
  star(group, color) {
    decal(group, paintDecal(r => {
      r.poly(starPoints(32, 27, 26, 12), DARK);
      r.poly(starPoints(32, 27, 21, 8.5), color);
    }));
  },
  target(group, color) {
    decal(group, paintDecal(r => {
      r.disc(32, 26, 26, DARK);
      r.ring(32, 26, 24, 19, color);
      r.ring(32, 26, 13, 8, color);
      r.disc(32, 26, 3.5, color);
      r.rect(30, 0, 4, 52, color);
      r.rect(4, 24, 56, 4, color);
    }));
  },
};

export function createHoodOrnament(kind, color, model) {
  const group = new THREE.Group(), { stations, greenhouse, beltAt } = CAR_SHAPES[model];
  const z = (stations[1].z + greenhouse.front.z) / 2;
  group.position.set(0, beltAt(z), z);
  group.rotation.x = -Math.atan((beltAt(z + SLOPE_SPAN) - beltAt(z - SLOPE_SPAN)) / (SLOPE_SPAN * 2));
  BUILDERS[kind]?.(group, color);
  return group;
}

export function disposeHoodOrnament(group) {
  group.traverse(object => {
    object.geometry?.dispose();
    object.material?.map?.dispose();
    object.material?.dispose();
  });
}
