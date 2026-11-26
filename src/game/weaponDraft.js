import { WEAPON_TYPES } from './weaponTypes.js';

// Sorteio de armas do multiplayer, antes da garagem de cada corrida. A mesa tem uma arma por jogador humano; cada um
// aponta para a que quer. Quem aponta sozinho leva; quando dois ou mais querem a mesma, decidem num mata-mata de
// pedra, papel e tesoura. Ninguém recebe arma sem escolher: quem perde aponta de novo, numa nova rodada, entre as que sobraram.
// As armas giram em ciclo: uma corrida só mostra armas que ainda não apareceram no ciclo, e quando todas já
// apareceram o ciclo recomeça. Quem decide tudo é o admin (net/onlineMatch.js); aqui é só a conta.

export const THROWS = ['rock', 'paper', 'scissors'];
export const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
const MAX_ROUNDS = 3;                                // numa fase do mata-mata, a última rodada sai sempre sem empate

// Tempos da revelação, iguais em todos os navegadores para todos chegarem juntos à garagem.
export const DRAFT_TIMING = { intro: 1, stageIntro: 0.8, shake: 0.8, reveal: 0.8, stageEnd: 0.7, final: 3 };
export const roundTime = () => DRAFT_TIMING.shake + DRAFT_TIMING.reveal;
export const stageTime = stage => DRAFT_TIMING.stageIntro + stage.rounds.length * roundTime() + DRAFT_TIMING.stageEnd;
export const duelTime = duel => duel.stages.reduce((sum, stage) => sum + stageTime(stage), 0);
export const draftResultTime = duels => DRAFT_TIMING.intro + duels.reduce((sum, duel) => sum + duelTime(duel), 0) + DRAFT_TIMING.final;

function shuffle(list, random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// `seen`: armas já mostradas no ciclo atual; `last`: a mesa da corrida anterior. Devolve a mesa nova e o ciclo depois dela.
// Se faltar arma nova para completar a mesa, o ciclo fecha e recomeça; o que completa a mesa evita a mesa anterior.
export function drawOffer(seen, count, last = [], random = Math.random) {
  const all = Object.keys(WEAPON_TYPES);
  const size = Math.max(1, Math.min(count, all.length));
  const avoidingLast = ids => [...shuffle(ids.filter(id => !last.includes(id)), random), ...shuffle(ids.filter(id => last.includes(id)), random)];
  let offer = avoidingLast(all.filter(id => !seen.includes(id))).slice(0, size);
  let nextSeen = [...seen, ...offer];
  if (offer.length < size) {
    const refill = avoidingLast(all.filter(id => !offer.includes(id))).slice(0, size - offer.length);
    offer = [...offer, ...refill];
    nextSeen = refill;                               // o ciclo novo já começa com as que completaram a mesa
  }
  if (nextSeen.length >= all.length) nextSeen = [];
  return { offer: shuffle(offer, random), seen: nextSeen };
}

// Quem ganhou o duelo `[a, b]` com os gestos de `throws`; nulo no empate.
export function pairWinner([a, b], throws) {
  if (throws[a] === throws[b]) return null;
  return BEATS[throws[a]] === throws[b] ? a : b;
}

// Com número ímpar um passa direto, na ordem: líder da última corrida, líder de abates e, se nenhum dos dois estiver na
// disputa, sorteio. Cada um passa direto no máximo uma vez por disputa.
function chooseBye(alive, passed, { leader = null, killer = null }, random) {
  for (const [id, why] of [[leader, 'leader'], [killer, 'kills']]) if (alive.includes(id) && !passed.has(id)) return { bye: id, why };
  const fresh = alive.filter(id => !passed.has(id)), pool = fresh.length ? fresh : alive;
  return { bye: pool[Math.floor(random() * pool.length)], why: 'draw' };
}

// Os duelos de uma fase correm juntos: cada rodada, { idDoJogador: gesto }, tem só os pares que ainda estão empatados.
function playStage(pairs, random) {
  const rounds = [], winners = [];
  let open = pairs;
  while (open.length) {
    const throws = {}, tied = [];
    for (const pair of open) {
      for (const id of pair) throws[id] = THROWS[Math.floor(random() * 3)];
      if (rounds.length >= MAX_ROUNDS - 1) {         // sem mais empate: sorteia quem vence e o outro mostra o gesto que perde
        const winner = random() < 0.5 ? 0 : 1;
        throws[pair[1 - winner]] = BEATS[throws[pair[winner]]];
      }
      const winner = pairWinner(pair, throws);
      if (winner) winners.push(winner);
      else tied.push(pair);
    }
    rounds.push(throws);
    open = tied;
  }
  return { rounds, winners };
}

// Uma disputa: mata-mata em fases até sobrar um. Cada fase é { pairs: [[a, b]], bye, why, rounds }.
function playDuel(contenders, priority, random) {
  let alive = shuffle(contenders, random);
  const stages = [], passed = new Set();
  while (alive.length > 1) {
    const { bye, why } = alive.length % 2 ? chooseBye(alive, passed, priority, random) : { bye: null, why: null };
    if (bye) passed.add(bye);
    const dueling = shuffle(alive.filter(id => id !== bye), random);
    const pairs = Array.from({ length: dueling.length / 2 }, (_, i) => [dueling[2 * i], dueling[2 * i + 1]]);
    const { rounds, winners } = playStage(pairs, random);
    stages.push({ pairs, bye, why, rounds });
    alive = bye ? [...winners, bye] : winners;
  }
  return { stages, winner: alive[0] };
}

// Uma rodada. `players`: ids de quem ainda não tem arma; `offer`: armas ainda livres; `picks`: Map id -> arma apontada.
// `priority`: { leader, killer }, os ids de quem passa direto no mata-mata (líder da última corrida e de abates).
// Devolve { assigned: { id: arma }, duels: [{ w, stages, winner }] } só com quem ganhou arma nesta rodada.
export function resolveDraft({ offer, players, picks, priority = {}, random = Math.random }) {
  const claims = new Map();
  for (const id of players) {
    const weaponId = picks.get(id);
    if (offer.includes(weaponId)) claims.set(weaponId, [...(claims.get(weaponId) ?? []), id]);
  }
  const assigned = {}, duels = [];
  for (const weaponId of offer) {                    // na ordem da mesa, que é a ordem da revelação
    const contenders = claims.get(weaponId);
    if (!contenders) continue;
    if (contenders.length === 1) { assigned[contenders[0]] = weaponId; continue; }
    const { stages, winner } = playDuel(contenders, priority, random);
    duels.push({ w: weaponId, stages, winner });
    assigned[winner] = weaponId;
  }
  return { assigned, duels };
}
