// Formatos de carroceria. Só mudam o visual: comprimento e largura são os mesmos em todos, então a
// colisão e o desempenho não mudam. As alturas ficam abaixo do topo coberto pela textura (1,5 m).

const STATION_Z = [-2.2, -2.0, -1.2, -0.75, 1.2, 1.9, 2.2];
const FLOOR = [0.34, 0.26, 0.22, 0.22, 0.22, 0.26, 0.38];
const FLOOR_WIDTH = [0.8, 0.92, 0.95, 0.95, 0.95, 0.93, 0.84];
const BELT_WIDTH = [0.74, 0.86, 0.9, 0.91, 0.91, 0.88, 0.8];

// `belts` é a altura da linha de cintura em cada estação; `front` e `rear` são a base da cabine e
// `roofFront`/`roofRear` o teto, com z, altura (y, nos dois do teto) e meia-largura.
const SHAPES = {
  coupe: { belts: [0.64, 0.76, 0.9, 0.98, 0.98, 1.02, 0.98], front: { z: -0.75, width: 0.88 }, roofFront: { z: -0.05, y: 1.42, width: 0.66 }, roofRear: { z: 0.85, y: 1.42, width: 0.66 }, rear: { z: 1.65, width: 0.84 } },
  muscle: { belts: [0.7, 0.86, 1.0, 1.03, 1.02, 1.06, 1.02], front: { z: -0.3, width: 0.86 }, roofFront: { z: 0.2, y: 1.42, width: 0.64 }, roofRear: { z: 0.85, y: 1.42, width: 0.64 }, rear: { z: 1.85, width: 0.82 } },
  wedge: { belts: [0.5, 0.62, 0.8, 0.92, 1.0, 1.06, 1.04], front: { z: -0.95, width: 0.88 }, roofFront: { z: -0.25, y: 1.3, width: 0.66 }, roofRear: { z: 0.7, y: 1.3, width: 0.66 }, rear: { z: 1.6, width: 0.84 } },
  hatch: { belts: [0.66, 0.78, 0.92, 1.0, 1.0, 1.02, 1.0], front: { z: -0.85, width: 0.88 }, roofFront: { z: -0.15, y: 1.45, width: 0.7 }, roofRear: { z: 1.55, y: 1.45, width: 0.7 }, rear: { z: 2.12, width: 0.82 } },
  wagon: { belts: [0.64, 0.76, 0.9, 0.98, 0.98, 1.0, 1.0], front: { z: -0.85, width: 0.88 }, roofFront: { z: -0.15, y: 1.46, width: 0.7 }, roofRear: { z: 1.95, y: 1.44, width: 0.7 }, rear: { z: 2.18, width: 0.8 } },
};

function buildShape({ belts, front, roofFront, roofRear, rear }) {
  const stations = STATION_Z.map((z, i) => ({ z, floor: FLOOR[i], belt: belts[i], floorWidth: FLOOR_WIDTH[i], beltWidth: BELT_WIDTH[i] }));

  const beltAt = z => {
    const next = stations.findIndex(station => station.z >= z);
    if (next <= 0) return stations[Math.max(next, 0)].belt;
    const a = stations[next - 1], b = stations[next];
    return a.belt + (b.belt - a.belt) * (z - a.z) / (b.z - a.z);
  };

  return {
    stations,
    beltAt,
    greenhouse: { front: { ...front, y: beltAt(front.z) }, roofFront, roofRear, rear: { ...rear, y: beltAt(rear.z) } },
  };
}

export const CAR_SHAPES = Object.fromEntries(Object.entries(SHAPES).map(([id, data]) => [id, buildShape(data)]));
