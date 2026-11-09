// Mistura das quatro gravações do motor: cada uma tem um giro em que soa na altura natural.

export const ENGINE_LAYERS = ['engineIdle', 'engineLow', 'engineMid', 'engineHigh'];
const LAYER_RPM = [0, 0.3, 0.6, 0.9];
const SPACING = 0.3, STOPPED_KMH = 3, PITCH_BEND = 0.9, MIN_RATE = 0.7, MAX_RATE = 1.4;

// Giro efetivo: parado, o motor fica em marcha lenta mesmo em 1ª.
export function effectiveRpm(rpm, kmh) {
  return kmh < STOPPED_KMH ? rpm * (kmh / STOPPED_KMH) : rpm;
}

// Volume de cada camada (crossfade de potência constante) e velocidade de reprodução.
export function engineMix(rpm) {
  const position = Math.max(0, Math.min(LAYER_RPM.length - 1, rpm / SPACING));
  const lower = Math.min(Math.floor(position), LAYER_RPM.length - 2);
  const blend = position - lower;

  return LAYER_RPM.map((anchor, i) => ({
    gain: i === lower ? Math.cos(blend * Math.PI / 2) : i === lower + 1 ? Math.sin(blend * Math.PI / 2) : 0,
    rate: Math.max(MIN_RATE, Math.min(MAX_RATE, 1 + (rpm - anchor) * PITCH_BEND)),
  }));
}
