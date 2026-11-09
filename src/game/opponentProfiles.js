// Quem corre contra o jogador: arma, três itens e melhorias, tudo dentro do mesmo orçamento do jogador.
// Os ids vêm de weaponTypes.js e trapTypes.js; munição e cargas seguem as regras do jogador.

export const OPPONENT_PROFILES = [
  { name: 'Ema', weapon: 'revolver', traps: ['spikes', 'extinguisher', 'harpoon'], upgrades: { life: 2, nitro: 1, ammo: 1 } },
  { name: 'Waka', weapon: 'smg', traps: ['paint', 'smoke', 'extinguisher'], upgrades: { life: 1, nitro: 2, ammo: 1 } },
  { name: 'UnclePecos', weapon: 'shotgun', traps: ['dynamite', 'extinguisher', 'harpoon'], upgrades: { life: 1, nitro: 2, ammo: 0 } },
  { name: 'Ruiva', weapon: 'sniper', traps: ['oil', 'paint', 'harpoon'], upgrades: { life: 2, nitro: 1, ammo: 1 } },
  { name: 'Dino', weapon: 'autoshotgun', traps: ['dynamite', 'smoke', 'extinguisher'], upgrades: { life: 2, nitro: 0, ammo: 1 } },
  { name: 'Kiko', weapon: 'smg', traps: ['spikes', 'extinguisher', 'harpoon'], upgrades: { life: 1, nitro: 2, ammo: 0 } },
  { name: 'Zeca', weapon: 'magnum', traps: ['oil', 'dynamite', 'harpoon'], upgrades: { life: 2, nitro: 2, ammo: 1 } },
];
