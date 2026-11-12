// Constantes do jogo. Ajustes de balanceamento e de resolução ficam aqui.

export const VIEW = { width: 640, height: 360, fov: 70 };
export const SKY_COLOR = 0x2a120c;

// Mesma velocidade máxima e aceleração para TODOS os carros. Só o nitro passa desse limite.
export const MAX_SPEED = 120 / 3.6;         // m/s
export const NITRO_MAX_SPEED = 160 / 3.6;   // m/s
export const ACCEL = 18;
export const SLIPSTREAM_KMH = 8;            // velocidade máxima extra no vácuo total
export const NITRO_ACCEL = 16;              // m/s² somados à aceleração
export const NITRO_DRAIN = 0.25;            // fração do tanque por segundo
export const WHEELBASE = 2.6;

export const TRACK_WIDTH = 18;                      // uns 5 carros lado a lado; o original tem pista bem larga
export const LAPS = 3;
export const MAX_RACERS = 8;                         // a partida pode ter de 2 até este número de carros

// Posição do olho do piloto em relação ao centro do carro.
export const EYE = { x: -0.38, y: 1.12, z: 0.1 };

// Até onde a cabeça gira. Os limites escondem a parte vazia do carro (bancos, piso e traseira).
export const CAR_MAX_HP = 250;                       // vida inicial de qualquer carro
export const LOOK = { maxYaw: 1.3, maxPitchUp: 0.16, maxPitchDown: 0.1 };
