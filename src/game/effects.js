// Efeitos de armadilha em um carro: segundos restantes de cada um. `shock`: o mesmo bloqueio de `emp`, mas vindo do raio (só muda o texto do aviso). `net`: direção travada pela rede (game/nets.js). `burning` é o carro em chamas (game/burning.js).

export const createEffects = () => ({ puncture: 0, oil: 0, paint: 0, smoke: 0, burning: 0, shield: 0, emp: 0, net: 0, shock: 0 });


export function tickEffects(effects, dt) {
  for (const name in effects) effects[name] = Math.max(0, effects[name] - dt);
}

// O bloqueio de nitro, tiro e itens vem do raio (e não de um pulso EMP): o aviso fala só das restrições.
export const shockedByLightning = effects => effects.shock > 0 && effects.emp <= effects.shock + 0.05;
