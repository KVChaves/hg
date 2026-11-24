import * as THREE from 'three';
import { pixelTexture } from '../textures.js';
import { createBodyAddons, createTireDetails } from './carAddons.js';
import { createBumper, disposeBumper } from './carBumper.js';
import { createNeon, createRoofAccessory } from './carExtras.js';
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

// Camuflagem (game/cloak.js): um plano de corte anda do nariz (z negativo) até a traseira e o que fica à frente
// dele não é desenhado. Cada malha do carro troca o material por uma cópia com o plano enquanto durar.
const CLOAK_FRONT = -2.7, CLOAK_REAR = 2.9;
const BACKWARD = new THREE.Vector3(0, 0, 1);

// Escapamento: canos na traseira e o fogo do nitro saindo deles (z positivo é para trás).
// Cada tipo tem seus canos (`xs`, raio, comprimento) e chama (`layers`: raio, comprimento e cor).
const REAR_Z = 2.2;
const EXHAUST_Y = 0.36;
const EXHAUSTS = {
  stock: { xs: [-0.42, 0.42], radius: 0.08, length: 0.3, layers: [[0.15, 0.95, 0xff7a18], [0.08, 0.55, 0xffe080]] },
  muffled: { xs: [-0.42, 0.42], radius: 0.12, length: 0.42, layers: [[0.1, 0.5, 0x4a7aff], [0.05, 0.3, 0xc8e0ff]] },
  sport: { xs: [-0.55, -0.32, 0.32, 0.55], radius: 0.06, length: 0.3, layers: [[0.11, 0.85, 0xff6a18], [0.06, 0.5, 0xffe890]] },
  drift: { xs: [0], radius: 0.1, length: 0.34, layers: [[0.17, 1.0, 0x30e070], [0.09, 0.6, 0xd8ffd0]] },
  turbo: { xs: [-0.42, 0.42], radius: 0.13, length: 0.4, layers: [[0.2, 1.5, 0x3a6aff], [0.1, 0.9, 0xe8f4ff]] },
  explosive: { xs: [-0.42, 0.42], radius: 0.1, length: 0.36, layers: [[0.24, 1.4, 0xff2810], [0.13, 0.9, 0xffa020], [0.06, 0.5, 0xfff0a0]] },
};

// Base na boca do cano e ponta para trás, para a chama esticar a partir do escapamento.
function flameGeometry(radius, length) {
  const geometry = new THREE.ConeGeometry(radius, length, 5);
  geometry.translate(0, length / 2, 0);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}
const FLAME_FLICKER = [0.7, 1.25];

function createExhaust(kind, color) {
  const config = EXHAUSTS[kind] ?? EXHAUSTS.stock;
  const pipes = new THREE.Group(), flames = new THREE.Group();
  const geometries = [new THREE.CylinderGeometry(config.radius * 0.85, config.radius, config.length, 6).rotateX(Math.PI / 2)];
  const materials = [new THREE.MeshBasicMaterial({ color })];
  for (const x of config.xs) {
    const pipe = new THREE.Mesh(geometries[0], materials[0]);
    pipe.position.set(x, EXHAUST_Y, REAR_Z);
    pipes.add(pipe);
  }
  for (const [radius, length, flameColor] of config.layers) {
    const geometry = flameGeometry(radius, length), material = new THREE.MeshBasicMaterial({ color: flameColor, fog: false });
    geometries.push(geometry);
    materials.push(material);
    for (const x of config.xs) {
      const flame = new THREE.Mesh(geometry, material);
      flame.position.set(x, EXHAUST_Y, REAR_Z + config.length / 2);
      flame.raycast = () => {};                  // o fogo não conta como acerto no carro
      flames.add(flame);
    }
  }
  flames.visible = false;
  return { pipes, flames, dispose: () => { geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); } };
}

