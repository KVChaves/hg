import { CLEAR } from '../../art/raster.js';
import { dither } from '../../art/shade.js';
import { ctxBox, layerOf } from './gunPaint.js';

// Pistolas de ferrolho e fuzis de pente. Mesmas convenções de gunArt.js: o cano aponta para a esquerda e os pontos são
// pixels da imagem. As duas se movem como a submetralhadora (gunAnimator.js, `smg`): o ferrolho (`pose.bolt`) recua a
// cada tiro e trava aberto sem munição, e o pente (`pose.magDrop`) cai e volta inteiro na recarga.
// `magazineBase`: o fundo do pente (x, y, largura), onde o carregador estendido ganha mais um gomo (gunParts.js).

const BRASS = 0xd0a040, BRASS_DARK = 0x8a5a20;

// Pistola: ferrolho com serrilha, armação com guarda-mato, cabo inclinado e pente que sai por baixo do cabo.
// A Desert Eagle é a mesma pistola maior, de aço polido, com o ferrolho alto e liso; a CZ75 leva um pente de reserva
// pendurado na frente, como empunhadura.
export function buildPistol(custom, m, type) {
  const heavy = type?.id === 'deagle', k = heavy ? 1.22 : 1, accessory = custom.options.accessory;
  const s = v => Math.round(v * k);
  const W = s(58), H = s(52), SLIDE_TRAVEL = s(6);
  const rect = (r, x, y, w, h, c) => r.rect(s(x), s(y), Math.max(1, s(w)), Math.max(1, s(h)), c);
  const poly = (r, points, c) => r.poly(points.map(([x, y]) => [s(x), s(y)]), c);
  const magazine = { x: s(43), y: s(47), w: s(10) };
  return {
    size: [W, H], pivot: [s(40), s(22)], muzzle: [0, s(13)], hand: [s(46), s(32)], load: [s(47), s(45)], eject: [s(26), s(9)],
    carry: 'magazine', casing: 'round', flashSize: heavy ? 1.5 : 0.8, smoke: heavy ? 1.4 : 0.5,
    recoil: heavy ? { back: 4, up: 14, tilt: 0.46, stiffness: 190, damping: 12 } : { back: 3, up: 6, tilt: 0.18, stiffness: 300, damping: 20 },
    reload: { x: 494, y: 206, angle: -0.25 },
    magazineBase: magazine,
    layers: [
      // pente: fica escondido dentro do cabo, só a base aparece embaixo
      {
        isMagazine: true,
        image: layerOf(W, H, r => {
          poly(r, [[38, 26], [46, 25], [53, 45], [44, 48]], m.steel(0.45));
          rect(r, 42, 46, 12, 2, m.metal[1]);
          rect(r, 42, 46, 12, 1, m.metal[3]);
          for (let y = 30; y < 44; y += 4) rect(r, 42 + (y - 30) * 0.3, y, 3, 1, BRASS);
        }),
        pose: p => ({ dy: p.magDrop * s(30), hidden: p.magDrop >= 1 }),
      },
      { image: layerOf(W, H, r => {
        // cabo
        poly(r, [[34, 22], [46, 21], [54, 44], [43, 47], [38, 30]], (x, y) => dither(x, y, 0.7 - (x - s(34)) / 50 - (y - s(21)) / 80, m.grip, 0.9));
        for (let i = 0; i < 4; i++) r.line(s(40 + i * 2), s(27 + i), s(45 + i * 2), s(42 + i), m.grip[0]);
        // armação: trilho embaixo do ferrolho, corpo e guarda-mato
        rect(r, 4, 18, 32, 4, m.steel(0.5));
        rect(r, 4, 21, 32, 1, m.metal[0]);
        poly(r, [[30, 17], [47, 17], [46, 24], [30, 24]], m.steel(0.55));
        r.ring(s(28), s(25), 5.5 * k, 4.2 * k, m.metal[2]);
        r.line(s(29), s(22), s(27), s(27), m.metal[1], 2);
        if (!heavy) {
          // pente de reserva na frente
          poly(r, [[15, 22], [21, 22], [21, 36], [15, 37]], m.steel(0.42));
          rect(r, 14, 36, 8, 2, m.metal[1]);
          rect(r, 15, 22, 1, 14, m.metal[3]);
        }
        if (accessory === 'laser') {
          rect(r, 3, 22, 11, 4, 0x18181c);
          rect(r, 3, 22, 11, 1, 0x4a4a52);
          rect(r, 2, 23, 1, 2, 0xe02018);
        }
      }) },
      // ferrolho: corre para trás a cada tiro
      {
        image: layerOf(W, H, r => {
          rect(r, 0, heavy ? 7 : 9, 46, heavy ? 11 : 9, m.steel(heavy ? 0.82 : 0.7));
          rect(r, 0, heavy ? 7 : 9, 46, 1, m.metal[4]);
          rect(r, 0, 17, 46, 1, m.metal[0]);
          if (heavy) {
            rect(r, 0, 11, 40, 1, m.metal[1]);          // a quina do ferrolho triangular
            for (let x = 38; x < 45; x += 3) rect(r, x, 9, 1, 7, m.metal[1]);
          } else {
            for (let x = 33; x < 44; x += 2) rect(r, x, 11, 1, 5, m.metal[1]);
          }
          rect(r, 22, heavy ? 8 : 10, 9, 2, 0x08080a);  // janela de ejeção
          rect(r, 2, heavy ? 5 : 7, 2, 2, m.metal[1]);   // massa de mira
          rect(r, 40, heavy ? 5 : 7, 4, 2, m.metal[1]);  // alça de mira
          rect(r, 0, 12, 1, 3, 0x050506);
          if (accessory === 'compensator') {
            rect(r, 0, heavy ? 7 : 9, 7, heavy ? 11 : 9, m.steel(0.4));
            for (const x of [1, 3, 5]) rect(r, x, heavy ? 7 : 9, 1, 3, 0x000000);
          }
        }),
        pose: p => ({ dx: p.bolt * SLIDE_TRAVEL }),
      },
      // cão
      {
        image: layerOf(W, H, r => {
          poly(r, [[44, 10], [47, 5], [50, 6], [48, 12]], m.metal[1]);
          rect(r, 46, 5, 3, 1, m.metal[3]);
        }),
        pose: p => ({ dx: p.bolt * SLIDE_TRAVEL, angle: p.hammer * 0.4, px: s(47), py: s(12) }),
      },
    ],
  };
}

