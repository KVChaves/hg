import { WEAPON_TYPES } from './weaponTypes.js';

// Estilo de jogo de cada adversário. Todos usam a mesma IA (alvo, tiro, faixa, nitro e itens); o estilo só muda os pesos,
// e é isso que faz cada piloto seguir uma estratégia própria. As regras valem para qualquer alvo de race.field.
//  focus     pesos da escolha de alvo: near (perto), leader (quem lidera), weak (vida baixa ou indefeso),
//            rival (quem está logo à frente na classificação).
//  accuracy  multiplica a chance de acerto; aim multiplica o tempo de mira; ammoTime: segundos que a munição deve durar.
//  reach     até onde (m) o piloto aceita trocar tiro, limitado ao alcance da arma.
//  keepAt    distância (m) que gosta de manter do alvo à frente: longe disso usa nitro (chaseNitro), perto disso
//            segura atrás por até `patience` segundos para continuar atirando.
//  escapeNitro / defendNitro: nitro para fugir de quem ameaça de trás / para não deixar passar.
//  ram, block, jink, draft: vontade de jogar o carro no de lado, de fechar quem vem atrás, de ziguezaguear sob fogo
//            e de entrar no vácuo do alvo.
//  dodge     chance de desviar de cada armadilha vista; trapLane: entra na faixa de quem vem atrás antes de soltar;
//            curveTraps: prefere soltar óleo e espinhos na entrada das curvas fechadas.
//  empCrowd  quantos rivais perto pedem um pulso EMP; shieldAt / extinguishAt: vida (0 a 1) em que usa escudo e extintor.
//  swarm     não se importa de atacar quem já está sendo atacado.
//  items     preferência no NPC de estrada (multiplica o quanto falta de cada coisa).
export const BOT_STYLES = {
  hunter: {
    label: 'CACADORA', summary: 'PERSEGUE O LIDER E NAO LARGA',
    focus: { near: 0.6, leader: 1.5, weak: 0.4, rival: 0.4 },
    accuracy: 1.1, aim: 1, ammoTime: 105, reach: 130,
    keepAt: [14, 55], patience: 0, chaseNitro: true, escapeNitro: false, defendNitro: false,
    ram: 0.25, block: 0.15, jink: 0.4, draft: 0.8,
    dodge: 0.85, trapLane: false, curveTraps: false, trapPause: [16, 30], powerupPause: [2, 4],
    empCrowd: 1, shieldAt: 0.6, extinguishAt: 0.5, swarm: true,
    items: { ammo: 1.2, nitro: 1.3, trap: 0.8, extinguisher: 0.8 },
  },
  tick: {
    label: 'CARRAPATO', summary: 'GRUDA NA TRASEIRA E METRALHA',
    focus: { near: 1.2, leader: 0.2, weak: 0.3, rival: 1 },
    accuracy: 1, aim: 0.7, ammoTime: 85, reach: 95,
    keepAt: [6, 28], patience: 4, chaseNitro: true, escapeNitro: false, defendNitro: false,
    ram: 0.3, block: 0, jink: 0.6, draft: 1,
    dodge: 0.8, trapLane: false, curveTraps: false, trapPause: [12, 24], powerupPause: [2, 4],
    empCrowd: 1, shieldAt: 0.5, extinguishAt: 0.45, swarm: true,
    items: { ammo: 1.5, nitro: 1, trap: 0.7, extinguisher: 0.8 },
  },
  brawler: {
    label: 'BRUTAMONTES', summary: 'ENCOSTA, BATE E ESTOURA DE PERTO',
    focus: { near: 1.5, leader: 0.3, weak: 0.3, rival: 0.4 },
    accuracy: 1, aim: 0.6, ammoTime: 100, reach: 60,
    keepAt: [0, 12], patience: 0, chaseNitro: true, escapeNitro: false, defendNitro: false,
    ram: 1, block: 0.4, jink: 0, draft: 0.6,
    dodge: 0.6, trapLane: true, curveTraps: false, trapPause: [14, 26], powerupPause: [1.5, 3],
    empCrowd: 2, shieldAt: 0.75, extinguishAt: 0.5, swarm: true,
    items: { ammo: 1, nitro: 1.3, trap: 0.9, extinguisher: 1.1 },
  },
  marksman: {
    label: 'ATIRADORA', summary: 'MIRA COM CALMA, DE LONGE',
    focus: { near: 0.2, leader: 0.8, weak: 1.1, rival: 0.3 },
    accuracy: 1.35, aim: 1.5, ammoTime: 140, reach: 220,
    keepAt: [45, 150], patience: 7, chaseNitro: false, escapeNitro: true, defendNitro: false,
    ram: 0, block: 0, jink: 0.8, draft: 0,
    dodge: 0.95, trapLane: false, curveTraps: true, trapPause: [18, 32], powerupPause: [2, 4],
    empCrowd: 1, shieldAt: 0.65, extinguishAt: 0.5, swarm: false,
    items: { ammo: 1.6, nitro: 0.8, trap: 0.9, extinguisher: 0.9 },
  },
  blocker: {
    label: 'MURALHA', summary: 'FECHA A PORTA DE QUEM VEM ATRAS',
    focus: { near: 1.3, leader: 0.2, weak: 0.3, rival: 0.6 },
    accuracy: 1, aim: 0.8, ammoTime: 110, reach: 50,
    keepAt: null, patience: 0, chaseNitro: false, escapeNitro: false, defendNitro: true,
    ram: 0.6, block: 1, jink: 0, draft: 0,
    dodge: 0.8, trapLane: true, curveTraps: false, trapPause: [10, 18], powerupPause: [2, 4],
    empCrowd: 1, shieldAt: 0.6, extinguishAt: 0.55, swarm: true,
    items: { ammo: 1, nitro: 0.8, trap: 1.4, extinguisher: 1 },
  },
  vulture: {
    label: 'ABUTRE', summary: 'ACABA COM QUEM ESTA FERIDO',
    focus: { near: 0.4, leader: 0.2, weak: 2.2, rival: 0.2 },
    accuracy: 1.15, aim: 0.9, ammoTime: 100, reach: 105,
    keepAt: [10, 40], patience: 3, chaseNitro: true, escapeNitro: true, defendNitro: false,
    ram: 0.3, block: 0, jink: 0.5, draft: 0.5,
    dodge: 0.85, trapLane: false, curveTraps: false, trapPause: [16, 30], powerupPause: [2, 4],
    empCrowd: 2, shieldAt: 0.6, extinguishAt: 0.5, swarm: true,
    items: { ammo: 1.3, nitro: 1, trap: 0.8, extinguisher: 1 },
  },
  trapper: {
    label: 'TRAPACEIRO', summary: 'ARMA A PISTA NAS CURVAS FECHADAS',
    focus: { near: 0.8, leader: 0.4, weak: 0.5, rival: 0.6 },
    accuracy: 1.05, aim: 1.1, ammoTime: 130, reach: 110,
    keepAt: null, patience: 0, chaseNitro: false, escapeNitro: true, defendNitro: false,
    ram: 0, block: 0.5, jink: 0.4, draft: 0,
    dodge: 1, trapLane: true, curveTraps: true, trapPause: [6, 14], powerupPause: [2, 4],
    empCrowd: 2, shieldAt: 0.6, extinguishAt: 0.5, swarm: false,
    items: { ammo: 0.8, nitro: 0.9, trap: 1.8, extinguisher: 0.9 },
  },
};

