import { wrapDistance } from '../world/track.js';

// Vácuo: atrás de outro carro, na mesma faixa, o ar pesa menos e a velocidade máxima sobe. Vale para qualquer piloto.

const RANGE = 25, FULL_WITHIN = 12, LANE_WIDTH = 2.6, MIN_LEADER_SPEED = 10;   // metros e m/s

// De 0 (sem vácuo) a 1 (colado atrás de um carro em movimento).
export function slipstreamStrength(racer, field) {
  if (racer.dead > 0) return 0;
  let strongest = 0;
  for (const other of field) {
    if (other === racer || other.dead > 0 || other.v < MIN_LEADER_SPEED) continue;
    const ahead = wrapDistance(other.dist - racer.dist), side = Math.abs(other.lane - racer.lane);
    if (ahead <= 0 || ahead >= RANGE || side >= LANE_WIDTH) continue;
    const distance = Math.min(1, (RANGE - ahead) / (RANGE - FULL_WITHIN));
    strongest = Math.max(strongest, distance * (1 - (side / LANE_WIDTH) ** 2));
  }
  return strongest;
}
