// Efeitos de armadilha em um carro: segundos restantes de cada um. `burning` é o carro em chamas (game/burning.js).

export const createEffects = () => ({ puncture: 0, oil: 0, paint: 0, smoke: 0, burning: 0 });


export function tickEffects(effects, dt) {
  for (const name in effects) effects[name] = Math.max(0, effects[name] - dt);
}
