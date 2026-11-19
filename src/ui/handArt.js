import { CLEAR, Raster } from '../art/raster.js';

// Mãos do piloto em pixel art. Todos os estilos usam a mesma silhueta (o punho visto de costas e a mão na
// coronha), para caberem nos mesmos pontos de pegada; o que muda é a pele, as marcas, as garras e o punho.
// Pixels que brilham vão para uma segunda imagem (`image.glow`), que hands.js pulsa por cima da mão.

const plus = (r, x, y, color) => {
  r.rect(x - 1, y, 4, 2, color);
  r.rect(x, y - 1, 2, 4, color);
};

function crack(r, g, points, base, glow) {
  for (let i = 0; i + 1 < points.length; i++) {
    const [ax, ay] = points[i], [bx, by] = points[i + 1];
    r.line(ax, ay, bx, by, base);
    g.line(ax, ay, bx, by, glow);
  }
}

// Luva de piloto: costas pretas, dedos claros de tela, cruzes nos nós e tira no punho.
const gloveMesh = (x, y) => ((x & 1) === 0 && (y & 1) === 0 ? 0x8a827b : 0xb6aea6);
const GLOVE = {
  skin: 0x08090b, edge: 0x3a3c40,
  finger: gloveMesh, fingerLight: 0xb6aea6, fingerShade: 0x8a827b,
  knuckle: (r, g, x, y) => plus(r, x, y, 0xa8a29c),
  back: (r, g, oy) => r.rect(10, oy + 25, 13, 5, gloveMesh),
  cuff: (r, g, oy) => {
    r.rect(9, oy + 33, 15, 3, gloveMesh);
    r.rect(9, oy + 35, 15, 1, 0x3a3c40);
  },
  gunCuff: r => r.rect(23, 27, 7, 3, gloveMesh),
};

// Demoníaca: pele vermelha escamada, garras pretas, espinhos de osso nos nós e rachaduras em brasa.
const DEMON_EMBER = 0xb83a12, DEMON_GLOW = 0xff7a20, CHAR = 0x1a0a08;
const DEMON = {
  skin: 0x3e0a0c, edge: 0x1e0406,
  finger: (x, y) => ((x + y) % 3 === 0 ? 0x6e1612 : 0x96261a), fingerLight: 0xa8301e, fingerShade: 0x6e1612,
  claw: { color: 0x1a1214, tip: 0xb8a8a4, shine: 0x6a5a5e },
  knuckle: (r, g, x, y) => {
    r.rect(x, y, 2, 2, 0xc8b898);
    r.rect(x, y + 2, 2, 1, 0x1e0406);
    r.put(x, y - 1, 0xe8dcc0);
    r.put(x + 1, y - 1, 0xc8b898);
    r.put(x, y - 2, 0xf4ecd8);
  },
  back: (r, g, oy) => {
    crack(r, g, [[11, oy + 22], [14, oy + 25], [13, oy + 28], [17, oy + 30]], DEMON_EMBER, DEMON_GLOW);
    crack(r, g, [[21, oy + 21], [20, oy + 25], [24, oy + 27]], DEMON_EMBER, DEMON_GLOW);
  },
  cuff: (r, g, oy) => {
    r.rect(9, oy + 33, 15, 3, CHAR);
    for (const [x, y] of [[11, 34], [15, 33], [18, 35], [22, 34]]) {
      r.put(x, oy + y, 0xc84a18);
      g.put(x, oy + y, 0xff8a30);
    }
  },
  gunBack: (r, g) => crack(r, g, [[17, 6], [20, 12], [19, 18], [23, 22]], DEMON_EMBER, DEMON_GLOW),
  gunCuff: (r, g) => {
    r.rect(23, 27, 7, 3, CHAR);
    for (const [x, y] of [[25, 28], [28, 29]]) {
      r.put(x, y, 0xc84a18);
      g.put(x, y, 0xff8a30);
    }
  },
  // Brasa que respira e tremula.
  pulse: t => (0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 3.1))) * (0.8 + 0.2 * Math.sin(t * 11.3)),
};