export const styleOf = racer => BOT_STYLES[racer.profile?.style] ?? BOT_STYLES.hunter;

// A arma de qualquer piloto: a do bot vem do arsenal; a do jogador e a de quem é simulado em outro navegador vêm de
// `weaponId` (o jogador local ao equipar, os remotos ao serem vistos atirando). Nulo enquanto ninguém sabe.
// O carro remoto reaproveita um objeto de bot, então o arsenal dele não vale.
export const weaponOf = racer => (racer.remote ? null : racer.arsenal?.type) ?? WEAPON_TYPES[racer.weaponId] ?? null;

// Vida de 0 a 1 de qualquer piloto.
export const healthOf = racer => (racer.isPlayer ? racer.health ?? 1 : racer.maxHp ? racer.hp / racer.maxHp : 1);

// Até onde a arma ainda machuca de verdade (a escopeta perde força longe). Arma desconhecida conta como média.
export const UNKNOWN_WEAPON_RANGE = 90;
export function effectiveRange(type) {
  if (!type) return UNKNOWN_WEAPON_RANGE;
  return type.falloff ? (type.falloff.full + type.falloff.zero) / 2 : type.range;
}

// Indefeso agora: pegando fogo, sem itens por EMP, deslizando no óleo, cego ou capotado.
export const isVulnerable = racer => {
  const e = racer.effects ?? {};
  return e.burning > 0 || e.emp > 0 || e.oil > 0 || e.paint > 0 || Boolean(racer.overturned);
};

export const isAlive = racer => racer.dead <= 0 && !(racer.sunk > 0);
