import * as THREE from 'three';
import { PROJECT } from './carAtlas.js';
import { CAR_SHAPES } from './carShapes.js';

// Carroceria de poucos polígonos, compartilhada por todos os carros.

// Alturas relativas à tampa traseira de uma carroceria padrão; `decks` soma a diferença de cada modelo.
const DECK_Y = 1.0;
const SPOILERS = {
  lip: { z0: 2.06, z1: 2.3, y: 1.05, thickness: 0.05, halfWidth: 0.78, postX: 0.5, postBase: 1.0 },
  duck: { z0: 1.9, z1: 2.3, y: 1.04, thickness: 0.09, halfWidth: 0.82 },
  wing: { z0: 2.0, z1: 2.3, y: 1.16, thickness: 0.05, halfWidth: 0.82, postX: 0.58, postBase: 1.0 },
  twin: { z0: 2.0, z1: 2.32, y: 1.14, thickness: 0.04, halfWidth: 0.84, postX: 0.58, postBase: 1.0, secondBlade: 0.14 },
  gt: { z0: 1.96, z1: 2.36, y: 1.36, thickness: 0.06, halfWidth: 0.92, postX: 0.6, postBase: 1.0 },
};

function createBuilder() {
  const positions = [], uvs = [];

  function triangle(a, b, c, project) {
    for (const v of [a, b, c]) {
      positions.push(...v);
      uvs.push(...project(v));
    }
  }
  function quad(a, b, c, d, project) {
    triangle(a, b, c, project);
    triangle(a, c, d, project);
  }
  function build() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    return geometry;
  }
  return { quad, build };
}

function addLowerBody({ quad }, stations) {
  for (let i = 0; i + 1 < stations.length; i++) {
    const s0 = stations[i], s1 = stations[i + 1];
    for (const side of [-1, 1]) {
      quad([side * s0.floorWidth, s0.floor, s0.z], [side * s1.floorWidth, s1.floor, s1.z],
        [side * s1.beltWidth, s1.belt, s1.z], [side * s0.beltWidth, s0.belt, s0.z], PROJECT.side);
    }
    quad([-s0.beltWidth, s0.belt, s0.z], [s0.beltWidth, s0.belt, s0.z],
      [s1.beltWidth, s1.belt, s1.z], [-s1.beltWidth, s1.belt, s1.z], PROJECT.top);
  }
  const cap = ({ z, floor, belt, floorWidth, beltWidth }, project) => quad(
    [-floorWidth, floor, z], [floorWidth, floor, z], [beltWidth, belt, z], [-beltWidth, belt, z], project,
  );
  cap(stations[0], PROJECT.front);
  cap(stations[stations.length - 1], PROJECT.rear);
}

function addGreenhouse({ quad }, { front, roofFront, roofRear, rear }) {
  const point = (side, p) => [side * p.width, p.y, p.z];

  for (const [a, b] of [[front, roofFront], [roofFront, roofRear], [roofRear, rear]]) {
    quad(point(-1, a), point(1, a), point(1, b), point(-1, b), PROJECT.top);
  }
  for (const side of [-1, 1]) {
    quad(point(side, front), point(side, roofFront), point(side, roofRear), point(side, rear), PROJECT.side);
  }
}

function addBox({ quad }, x0, x1, y0, y1, z0, z1) {
  const c = (x, y, z) => [x, y, z];
  const faces = [
    [c(x0, y1, z0), c(x1, y1, z0), c(x1, y1, z1), c(x0, y1, z1)],
    [c(x0, y0, z0), c(x1, y0, z0), c(x1, y0, z1), c(x0, y0, z1)],
    [c(x0, y0, z0), c(x1, y0, z0), c(x1, y1, z0), c(x0, y1, z0)],
    [c(x0, y0, z1), c(x1, y0, z1), c(x1, y1, z1), c(x0, y1, z1)],
    [c(x0, y0, z0), c(x0, y0, z1), c(x0, y1, z1), c(x0, y1, z0)],
    [c(x1, y0, z0), c(x1, y0, z1), c(x1, y1, z1), c(x1, y1, z0)],
  ];
  for (const [a, b, d, e] of faces) quad(a, b, d, e, PROJECT.solid);
}

export function createSpoilerGeometry(kind, model) {
  const builder = createBuilder();
  const { z0, z1, y: baseY, thickness, halfWidth, postX, postBase, secondBlade } = SPOILERS[kind];
  const lift = CAR_SHAPES[model].beltAt(2.1) - DECK_Y, y = baseY + lift;
  addBox(builder, -halfWidth, halfWidth, y, y + thickness, z0, z1);
  if (secondBlade) addBox(builder, -halfWidth, halfWidth, y + secondBlade, y + secondBlade + thickness, z0 + 0.04, z1 - 0.04);
  if (postX) {
    for (const side of [-1, 1]) {
      addBox(builder, side * postX - 0.05, side * postX + 0.05, postBase + lift, y + (secondBlade ?? 0), z0 + 0.08, z0 + 0.22);
    }
  }
  return builder.build();
}

export function createBodyGeometry(model = 'coupe') {
  const builder = createBuilder(), { stations, greenhouse } = CAR_SHAPES[model];
  addLowerBody(builder, stations);
  addGreenhouse(builder, greenhouse);
  return builder.build();
}
