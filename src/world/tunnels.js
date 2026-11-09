import * as THREE from 'three';
import { TUNNEL_HALF_WIDTH, TUNNEL_HEIGHT } from '../game/mapLayout.js';
import { track, trackAt } from './track.js';
import { pixelTexture } from './textures.js';

// Túneis: uma meia-elipse que acompanha a pista. `open` são só arcos, para o que deixa ver o céu.

const ARC_SEGMENTS = 10, RIB_EVERY = 18, OPEN_RIB_EVERY = 9, PORTAL_DEPTH = 3, PORTAL_GROW = 1.1;

function arcBand(from, to, grow, thetaA, thetaB, tile) {
  const { step } = track, rings = Math.max(1, Math.round((to - from) / step));
  const verts = (rings + 1) * (ARC_SEGMENTS + 1), pos = new Float32Array(verts * 3), uv = new Float32Array(verts * 2), index = [];
  const halfWidth = TUNNEL_HALF_WIDTH + grow, height = TUNNEL_HEIGHT + grow;
  for (let i = 0; i <= rings; i++) {
    const distance = from + (to - from) * i / rings, t = trackAt(distance);
    for (let a = 0; a <= ARC_SEGMENTS; a++) {
      const theta = thetaA + (thetaB - thetaA) * a / ARC_SEGMENTS, side = Math.cos(theta) * halfWidth, v = i * (ARC_SEGMENTS + 1) + a;
      pos.set([t.x - t.tz * side, t.y + Math.sin(theta) * height, t.z + t.tx * side], v * 3);
      uv.set([a / 2, distance / tile], v * 2);
      if (i < rings && a < ARC_SEGMENTS) index.push(v, v + ARC_SEGMENTS + 1, v + 1, v + 1, v + ARC_SEGMENTS + 1, v + ARC_SEGMENTS + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(index);
  return geometry;
}

export function wallTexture(style) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = style.wall;
  ctx.fillRect(0, 0, 32, 32);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = style.speckle[i % style.speckle.length];
    ctx.fillRect(Math.floor(Math.random() * 32), Math.floor(Math.random() * 32), 1 + Math.floor(Math.random() * 4), 1 + Math.floor(Math.random() * 2));
  }
  const texture = pixelTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

const SPIKE_CLEARANCE = 4.6, SPIKE_MIN_LENGTH = 0.3;   // a ponta das estalactites nunca desce até a altura dos carros

function addHangingSpikes(group, tunnel, spikes) {
  const geometry = new THREE.ConeGeometry(0.5, 1, 5);
  geometry.rotateX(Math.PI);
  geometry.translate(0, -0.5, 0);
  const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({ color: spikes.color }), spikes.count);
  mesh.frustumCulled = false;
  const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), position = new THREE.Vector3(), scale = new THREE.Vector3();
  for (let i = 0; i < spikes.count; i++) {
    const t = trackAt(tunnel.start + Math.random() * tunnel.length), side = (Math.random() * 2 - 1) * (TUNNEL_HALF_WIDTH - 1.5);
    const y = t.y + TUNNEL_HEIGHT * Math.sqrt(1 - (side / TUNNEL_HALF_WIDTH) ** 2);
    const size = 0.7 + Math.random() * 1.5, length = Math.min(size * (1.2 + Math.random() * 1.6), Math.max(SPIKE_MIN_LENGTH, y - t.y - SPIKE_CLEARANCE));
    matrix.compose(position.set(t.x - t.tz * side, y, t.z + t.tx * side), quaternion, scale.set(size, length, size));
    mesh.setMatrixAt(i, matrix);
  }
  group.add(mesh);
}

function addSolidTunnel(group, tunnel, style) {
  const { start, length } = tunnel;
  const shell = new THREE.MeshBasicMaterial({ map: wallTexture(style), side: THREE.DoubleSide });
  group.add(new THREE.Mesh(arcBand(start, start + length, 0, 0, Math.PI, 6), shell));

  const ribMaterial = new THREE.MeshBasicMaterial({ color: style.rib, side: THREE.DoubleSide });
  for (let d = 0; d <= length; d += RIB_EVERY) group.add(new THREE.Mesh(arcBand(start + d - 0.5, start + d + 0.5, -0.25, 0, Math.PI, 6), ribMaterial));

  for (const line of style.lines) {
    const material = new THREE.MeshBasicMaterial({ color: line.color, side: THREE.DoubleSide, fog: false });
    group.add(new THREE.Mesh(arcBand(start, start + length, -0.35, line.angle - line.width, line.angle + line.width, 6), material));
  }

  const portal = new THREE.MeshBasicMaterial({ color: style.portal, side: THREE.DoubleSide });
  for (const d of [start, start + length]) group.add(new THREE.Mesh(arcBand(d - PORTAL_DEPTH / 2, d + PORTAL_DEPTH / 2, PORTAL_GROW, 0, Math.PI, 6), portal));

  if (style.spikes) addHangingSpikes(group, tunnel, style.spikes);
}

function addOpenTunnel(group, tunnel, style) {
  const { start, length } = tunnel;
  const material = new THREE.MeshBasicMaterial({ color: style.rib, side: THREE.DoubleSide });
  const leaves = new THREE.MeshBasicMaterial({ color: style.leaves });
  const blob = new THREE.IcosahedronGeometry(2.6, 0);
  for (let d = 0; d <= length; d += OPEN_RIB_EVERY) {
    group.add(new THREE.Mesh(arcBand(start + d - 0.6, start + d + 0.6, 0, 0, Math.PI, 6), material));
    const t = trackAt(start + d);
    for (const side of [-5.5, 0, 5.5]) {
      const mesh = new THREE.Mesh(blob, leaves);
      mesh.position.set(t.x - t.tz * side, t.y + TUNNEL_HEIGHT - Math.abs(side) * 0.3 + 0.6, t.z + t.tx * side);
      mesh.scale.set(1.3, 0.8, 1.6);
      group.add(mesh);
    }
  }
}

export function buildTunnels(group, layout, style) {
  for (const tunnel of layout.tunnels) (tunnel.open ? addOpenTunnel : addSolidTunnel)(group, tunnel, style);
}
