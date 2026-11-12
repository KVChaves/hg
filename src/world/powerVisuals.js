import * as THREE from 'three';
import { EMP_RADIUS } from '../game/trapTypes.js';

// Visual dos poderes: a bolha do escudo em volta de cada carro protegido e a onda do pulso EMP.
const PULSE_TIME = 0.22, MAX_PULSES = 4, SHIELD_FLICKER_BELOW = 2;

export function createPowerVisuals(scene) {
  const sphere = new THREE.SphereGeometry(1, 18, 12);
  const pulses = Array.from({ length: MAX_PULSES }, () => {
    const mesh = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: 0xcfeaff, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    mesh.visible = false;
    scene.add(mesh);
    return { mesh, age: PULSE_TIME };
  });
  const bubbles = new Map();
  const shocks = new Map();
  const BOLTS = 6, BOLT_POINTS = 4;

  // Choque: clarão azul piscando + raios que mudam de lugar a ~25 vezes por segundo em volta do carro afetado.
  function shockOf(racer) {
    if (!shocks.has(racer)) {
      const positions = new Float32Array(BOLTS * (BOLT_POINTS - 1) * 2 * 3);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const bolts = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xbfe8ff, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
      bolts.frustumCulled = false;
      const glow = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: 0x4cb8ff, transparent: true, opacity: 0.3, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
      glow.scale.set(1.4, 0.9, 2.6);
      const group = new THREE.Group();
      group.add(glow, bolts);
      group.visible = false;
      scene.add(group);
      shocks.set(racer, { group, glow, bolts, positions, tick: 0 });
    }
    return shocks.get(racer);
  }

  function rerollBolts(shock) {
    const a = shock.positions;
    let i = 0;
    for (let b = 0; b < BOLTS; b++) {
      let x = (Math.random() - 0.5) * 1.6, y = Math.random() * 1.4, z = (Math.random() - 0.5) * 3.4;
      for (let k = 0; k < BOLT_POINTS - 1; k++) {
        a[i++] = x; a[i++] = y; a[i++] = z;
        x += (Math.random() - 0.5) * 1.2; y += (Math.random() - 0.5) * 0.9; z += (Math.random() - 0.5) * 1.6;
        a[i++] = x; a[i++] = y; a[i++] = z;
      }
    }
    shock.bolts.geometry.attributes.position.needsUpdate = true;
  }

  function bubbleOf(racer) {
    if (!bubbles.has(racer)) {
      const mesh = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: 0x58b4ff, transparent: true, opacity: 0.22, depthWrite: false, fog: false }));
      mesh.scale.set(1.5, 1, 2.7);
      mesh.visible = false;
      scene.add(mesh);
      bubbles.set(racer, mesh);
    }
    return bubbles.get(racer);
  }

  return {
    pulse(x, y, z) {
      const slot = pulses.find(entry => entry.age >= PULSE_TIME) ?? pulses[0];
      slot.age = 0;
      slot.mesh.position.set(x, y, z);
      slot.mesh.visible = true;
    },

    update(field, dt) {
      for (const slot of pulses) {
        if (slot.age >= PULSE_TIME) continue;
        slot.age += dt;
        const t = Math.min(1, slot.age / PULSE_TIME);
        slot.mesh.scale.setScalar(1 + (EMP_RADIUS - 1) * (1 - (1 - t) ** 3));
        slot.mesh.material.opacity = 0.7 * (1 - t) ** 2;
        if (t >= 1) slot.mesh.visible = false;
      }
      const now = performance.now() / 1000;
      for (const racer of field) {
        const active = racer.effects.shield > 0 && racer.dead <= 0;
        if (!active && !bubbles.has(racer)) continue;
        const bubble = bubbleOf(racer);
        bubble.visible = active;
        if (!active) continue;
        bubble.position.set(racer.wx, racer.wy + 0.8, racer.wz);
        bubble.rotation.y = racer.yaw;
        const flicker = racer.effects.shield < SHIELD_FLICKER_BELOW && Math.sin(now * 24) > 0;
        bubble.material.opacity = flicker ? 0.06 : 0.2 + 0.05 * Math.sin(now * 5);
      }
      for (const racer of field) {
        const shocked = racer.effects.emp > 0 && racer.dead <= 0;
        if (!shocked && !shocks.has(racer)) continue;
        const shock = shockOf(racer);
        shock.group.visible = shocked;
        if (!shocked) continue;
        shock.group.position.set(racer.wx, racer.wy + 0.1, racer.wz);
        shock.group.rotation.y = racer.yaw;
        shock.tick -= dt;
        if (shock.tick <= 0) {
          shock.tick = 0.04;
          rerollBolts(shock);
          shock.bolts.visible = Math.random() > 0.15;
          shock.glow.material.opacity = 0.12 + Math.random() * 0.35;
        }
      }
    },

    reset() {
      for (const slot of pulses) { slot.age = PULSE_TIME; slot.mesh.visible = false; }
      for (const bubble of bubbles.values()) bubble.visible = false;
      for (const shock of shocks.values()) shock.group.visible = false;
    },
  };
}
