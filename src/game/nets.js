import { createDrapedNet, createFlyingNet } from '../world/netVisual.js';
import { inAim } from './aim.js';
import { NET_CONE, NET_FLIGHT_MAX, NET_RANGE, NET_SPEED, NET_TIME } from './trapTypes.js';

// Lança-redes: a rede sai da frente do carro, persegue o carro mais bem alinhado à frente (até NET_RANGE) e, ao
// alcançá-lo, trava a direção dele por NET_TIME segundos (`effects.net`; quem lê é game/car.js e game/opponents.js).
// O efeito vale para quem simula o alvo: se ele é de outro navegador, o aviso da rede (`catchFromNetwork`) chega lá.
// Em todos os navegadores a rede fica visível por cima do carro preso. O pulso EMP não afeta a rede.
const NOSE_FORWARD = 2.3, LAUNCH_HEIGHT = 0.8, HIT_RADIUS = 1.8, TARGET_HEIGHT = 0.8;
const FLIGHT_SPIN = 7, FLIGHT_OPEN = 0.25;           // giro da rede em voo (rad/s) e segundos até abrir por inteiro
const DROP_TIME = 0.22, DROP_HEIGHT = 1.4;          // a rede cai do alto sobre o carro
const LIFT_TIME = 0.35;                              // no fim ela afrouxa e some, encolhendo

export function createNets({ scene, race, onSound, onCatch = () => {} }) {
  const flying = [], clinging = [];

  // `yaw`: para onde se mira. O jogador mira na linha de visada (`cone` nulo, ver aim.js); os bots, reto à frente, num cone.
  const aimed = (owner, racer, yaw, cone) => {
    const dx = racer.x - owner.x, dz = racer.z - owner.z, distance = Math.hypot(dx, dz) || 1;
    if (cone === null) return inAim(owner.x, owner.z, yaw, racer.x, racer.z, NET_RANGE) ? distance : null;   // mira do jogador: na linha de visada
    const forward = -Math.sin(yaw) * dx - Math.cos(yaw) * dz;
    return forward > 3 && distance <= NET_RANGE && forward / distance >= cone ? distance : null;
  };
  const catchable = racer => racer.dead <= 0 && racer.sunk <= 0 && racer.protectedFor <= 0 && racer.effects.net <= 0;

  // O carro mais perto dentro do cone da mira de quem lança.
  function findTarget(owner, yaw, cone) {
    let best = null, bestDistance = Infinity;
    for (const racer of race.field) {
      if (racer === owner || !catchable(racer)) continue;
      const distance = aimed(owner, racer, yaw, cone);
      if (distance !== null && distance < bestDistance) { best = racer; bestDistance = distance; }
    }
    return best;
  }

  function remove(list, index) {
    scene.remove(list[index].mesh);
    list.splice(index, 1);
  }

  // A rede cobre o carro: some quando o tempo acaba. Para o jogador não desenha nada (a câmera está dentro do carro).
  function cling(target) {
    const known = clinging.find(item => item.target === target);
    if (known) { known.time = NET_TIME; return; }   // rede nova por cima da antiga: só renova o tempo
    if (target.isPlayer) return;
    const mesh = createDrapedNet();
    mesh.rotation.order = 'YXZ';
    scene.add(mesh);
    clinging.push({ target, mesh, time: NET_TIME, age: 0 });
  }

  // Trava o alvo (só se ele é simulado aqui) e mostra a rede.
  function apply(target) {
    if (!target.remote) target.effects.net = NET_TIME;
    cling(target);
    onSound('mineStick', target.x, target.z);
  }

  const api = {
    // Quem a rede lançada agora travaria (a IA confere antes de gastar). Com `aimYaw` vale a mira do jogador.
    targetFor: (owner, aimYaw) => (aimYaw === undefined ? findTarget(owner, owner.yaw, NET_CONE) : findTarget(owner, aimYaw, null)),

    fire(owner, aimYaw) {
      const target = api.targetFor(owner, aimYaw);
      if (!target) return false;
      const mesh = createFlyingNet();
      scene.add(mesh);
      flying.push({ owner, target, mesh, age: 0, x: owner.wx - Math.sin(owner.yaw) * NOSE_FORWARD, y: owner.wy + LAUNCH_HEIGHT, z: owner.wz - Math.cos(owner.yaw) * NOSE_FORWARD });
      onSound('mineLaunch', owner.x, owner.z);
      return true;
    },

    // Outro navegador acertou a rede neste carro: se ele é nosso, trava; em todo caso, mostra a rede.
    catchFromNetwork: apply,

    reset() {
      for (let i = flying.length - 1; i >= 0; i--) remove(flying, i);
      for (let i = clinging.length - 1; i >= 0; i--) remove(clinging, i);
    },

    update(dt) {
      for (let i = flying.length - 1; i >= 0; i--) {
        const net = flying[i], { target, owner } = net;
        net.age += dt;
        if (net.age > NET_FLIGHT_MAX || target.dead > 0 || owner.dead > 0) { remove(flying, i); continue; }
        const dx = target.wx - net.x, dy = target.wy + TARGET_HEIGHT - net.y, dz = target.wz - net.z, distance = Math.hypot(dx, dy, dz) || 1;
        const step = (NET_SPEED + Math.max(0, owner.v)) * dt;
        if (distance <= step + HIT_RADIUS) {
          remove(flying, i);
          if (catchable(target)) { apply(target); onCatch(target, owner); }
          continue;
        }
        net.x += dx / distance * step;
        net.y += dy / distance * step;
        net.z += dz / distance * step;
        net.mesh.position.set(net.x, net.y, net.z);
        net.mesh.lookAt(target.wx, target.wy + TARGET_HEIGHT, target.wz);
        net.mesh.rotateZ(net.age * FLIGHT_SPIN);
        net.mesh.scale.setScalar(0.35 + 0.65 * Math.min(1, net.age / FLIGHT_OPEN));   // sai embolada e abre em pleno voo
      }
      for (let i = clinging.length - 1; i >= 0; i--) {
        const item = clinging[i], { target } = item;
        item.time -= dt;
        item.age += dt;
        if (item.time <= 0 || target.dead > 0) { remove(clinging, i); continue; }
        const drop = Math.max(0, 1 - item.age / DROP_TIME), lift = Math.min(1, item.time / LIFT_TIME);
        item.mesh.position.set(target.wx, target.wy + drop * drop * DROP_HEIGHT, target.wz);
        item.mesh.rotation.set(0, target.yaw, target.twist ?? 0);
        item.mesh.scale.set(1, lift, 1);
      }
    },
  };
  return api;
}
