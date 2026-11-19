// Sons das armas. Cada arma lista só os momentos que têm som; os outros ficam mudos.
// Momentos: fire (tiro), dry (gatilho sem munição), reloadStart (abre a arma), roundIn (entra uma bala),
// magazineIn (o pente encaixa), reloadEnd (fecha a arma), leverOpen/leverClose (ciclo da alavanca)
// e casing (cápsula batendo no painel).
// Os volumes igualam a força dos arquivos, que varia muito; a escopeta passa de 1 porque o arquivo é baixo.

const sound = (path, volume) => ({ url: `assets/audio/weapons/${path}.mp3`, volume });

const DRY_FIRE = sound('dry-fire', 0.4);              // o mesmo gatilho vazio em todas as armas
const ROUND_IN = sound('round-in', 1);
const CASING = sound('casing', 0.7);
const LEVER_OPEN = sound('rifle/lever-open', 0.5);
const LEVER_CLOSE = sound('rifle/lever-close', 0.5);

export const WEAPON_SOUNDS = {
  revolver: {
    fire: sound('revolver/fire', 0.3),
    dry: DRY_FIRE,
    reloadStart: sound('revolver/spin', 0.7),
    roundIn: ROUND_IN,
    reloadEnd: sound('revolver/close', 1),
    casing: CASING,
  },
  shotgun: {
    fire: sound('shotgun/fire', 1.3),
    dry: DRY_FIRE,
    reloadStart: sound('shotgun/open', 0.45),
    roundIn: ROUND_IN,
    reloadEnd: sound('shotgun/close', 0.45),
    casing: CASING,
  },
  smg: {
    fire: sound('smg/fire', 0.5),
    dry: DRY_FIRE,
    reloadStart: sound('smg/mag-out', 0.5),
    magazineIn: sound('smg/mag-in', 0.5),
    casing: CASING,
  },
  rifle: {
    fire: sound('rifle/fire', 0.5),
    dry: DRY_FIRE,
    reloadStart: LEVER_OPEN,
    roundIn: ROUND_IN,
    reloadEnd: LEVER_CLOSE,
    leverOpen: LEVER_OPEN,
    leverClose: LEVER_CLOSE,
    casing: CASING,
  },
};

// Armas com som próprio. Cada som tem `fallback`: enquanto o arquivo novo não existe, toca o da arma parecida.
// Arquivos novos: assets/audio/weapons/<arma>/<nome>.mp3 (veja a lista em NOVOS-SONS.md).
const own = (path, volume, fallback, fallbackVolume = volume) => ({ ...sound(path, volume), fallback: fallback.url ?? fallback, fallbackVolume: fallback.volume ?? fallbackVolume });
const HARPOON_SOUND = { url: 'assets/audio/traps/harpoon.mp3', volume: 0.5 };
const BASE = WEAPON_SOUNDS;

WEAPON_SOUNDS.magnum = {
  fire: own('magnum/fire', 1.8, BASE.revolver.fire, 0.45),
  dry: DRY_FIRE,
  reloadStart: own('magnum/open', 0.45, BASE.revolver.reloadStart),
  roundIn: ROUND_IN,
  reloadEnd: own('magnum/close', 1, BASE.revolver.reloadEnd),
  casing: CASING,
};
WEAPON_SOUNDS.sniper = {
  fire: own('sniper/fire', 0.9, BASE.rifle.fire),
  dry: DRY_FIRE,
  reloadStart: own('sniper/bolt-open', 1.2, LEVER_OPEN),
  roundIn: ROUND_IN,
  reloadEnd: own('sniper/bolt-close', 0.5, LEVER_CLOSE),
  boltOpen: own('sniper/bolt-open', 1.2, LEVER_OPEN),
  boltClose: own('sniper/bolt-close', 0.5, LEVER_CLOSE),
  casing: CASING,
};
WEAPON_SOUNDS.autoshotgun = {
  fire: own('autoshotgun/fire', 0.55, BASE.shotgun.fire),
  dry: DRY_FIRE,
  reloadStart: own('autoshotgun/port-open', 0.5, BASE.shotgun.reloadStart),
  roundIn: ROUND_IN,
  reloadEnd: own('autoshotgun/slide', 0.6, BASE.shotgun.reloadEnd),
  casing: CASING,
};
WEAPON_SOUNDS.crossbow = {
  fire: own('crossbow/fire', 0.35, HARPOON_SOUND),
  dry: DRY_FIRE,
  reloadStart: own('crossbow/crank', 0.5, LEVER_OPEN),
  roundIn: own('crossbow/bolt-in', 0.5, ROUND_IN),
  reloadEnd: own('crossbow/latch', 0.4, LEVER_CLOSE),
};
WEAPON_SOUNDS.grenade = {
  fire: own('grenade/fire', 0.9, BASE.shotgun.fire, 0.9),
  dry: DRY_FIRE,
  reloadStart: own('grenade/port-open', 1.2, BASE.shotgun.reloadStart),
  roundIn: own('grenade/round-in', 0.8, ROUND_IN),
  reloadEnd: own('grenade/pump', 0.6, BASE.shotgun.reloadEnd),
  pump: own('grenade/pump', 0.6, BASE.shotgun.reloadEnd),
  casing: CASING,
};
