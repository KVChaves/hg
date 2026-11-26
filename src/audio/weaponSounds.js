// Sons das armas. Cada arma lista só os momentos que têm som; os outros ficam mudos.
// Momentos: fire (tiro), dry (gatilho sem munição), reloadStart (abre a arma), roundIn (entra uma bala),
// magazineIn (o pente encaixa), reloadEnd (fecha a arma), leverOpen/leverClose (ciclo da alavanca)
// e casing (cápsula batendo no painel).
// Os volumes igualam a força dos arquivos, que varia muito; a escopeta passa de 1 porque o arquivo é baixo.
// `rate` (opcional) muda a velocidade e o tom do arquivo: abaixo de 1 fica mais grave, para reaproveitar um som.

const sound = (path, volume, rate) => ({ url: `assets/audio/weapons/${path}.mp3`, volume, ...(rate && { rate }) });

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
WEAPON_SOUNDS.pump = {
  fire: own('grenade/fire', 0.9, BASE.shotgun.fire, 0.9),
  dry: DRY_FIRE,
  reloadStart: own('grenade/port-open', 1.2, BASE.shotgun.reloadStart),
  roundIn: own('grenade/round-in', 0.8, ROUND_IN),
  reloadEnd: own('grenade/pump', 0.6, BASE.shotgun.reloadEnd),
  pump: own('grenade/pump', 0.6, BASE.shotgun.reloadEnd),
  casing: CASING,
};
// Metralhadora: só sons que já existem, mais graves. O tiro é o da submetralhadora puxado para baixo, o giro dos canos
// é o tambor do revólver bem devagar e a caixa de munição usa o pente da submetralhadora e o ferrolho da sniper.
WEAPON_SOUNDS.gatling = {
  fire: sound('smg/fire', 0.6, 0.72),
  dry: DRY_FIRE,
  spinUp: sound('revolver/spin', 0.6, 0.55),
  reloadStart: sound('smg/mag-out', 0.6, 0.7),
  magazineIn: sound('smg/mag-in', 0.7, 0.65),
  reloadEnd: sound('sniper/bolt-close', 0.5, 0.8),
  casing: CASING,
};

// Armas de agora: cada uma reaproveita os sons do desenho que usa (`art`), com o tom (`rate`) ajustado ao calibre.
const S = WEAPON_SOUNDS;
const MAG_OUT = (volume, rate) => sound('smg/mag-out', volume, rate);
const MAG_IN = (volume, rate) => sound('smg/mag-in', volume, rate);
const CHARGE = (volume, rate) => sound('sniper/bolt-close', volume, rate);       // puxar a alavanca de armar no fim da recarga

S.cz75 = { fire: sound('smg/fire', 0.42, 1.3), dry: DRY_FIRE, reloadStart: MAG_OUT(0.45, 1.25), magazineIn: MAG_IN(0.45, 1.25), reloadEnd: CHARGE(0.3, 1.5), casing: CASING };
S.deagle = { fire: S.magnum.fire, dry: DRY_FIRE, reloadStart: MAG_OUT(0.55, 0.95), magazineIn: MAG_IN(0.6, 0.9), reloadEnd: CHARGE(0.4, 1.3), casing: CASING };
S.r8 = { ...S.revolver, fire: sound('revolver/fire', 0.38, 0.85) };
S.nova = { ...S.pump, fire: S.shotgun.fire, roundIn: ROUND_IN };
S.mag7 = { ...S.autoshotgun, fire: sound('shotgun/fire', 1.3, 0.88) };
S.m249 = { ...S.gatling, fire: sound('smg/fire', 0.6, 0.78) };
delete S.m249.spinUp;
S.p90 = { ...S.smg, fire: sound('smg/fire', 0.48, 1.08) };
S.ak47 = { fire: sound('rifle/fire', 0.42, 1.08), dry: DRY_FIRE, reloadStart: MAG_OUT(0.55, 0.85), magazineIn: MAG_IN(0.6, 0.82), reloadEnd: CHARGE(0.45, 1), casing: CASING };
S.m4a4 = { fire: sound('smg/fire', 0.55, 0.82), dry: DRY_FIRE, reloadStart: MAG_OUT(0.5, 0.95), magazineIn: MAG_IN(0.55, 0.92), reloadEnd: CHARGE(0.4, 1.15), casing: CASING };
S.aug = { fire: sound('rifle/fire', 0.38, 1.2), dry: DRY_FIRE, reloadStart: MAG_OUT(0.5, 0.9), magazineIn: MAG_IN(0.55, 0.88), reloadEnd: CHARGE(0.4, 1.1), casing: CASING };
S.awp = S.sniper;
