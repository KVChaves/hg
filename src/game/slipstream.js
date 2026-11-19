import { wrapDistance } from '../world/track.js';

// Vácuo: atrás de outro carro, na mesma faixa, o ar pesa menos e a velocidade máxima sobe. Vale para qualquer piloto.
// As peças mexem nele pelos dois lados (game/carUpgrades.js): `draftRange` de quem vem atrás aumenta o alcance;
// `wake` de quem vai na frente diminui (ou aumenta) o que o de trás aproveita. Quem não tem peças conta como 1.

const RANGE = 25, FULL_WITHIN = 12, LANE_WIDTH = 2.6, MIN_LEADER_SPEED = 10;   // metros e m/s

// De 0 (sem vácuo) a 1 (colado atrás de um carro em movimento); passa de 1 só com uma peça de vácuo forte na frente.
export function slipstreamStrength(racer, field) {
  if (racer.dead > 0) return 0;
  const reach = racer.draftRange ?? 1, range = RANGE * reach, fullWithin = FULL_WITHIN * reach;
  let strongest = 0;
  for (const other of field) {
    if (other === racer || other.dead > 0 || other.v < MIN_LEADER_SPEED) continue;
    const ahead = wrapDistance(other.dist - racer.dist), side = Math.abs(other.lane - racer.lane);
    if (ahead <= 0 || ahead >= range || side >= LANE_WIDTH) continue;
    const distance = Math.min(1, (range - ahead) / (range - fullWithin));
    strongest = Math.max(strongest, distance * (1 - (side / LANE_WIDTH) ** 2) * (other.wake ?? 1));
  }
  return strongest;
}
