// Física de capotagem: o carro visto de trás é um corpo rígido sob gravidade, com pontos que encostam no
// chão (rodas, laterais e teto). Nada aqui decide "capotou": uma pancada só muda a velocidade do corpo.
// Coordenadas relativas ao centro de massa: x para a direita, y para cima; ângulo positivo tomba para a esquerda.

const REST_HEIGHT = 0.6;                             // altura do centro de massa com o carro parado
const INERTIA = 0.48;                                // em relação à massa (caixa de 1,94 x 1,42 m)
const GRAVITY = 9.8;

const CONTACT_POINTS = [
  [-0.86, -REST_HEIGHT], [0.86, -REST_HEIGHT],       // rodas
  [-0.97, 0], [0.97, 0],                             // laterais
  [-0.72, 0.82], [0.72, 0.82],                       // teto
];
const WHEEL_POINTS = 2;
const GROUND_STIFFNESS = 5000, GROUND_DAMPING = 100; // mola do contato com o chão, por unidade de massa
const TIRE_FRICTION = 0.9, BODY_FRICTION = 1.3, FRICTION_RESPONSE = 12;
const SCRAPE_DRAG = 1.4;                             // lataria no asfalto: a capotagem perde energia
const SUBSTEP = 1 / 300;

const IMPACT_HEIGHT = -0.1;                          // os para-choques batem um pouco abaixo do centro de massa
const MIN_SPIN_TO_WAKE = 0.05;

const UPRIGHT_LEAN = 0.1, OVERTURNED_LEAN = 0.7, AIRBORNE_HEIGHT = 0.9;
const AT_REST_SPEED = 0.3, SETTLE_TIME = 0.15;

// Um carro imóvel fora das rodas não sai dali sozinho: depois de um tempo recebe um empurrão para desvirar.
const STUCK_TIME = 0.8, ON_ROOF_LEAN = 2.2;
const SIDE_PUSH = { rate: 3.5, lift: 1.2 }, ROOF_PUSH = { rate: 4.5, lift: 2.8 };

const wrapAngle = angle => Math.atan2(Math.sin(angle), Math.cos(angle));

export const createRig = () => ({ active: false, angle: 0, rate: 0, y: REST_HEIGHT, vy: 0, restFor: 0 });

export function resetRig(rig) {
  Object.assign(rig, createRig());
}

export const rigLean = rig => wrapAngle(rig.angle);
export const rigElevation = rig => (rig.active ? rig.y - REST_HEIGHT : 0);
export const isOverturned = rig => rig.active && (Math.abs(rigLean(rig)) > OVERTURNED_LEAN || rigElevation(rig) > AIRBORNE_HEIGHT);

// Pancada em `contactX` (distância do centro, direita positiva): `sideChange` é a mudança de velocidade
// lateral e `lift` a força para cima, quando a pancada calça uma roda e levanta aquele lado.
export function applyHit(rig, { contactX, sideChange, lift }) {
  const spin = (contactX * lift - IMPACT_HEIGHT * sideChange) / INERTIA;
  if (!rig.active && Math.abs(spin) < MIN_SPIN_TO_WAKE && lift === 0) return;
  rig.active = true;
  rig.rate += spin;
  rig.vy += lift;
}

function integrate(rig, lateralSpeed, dt) {
  const c = Math.cos(rig.angle), s = Math.sin(rig.angle);
  let forceX = 0, forceY = -GRAVITY, torque = 0;

  let scraping = false;
  for (const [index, [px, py]] of CONTACT_POINTS.entries()) {
    const rx = px * c - py * s, ry = px * s + py * c;
    const depth = -(rig.y + ry);
    if (depth <= 0) continue;
    const speedX = lateralSpeed - rig.rate * ry, speedY = rig.vy + rig.rate * rx;
    const normal = Math.max(0, GROUND_STIFFNESS * depth - GROUND_DAMPING * speedY);
    const isWheel = index < WHEEL_POINTS;
    scraping = scraping || !isWheel;
    const limit = (isWheel ? TIRE_FRICTION : BODY_FRICTION) * normal;
    const friction = Math.max(-limit, Math.min(limit, -speedX * FRICTION_RESPONSE));
    forceX += friction;
    forceY += normal;
    torque += rx * normal - ry * friction;
  }

  rig.vy += forceY * dt;
  rig.rate += torque / INERTIA * dt;
  if (scraping) rig.rate *= Math.exp(-SCRAPE_DRAG * dt);
  rig.y += rig.vy * dt;
  rig.angle += rig.rate * dt;
  return lateralSpeed + forceX * dt;
}

function pushBackUp(rig, lean) {
  const push = Math.abs(lean) > ON_ROOF_LEAN ? ROOF_PUSH : SIDE_PUSH;
  rig.rate = -Math.sign(lean) * push.rate;
  rig.vy = push.lift;
}

function checkRest(rig, dt) {
  if (Math.abs(rig.rate) > AT_REST_SPEED || Math.abs(rig.vy) > AT_REST_SPEED) {
    rig.restFor = 0;
    return;
  }
  rig.restFor += dt;
  const lean = rigLean(rig);
  if (Math.abs(lean) < UPRIGHT_LEAN) {
    if (rig.restFor > SETTLE_TIME) resetRig(rig);
  } else if (rig.restFor > STUCK_TIME) {
    pushBackUp(rig, lean);
    rig.restFor = 0;
  }
}

// Avança a física e devolve a nova velocidade lateral do carro.
export function stepRig(rig, lateralSpeed, dt) {
  const steps = Math.max(1, Math.round(dt / SUBSTEP)), h = dt / steps;
  let speed = lateralSpeed;
  for (let i = 0; i < steps; i++) speed = integrate(rig, speed, h);
  checkRest(rig, dt);
  return speed;
}

// Coloca um objeto já posicionado no chão na pose do corpo, girando em volta do centro de massa.
export function poseRig(object, rig) {
  const yaw = object.rotation.y, side = REST_HEIGHT * Math.sin(rig.angle);
  object.position.x += Math.cos(yaw) * side;
  object.position.z -= Math.sin(yaw) * side;
  object.position.y += rig.y - REST_HEIGHT * Math.cos(rig.angle);
  object.rotation.z += rig.angle;
}
