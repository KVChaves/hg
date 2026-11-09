// Sons das armas. Cada arma lista só os momentos que têm som; os outros ficam mudos.
// Momentos: fire (tiro), dry (gatilho sem munição), reloadStart (abre a arma), roundIn (entra uma bala),
// magazineIn (o pente encaixa), reloadEnd (fecha a arma), leverOpen/leverClose (ciclo da alavanca)
// e casing (cápsula batendo no painel).
// Os volumes igualam a força dos arquivos, que varia muito; a escopeta passa de 1 porque o arquivo é baixo.

const sound = (path, volume) => ({ url: `assets/audio/weapons/${path}.wav`, volume });

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
