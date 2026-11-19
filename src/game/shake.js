// Balanço de um carro atingido por escopeta: um tranco de giro, um empurrão para o lado e a carroceria inclinando.
// `power` vem de shakeAtDistance (game/weaponTypes.js); vale para o jogador e para os bots.

const SPIN = 0.9, PUSH = 2.8, ROLL = 0.07, MAX_SPIN = 3;
const randomSide = () => (Math.random() < 0.5 ? -1 : 1);

export function shakeCar(car, power, side = randomSide()) {
  car.spin = Math.max(-MAX_SPIN, Math.min(MAX_SPIN, car.spin + side * power * SPIN));
  car.vx += Math.cos(car.yaw) * side * power * PUSH;
  car.vz += -Math.sin(car.yaw) * side * power * PUSH;
  car.roll += side * power * ROLL;
}

export function shakeOpponent(op, power, side = randomSide()) {
  if (op.remote || op.dead > 0) return;
  op.spin = Math.max(-MAX_SPIN, Math.min(MAX_SPIN, op.spin + side * power * SPIN));
  op.knock += side * power * PUSH * 1.5;
}