// Lobisomem: pelo marrom em mechas, garras de marfim, tufos saindo da silhueta e a manga de flanela rasgada.
const FUR_LIGHT = 0x7a5432, FUR_MID = 0x5a3a20, FUR_DARK = 0x1e1208;
const plaid = (x, y) => (x % 4 === 0 || y % 3 === 0 ? 0x4a0e0e : 0x8a2020);
// Mechas em diagonal (curtas, quebradas a cada 4 linhas) em vez de pontos soltos.
const strand = (x, y, slope) => (x * 2 + y * slope + (y >> 2) * 3) % 6;
const WEREWOLF = {
  skin: (x, y) => { const d = strand(x, y, 1); return d === 0 ? FUR_MID : d === 1 && (y & 3) < 2 ? 0x462c16 : 0x2e1c0e; },
  edge: FUR_DARK,
  finger: (x, y) => { const d = strand(x, y, -1); return d === 0 ? FUR_LIGHT : d === 1 ? 0x4a301a : 0x6a4628; },
  fingerLight: FUR_LIGHT, fingerShade: 0x4a301a,
  claw: { color: 0xd8d0b8, tip: 0xf4f0e0, shine: 0xf4f0e0 },
  knuckle: (r, g, x, y) => {
    r.put(x, y, FUR_LIGHT);
    r.put(x + 1, y - 1, FUR_LIGHT);
    r.put(x + 1, y, FUR_MID);
  },
  back: (r, g, oy) => {
    // tufos que escapam do contorno da mão
    for (const [x, y] of [[0, 18], [0, 21], [1, 23], [3, 27], [5, 29], [7, 31], [29, 23], [29, 25], [28, 27], [26, 30], [24, 33]]) r.put(x, oy + y, FUR_MID);
    for (const [x, y] of [[2, 25], [4, 28], [27, 28], [25, 31]]) r.put(x, oy + y, FUR_DARK);
    for (const [x, y] of [[12, 24], [17, 26], [21, 23], [14, 29]]) r.rect(x, oy + y, 1, 2, FUR_LIGHT);
  },
  cuff: (r, g, oy) => {
    r.rect(9, oy + 33, 15, 3, plaid);
    for (const x of [10, 13, 14, 18, 21]) r.put(x, oy + 35, CLEAR);
    for (const x of [11, 16, 20]) r.put(x, oy + 32, FUR_MID);
  },
  gunBack: r => {
    for (const [x, y] of [[13, 5], [31, 14], [30, 20], [24, 28], [13, 22]]) r.put(x, y, FUR_MID);
    for (const [x, y] of [[20, 8], [25, 12], [22, 18]]) r.rect(x, y, 1, 2, FUR_LIGHT);
  },
  gunCuff: r => {
    r.rect(23, 27, 7, 3, plaid);
    r.put(24, 29, CLEAR);
    r.put(27, 29, CLEAR);
  },
};

