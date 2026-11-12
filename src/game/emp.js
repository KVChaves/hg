import { cutInvolving } from './tether.js';
import { EMP_RADIUS, EMP_TIME } from './trapTypes.js';

// Pulso EMP: quem está a EMP_RADIUS metros de quem pulsa fica sem nitro e sem atirar por EMP_TIME segundos
// (game/car.js, game/opponents.js, game/weapon.js e opponentCombat.js leem `effects.emp`). Também desarma as minas
// grudadas em quem pulsou. Cada navegador aplica o efeito nos carros que simula; `pulse` avisa os outros.
export function createEmp({ race, mines, visuals, onSound, onPulse = () => {} }) {
  function apply(owner) {
    for (const racer of race.field) {
      if (racer === owner || racer.remote || racer.dead > 0) continue;
      if (Math.hypot(racer.x - owner.x, racer.z - owner.z) <= EMP_RADIUS) racer.effects.emp = EMP_TIME;
    }
    cutInvolving(owner, 'emp');
    const defused = mines.defuse(owner);
    visuals.pulse(owner.wx, owner.wy + 0.6, owner.wz);
    onSound('emp', owner.x, owner.z);
    return defused;
  }

  return {
    // Devolve quantas minas foram desarmadas.
    pulse(owner) {
      const defused = apply(owner);
      onPulse(owner);
      return defused;
    },
    receive: apply,
  };
}
