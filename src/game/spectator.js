import * as THREE from 'three';

// Modo espectador: depois de cruzar a linha de chegada o jogador acompanha os outros pilotos por trás.

const DISTANCE = 7.5, HEIGHT = 2.8, LOOK_AHEAD = 3, LOOK_HEIGHT = 1, FOLLOW_SPEED = 6;

export function createSpectator({ opponents, race, camera }) {
  let targetName = null, yaw = 0;
  const candidates = () => opponents.filter(op => op.group.visible);
  const find = () => candidates().find(op => op.name === targetName);

  const spectator = {
    camera,
    active: false,
    get targetName() { return find()?.name ?? ''; },
    hasTargets: () => candidates().length > 0,
    reset() { targetName = null; spectator.active = false; },
    cycle(direction) {
      const list = candidates();
      if (!list.length) return;
      const current = list.findIndex(op => op.name === targetName);
      targetName = list[(current + direction + list.length * 2) % list.length].name;
      yaw = list.find(op => op.name === targetName).yaw;
    },
    update(dt, active) {
      spectator.active = active;
      if (!active) return;
      let target = find();
      if (!target) {                                  // primeiro alvo (ou o anterior saiu): quem lidera a corrida
        const leader = race.order.map(entry => candidates().find(op => op.name === entry.name)).find(Boolean) ?? candidates()[0];
        if (!leader) { spectator.active = false; return; }
        target = leader;
        targetName = leader.name;
        yaw = leader.yaw;
      }
      yaw += Math.atan2(Math.sin(target.yaw - yaw), Math.cos(target.yaw - yaw)) * Math.min(1, dt * FOLLOW_SPEED);
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      camera.position.set(target.wx - fx * DISTANCE, target.wy + HEIGHT, target.wz - fz * DISTANCE);
      camera.lookAt(target.wx + fx * LOOK_AHEAD, target.wy + LOOK_HEIGHT, target.wz + fz * LOOK_AHEAD);
      camera.updateMatrixWorld();
    },
  };
  return spectator;
}
