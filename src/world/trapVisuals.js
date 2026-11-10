import * as THREE from 'three';

// Aparência das armadilhas na pista.

const GROUND_OFFSET = { polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 };
const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });

function groundDisc(group, halfWidth, halfLength, color, y = 0.05) {
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 11), basic(color, GROUND_OFFSET));
  mesh.rotation.x = -Math.PI / 2;
  mesh.scale.set(halfWidth, halfLength, 1);
  mesh.position.y = y;
  group.add(mesh);
  return mesh;
}

function buildSpikes(group, { halfWidth, halfLength }) {
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(halfWidth * 2, halfLength * 2), basic(0x120c0a, GROUND_OFFSET));
  plate.rotation.x = -Math.PI / 2;
  plate.position.y = 0.05;
  group.add(plate);

  const cone = new THREE.ConeGeometry(0.14, 0.5, 4);
  cone.translate(0, 0.25, 0);
  const columns = Math.floor(halfWidth * 2 / 0.75), rows = 4;
  const spikes = new THREE.InstancedMesh(cone, basic(0xa8a8a8), columns * rows);
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < columns * rows; i++) {
    const row = Math.floor(i / columns), stagger = row % 2 ? 0.37 : 0;
    matrix.makeTranslation(-halfWidth + 0.3 + (i % columns) * 0.75 + stagger, 0, -halfLength + 0.4 + row * (halfLength * 2 / rows));
    spikes.setMatrixAt(i, matrix);
  }
  group.add(spikes);
}

function buildOil(group, { halfWidth, halfLength }) {
  groundDisc(group, halfWidth, halfLength, 0x070506);
  groundDisc(group, halfWidth * 0.55, halfLength * 0.4, 0x2a2436, 0.06).position.x = halfWidth * 0.2;
}

function buildPaint(group, { halfWidth, halfLength }) {
  groundDisc(group, halfWidth, halfLength, 0xb8d020);
  groundDisc(group, halfWidth * 0.5, halfLength * 0.55, 0xd8ec40, 0.06).position.z = 0.3;
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.7, 7), basic(0x8a8a90));
  can.position.set(0.6, 0.35, -0.3);
  group.add(can);
}

function buildDynamite(group) {
  const stick = new THREE.CylinderGeometry(0.13, 0.13, 0.9, 6);
  for (const x of [-0.28, 0, 0.28]) {
    const mesh = new THREE.Mesh(stick, basic(0xb02018));
    mesh.position.set(x, 0.14, 0);
    mesh.rotation.x = Math.PI / 2;
    group.add(mesh);
  }
  const spark = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), basic(0xffe080, { fog: false }));
  spark.position.set(0, 0.42, -0.45);
  group.add(spark);

  const fireball = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), basic(0xff8a20, { fog: false }));
  fireball.position.y = 1.5;
  fireball.visible = false;
  group.add(fireball);
  return { spark, fireball };
}

function buildSmoke(group) {
  const puff = new THREE.IcosahedronGeometry(1, 1);
  const puffs = [];
  for (let i = 0; i < 9; i++) {
    const mesh = new THREE.Mesh(puff, basic(i % 2 ? 0x3a3430 : 0x2c2724));
    mesh.position.set((i % 3 - 1) * 5 + Math.random() * 2, 1.2 + Math.random() * 1.5, (i - 4) * 1.7);
    group.add(mesh);
    puffs.push({ mesh, size: 2 + Math.random() * 1.6 });
  }
  return puffs;
}

// Chão queimando: mancha preta e chamas que tremulam, crescem ao cair e somem no fim da vida.
const FIRE_COLORS = [0xff5a10, 0xff9a20, 0xffd050];
function buildGroundFire(group, { halfWidth, halfLength }) {
  groundDisc(group, halfWidth, halfLength, 0x140a06);
  groundDisc(group, halfWidth * 0.7, halfLength * 0.7, 0x3a1206, 0.06);
  const cone = new THREE.ConeGeometry(0.5, 1, 5);
  cone.translate(0, 0.5, 0);
  const flames = [];
  for (let i = 0; i < 11; i++) {
    const a = i * 2.4, r = Math.sqrt((i + 0.5) / 11);
    const mesh = new THREE.Mesh(cone, basic(FIRE_COLORS[i % FIRE_COLORS.length], { fog: false }));
    mesh.position.set(Math.cos(a) * r * halfWidth * 0.85, 0, Math.sin(a) * r * halfLength * 0.85);
    group.add(mesh);
    flames.push({ mesh, height: 1.2 + Math.random() * 1.6, width: 0.7 + Math.random() * 0.6, phase: Math.random() * 6 });
  }
  return flames;
}

export function createTrapVisual(type) {
  const group = new THREE.Group();
  let age = 0, dynamite = null, puffs = null, flames = null;

  if (type.id === 'spikes') buildSpikes(group, type);
  if (type.id === 'oil') buildOil(group, type);
  if (type.id === 'paint') buildPaint(group, type);
  if (type.id === 'dynamite') dynamite = buildDynamite(group);
  if (type.id === 'smoke') puffs = buildSmoke(group);
  if (type.id === 'fire') flames = buildGroundFire(group, type);

  return {
    group,
    update(dt) {
      age += dt;
      if (dynamite) dynamite.spark.visible = Math.floor(age * 16) % 2 === 0;
      if (puffs) {
        const grow = Math.min(1, age * 2.5);
        for (const { mesh, size } of puffs) mesh.scale.setScalar(size * grow);
      }
      if (flames) {
        const strength = Math.min(1, age * 4) * Math.max(0, Math.min(1, type.life - age));
        for (const flame of flames) {
          const flicker = 0.75 + 0.25 * Math.sin(age * 17 + flame.phase) + Math.random() * 0.15;
          flame.mesh.scale.set(flame.width * strength, flame.height * flicker * strength + 0.01, flame.width * strength);
        }
      }
    },
    showExplosion(progress) {
      const { fireball, spark } = dynamite;
      spark.visible = false;
      fireball.visible = true;
      fireball.scale.setScalar(2 + progress * type.radius);
      fireball.material.color.setHex(progress < 0.5 ? 0xffc040 : 0xd84a14);
    },
    dispose() {
      group.traverse(object => {
        object.geometry?.dispose();
        object.material?.dispose();
      });
    },
  };
}
