import * as THREE from 'three';
import { pixelTexture } from '../textures.js';
import { createBumper, disposeBumper } from './carBumper.js';
import { createBodyGeometry, createSpoilerGeometry } from './carGeometry.js';
import { createHoodOrnament, disposeHoodOrnament } from './carHood.js';
import { paintLivery, paintRim, WHEEL_POSITIONS_Z } from './carLivery.js';
import { createCarLights } from './carLights.js';

const WHEEL_RADIUS = 0.34, WHEEL_WIDTH = 0.22, WHEEL_X = 0.86;

const bodyGeometries = new Map();
function bodyGeometry(model) {
  if (!bodyGeometries.has(model)) bodyGeometries.set(model, createBodyGeometry(model));
  return bodyGeometries.get(model);
}
const wheelGeometry = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_WIDTH, 12);
wheelGeometry.rotateZ(Math.PI / 2);
const spoilerGeometries = new Map();

function spoilerGeometry(kind, model) {
  const key = `${model}:${kind}`;
  if (!spoilerGeometries.has(key)) spoilerGeometries.set(key, createSpoilerGeometry(kind, model));
  return spoilerGeometries.get(key);
}

const flashMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });

// Escapamento: dois canos na traseira e o fogo do nitro saindo deles (z positivo é para trás).
const REAR_Z = 2.2;
const EXHAUST_X = [-0.42, 0.42], EXHAUST_Y = 0.36;
const pipeGeometry = new THREE.CylinderGeometry(0.075, 0.09, 0.3, 6);
pipeGeometry.rotateX(Math.PI / 2);
const pipeMaterial = new THREE.MeshBasicMaterial({ color: 0x2a2a2e });

// Base na boca do cano e ponta para trás, para a chama esticar a partir do escapamento.
function flameGeometry(radius, length) {
  const geometry = new THREE.ConeGeometry(radius, length, 5);
  geometry.translate(0, length / 2, 0);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}
const FLAME_LAYERS = [
  { geometry: flameGeometry(0.15, 0.95), material: new THREE.MeshBasicMaterial({ color: 0xff7a18, fog: false }) },
  { geometry: flameGeometry(0.08, 0.55), material: new THREE.MeshBasicMaterial({ color: 0xffe080, fog: false }) },
];
const FLAME_FLICKER = [0.7, 1.25];

// `spec` descreve o carro: veja DEFAULT_SPEC. A frente do modelo aponta para z negativo.
const DEFAULT_SPEC = {
  model: 'coupe', headlightShape: 'rect', primary: 0xc4c0b8, secondary: 0x98161e, glyph: 0xe8e4dc, pattern: 'digital', decal: 'crosses',
  spoiler: 'wing', hood: 'none', hoodColor: 0xd8d4cc, height: 0, tire: { width: 1, radius: 1 }, rim: 'spokes', rimColor: 0xb01820,
  headlight: 0xf8f4d8, glass: { color: 0x3a3c44, level: 0 }, tireColor: 0x0a0a0c, bumper: 'stock', bumperColor: 0x34343a,
};

export function createCarModel(initialSpec, seed = 0) {
  const group = new THREE.Group();
  const lifted = new THREE.Group();        // carroceria e aerofólio sobem e descem juntos
  group.add(lifted);

  const paint = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const body = new THREE.Mesh(bodyGeometry('coupe'), paint);
  const spoiler = new THREE.Mesh(bodyGeometry('coupe'), paint);
  lifted.add(body, spoiler);

  const rim = new THREE.MeshBasicMaterial();
  const tire = new THREE.MeshBasicMaterial();
  const wheelMaterials = [tire, rim, rim];
  const wheels = [];
  for (const z of WHEEL_POSITIONS_Z) {
    for (const side of [-1, 1]) {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterials);
      wheel.rotation.order = 'YXZ';          // esterço (y) antes do giro da roda (x)
      wheel.userData.side = side;
      wheel.position.z = z;
      group.add(wheel);
      wheels.push(wheel);
    }
  }

  const flames = new THREE.Group();
  flames.visible = false;
  lifted.add(flames);
  for (const x of EXHAUST_X) {
    const pipe = new THREE.Mesh(pipeGeometry, pipeMaterial);
    pipe.position.set(x, EXHAUST_Y, REAR_Z);
    lifted.add(pipe);
    for (const { geometry, material } of FLAME_LAYERS) {
      const flame = new THREE.Mesh(geometry, material);
      flame.position.set(x, EXHAUST_Y, REAR_Z + 0.14);
      flame.raycast = () => {};                  // o fogo não conta como acerto no carro
      flames.add(flame);
    }
  }

  let flashing = false, radiusScale = 1, hoodOrnament = null, hoodKey = '', bumper = null, bumperKey = '';

  function apply(partialSpec) {
    const spec = { ...DEFAULT_SPEC, ...partialSpec };

    paint.map?.dispose();
    paint.map = pixelTexture(paintLivery(spec, seed));
    paint.needsUpdate = true;
    rim.map?.dispose();
    rim.map = pixelTexture(paintRim(spec.rim, spec.rimColor));
    rim.needsUpdate = true;
    tire.color.setHex(spec.tireColor);

    body.geometry = bodyGeometry(spec.model);
    const nextHood = `${spec.hood}|${spec.hoodColor}|${spec.model}`;
    if (nextHood !== hoodKey) {
      hoodKey = nextHood;
      if (hoodOrnament) {
        lifted.remove(hoodOrnament);
        disposeHoodOrnament(hoodOrnament);
      }
      hoodOrnament = createHoodOrnament(spec.hood, spec.hoodColor, spec.model);
      lifted.add(hoodOrnament);
    }

    const nextBumper = `${spec.bumper}|${spec.bumperColor}`;
    if (nextBumper !== bumperKey) {
      bumperKey = nextBumper;
      if (bumper) {
        lifted.remove(bumper);
        disposeBumper(bumper);
      }
      bumper = createBumper(spec.bumper, spec.bumperColor);
      lifted.add(bumper);
    }

    spoiler.visible = spec.spoiler !== 'none';
    if (spoiler.visible) spoiler.geometry = spoilerGeometry(spec.spoiler, spec.model);
    lifted.position.y = spec.height;

    radiusScale = spec.tire.radius;
    for (const wheel of wheels) {
      wheel.scale.set(spec.tire.width, radiusScale, radiusScale);
      wheel.position.x = wheel.userData.side * (WHEEL_X + (spec.tire.width - 1) * WHEEL_WIDTH / 2);
      wheel.position.y = WHEEL_RADIUS * radiusScale;
    }
  }

  apply(initialSpec);
  const lights = createCarLights();
  lifted.add(lights.group);

  return {
    group,
    apply,
    setLights: lights.setOn,                         // faróis acesos nos trechos escuros
    roll(distance) {
      const angle = distance / (WHEEL_RADIUS * radiusScale);
      for (const wheel of wheels) wheel.rotation.x -= angle;
    },
    steer(angle) {
      for (const wheel of wheels.slice(0, 2)) wheel.rotation.y = -angle;   // as duas primeiras são as dianteiras
    },
    // Chamado a cada quadro: com o nitro aberto o fogo tremula.
    setNitro(active) {
      flames.visible = active;
      if (!active) return;
      for (const flame of flames.children) {
        flame.scale.z = FLAME_FLICKER[0] + Math.random() * (FLAME_FLICKER[1] - FLAME_FLICKER[0]);
      }
    },
    setFlash(active) {
      if (active === flashing) return;
      flashing = active;
      body.material = spoiler.material = active ? flashMaterial : paint;
    },
  };
}
