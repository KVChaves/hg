// Constantes do jogo. Ajustes de balanceamento e de resolução ficam aqui.

export const VIEW = { width: 640, height: 360, fov: 70 };
export const SKY_COLOR = 0x2a120c;

// Mesma velocidade máxima e aceleração para TODOS os carros. Só o nitro passa desse limite.
export const MAX_SPEED = 120 / 3.6;         // m/s
export const NITRO_MAX_SPEED = 160 / 3.6;   // m/s
export const ACCEL = 18;
export const SLIPSTREAM_KMH = 8;            // velocidade máxima extra no vácuo total
export const NITRO_ACCEL = 16;              // m/s² somados à aceleração
// Nitro azul (ajuda para o último colocado, ver roadsideHelp.js): enche o tanque e, por `time` segundos de nitro aberto, o tanque não gasta,
// a velocidade máxima do nitro sobe `top` vezes e a aceleração extra `accel` vezes.
export const BLUE_NITRO = { time: 6, top: 1.2, accel: 1.6 };
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
// Visão pela janela (olhar demais para a esquerda): a cabeça sai pela janela do motorista (deslocamento em metros a partir do olho, `head`)
// e pode virar até olhar para trás por cima do ombro esquerdo (yaw positivo é para a esquerda) e um pouco além, para pegar
// quem vem atrás pelo outro lado. `backYaw`: para onde a tecla de olhar para trás aponta.
export const WINDOW_VIEW = { head: { x: -0.92, y: 0.2, z: 0.15 }, minYaw: -0.45, maxYaw: 3.35, backYaw: 3.05, maxPitchUp: 0.45, maxPitchDown: 0.35 };
