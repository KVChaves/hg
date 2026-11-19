// O piso de cada bioma muda como o carro se comporta. `surface` do bioma sobrescreve só o que quiser:
//   grip    — curva mais ou menos fechada (multiplica o limite de giro);
//   side    — o quanto a lateral do carro "segura" (menor = derrapa mais);
//   drag    — arrasto extra por segundo, em qualquer lugar da pista (areia solta, lama);
//   top     — velocidade máxima;
//   accel   — aceleração;
//   offroad — o quanto sair da pista freia a mais.
// `wet` (de 0 a 1, menor = mais escorregadio) vem do clima do trecho: chuva, nevasca, areia no ar.
// `rain` (de 0 a 1, menor = mais escorregadio) vem do clima dinâmico da corrida (game/dynamicWeather.js) e vale para todos os carros.
export const surface = { grip: 1, side: 1, drag: 0, top: 1, accel: 1, offroad: 1, wet: 1, rain: 1 };
const NEUTRAL = { grip: 1, side: 1, drag: 0, top: 1, accel: 1, offroad: 1 };

export function setSurface(spec = {}) {
  Object.assign(surface, NEUTRAL, spec, { wet: 1, rain: 1 });
}

// Clima dinâmico: `level` de 0 a 1 e `grip` a aderência de toda a pista no auge dele.
export function setRainGrip(level, grip = 1) {
  surface.rain = 1 - level * (1 - grip);
}

// Trecho de clima pesado: `level` é o quanto o carro está dentro dele (0 a 1) e `grip` a aderência no meio dele.
export function setWeatherGrip(level, grip = 1) {
  surface.wet = 1 - level * (1 - grip);
}
