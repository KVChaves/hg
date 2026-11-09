import * as THREE from 'three';
import { VIEW } from '../config.js';
import { poseFlippingCar } from '../game/carFlip.js';
import { alignToTwist } from './track.js';
import { poseRig } from '../game/carRoll.js';
import { createCarModel } from './car/carModel.js';

// Câmera externa (enquanto Q estiver pressionada): mostra o carro do jogador por trás, com um leve atraso.

const DISTANCE = 7.5, HEIGHT = 2.8, LOOK_AHEAD = 3, LOOK_HEIGHT = 1;
const FOLLOW_SPEED = 6, FRONT_WHEEL_TURN = 0.45, ROLL_VISUAL = 1.6;

export function createExternalView({ scene, car, look, initialSpec, seed }) {
  const camera = new THREE.PerspectiveCamera(VIEW.fov, VIEW.width / VIEW.height, 0.1, 400);
  const model = createCarModel(initialSpec, seed);
  model.group.rotation.order = 'YXZ';
  model.group.visible = false;
  scene.add(model.group);

  let cameraYaw = 0;

  const view = {
    camera,
    active: false,
    setActive(active) {
      if (active === view.active) return;
      view.active = active;
      model.group.visible = active;
      cameraYaw = car.yaw;
    },
    applySpec: spec => model.apply(spec),
    update(dt) {
      model.roll(car.speed * dt);
      if (!view.active) return;

      model.group.position.set(car.wx, car.wy, car.wz);
      model.group.rotation.set(car.pitch, car.yaw, car.roll * ROLL_VISUAL + car.twist);
      if (car.wrecked > 0) poseFlippingCar(model.group, car.flip, car.wrecked);
      else if (car.rig.active) poseRig(model.group, car.rig);
      alignToTwist(model.group, car);
      model.steer(car.visualSteer * FRONT_WHEEL_TURN);
      model.setNitro(car.nitroActive);

      cameraYaw += (car.yaw - cameraYaw) * Math.min(1, dt * FOLLOW_SPEED);
      const angle = (car.twist ? car.twistHeading : cameraYaw) + look.yaw;   // no tubo a câmera segue a pista, não o giro do carro
      let fx = -Math.sin(angle), fy = 0, fz = -Math.cos(angle);
      // No tubo o "para cima" do carro gira junto com a estrada.
      const sideUp = -Math.sin(car.twist), rightX = Math.cos(car.yaw), rightZ = -Math.sin(car.yaw), upY = Math.cos(car.twist);
      if (car.twist) {                                // e a câmera segue o rumo da hélice, não o eixo do tubo
        const skew = Math.tan(car.twistYaw);
        fx += rightX * upY * skew;
        fy = Math.sin(car.twist) * skew;
        fz += rightZ * upY * skew;
        const size = Math.hypot(fx, fy, fz);
        fx /= size; fy /= size; fz /= size;
      }
      camera.up.set(rightX * sideUp, upY, rightZ * sideUp);
      camera.position.set(car.wx - fx * DISTANCE + rightX * sideUp * HEIGHT, car.wy - fy * DISTANCE + upY * HEIGHT, car.wz - fz * DISTANCE + rightZ * sideUp * HEIGHT);
      camera.lookAt(car.wx + fx * LOOK_AHEAD + rightX * sideUp * LOOK_HEIGHT, car.wy + fy * LOOK_AHEAD + upY * LOOK_HEIGHT, car.wz + fz * LOOK_AHEAD + rightZ * sideUp * LOOK_HEIGHT);
      camera.updateMatrixWorld();
    },
  };
  return view;
}