// Android: chapas de metal, dedos segmentados, LEDs nos nós e anel hidráulico com faixa de luz.
const PLATE_LINE = 0x14181d, RIVET = 0x7a848e, LED = 0x2a90b0, LED_GLOW = 0x60f0ff;
const ring = x => (x % 3 === 0 ? 0x3a424c : RIVET);
const ANDROID = {
  skin: 0x2a3038, edge: 0x5a646e,
  finger: (x, y) => (y % 3 === 0 ? 0x4a525c : (x & 1 ? 0x9aa4ae : 0x8a949e)), fingerLight: 0xa8b2bc, fingerShade: 0x5a646e,
  knuckle: (r, g, x, y) => {
    r.rect(x - 1, y - 1, 4, 4, PLATE_LINE);
    r.rect(x, y, 2, 2, LED);
    g.rect(x, y, 2, 2, LED_GLOW);
  },
  back: (r, g, oy) => {
    r.rect(3, oy + 22, 26, 1, PLATE_LINE);
    r.rect(16, oy + 22, 1, 11, PLATE_LINE);
    for (const [x, y] of [[6, 25], [25, 25], [12, 30], [20, 30]]) r.put(x, oy + y, RIVET);
  },
  cuff: (r, g, oy) => {
    r.rect(9, oy + 33, 15, 3, ring);
    r.rect(10, oy + 34, 13, 1, 0x1a6078);
    g.rect(10, oy + 34, 13, 1, 0x40c8f0);
  },
  gunBack: r => {
    r.line(15, 14, 29, 12, PLATE_LINE);
    r.put(20, 7, RIVET);
    r.put(26, 20, RIVET);
  },
  gunCuff: (r, g) => {
    r.rect(23, 27, 7, 3, ring);
    r.rect(24, 28, 5, 1, 0x1a6078);
    g.rect(24, 28, 5, 1, 0x40c8f0);
  },
  // Luz estável que oscila devagar e de vez em quando pisca apagando.
  pulse: t => (t % 3.7 < 0.09 ? 0 : 0.7 + 0.3 * Math.sin(t * 2)),
};

// Fantasma: pálido e translúcido, com um halo frio e o punho se desfazendo em fiapos.
const GHOST_FINGER = (x, y) => ((x + y) & 1 ? 0xd4ecf4 : 0xbcd8e4);
const GHOST = {
  skin: 0x6a8a9c, edge: 0x4a6a7c,
  finger: GHOST_FINGER, fingerLight: 0xe4f6fa, fingerShade: 0xa0c0d0,
  knuckle: (r, g, x, y) => r.rect(x, y, 2, 2, 0x8aaabc),
  back: (r, g, oy) => {
    g.poly(FIST_OUTLINE.map(([x, y]) => [x, y + oy]), 0x183848);
    r.rect(6, oy + 14, 1, 10, 0x8aaabc);
  },
  cuff: (r, g, oy) => {
    for (let x = 9; x < 24; x++) {
      const length = 1 + ((x * 7) % 3);
      for (let y = 0; y < length; y++) if (y < 2 || (x & 1)) r.put(x, oy + 33 + y, y === 0 ? 0xbcd8e4 : 0x8aaabc);
    }
  },
  gunBack: (r, g) => g.poly(GUN_PALM, 0x183848),
  gunCuff: r => {
    for (let x = 23; x < 30; x++) for (let y = 27; y < 27 + 1 + ((x * 5) % 3); y++) r.put(x, y, y === 27 ? 0xbcd8e4 : 0x8aaabc);
  },
  pulse: t => 0.7 + 0.3 * Math.sin(t * 1.6),
  // Some e volta: respira devagar e às vezes falha por um instante.
  alpha: t => 0.62 + 0.12 * Math.sin(t * 2.2) - (Math.sin(t * 7.3) * Math.sin(t * 2.9) > 0.92 ? 0.3 : 0),
};

export const HAND_STYLES = { glove: GLOVE, demon: DEMON, werewolf: WEREWOLF, android: ANDROID, ghost: GHOST };
const styleOf = id => HAND_STYLES[id] ?? GLOVE;

// Punho visto de costas com os dedos para cima. O polegar fica à esquerda (mão direita).
const FIST_OUTLINE = [[0, 15], [3, 10], [9, 9], [30, 9], [30, 21], [26, 29], [23, 33], [10, 33], [3, 25], [1, 19]];
const FINGERS = [[9, 15], [16, 21], [22, 26], [27, 30]];

function fistClaw(r, x0, x1, oy, { color, tip, shine }) {
  const c = Math.floor((x0 + x1 - 1) / 2);
  r.put(c, oy, tip);
  r.rect(c - 1, oy + 1, 2, 1, color);
  r.rect(c - 1, oy + 2, 3, 2, color);
  r.rect(c - 1, oy + 1, 1, 2, shine);
}

