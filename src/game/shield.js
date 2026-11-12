import { SHIELD_ABSORB, SHIELD_TIME } from './trapTypes.js';

// Escudo temporário: enquanto `effects.shield` (segundos) dura, absorve dano até esgotar a reserva.
// A reserva fica numa tabela presa ao objeto `effects`, que o carro do jogador e o `racer` dele compartilham.
// `unit`: a vida total na escala do dano que esse piloto recebe (1 para o jogador, maxHp para os bots).
const pools = new WeakMap();

export function raiseShield(racer, unit) {
  racer.effects.shield = SHIELD_TIME;
  pools.set(racer.effects, SHIELD_ABSORB * unit);
}

// Devolve o dano que sobrou depois do escudo.
export function absorbShield(racer, amount) {
  const left = pools.get(racer.effects) ?? 0;
  if (racer.effects.shield <= 0 || left <= 0) return amount;
  const taken = Math.min(amount, left);
  pools.set(racer.effects, left - taken);
  if (left - taken <= 0) racer.effects.shield = 0;
  return amount - taken;
}

// Quanto do escudo resta, de 0 a 1 (para o HUD).
export const shieldLevel = (racer, unit) => (racer.effects.shield > 0 ? Math.min(1, (pools.get(racer.effects) ?? 0) / (SHIELD_ABSORB * unit)) : 0);
