import { poseFlippingCar } from '../game/carFlip.js';
import { alignToTwist } from './track.js';
import { poseRig } from '../game/carRoll.js';
import { createCarModel } from './car/carModel.js';
import { cloakLevel } from '../game/cloak.js';

// Visão pela janela (ao virar demais para a esquerda): o piloto põe a cabeça para fora da janela dele e pode olhar
// para trás e atirar em quem vem atrás. A câmera continua sendo a da cabine, só que com a cabeça deslocada para
// fora (cabin.setWindowView) e sem desenhar o interior; daqui mostramos o próprio carro, que agora fica à vista.

const FRONT_WHEEL_TURN = 0.45, ROLL_VISUAL = 1.6;

export function createWindowView({ scene, car, initialSpec, seed }) {
  const model = createCarModel(initialSpec, seed);
  model.group.rotation.order = 'YXZ';
  model.group.visible = false;
  scene.add(model.group);

  const view = {
    active: false,
    setActive(active) {
      if (active === view.active) return;
      view.active = active;
      model.group.visible = active;
    },
    applySpec: spec => model.apply(spec),
    setLights: on => model.setLights(on),
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
      model.setCloak(cloakLevel({ effects: car.effects, dead: car.wrecked }));   // camuflado, o piloto vê o próprio carro sumir
    },
  };
  return view;
}
