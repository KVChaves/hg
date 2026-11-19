// Sequência do carro destruído: quica, rola perdendo força, para de lado, tomba sobre as rodas e assenta.
// A regra é a mesma para qualquer piloto; a pose só depende do tempo decorrido.

export const RESPAWN_PROTECTION = 2.5;              // segundos sem levar dano depois de voltar

const LIFE_LOST_PER_DESTRUCTION = 0.165, MIN_LIFE = 0.5;

// Meia altura e meia largura do carro: a altura do centro depende de qual lado encosta no chão.
const HALF_HEIGHT = 0.71, HALF_WIDTH = 0.97;
const ROLL_EASING = 2.2;                            // perde giro ao rolar e ganha ao tombar

// duration: segundos até voltar a correr; rollingEnd: chega deitado de lado; landedAt: as rodas tocam o chão.
// bounces: início, fim e altura de cada quicada.
const WRECK = { duration: 5, rollingEnd: 3.4, landedAt: 4.25, turns: 3, bounces: [[0, 1.25, 2.6], [1.25, 2.2, 1.1], [2.2, 2.9, 0.35]] };

// Depois de tocar o chão a suspensão balança e para.
const SETTLE_LIFT = 0.22, SETTLE_ROLL = 0.18, SETTLE_DECAY = 5, SETTLE_LIFT_RATE = 9, SETTLE_ROLL_RATE = 11;

// Fração da vida total com que o carro volta depois de ser destruído `times` vezes.
// `wreck` (game/carUpgrades.js) multiplica o que cada destruição tira da vida máxima; o piso não muda.
export const lifeAfterDestruction = (times, wreck = 1) => Math.max(MIN_LIFE, 1 - times * LIFE_LOST_PER_DESTRUCTION * wreck);

// `direction` 1 tomba para a esquerda; `startRoll` é a inclinação que o carro já tinha.
export function createFlip({ direction = 1, startRoll = 0 } = {}) {
  return { direction, startRoll, finalRoll: WRECK.turns * Math.PI * 2, ...WRECK };
}

const elapsedIn = (flip, timer) => flip.duration - timer;
export const flipLandingTime = (flip, timer) => flip.landedAt - elapsedIn(flip, timer);

// Oscilação que morre até zerar exatamente no fim da animação.
function settle(flip, elapsed, size, rate) {
  const s = elapsed - flip.landedAt, span = flip.duration - flip.landedAt;
  return size * Math.exp(-SETTLE_DECAY * s) * Math.sin(rate * s) * (1 - s / span);
}

function rollAt(flip, elapsed) {
  const onSide = flip.finalRoll - Math.PI / 2;
  if (elapsed < flip.rollingEnd) {
    return flip.startRoll + (onSide - flip.startRoll) * (1 - (1 - elapsed / flip.rollingEnd) ** ROLL_EASING);
  }
  if (elapsed < flip.landedAt) {
    const falling = (elapsed - flip.rollingEnd) / (flip.landedAt - flip.rollingEnd);
    return onSide + (flip.finalRoll - onSide) * falling ** ROLL_EASING;
  }
  return flip.finalRoll + settle(flip, elapsed, SETTLE_ROLL, SETTLE_ROLL_RATE);
}

function liftAt(flip, elapsed) {
  const bounce = flip.bounces.find(([start, end]) => elapsed >= start && elapsed < end);
  if (bounce) {
    const [start, end, height] = bounce, t = (elapsed - start) / (end - start);
    return height * 4 * t * (1 - t);
  }
  return elapsed < flip.landedAt ? 0 : Math.abs(settle(flip, elapsed, SETTLE_LIFT, SETTLE_LIFT_RATE));
}

// Altura do centro do carro acima do chão: depende de qual lado encosta e de quanto ele quicou.
function centerHeight(roll, lift) {
  return lift + HALF_HEIGHT * Math.abs(Math.cos(roll)) + HALF_WIDTH * Math.abs(Math.sin(roll));
}

// Quanto o meio do carro está acima da posição normal; zero quando ele não está capotando.
export function flipElevation(flip, timer) {
  const elapsed = elapsedIn(flip, timer);
  return centerHeight(rollAt(flip, elapsed), liftAt(flip, elapsed)) - HALF_HEIGHT;
}

// Inclina um objeto já posicionado no chão, girando em volta do meio do carro.
function poseRolled(object, roll, lift) {
  const yaw = object.rotation.y, side = HALF_HEIGHT * Math.sin(roll);
  object.position.x += Math.cos(yaw) * side;
  object.position.z -= Math.sin(yaw) * side;
  object.position.y += centerHeight(roll, lift) - HALF_HEIGHT * Math.cos(roll);
  object.rotation.z += roll;
}

export function poseFlippingCar(object, flip, timer) {
  const elapsed = elapsedIn(flip, timer);
  poseRolled(object, rollAt(flip, elapsed) * flip.direction, liftAt(flip, elapsed));
}
