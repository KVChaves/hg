// Quem corre contra o jogador: arma, três itens e melhorias, tudo dentro do mesmo orçamento do jogador.
// Os ids vêm de weaponTypes.js e trapTypes.js; munição e cargas seguem as regras do jogador.
// `weaponParts`: peças de combate da arma (weaponParts.js), as que faltam ficam no original.
// `style` é a estratégia do piloto (botStyles.js), escolhida para combinar com o que ele leva.

export const OPPONENT_PROFILES = [
  // Caçadora: vai atrás de quem lidera, fecha com nitro e arpoa e prende na rede; o escudo segura a troca de tiros.
  { name: 'Ema', style: 'hunter', weapon: 'revolver', weaponParts: { grip: 'firm' }, traps: ['net', 'shield', 'harpoon'], upgrades: { life: 2, nitro: 1, ammo: 1 } },
  // Carrapato: cola na traseira de quem está logo à frente e não solta o gatilho da metralhadora; tinta cega quem vem
  // atrás, EMP corta o revide.
  { name: 'Waka', style: 'tick', weapon: 'heavymg', weaponParts: { magazine: 'extended' }, traps: ['paint', 'emp', 'extinguisher'], upgrades: { life: 1, nitro: 1, ammo: 1 } },
  // Brutamontes: encosta, joga o carro em cima e descarrega a escopeta de perto; arpão puxa quem tenta fugir.
  { name: 'UnclePecos', style: 'brawler', weapon: 'shotgun', weaponParts: { ammo: 'impact' }, traps: ['dynamite', 'extinguisher', 'harpoon'], upgrades: { life: 1, nitro: 2, ammo: 0 } },
  // Atiradora: segura distância e mira com calma; óleo nas curvas, mina em quem foge, camuflagem se a caçarem.
  { name: 'Ruiva', style: 'marksman', weapon: 'sniper', traps: ['oil', 'mine', 'cloak'], upgrades: { life: 2, nitro: 1, ammo: 0 } },
  // Muralha: fecha a faixa de quem vem atrás, dinamite e barreira inflável na cara dele, escopeta automática em quem emparelha.
  { name: 'Dino', style: 'blocker', weapon: 'autoshotgun', traps: ['dynamite', 'barrier', 'extinguisher'], upgrades: { life: 2, nitro: 0, ammo: 1 } },
  // Abutre: escolhe quem está ferido, pegando fogo ou sem itens; mina e arpão para terminar o serviço.
  { name: 'Kiko', style: 'vulture', weapon: 'smg', weaponParts: { ammo: 'hollow' }, traps: ['mine', 'net', 'harpoon'], upgrades: { life: 1, nitro: 1, ammo: 0 } },
  // Trapaceiro: arma a pista na entrada das curvas fechadas e na faixa de quem o segue; o revólver pesado faz o resto.
  { name: 'Zeca', style: 'trapper', weapon: 'magnum', weaponParts: { barrel: 'heavy' }, traps: ['oil', 'dynamite', 'harpoon'], upgrades: { life: 2, nitro: 1, ammo: 0 } },
];

// Nomes dos bots: sorteados a cada partida, sem repetir e sem pegar nome de quem já está na pista.
const BOT_NAMES = [
  'Ema', 'Waka', 'UnclePecos', 'Ruiva', 'Dino', 'Kiko', 'Zeca',
  'Bira', 'Tonha', 'Juca', 'Dona Cida', 'Biscoito', 'Marreta', 'Faísca', 'Tatu', 'Lagartixa',
  'Chumbinho', 'Gambá', 'Pipoca', 'Baixinho', 'Gaúcho', 'Cabeça', 'Fumaça', 'Vovó Neusa',
  'Bigode', 'Toco', 'Ferrugem', 'Paçoca', 'Cascudo', 'Tião', 'Lambari', 'Pé de Pano',
  'Xerife', 'Coruja', 'Zé Graxa', 'Nina', 'Brasa', 'Mosca', 'Jacaré', 'Tchuca',
];

// Gerador com semente: no online todos sorteiam os mesmos nomes a partir do id da partida.
export function seededRandom(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = (h + 0x6D2B79F5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function drawBotNames(count, taken = new Set(), random = Math.random) {
  const pool = [...BOT_NAMES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  // Filtra depois de embaralhar: com a mesma semente, quem entra no meio da partida não muda o nome dos bots.
  return pool.filter(name => !taken.has(name)).slice(0, count).concat(
    Array.from({ length: count }, (_, i) => `Bot ${i + 1}`)).slice(0, count);
}
