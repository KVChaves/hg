// `shake` (escopetas): o carro atingido balança, com giro, empurrão lateral e inclinação; quanto mais perto, mais forte.
// `recoil`: só o tranco visual da arma na mão. `kick`: o recuo de verdade, que levanta a mira (game/weapon.js):
//   up      radianos que cada tiro sobe a mira (com uma variação pequena)
//   side    radianos que cada tiro pode jogar a mira para um lado ou para o outro
//   recover por segundo, quão rápido volta a parte do salto que volta sozinha (o resto o piloto corrige com o mouse)
// `bloom`: abertura das automáticas, em frações da tela (as balas se espalham em volta da mira).
// O recuo segue a arma de verdade: a força do disparo faz o salto, e peso e coronha seguram. Do maior para o menor:
//   escopetas        chumbo grosso numa arma curta: o maior coice (a MAG-7 mais que a Nova)
//   Desert Eagle     o cartucho mais forte numa arma de mão, sem apoio
//   AWP              disparo enorme, mas arma pesada com freio de boca: sobe reto, quase sem sair para o lado
//   R8               revólver pesado: salta e volta
//   AK-47            fuzil forte e solto: sobe e espalha a rajada
//   M4A4 e AUG       fuzis mais contidos (a AUG tem luneta)
//   CZ75 e P90       munição leve: pouco por tiro, soma na rajada
//   M249             o peso quase não deixa subir, mas a rajada longa faz tremer para os lados
// Armas de fogo disponíveis (inspiradas no arsenal clássico de tiro tático). A arma começa descarregada, então
// `reserve` é toda a munição da corrida: dano × reserva fica perto de 850 para todas.
// O preço (`price`, em reais) depende de quão fácil é aproveitar esse dano numa corrida.
// `art`: o desenho reaproveitado (ui/guns/gunArt.js), que também escolhe som, munição do painel e peças desenhadas
// quando a arma não tem os seus. `style`: o jeito de mover (ui/guns/gunAnimator.js). `family`: o último recurso.
// `range`: alcance em metros, de 70 (escopetas) a 230 (AWP). Nas escopetas o dano já some antes (`falloff`).
// `scope`: o botão direito fecha o campo de visão até `fov` graus (ui/scope.js).

export const WEAPON_TYPES = {
  cz75: {
    id: 'cz75', family: 'revolver', art: 'pistol', style: 'smg', label: 'CZ75-AUTO', price: 230, summary: 'PISTOLA AUTOMATICA: CURTA E FURIOSA',
    damage: 11, interval: 0.075, range: 90, magazine: 12, reserve: 78, roundTime: 1.5, recoil: 0.45, kick: { up: 0.009, side: 0.01, recover: 5 },
    automatic: true, reloadsWholeMagazine: true, bloom: { perShot: 0.004, max: 0.03, decay: 0.14 },
  },
  deagle: {
    id: 'deagle', family: 'revolver', art: 'pistol', style: 'smg', label: 'DESERT EAGLE', price: 220, summary: 'PISTOLA PESADA: ACERTE O PRIMEIRO',
    damage: 64, interval: 0.55, range: 160, magazine: 7, reserve: 13, roundTime: 1.3, recoil: 2, kick: { up: 0.07, side: 0.02, recover: 3.5 },
    reloadsWholeMagazine: true,
  },
  r8: {
    id: 'r8', family: 'revolver', art: 'revolver', style: 'revolver', label: 'R8 REVOLVER', price: 170, summary: 'REVOLVER PESADO DE OITO TIROS',
    damage: 46, interval: 0.6, range: 150, magazine: 8, reserve: 18, roundTime: 0.36, recoil: 1.5, kick: { up: 0.045, side: 0.012, recover: 4.5 },
  },
  nova: {
    id: 'nova', family: 'shotgun', art: 'pump', style: 'pump', label: 'NOVA', price: 220, summary: 'ESCOPETA DE BOMBA: OITO CARTUCHOS',
    damage: 80, falloff: { full: 30, zero: 50, min: 5 }, shake: 1.2, interval: 0.9, range: 80,
    magazine: 8, reserve: 11, roundTime: 0.5, recoil: 1.9, kick: { up: 0.072, side: 0.017, recover: 3.5 },
  },
  mag7: {
    id: 'mag7', family: 'shotgun', art: 'autoshotgun', style: 'autoshotgun', label: 'MAG-7', price: 260, summary: 'ESCOPETA BRUTA DE MUITO PERTO',
    damage: 100, falloff: { full: 22, zero: 40, min: 6 }, shake: 1.6, interval: 0.8, range: 70,
    magazine: 5, reserve: 9, roundTime: 0.55, recoil: 2.3, kick: { up: 0.08, side: 0.02, recover: 3.2 },
  },
  // `botBurst`: quantos tiros os bots dão por rajada.
  m249: {
    id: 'm249', family: 'smg', art: 'gatling', style: 'gatling', label: 'M249', price: 250, summary: 'CEM BALAS NA CAIXA, RECARGA LENTA',
    damage: 9, interval: 0.075, range: 140, magazine: 100, reserve: 100, roundTime: 3.4, recoil: 0.3, kick: { up: 0.005, side: 0.012, recover: 4.5 },
    automatic: true, reloadsWholeMagazine: true, botBurst: [14, 28], bloom: { perShot: 0.0014, max: 0.035, decay: 0.08 },
  },
  p90: {
    id: 'p90', family: 'smg', art: 'smg', style: 'smg', label: 'P90', price: 270, summary: 'CINQUENTA BALAS: SEGURE O CLIQUE',
    damage: 10, interval: 0.07, range: 110, magazine: 50, reserve: 80, roundTime: 1.9, recoil: 0.35, kick: { up: 0.007, side: 0.007, recover: 5 },
    automatic: true, reloadsWholeMagazine: true, bloom: { perShot: 0.0022, max: 0.025, decay: 0.12 },
  },
  ak47: {
    id: 'ak47', family: 'rifle', art: 'assault', style: 'smg', label: 'AK-47', price: 340, summary: 'FORTE E LONGE, MAS PULA MUITO',
    damage: 22, interval: 0.12, range: 190, magazine: 30, reserve: 38, roundTime: 2.2, recoil: 0.85, kick: { up: 0.02, side: 0.01, recover: 4 },
    automatic: true, reloadsWholeMagazine: true, bloom: { perShot: 0.004, max: 0.03, decay: 0.1 },
  },
  m4a4: {
    id: 'm4a4', family: 'rifle', art: 'assault', style: 'smg', label: 'M4A4', price: 330, summary: 'RAJADA PRECISA E CONTROLADA',
    damage: 18, interval: 0.1, range: 180, magazine: 30, reserve: 46, roundTime: 2, recoil: 0.55, kick: { up: 0.013, side: 0.006, recover: 4.5 },
    automatic: true, reloadsWholeMagazine: true, bloom: { perShot: 0.003, max: 0.022, decay: 0.12 },
  },
  aug: {
    id: 'aug', family: 'rifle', art: 'assault', style: 'smg', label: 'AUG', price: 360, summary: 'FUZIL COM LUNETA NO BOTAO DIREITO',
    damage: 19, interval: 0.11, range: 210, magazine: 30, reserve: 44, roundTime: 2.3, recoil: 0.5, kick: { up: 0.012, side: 0.006, recover: 4.5 },
    automatic: true, reloadsWholeMagazine: true, bloom: { perShot: 0.0025, max: 0.02, decay: 0.12 }, scope: { fov: 38 },
  },
  awp: {
    id: 'awp', family: 'rifle', art: 'sniper', style: 'bolt', label: 'AWP', price: 320, summary: 'UM TIRO, ALCANCE ENORME',
    damage: 120, interval: 1.5, range: 230, magazine: 5, reserve: 7, roundTime: 0.9, recoil: 2.1, kick: { up: 0.065, side: 0.006, recover: 3 },
    scope: { fov: 20 },
  },
};