// `spec` descreve o carro: veja DEFAULT_SPEC. A frente do modelo aponta para z negativo.
const DEFAULT_SPEC = {
  model: 'coupe', headlightShape: 'rect', primary: 0xc4c0b8, secondary: 0x98161e, glyph: 0xe8e4dc, pattern: 'digital', decal: 'crosses',
  spoiler: 'wing', hood: 'none', hoodColor: 0xd8d4cc, height: 0, tire: { width: 1, radius: 1 }, rim: 'spokes', rimColor: 0xb01820,
  headlight: 0xf8f4d8, glass: { color: 0x3a3c44, level: 0 }, tireColor: 0x0a0a0c, bumper: 'stock', bumperColor: 0x34343a, bumperTrimColor: 0xd8b840, tireKind: 'street', exhaustKind: 'stock', exhaustColor: 0x2a2a2e, heightKind: 'stock', glassKind: 'clear',
  finish: 'gloss', roof: 'none', roofColor: 0x26282e, neon: 'none', neonColor: 0x30e0ff,
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

  let exhaust = null, exhaustKey = '', flames = new THREE.Group();

  let roof = null, roofKey = '', neon = null, neonKey = '';
  let flashing = false, radiusScale = 1, hoodOrnament = null, hoodKey = '', bumper = null, bumperKey = '', addons = null, addonsKey = '', tireDetails = [], tireKey = '';

  function apply(partialSpec) {
    const spec = { ...DEFAULT_SPEC, ...partialSpec };

    const nextExhaust = `${spec.exhaustKind}|${spec.exhaustColor}`;
    if (nextExhaust !== exhaustKey) {
      exhaustKey = nextExhaust;
      if (exhaust) { lifted.remove(exhaust.pipes, exhaust.flames); exhaust.dispose(); }
      exhaust = createExhaust(spec.exhaustKind, spec.exhaustColor);
      flames = exhaust.flames;
      lifted.add(exhaust.pipes, flames);
    }

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

    const nextRoof = `${spec.roof}|${spec.roofColor}|${spec.model}`;
    if (nextRoof !== roofKey) {
      roofKey = nextRoof;
      roof?.dispose();
      roof = createRoofAccessory(spec.roof, spec.roofColor, spec.model);
      lifted.add(roof.group);
    }

    const nextNeon = `${spec.neon}|${spec.neonColor}`;
    if (nextNeon !== neonKey) {
      neonKey = nextNeon;
      neon?.dispose();
      neon = createNeon(spec.neon, spec.neonColor);
      group.add(neon.group);                       // no chão: não sobe com a suspensão
    }

    const nextBumper = `${spec.bumper}|${spec.bumperColor}|${spec.bumperTrimColor}`;
    if (nextBumper !== bumperKey) {
      bumperKey = nextBumper;
      if (bumper) {
        lifted.remove(bumper);
        disposeBumper(bumper);
      }
      bumper = createBumper(spec.bumper, spec.bumperColor, spec.bumperTrimColor);
      lifted.add(bumper);
    }

    const nextAddons = `${spec.model}|${spec.heightKind}|${spec.glassKind}|${spec.bumperTrimColor}`;
    if (nextAddons !== addonsKey) {
      addonsKey = nextAddons;
      addons?.dispose();
      addons = createBodyAddons({ model: spec.model, heightKind: spec.heightKind, glassKind: spec.glassKind, accent: spec.bumperTrimColor });
      lifted.add(addons.group);
    }

    const nextTires = `${spec.tireKind}|${spec.bumperTrimColor}`;
    if (nextTires !== tireKey) {
      tireKey = nextTires;
      tireDetails.forEach(set => set.dispose());
      tireDetails = wheels.map(wheel => {
        const set = createTireDetails(spec.tireKind, wheel.userData.side, spec.bumperTrimColor);
        wheel.add(set.group);
        return set;
      });
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

  const cloakPlane = new THREE.Plane(), cloakClones = new Map();
  let cloaked = false;
  const cloakedCopy = material => {
    if (!cloakClones.has(material)) {
      const copy = material.clone();
      copy.clippingPlanes = [cloakPlane];
      cloakClones.set(material, copy);
    }
    return cloakClones.get(material);
  };
  // As peças trocadas por `apply` ou pelo clarão do tiro entram na próxima chamada.
  function swapToCloak(object) {
    if (!object.material || object.userData.cloakCopy === object.material) return;
    object.userData.cloakOriginal = object.material;
    object.material = Array.isArray(object.material) ? object.material.map(cloakedCopy) : cloakedCopy(object.material);
    object.userData.cloakCopy = object.material;
  }
  function restoreFromCloak(object) {
    if (!object.userData.cloakOriginal) return;
    if (object.material === object.userData.cloakCopy) object.material = object.userData.cloakOriginal;
    object.userData.cloakOriginal = object.userData.cloakCopy = null;
  }

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
    // `amount`: 0 inteiro, 1 todo escondido. Chamar depois de posicionar o carro no quadro.
    setCloak(amount) {
      if (amount <= 0) {
        if (!cloaked) return;
        cloaked = false;
        group.traverse(restoreFromCloak);
        for (const copy of cloakClones.values()) copy.dispose();
        cloakClones.clear();
        return;
      }
      cloaked = true;
      group.traverse(swapToCloak);
      group.updateWorldMatrix(true, false);
      const cut = CLOAK_FRONT + (CLOAK_REAR - CLOAK_FRONT) * Math.min(1, amount);
      cloakPlane.set(BACKWARD, -cut).applyMatrix4(group.matrixWorld);   // fica só o que está atrás do corte
    },
  };
}
