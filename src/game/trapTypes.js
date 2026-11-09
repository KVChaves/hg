// `price` é por unidade e `maxCharges` o máximo que cabe na compra; `charges` é a quantidade sugerida.
// Itens do bagageiro (tecla E). As armadilhas ficam na pista e afetam todos os carros, inclusive quem soltou;
// halfLength e halfWidth são a área de contato em metros. A dinamite explode quando um carro passa por cima: joga esse carro na diagonal para trás e empurra quem estiver perto; não causa dano.
// Os power-ups (`powerup`) fazem efeito na hora. Nenhum item do bagageiro pode ser usado antes de TRAPS_UNLOCK_TIME.

export const TRAP_TYPES = {
  spikes: { id: 'spikes', label: 'ESPINHOS', caughtText: 'NOS ESPINHOS', price: 30, maxCharges: 6, summary: 'FURA O PNEU', charges: 3, halfLength: 1.9, halfWidth: 3.56, life: 20, effect: 'puncture', duration: 4 },
  oil: { id: 'oil', label: 'OLEO', caughtText: 'NO OLEO', price: 35, maxCharges: 6, summary: 'CARRO PERDE ADERENCIA', charges: 3, halfLength: 2.85, halfWidth: 3.32, life: 20, effect: 'oil', duration: 2.4 },
  paint: { id: 'paint', label: 'TINTA', caughtText: 'NA TINTA', price: 60, maxCharges: 4, summary: 'COBRE O PARA-BRISA', charges: 2, halfLength: 1.6, halfWidth: 2.8, life: 20, effect: 'paint', duration: 7 },
  dynamite: { id: 'dynamite', label: 'DINAMITE', caughtText: 'NA DINAMITE', price: 65, maxCharges: 4, summary: 'EXPLODE AO PISAR E JOGA O CARRO PARA TRAS', charges: 2, halfLength: 1.0, halfWidth: 1.3, life: 90, radius: 10 },
  smoke: { id: 'smoke', label: 'FUMACA', caughtText: 'NA FUMACA', price: 35, maxCharges: 4, summary: 'ESCONDE A PISTA', charges: 2, halfLength: 8, halfWidth: 7.5, life: 9, effect: 'smoke', duration: 3 },
  extinguisher: { id: 'extinguisher', label: 'EXTINTOR', price: 80, maxCharges: 4, summary: 'RECUPERA 20% DA VIDA', charges: 2, powerup: true },
  harpoon: { id: 'harpoon', label: 'ARPAO', price: 45, maxCharges: 5, summary: 'SEGURE E: PUXA O CARRO A FRENTE, 30 M', charges: 3, powerup: true },
};

export const MAX_TRAP_SLOTS = 3;
export const EXTINGUISHER_LIFE = 0.2;                // fração da vida total que o extintor devolve
export const TRAPS_UNLOCK_TIME = 7;                  // segundos de corrida até o bagageiro liberar