// Visual de cada fuzil: corpo, cano, pente e coronha mudam; o mecanismo é o mesmo. `recoil` (opcional): tranco
// próprio na mão (gunRig.DEFAULT_RECOIL); sem ele, o dos fuzis.
const ASSAULT = {
  // AK-47: madeira na coronha e no guarda-mão, tubo de gás em cima do cano, pente curvo para a frente.
  // Tranco próprio: o cartucho mais forte dos fuzis numa mola mais mole, que joga a arma para trás e para cima,
  // inclina mais e demora a assentar, tremendo um pouco.
  ak47: {
    recoil: { back: 9, up: 11, tilt: 0.3, stiffness: 230, damping: 15, shake: 0.6 },
    pivot: [86, 20], hand: [92, 32], load: [60, 44], eject: [72, 12], muzzle: [0, 15],
    magazine: [[60, 23], [72, 23], [70, 34], [63, 46], [52, 44], [58, 33]], magazineBase: { x: 52, y: 45, w: 12 },
    bolt: { x: 84, y: 12, w: 6, h: 3 },
  },
  // M4A4: polímero preto, trilho em cima com massa de mira em A, coronha de tubo e pente quase reto.
  m4a4: {
    pivot: [86, 20], hand: [90, 32], load: [64, 42], eject: [74, 13], muzzle: [0, 15],
    magazine: [[60, 24], [71, 24], [70, 41], [59, 43]], magazineBase: { x: 59, y: 43, w: 12 },
    bolt: { x: 70, y: 13, w: 12, h: 3 },
  },
  // AUG: bullpup verde de corpo inteiriço, luneta embutida, empunhadura dianteira e pente translúcido atrás do cabo.
  aug: {
    pivot: [66, 20], hand: [68, 32], load: [90, 42], eject: [102, 14], muzzle: [0, 15],
    magazine: [[84, 26], [96, 26], [96, 41], [86, 43]], magazineBase: { x: 85, y: 43, w: 12 },
    bolt: { x: 48, y: 9, w: 8, h: 2 },
  },
};

