import { CAR_MAX_HP } from '../config.js';
import { damagePlayer } from './car.js';
import { damageOpponent } from './opponents.js';

// Carros em chamas (flecha da besta incendiária ou fogo no chão). Enquanto `effects.burning` (segundos)
// durar, o carro perde vida em pulsos, e o abate conta para quem pôs fogo. Vale para qualquer piloto:
// quem é simulado em outro navegador queima lá (`onRemoteIgnite`). O extintor apaga o fogo.

export const BURN_DPS = 11;                          // dano por segundo, na escala de CAR_MAX_HP
const BURN_TICK = 0.5;                               // segundos entre os pulsos de dano

export function createBurning({ race, car, onDestroyed, onIgnite = () => {}, onRemoteIgnite = () => {} }) {
  const nextTick = new Map();                        // piloto → segundos até o próximo pulso

  const isOut = racer => (racer.isPlayer ? car.wrecked > 0 || car.invulnerable > 0 : racer.dead > 0 || racer.protectedFor > 0);

  // `attacker` é quem pôs fogo (um piloto de race.field) ou nulo.
  function ignite(racer, attacker, seconds) {
    if (!racer) return;
    if (racer.remote) { onRemoteIgnite(racer, seconds, attacker); return; }
    if (isOut(racer)) return;
    const wasBurning = racer.effects.burning > 0;
    racer.effects.burning = Math.max(racer.effects.burning, seconds);
    racer.burnBy = attacker && attacker !== racer ? attacker : null;
    if (!wasBurning) {
      nextTick.set(racer, BURN_TICK);
      onIgnite(racer, racer.burnBy);
    }
  }

  function hurt(racer, amount) {
    const attacker = racer.burnBy;
    if (racer.isPlayer) {
      const wasAlive = car.health > 0;
      damagePlayer(car, amount / CAR_MAX_HP);
      if (wasAlive && car.health <= 0) onDestroyed(racer, attacker, 'fire');
    } else if (damageOpponent(racer, amount, attacker)) {
      onDestroyed(racer, attacker, 'fire');
    }
  }

  function update(dt) {
    for (const racer of race.field) {
      if (racer.remote || racer.effects.burning <= 0) continue;
      if (isOut(racer)) { racer.effects.burning = 0; continue; }
      const wait = (nextTick.get(racer) ?? BURN_TICK) - dt;
      nextTick.set(racer, wait > 0 ? wait : wait + BURN_TICK);
      if (wait <= 0) hurt(racer, BURN_DPS * BURN_TICK);
    }
  }

  return { ignite, update };
}
