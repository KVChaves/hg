// `price` é por unidade e `maxCharges` o limite individual do item na compra (itens fortes têm limite menor);
// `charges` é a quantidade sugerida. O jogador leva qualquer combinação de itens, cada um até o seu limite.
// Itens do bagageiro (tecla E). As armadilhas ficam na pista e afetam todos os carros, inclusive quem soltou;
// halfLength e halfWidth são a área de contato em metros. A dinamite explode quando um carro passa por cima: joga esse carro na diagonal para trás e empurra quem estiver perto; não causa dano.
// Os power-ups (`powerup`) fazem efeito na hora. Nenhum item do bagageiro pode ser usado antes de TRAPS_UNLOCK_TIME.

export const TRAP_TYPES = {
  spikes: { id: 'spikes', label: 'ESPINHOS', caughtText: 'NOS ESPINHOS', price: 40, maxCharges: 5, summary: 'FURA O PNEU', charges: 3, halfLength: 1.9, halfWidth: 2.95, life: 20, effect: 'puncture', duration: 5 },
  oil: { id: 'oil', label: 'OLEO', caughtText: 'NO OLEO', price: 30, maxCharges: 5, summary: 'CARRO PERDE ADERENCIA', charges: 3, halfLength: 2.85, halfWidth: 2.8, life: 20, effect: 'oil', duration: 2.8 },
  paint: { id: 'paint', label: 'TINTA', caughtText: 'NA TINTA', price: 40, maxCharges: 3, summary: 'COBRE O PARA-BRISA', charges: 1, halfLength: 1.6, halfWidth: 2.4, life: 20, effect: 'paint', duration: 7 },
  dynamite: { id: 'dynamite', label: 'DINAMITE', caughtText: 'NA DINAMITE', price: 75, maxCharges: 4, summary: 'EXPLODE AO PISAR E JOGA O CARRO PARA TRAS', charges: 2, halfLength: 1.0, halfWidth: 1.3, life: 90, radius: 8 },
  smoke: { id: 'smoke', label: 'FUMACA', caughtText: 'NA FUMACA', price: 50, maxCharges: 3, summary: 'ESCONDE A PISTA', charges: 1, halfLength: 8, halfWidth: 6.5, life: 9, effect: 'smoke', duration: 3 },
  extinguisher: { id: 'extinguisher', label: 'EXTINTOR', price: 60, maxCharges: 3, summary: 'RECUPERA 20% DA VIDA', charges: 1, powerup: true },
  shield: { id: 'shield', label: 'ESCUDO', price: 130, maxCharges: 2, summary: 'ABSORVE 80% DA VIDA POR 8 S', charges: 1, powerup: true },
  emp: { id: 'emp', label: 'PULSO EMP', price: 90, maxCharges: 3, summary: 'SEM NITRO, TIRO E ITENS POR 8 S, A 50 M', charges: 1, powerup: true },
  mine: { id: 'mine', label: 'MINA TELEGUIADA', price: 120, maxCharges: 3, summary: 'PERSEGUE O CARRO A FRENTE, GRUDA E EXPLODE', charges: 1, powerup: true },
  harpoon: { id: 'harpoon', label: 'ARPAO', price: 85, maxCharges: 3, summary: 'FISGA ATE 50 M E PRENDE POR 6 S. E SOLTA OU CANCELA', charges: 1, powerup: true },
};

// Chão queimando onde a flecha incendiária caiu. Não se compra: só a besta cria. Quem passa por cima pega fogo
// por `duration` segundos (renovado enquanto continuar em cima). Fica fora de TRAP_TYPES para não ir à loja.
export const GROUND_FIRE = { id: 'fire', label: 'FOGO', caughtText: 'NO FOGO', halfLength: 2.6, halfWidth: 2.5, life: 7, effect: 'burning', duration: 3 };
export const hazardType = id => TRAP_TYPES[id] ?? (id === GROUND_FIRE.id ? GROUND_FIRE : undefined);

// Escudo: absorve `SHIELD_ABSORB` da vida total (ou até acabar o tempo). EMP: raio em metros, duração em segundos.
// Mina: alcance para travar o alvo, tempo até explodir depois de grudar, dano (fração da vida padrão).
export const SHIELD_TIME = 8, SHIELD_ABSORB = 0.8;
export const EMP_RADIUS = 50, EMP_TIME = 8;
export const MINE_RANGE = 70, MINE_CONE = 0.8, MINE_SPEED = 45, MINE_FUSE = 3, MINE_DAMAGE = 0.3, MINE_FLIGHT_MAX = 3;

export const EXTINGUISHER_LIFE = 0.2;                // fração da vida total que o extintor devolve
export const TRAPS_UNLOCK_TIME = 7;                  // segundos de corrida até o bagageiro liberar
