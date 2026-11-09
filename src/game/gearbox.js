// Câmbio automático: deriva marcha e giro a partir da velocidade.

const UPPER_KMH = [30, 55, 80, 100, 130];
export const GEAR_LABELS = ['R', '1', '2', '3', '4', '5'];

// Posição na grade em H: [coluna 0-2, linha 0=cima 1=meio 2=baixo]
const GATE = { N: [1, 1], 1: [0, 0], 2: [0, 2], 3: [1, 0], 4: [1, 2], 5: [2, 0], R: [2, 2] };

export function readGearbox(car, throttleHeld) {
  const kmh = Math.abs(car.speed) * 3.6;
  const reversing = car.speed < -0.5;
  const parked = car.speed < 0.3 && !reversing && !throttleHeld;

  let index = 0;
  if (!reversing) {
    index = UPPER_KMH.findIndex(limit => kmh < limit) + 1 || 5;
  }
  const low = index > 1 ? UPPER_KMH[index - 2] : 0;
  const high = UPPER_KMH[Math.max(index - 1, 0)];
  const rpm = reversing
    ? Math.min(kmh / 40, 1)
    : Math.min(Math.max((kmh - low) / (high - low), 0) * 0.75 + 0.15, 1);

  return { kmh, index, label: GEAR_LABELS[index], rpm, gate: parked ? GATE.N : GATE[GEAR_LABELS[index]] };
}
