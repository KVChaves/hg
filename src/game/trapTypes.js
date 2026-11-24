// `price` é por unidade e `maxCharges` o limite individual do item na compra (itens fortes têm limite menor);
// `charges` é a quantidade sugerida. O jogador leva qualquer combinação de itens, cada um até o seu limite.
// Itens do bagageiro (tecla E). As armadilhas ficam na pista e afetam todos os carros, inclusive quem soltou;
// halfLength e halfWidth são a área de contato em metros. A dinamite explode quando um carro passa por cima: joga esse carro na diagonal para trás e empurra quem estiver perto; não causa dano.
// A barreira (`barrier`) cai atrás como as armadilhas, mas é um obstáculo sólido (game/obstacles.js, tipo `barrier`).
// Os power-ups (`powerup`) fazem efeito na hora. Os itens de ataque e controle só podem ser usados depois de TRAPS_UNLOCK_TIME; os de defesa, desde a largada.

// `category`: como o item é usado. defense protege quem leva (extintor, escudo) ou desarma o ataque dos outros (EMP); control atrapalha o rival
// (pneu, aderência, visão, direção, barreira); attack machuca (dinamite, mina, arpão). Só organiza a garagem e não muda o jogo, então não afeta o online.
// `damage` (dinamite): vida (escala de CAR_MAX_HP) que a explosão tira de quem pisou; quem está em volta leva menos, até 40% nas bordas (game/traps.js).
export const ITEM_CATEGORIES = [
  { id: 'attack', label: 'ATAQUE' },
  { id: 'control', label: 'CONTROLE' },
  { id: 'defense', label: 'DEFESA' },
];

export const TRAP_TYPES = {
  spikes: { id: 'spikes', category: 'control', label: 'ESPINHOS', caughtText: 'NOS ESPINHOS', price: 30, maxCharges: 5, summary: 'FURA O PNEU', charges: 3, halfLength: 1.9, halfWidth: 2.95, life: 20, effect: 'puncture', duration: 5 },
  oil: { id: 'oil', category: 'control', label: 'OLEO', caughtText: 'NO OLEO', price: 30, maxCharges: 5, summary: 'CARRO PERDE ADERENCIA', charges: 3, halfLength: 2.85, halfWidth: 2.8, life: 20, effect: 'oil', duration: 2.8 },
  paint: { id: 'paint', category: 'control', label: 'TINTA', caughtText: 'NA TINTA', price: 40, maxCharges: 3, summary: 'COBRE O PARA-BRISA', charges: 1, halfLength: 1.6, halfWidth: 2.4, life: 20, effect: 'paint', duration: 7 },
  dynamite: { id: 'dynamite', category: 'attack', label: 'DINAMITE', caughtText: 'NA DINAMITE', price: 75, maxCharges: 4, summary: 'DANO EM AREA E JOGA O CARRO PARA TRAS', charges: 2, halfLength: 1.0, halfWidth: 1.3, life: 90, radius: 8, damage: 50 },
  smoke: { id: 'smoke', category: 'control', label: 'FUMACA', caughtText: 'NA FUMACA', price: 50, maxCharges: 3, summary: 'ESCONDE A PISTA', charges: 1, halfLength: 8, halfWidth: 6.5, life: 9, effect: 'smoke', duration: 3 },
  extinguisher: { id: 'extinguisher', category: 'defense', label: 'EXTINTOR', price: 75, maxCharges: 3, summary: 'RECUPERA 20% DA VIDA', charges: 1, powerup: true },
  shield: { id: 'shield', category: 'defense', label: 'ESCUDO', price: 90, maxCharges: 2, summary: 'ABSORVE 80% DA VIDA POR 8 S', charges: 1, powerup: true },
  emp: { id: 'emp', category: 'defense', label: 'PULSO EMP', price: 80, maxCharges: 3, summary: 'SEM NITRO, TIRO E ITENS POR 8 S, A 80 M', charges: 1, powerup: true },
  mine: { id: 'mine', category: 'attack', label: 'MINA TELEGUIADA', price: 135, maxCharges: 3, summary: 'PERSEGUE O CARRO A FRENTE, GRUDA E EXPLODE', charges: 1, powerup: true },
  net: { id: 'net', category: 'control', label: 'LANCA-REDES', price: 95, maxCharges: 3, summary: 'PERSEGUE O CARRO NA MIRA ATE 60 M E TRAVA A DIRECAO DELE POR 2,8 S', charges: 1, powerup: true },
  barrier: { id: 'barrier', category: 'control', label: 'BARREIRA INFLAVEL', caughtText: 'NA BARREIRA', price: 60, maxCharges: 4, summary: 'FECHA UMA FAIXA. QUEM BATE PERDE MUITA VELOCIDADE. O TIRO ESTOURA', charges: 2, halfWidth: 1.1, barrier: true },
  cloak: { id: 'cloak', category: 'defense', label: 'CAMUFLAGEM', price: 120, maxCharges: 2, summary: 'O CARRO SOME POR 6 S: NINGUEM TRAVA A MIRA EM VOCE', charges: 1, powerup: true },
  harpoon: { id: 'harpoon', category: 'attack', label: 'ARPAO', price: 60, maxCharges: 3, summary: 'DANO BAIXO. PERSEGUE O CARRO NA MIRA ATE 60 M E PRENDE POR 8 S. SO O EMP SOLTA. OUTROS CARROS BATEM NO CABO', charges: 1, powerup: true },
};

// Chão queimando onde a flecha incendiária caiu. Não se compra: só a besta cria. Quem passa por cima pega fogo
// por `duration` segundos (renovado enquanto continuar em cima). Fica fora de TRAP_TYPES para não ir à loja.
export const GROUND_FIRE = { id: 'fire', label: 'FOGO', caughtText: 'NO FOGO', halfLength: 2.6, halfWidth: 2.5, life: 7, effect: 'burning', duration: 3 };
export const hazardType = id => TRAP_TYPES[id] ?? (id === GROUND_FIRE.id ? GROUND_FIRE : undefined);

// Escudo: absorve `SHIELD_ABSORB` da vida total (ou até acabar o tempo). EMP: raio em metros, duração em segundos.
// Mina: alcance para travar o alvo, tempo até explodir depois de grudar, dano (fração da vida padrão).
export const SHIELD_TIME = 8, SHIELD_ABSORB = 0.8;
export const EMP_RADIUS = 80, EMP_TIME = 8;
export const MINE_RANGE = 70, MINE_CONE = 0.8, MINE_SPEED = 45, MINE_FUSE = 3, MINE_DAMAGE = 0.3, MINE_FLIGHT_MAX = 3;

// Lança-redes: alcance para travar o alvo, cone de mira dos bots (cosseno; a mira do jogador é a linha de visada, ver aim.js), velocidade da rede, tempo máximo de voo e tempo com a direção travada.
export const NET_RANGE = 60, NET_CONE = 0.8, NET_SPEED = 70, NET_FLIGHT_MAX = 2, NET_TIME = 2.8;

// Camuflagem: segundos para sumir (da frente para trás), invisível e para reaparecer (game/cloak.js).
export const CLOAK_FADE = 0.8, CLOAK_TIME = 6, CLOAK_REVEAL = 0.5;

export const EXTINGUISHER_LIFE = 0.2;                // fração da vida total que o extintor devolve
export const TRAPS_UNLOCK_TIME = 7;                  // segundos de corrida até o bagageiro liberar