export function buildAssault(custom, m, type) {
  const id = ASSAULT[type?.id] ? type.id : 'ak47', look = ASSAULT[id], accessory = custom.options.accessory;
  const W = 140, H = 50, [, my] = look.muzzle;
  const suppressed = accessory === 'suppressor';

  function barrel(r, from, to) {
    r.rect(from, my - 1, to - from, 4, m.steel(0.72));
    r.rect(from, my - 1, to - from, 1, m.metal[4]);
    r.rect(from, my + 2, to - from, 1, m.metal[0]);
    if (suppressed) {
      r.rect(0, my - 4, 22, 10, m.steel(0.4));
      r.rect(0, my - 4, 22, 1, m.metal[3]);
      for (let x = 3; x < 20; x += 4) r.rect(x, my - 3, 1, 8, m.metal[0]);
    } else {
      r.rect(0, my - 2, 5, 6, m.steel(0.5));          // quebra-chamas
      r.rect(1, my - 1, 1, 4, 0x000000);
      r.rect(3, my - 1, 1, 4, 0x000000);
    }
  }

  function sling(r, a, b) {
    if (accessory !== 'sling') return;
    r.line(a[0], a[1], b[0], b[1], 0x4a3218, 2);
    r.line(a[0], a[1] - 1, b[0], b[1] - 1, 0x6a4a2a, 1);
  }

  const bodies = {
    ak47: r => {
      r.poly([[96, 12], [138, 16], [139, 33], [126, 35], [98, 24]], m.wood(0.8, 96));                // coronha
      r.rect(136, 16, 3, 18, m.grip[0]);
      r.poly([[84, 22], [94, 21], [100, 40], [90, 42], [86, 30]], m.wood(0.6, 84));                  // cabo
      r.ring(78, 26, 5, 3.8, m.metal[2]);
      r.line(79, 23, 77, 28, m.metal[1], 2);
      r.poly([[54, 9], [98, 10], [98, 24], [54, 24]], m.steel(0.6));                                 // caixa da culatra
      r.rect(56, 8, 40, 2, m.metal[3]);
      r.rect(66, 12, 14, 4, 0x08080a);
      for (const x of [58, 94]) r.disc(x, 21, 1, m.metal[4]);
      r.line(82, 18, 92, 16, m.metal[1], 2);                                                         // seletor
      r.rect(54, 6, 7, 3, m.metal[1]);                                                               // alça de mira
      barrel(r, 4, 32);
      r.poly([[28, 12], [54, 12], [54, 23], [30, 22]], m.wood(0.72, 28));                            // guarda-mão
      for (let x = 33; x < 52; x += 4) r.rect(x, 15, 2, 5, m.grip[1]);
      r.rect(20, 9, 34, 3, m.wood(0.85, 20));                                                        // tubo de gás
      r.rect(20, 9, 34, 1, m.grip[4]);
      r.rect(5, 6, 3, my - 6, m.metal[1]);                                                           // massa de mira
      r.rect(4, my - 3, 6, 3, m.metal[2]);
      sling(r, [128, 30], [40, 26]);
    },
    m4a4: r => {
      r.rect(98, 12, 20, 5, m.steel(0.5));                                                           // tubo da coronha
      r.poly([[114, 9], [138, 12], [138, 30], [126, 29], [114, 19]], m.wood(0.55, 114));             // coronha
      r.poly([[120, 13], [132, 14], [132, 20], [122, 19]], CLEAR);
      r.rect(136, 12, 3, 18, m.grip[0]);
      r.poly([[82, 22], [92, 21], [97, 40], [88, 42], [84, 30]], m.wood(0.5, 82));                   // cabo
      r.ring(76, 27, 5, 3.8, m.metal[2]);
      r.line(77, 24, 75, 29, m.metal[1], 2);
      r.poly([[54, 9], [98, 9], [98, 25], [54, 25]], m.steel(0.62));                                 // culatra
      r.rect(54, 9, 44, 1, m.metal[4]);
      r.rect(54, 17, 44, 1, m.metal[1]);
      r.rect(70, 12, 14, 5, 0x08080a);                                                               // janela de ejeção
      r.rect(56, 6, 40, 3, m.metal[2]);                                                              // trilho
      for (let x = 57; x < 95; x += 3) r.put(x, 6, m.metal[0]);
      r.rect(90, 2, 5, 4, m.metal[1]);                                                               // alça de mira
      r.rect(91, 3, 3, 1, m.metal[4]);
      barrel(r, 4, 26);
      r.rect(24, 10, 32, 11, m.steel(0.5));                                                          // guarda-mão
      r.rect(24, 10, 32, 1, m.metal[3]);
      for (let x = 27; x < 54; x += 4) { r.rect(x, 13, 2, 2, 0x08080a); r.rect(x + 2, 17, 2, 2, 0x08080a); }
      r.poly([[13, 12], [16, 3], [19, 3], [21, 12]], m.metal[1]);                                    // massa de mira em A
      r.rect(16, 1, 2, 3, m.metal[2]);
      sling(r, [126, 26], [34, 22]);
    },
    aug: r => {
      r.poly([[40, 9], [124, 10], [134, 16], [134, 32], [110, 33], [98, 26], [52, 25], [40, 21]], m.steel(0.6));   // corpo
      r.rect(40, 9, 84, 1, m.metal[4]);
      r.rect(132, 16, 2, 16, m.grip[0]);
      r.rect(100, 12, 12, 4, 0x08080a);                                                              // janela de ejeção
      r.poly([[60, 24], [70, 23], [74, 41], [65, 43], [61, 32]], m.wood(0.55, 60));                  // cabo
      r.line(52, 25, 58, 43, m.metal[2], 2);                                                         // guarda da mão inteira
      r.line(58, 43, 66, 44, m.metal[2], 2);
      r.ring(70, 27, 4, 3, m.metal[1]);
      barrel(r, 4, 42);
      r.poly([[30, 18], [36, 18], [36, 36], [31, 36]], m.wood(0.5, 30));                             // empunhadura dianteira
      r.rect(30, 36, 7, 2, m.grip[0]);
      // luneta embutida
      r.rect(46, 1, 40, 7, (x, y) => dither(x, y, 0.5 - (y - 1) / 12, m.metal, 0.8));
      r.rect(46, 1, 40, 1, m.metal[4]);
      r.poly([[40, 0], [47, 1], [47, 8], [40, 9]], m.metal[1]);
      r.disc(42, 4, 2, 0x2a5a88);
      r.put(41, 3, 0x6ab0e8);
      r.rect(56, 8, 4, 2, m.metal[2]);
      r.rect(76, 8, 4, 2, m.metal[2]);
      sling(r, [126, 30], [38, 22]);
    },
  };

  return {
    size: [W, H], pivot: look.pivot, muzzle: look.muzzle, hand: look.hand, load: look.load, eject: look.eject,
    carry: 'magazine', casing: 'long', flashSize: suppressed ? 0.35 : 1.15, smoke: suppressed ? 0.25 : 0.9,
    recoil: look.recoil ?? { back: 6, up: 6, tilt: 0.16, stiffness: 300, damping: 20 },
    reload: { x: 496, y: 198, angle: -0.3 },
    magazineBase: look.magazineBase,
    layers: [
      { image: layerOf(W, H, bodies[id]) },
      // pente
      {
        isMagazine: true,
        image: layerOf(W, H, r => {
          const clear = id === 'aug';                // o pente da AUG é translúcido: as balas aparecem
          r.poly(look.magazine, clear ? 0x3a4038 : m.steel(0.5));
          const [[x0, y0]] = look.magazine, { x, y, w } = look.magazineBase;
          r.rect(x, y, w, 2, m.metal[1]);
          if (clear) for (let yy = y0 + 3; yy < y - 1; yy += 3) { r.rect(x0 + 3, yy, 7, 2, BRASS); r.put(x0 + 3, yy + 1, BRASS_DARK); }
          else for (let yy = y0 + 4; yy < y - 2; yy += 5) r.rect(x0 + 2 - (yy - y0) * 0.15, yy, 8, 1, m.metal[0]);
        }),
        pose: p => ({ dy: p.magDrop * 30, hidden: p.magDrop >= 1 }),
      },
      // ferrolho (ou alavanca de armar), que recua a cada tiro
      {
        image: layerOf(W, H, r => {
          const { x, y, w, h } = look.bolt;
          r.rect(x, y, w, h, m.metal[3]);
          r.rect(x, y, w, 1, m.metal[4]);
          r.rect(x + w - 2, y, 2, h, m.metal[1]);
        }),
        pose: p => ({ dx: p.bolt * 7 }),
      },
      // lampejo da lente da AUG de tempos em tempos
      ...(id === 'aug' ? [{
        pose: p => ({ hidden: p.t % 3.8 > 0.2 }),
        paint: ctx => ctxBox(ctx, 0xffffff, 41, 3, 1, 1),
      }] : []),
    ],
  };
}