function plotFist(r, g, oy, s) {
  const at = pts => pts.map(([x, y]) => [x, y + oy]);
  r.poly(at(FIST_OUTLINE), s.skin);

  // dedos (com garras, a ponta de cada um vira unha)
  const top = s.claw ? oy + 2 : oy;
  for (const [x0, x1] of FINGERS) {
    r.rect(x0, top + 1, x1 - x0, oy + 10 - (top + 1), s.finger);
    r.rect(x0, top, x1 - x0, 1, s.edge);
    if (s.claw) fistClaw(r, x0, x1, oy, s.claw);
  }
  for (const x of [15, 21, 26]) r.rect(x, oy + 9, 1, 4, s.edge);

  // polegar
  r.poly(at([[1, 15], [2, 12], [8, 5], [9, 5], [9, 9], [3, 11]]), s.finger);
  if (s.claw) {
    r.put(9, oy + 3, s.claw.tip);
    r.rect(8, oy + 4, 2, 1, s.claw.color);
  }

  for (const x of [10, 16, 22, 27]) s.knuckle(r, g, x, oy + 18);
  s.back?.(r, g, oy);
  s.cuff(r, g, oy);
}

// Pinta em duas camadas (cor e brilho) e devolve a cor com o brilho pendurado em `glow`, se houver.
function paint(width, height, plot) {
  const r = new Raster(width, height), g = new Raster(width, height);
  let glowed = false;
  const put = g.put.bind(g);
  g.put = (x, y, color) => { glowed = true; put(x, y, color); };
  plot(r, g);
  const image = r.commit();
  if (glowed) image.glow = g.commit();
  return image;
}