export const DEFAULT_WEAPON = 'r8';
// Armas que saíram do jogo e a que ficou no lugar delas, para não perder o que estava salvo.
const RETIRED = {
  revolver: 'r8', magnum: 'deagle', smg: 'p90', heavymg: 'm249', shotgun: 'nova', autoshotgun: 'mag7',
  grenade: 'nova', rifle: 'ak47', sniper: 'awp', crossbow: 'awp',
};
export const currentWeaponId = id => (WEAPON_TYPES[id] ? id : RETIRED[id] ?? DEFAULT_WEAPON);

// Desenho que a arma usa (o próprio id quando ela tem desenho próprio).
export const artOf = id => WEAPON_TYPES[id]?.art ?? id;

// Família da arma (revolver, shotgun, smg ou rifle): o que não tem pelo id nem pelo desenho segue a família.
export const familyOf = id => WEAPON_TYPES[id]?.family ?? id;

export function damageAtDistance(type, distance) {
  if (!type.falloff) return type.damage;
  const { full, zero, min } = type.falloff;
  const t = Math.max(0, Math.min(1, (distance - full) / (zero - full)));
  return type.damage + (min - type.damage) * t;
}

// Força do balanço no carro atingido a `distance` metros: a mesma queda do dano, com um mínimo para o tiro longe ainda sacudir.
const SHAKE_MIN_SHARE = 0.25;
export function shakeAtDistance(type, distance) {
  if (!type.shake) return 0;
  return type.shake * Math.max(SHAKE_MIN_SHARE, damageAtDistance(type, distance) / type.damage);
}

// Intervalo entre tiros com os canos girando a `spin` (0 parado, 1 no máximo). Armas sem giro atiram sempre no mesmo ritmo.
export function fireInterval(type, spin = 1) {
  if (!type.spinUp) return type.interval;
  return type.spinUp.startInterval + (type.interval - type.spinUp.startInterval) * Math.max(0, Math.min(1, spin));
}

// Giro dos canos depois de `dt` segundos com o gatilho apertado (`held`) ou solto.
export function stepSpin(type, spin, held, dt) {
  if (!type.spinUp) return 0;
  return held ? Math.min(1, spin + dt / type.spinUp.time) : Math.max(0, spin - dt / type.spinUp.spinDown);
}
