import { CLOAK_FADE, CLOAK_REVEAL, CLOAK_TIME } from './trapTypes.js';

// Camuflagem: `effects.cloak` conta o tempo total (some em CLOAK_FADE s, fica invisível CLOAK_TIME s e reaparece em
// CLOAK_REVEAL s). Só a lataria some (world/car/carModel.js `setCloak`): fogo, tinta, rede, escudo, mina grudada e o
// som continuam. Enquanto está escondido, ninguém o escolhe como alvo: os bots não atiram nele e os itens que
// perseguem (mina, rede, arpão) não travam nele. Bala e batida ainda acertam quem passa no caminho.
export const CLOAK_TOTAL = CLOAK_FADE + CLOAK_TIME + CLOAK_REVEAL;
const HIDDEN_FROM = 0.6;                             // a partir de quanto sumido o carro deixa de ser alvo

export function raiseCloak(racer) {
  racer.effects.cloak = CLOAK_TOTAL;
}

// Quanto do carro já sumiu, de 0 (visível) a 1 (todo escondido), da frente para trás.
export function cloakLevel(racer) {
  const left = racer.effects?.cloak ?? 0;
  if (left <= 0 || racer.dead > 0) return 0;
  return Math.min(1, (CLOAK_TOTAL - left) / CLOAK_FADE, left / CLOAK_REVEAL);
}

export const isHidden = racer => cloakLevel(racer) >= HIDDEN_FROM;

// Segundos de invisibilidade que ainda faltam (o HUD conta só os CLOAK_TIME s, depois de sumir).
export const cloakSecondsLeft = racer => Math.max(0, Math.min(CLOAK_TIME, (racer.effects?.cloak ?? 0) - CLOAK_REVEAL));