function mirrored(source) {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  ctx.translate(source.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(source, 0, 0);
  return canvas;
}

const paintRightFist = s => paint(31, 36, (r, g) => plotFist(r, g, 0, s));

function paintLeftFist(s) {
  const right = paintRightFist(s), left = mirrored(right);
  if (right.glow) left.glow = mirrored(right.glow);
  return left;
}

// Punho segurando munição acima dos dedos, para a recarga: 'round', 'shell', 'magazine', 'bolt' (flecha) ou 'grenade'.
function paintFistHolding(kind, s) {
  const top = kind === 'magazine' ? 18 : kind === 'bolt' ? 14 : kind === 'grenade' ? 13 : 10;
  return paint(31, 36 + top, (r, g) => {
    if (kind === 'round') {
      r.rect(13, 0, 5, 7, 0xc08438);
      r.rect(13, 0, 1, 7, 0xe0a858);
      r.rect(13, 7, 5, 6, 0x9a9088);
      r.rect(17, 7, 1, 6, 0x6a625c);
    } else if (kind === 'bolt') {
      // flecha incendiária ainda apagada: o trapo só pega fogo quando ela está armada
      r.rect(14, 4, 3, 14, 0x9a8a6a);
      r.poly([[13, 4], [18, 4], [15.5, 0]], 0xd8d8dc);
      r.rect(13, 5, 5, 5, 0x6a4a2a);
      r.rect(13, 7, 5, 1, 0x3a2614);
      r.poly([[14, 17], [10, 20], [14, 20]], 0xc84a30);
      r.poly([[17, 17], [21, 20], [17, 20]], 0xc84a30);
    } else if (kind === 'grenade') {
      r.ellipse(15.5, 5, 5, 5, 0x6a7638);
      r.ellipse(14.5, 4, 2, 2, 0x8a9a4a);
      r.rect(11, 6, 10, 2, 0xd8b040);
      r.rect(11, 8, 10, 5, 0xc8a040);
      r.rect(11, 8, 1, 5, 0xe8c060);
    } else if (kind === 'shell') {
      r.rect(12, 0, 7, 9, 0xa02418);
      r.rect(12, 0, 1, 9, 0xd04830);
      r.rect(12, 9, 7, 3, 0xc09a4a);
    } else {
      r.poly([[11, 0], [20, 0], [19, 22], [12, 22]], 0x1a1a1e);
      r.rect(12, 0, 1, 22, 0x4a4a52);
    }
    plotFist(r, g, top, s);
  });
}

// Mão na coronha, vista pelo lado do revólver: dedos enrolados e indicador no gatilho.
const GUN_PALM = [[12, 4], [24, 2], [30, 10], [31, 25], [23, 30], [14, 24]];

function paintGunHand(triggerPulled, s) {
  return paint(32, 34, (r, g) => {
    r.poly(GUN_PALM, s.skin);
    r.poly([[24, 2], [30, 10], [31, 25], [30, 25], [29, 11], [23, 3]], s.edge);
    s.gunBack?.(r, g);

    // polegar sobre a armação
    r.poly([[8, 3], [22, 0], [27, 5], [12, 8]], s.finger);
    r.line(8, 3, 22, 0, s.edge);

    // indicador no gatilho
    const [tx, ty] = triggerPulled ? [5, 13] : [2, 10];
    r.line(15, 9, tx, ty, s.fingerLight, 3);
    r.line(15, 11, tx, ty + 1, s.fingerShade);
    if (s.claw) {
      r.rect(tx - 2, ty, 2, 2, s.claw.color);
      r.rect(tx - 2, ty, 2, 1, s.claw.shine);
      r.put(tx - 3, ty + 1, s.claw.tip);
    }

    // três dedos enrolados na coronha, as pontas para a esquerda
    for (const [x0, x1, y] of [[7, 21, 12], [9, 23, 18], [11, 25, 24]]) {
      r.rect(x0, y, x1 - x0, 5, s.finger);
      r.rect(x0, y + 5, x1 - x0, 1, typeof s.skin === 'function' ? s.edge : s.skin);
      r.rect(x1, y, 1, 5, s.edge);
      if (s.claw) {
        r.rect(x0 - 2, y + 1, 2, 3, s.claw.color);
        r.rect(x0 - 2, y + 1, 2, 1, s.claw.shine);
        r.put(x0 - 3, y + 3, s.claw.tip);
      }
    }

    s.knuckle(r, g, 26, 14);
    s.gunCuff(r, g);
  });
}

// Todas as imagens de um estilo de mão, mais o jeito de desenhar (transparência e pulso do brilho).
export function paintHandSet(styleId) {
  const s = styleOf(styleId);
  return {
    leftFist: paintLeftFist(s),
    rightFist: paintRightFist(s),
    fists: Object.fromEntries(['round', 'shell', 'magazine', 'bolt', 'grenade'].map(kind => [kind, paintFistHolding(kind, s)])),
    gunHand: paintGunHand(false, s),
    gunHandFiring: paintGunHand(true, s),
    alpha: s.alpha ?? (() => 1),
    pulse: s.pulse ?? (() => 1),
  };
}

// Desenha uma imagem de mão com o brilho somado por cima. O contexto já deve estar posicionado.
export function drawHandImage(ctx, image, x, y, alpha, glow) {
  ctx.globalAlpha = alpha;
  ctx.drawImage(image, x, y);
  if (image.glow && glow > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha * glow;
    ctx.drawImage(image.glow, x, y);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = 1;
}

// Miniatura da garagem: o punho direito com o brilho aceso.
export function handThumb(styleId) {
  const s = styleOf(styleId), fist = paintRightFist(s);
  const canvas = document.createElement('canvas');
  canvas.width = fist.width;
  canvas.height = fist.height;
  drawHandImage(canvas.getContext('2d'), fist, 0, 0, s.alpha ? 0.75 : 1, 1);
  return canvas;
}
