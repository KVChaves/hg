import { hash } from '../../art/shade.js';

// Peças de combate (game/weaponParts.js) desenhadas por cima da arma já montada. Cada peça é pintada na camada onde
// ela fica presa, então acompanha a animação: o compensador sobe com os canos da escopeta, a fita do carregador cai
// junto com o pente. As camadas são canvas novos a cada montagem, então pintar nelas não estraga nada.
//
// Cano e cabo são achados sozinhos (a boca está em `art.muzzle` e a mão em `art.hand`); o resto tem lugar por arma:
//   belt     cinto de munição: início (x, y) da tira, quantas cabem, o ponto (`on`) da camada onde ela fica presa e o
//            tipo do que vai nela (balas, cartuchos de escopeta, granadas ou flechas)
//   tag      etiqueta colorida da munição (perfurante, ponta oca, impacto)
//   quick    onde vai a fita do carregador rápido, quando a entrada da munição (`art.load`) fica fora da arma
//   heavy    reforço do cano pesado, quando a boca não é um cano (a besta)
//   pad      soleira de borracha do apoio, quando a mão não segura um cabo (a do rifle fica na alavanca)
//   extend   desenho próprio do pente estendido
const SPOTS = {
  revolver: { belt: { x: 9, y: 23, count: 5, on: [12, 21], kind: 'rounds' }, tag: [46, 15] },
  shotgun: { belt: { x: 30, y: 29, count: 6, on: [32, 25], kind: 'shells' }, tag: [64, 18] },
  smg: { belt: { x: 9, y: 21, count: 4, on: [12, 19], kind: 'rounds' }, tag: [41, 46], quick: [42, 54], extend: extendSmg },
  rifle: { belt: { x: 102, y: 17, count: 6, on: [104, 20], kind: 'rounds' }, tag: [73, 18], pad: { x: 132, y: 14, w: 5, h: 20 }, extend: extendRifle },
  magnum: { belt: { x: 8, y: 23, count: 6, on: [10, 20], kind: 'rounds' }, tag: [47, 26] },
  sniper: { belt: { x: 144, y: 19, count: 6, on: [146, 22], kind: 'rounds' }, tag: [112, 26] },
  autoshotgun: { belt: { x: 12, y: 22, count: 6, on: [14, 19], kind: 'shells' }, tag: [60, 20] },
  crossbow: { belt: { x: 62, y: 37, count: 4, on: [66, 34], kind: 'bolts' }, tag: [62, 33], heavy: { x: 22, y: 31, w: 32, h: 4 } },
  grenade: { belt: { x: 36, y: 30, count: 4, on: [36, 27], kind: 'grenades' }, tag: [74, 22], quick: [60, 26] },
  heavymg: { belt: { x: 34, y: 24, count: 6, on: [36, 21], kind: 'rounds' }, tag: [103, 23], quick: [84, 30], extend: extendGatling },
};

const BRASS = [0x6a4a18, 0xb08030, 0xe0b850];
const SHELL = [0x6a1410, 0xa82418, 0xd04a30];
const GRENADE = [0x3a4224, 0x5c6a38, 0x8a9a58];
const BOLT = { shaft: 0x8a6a40, tip: 0xb8b8c0, fletch: 0xc02818 };
const TIP = { stock: 0xb08030, pierce: 0x18181c, hollow: 0xc0602a, impact: 0x2a78d8 };
const TAG = { pierce: [0x101012, 0xd8d8dc], hollow: [0x8a3a14, 0xe08a4a], impact: [0x14408a, 0x5aa8ff], tar: [0x101010, 0xff7a20] };
const LEATHER = [0x2a1a10, 0x4a2e1a];
const RUBBER = [0x141416, 0x28282c, 0x3e3e46];
const PULL_TAB = [0x8a2a08, 0xe0601c];
const SHORT_SHARE = 0.3, SHORT_MAX = 22;              // o cano curto corta até 30% do caminho da boca ao pivô
const GRIP_REACH = 12;                               // raio, em pixels, da empunhadura em volta da mão

const canvasesOf = layer => (layer.variants ? Object.values(layer.variants) : layer.image ? [layer.image] : []);

function opaqueAt(canvas, x, y) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return false;
  return canvas.getContext('2d').getImageData(x, y, 1, 1).data[3] > 0;
}

// Camada de cima que tem pixel em (x, y); procura um pouco para cima se o ponto cair no vazio (a carga do pente fica
// logo abaixo dele, por exemplo).
// `bottom`: a primeira camada de baixo para cima (a coronha, por exemplo, em vez de uma peça móvel por cima dela).
function layerAt(art, x, y, search = 0, bottom = false) {
  const order = bottom ? [...art.layers] : [...art.layers].reverse();
  for (let k = 0; k <= search; k++) {
    for (const layer of order) {
      const [canvas] = canvasesOf(layer);
      if (canvas && opaqueAt(canvas, x, y - k)) return layer;
    }
  }
  return null;
}

function paintOn(layer, paint) {
  for (const canvas of canvasesOf(layer ?? {})) paint(canvas.getContext('2d'), canvas);
}

const css = color => `#${color.toString(16).padStart(6, '0')}`;
function fill(ctx, color, x, y, w = 1, h = 1) {
  ctx.fillStyle = css(color);
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// Altura do cano na boca: as linhas com pixel na coluna logo atrás dela.
function barrelSpan(canvas, [mx, my]) {
  const x = mx + 2;
  if (!opaqueAt(canvas, x, my)) return { top: my - 2, bottom: my + 2 };
  let top = my, bottom = my;
  while (opaqueAt(canvas, x, top - 1)) top--;
  while (opaqueAt(canvas, x, bottom + 1)) bottom++;
  return { top, bottom };
}

// --- cano -------------------------------------------------------------------------------------------------------

function compensator(art, m) {
  const [mx] = art.muzzle, layer = layerAt(art, mx + 2, art.muzzle[1]);
  let vents = [];
  paintOn(layer, (ctx, canvas) => {
    const { top, bottom } = barrelSpan(canvas, art.muzzle), length = 9;
    fill(ctx, m.metal[1], mx, top - 1, length, bottom - top + 3);
    fill(ctx, m.metal[3], mx, top - 1, length, 1);
    fill(ctx, m.metal[0], mx, bottom + 1, length, 1);
    fill(ctx, m.metal[0], mx + length, top - 1, 1, bottom - top + 3);
    vents = [mx + 2, mx + 4, mx + 6];
    for (const vx of vents) fill(ctx, 0x000000, vx, top, 1, Math.max(2, Math.ceil((bottom - top) / 2)));
    art.portY = top;
  });
  // O fogo escapa para cima pelas janelas, como no revólver pesado (gunRig.drawPorted).
  art.ports = vents;
  art.flashStyle = 'ported';
  art.flashSize = (art.flashSize ?? 1) * 0.8;
}

function heavyBarrel(art, m, plate) {
  if (plate) {                                       // besta: placas de aço no trilho, com rebites
    const { x, y, w, h } = plate;
    paintOn(layerAt(art, x + 2, y + 1, 0, true), ctx => {
      fill(ctx, m.metal[1], x, y, w, h);
      fill(ctx, m.metal[3], x, y, w, 1);
      for (let rx = x + 2; rx < x + w - 1; rx += 6) fill(ctx, m.metal[4], rx, y + 1, 1, 1);
    });
    return;
  }
  const [mx, my] = art.muzzle, [px] = art.pivot, layer = layerAt(art, mx + 2, my);
  paintOn(layer, (ctx, canvas) => {
    const { top, bottom } = barrelSpan(canvas, art.muzzle), start = mx + 3, length = Math.min(30, Math.round((px - mx) * 0.45));
    fill(ctx, m.metal[2], start, top - 1, length, bottom - top + 3);
    fill(ctx, m.metal[4], start, top - 1, length, 1);
    fill(ctx, m.metal[0], start, bottom + 1, length, 1);
    for (let x = start + 2; x < start + length - 2; x += 4) fill(ctx, m.metal[1], x, top + 1, 2, Math.max(1, bottom - top - 1));   // estrias
    fill(ctx, m.metal[0], start + length, top - 1, 1, bottom - top + 3);
  });
}

// Cano curto: apaga a ponta em todas as camadas (mira, acessório do cano...) e a boca anda para trás.
function shortBarrel(art, m) {
  const [mx, my] = art.muzzle, cut = Math.round(Math.min(SHORT_MAX, (art.pivot[0] - mx) * SHORT_SHARE));
  const barrel = layerAt(art, mx + 2, my), [barrelCanvas] = canvasesOf(barrel ?? {});
  // A altura que some é a maior do trecho cortado (a ponta pode ser mais fina que a proteção do cano logo atrás).
  let top = my - 3, bottom = my + 3;
  if (barrelCanvas) {
    for (let x = mx; x <= mx + cut; x++) {
      const span = barrelSpan(barrelCanvas, [x - 2, my]);
      top = Math.min(top, span.top);
      bottom = Math.max(bottom, span.bottom);
    }
  }
  const gone = { x: 0, y: top - 6, w: mx + cut, h: bottom - top + 11 };              // leva a massa de mira junto
  for (const layer of art.layers) {
    paintOn(layer, ctx => ctx.clearRect(gone.x, gone.y, gone.w, gone.h));
    if (layer.paint) {                               // camadas desenhadas a cada quadro (os furos da capa): recorta o trecho
      const paint = layer.paint;
      layer.paint = (ctx, pose) => {
        ctx.save();
        ctx.beginPath();
        ctx.rect(-1000, -1000, 3000, 3000);
        ctx.rect(gone.x, gone.y, gone.w, gone.h);
        ctx.clip('evenodd');
        paint(ctx, pose);
        ctx.restore();
      };
    }
  }
  paintOn(barrel, (ctx, canvas) => {
    const end = barrelSpan(canvas, [mx + cut - 1, my]);
    fill(ctx, m.metal[0], mx + cut, end.top, 1, end.bottom - end.top + 1);
    fill(ctx, m.metal[4], mx + cut + 1, end.top, 1, 1);
  });
  art.muzzle = [mx + cut, my];
}

// Choke da escopeta; `flare` abre mais a boca (o calibre maior do lança-granadas).
function choke(art, m, flare = 0) {
  const [mx, my] = art.muzzle, layer = layerAt(art, mx + 2, my);
  paintOn(layer, (ctx, canvas) => {
    const { top, bottom } = barrelSpan(canvas, art.muzzle);
    fill(ctx, m.metal[1], mx, top - 1, 6 + flare, bottom - top + 3);
    for (let k = 0; k <= flare; k++) fill(ctx, m.metal[2], mx + k, top - 2 - flare + k, 2, bottom - top + 5 + (flare - k) * 2);   // boca alargada
    for (const x of [mx + 1, mx + 4 + flare]) fill(ctx, m.metal[4], x, top - 1, 1, bottom - top + 3);
  });
}

// --- empunhadura ------------------------------------------------------------------------------------------------

// Pinta só onde o cabo já tem pixel (source-atop), num círculo em volta da mão.
function firmGrip(art) {
  const [hx, hy] = art.hand;
  paintOn(layerAt(art, hx, hy), ctx => {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    for (let y = hy - GRIP_REACH; y <= hy + GRIP_REACH; y++) {
      for (let x = hx - GRIP_REACH; x <= hx + GRIP_REACH; x++) {
        if (Math.hypot(x - hx, y - hy) > GRIP_REACH) continue;
        fill(ctx, (x + y) % 3 === 0 ? RUBBER[1] : RUBBER[0], x, y);         // borracha com relevo em diagonal
      }
    }
    ctx.restore();
  });
}

// Apoio: só a metade de baixo do cabo ganha borracha, com uma base para a palma.
function steadyGrip(art) {
  const [hx, hy] = art.hand;
  paintOn(layerAt(art, hx, hy), ctx => {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    for (let y = hy; y <= hy + GRIP_REACH; y++) {
      for (let x = hx - GRIP_REACH; x <= hx + GRIP_REACH; x++) fill(ctx, y % 3 === 0 ? RUBBER[0] : RUBBER[1], x, y);
    }
    ctx.restore();
  });
}

function buttPad(art, { x, y, w, h }) {
  paintOn(layerAt(art, x - 2, y + h / 2, 0, true), ctx => {
    fill(ctx, RUBBER[0], x, y, w, h);
    for (let k = y + 1; k < y + h - 1; k += 3) fill(ctx, RUBBER[2], x + 1, k, w - 2, 1);
  });
}

// Cabo vazado: furos só onde há cabo em volta (não abre a borda).
function lightGrip(art) {
  const [hx, hy] = art.hand;
  paintOn(layerAt(art, hx, hy), (ctx, canvas) => {
    const solid = (x, y) => [-1, 0, 1, 2].every(dx => [-1, 0, 1, 2].every(dy => opaqueAt(canvas, x + dx, y + dy)));
    const holes = [];
    for (let y = hy - GRIP_REACH; y <= hy + GRIP_REACH; y += 4) {
      for (let x = hx - GRIP_REACH; x <= hx + GRIP_REACH; x += 4) if (Math.hypot(x - hx, y - hy) <= GRIP_REACH && solid(x, y)) holes.push([x, y]);
    }
    for (const [x, y] of holes) ctx.clearRect(x, y, 2, 2);
  });
}

// --- carregador -------------------------------------------------------------------------------------------------

function extendSmg(art, m) {
  paintOn(layerAt(art, 42, 50), ctx => {
    fill(ctx, m.metal[2], 36, 56, 11, 6);
    fill(ctx, m.metal[3], 37, 56, 2, 6);
    fill(ctx, m.metal[0], 40, 58, 7, 2);
    fill(ctx, m.metal[1], 35, 61, 13, 2);
  });
  art.load = [art.load[0], art.load[1] + 4];
}

function extendRifle(art, m) {
  paintOn(layerAt(art, 30, 16), ctx => {
    fill(ctx, m.metal[2], 0, 15, 66, 4);                                       // tubo mais grosso e até a boca
    fill(ctx, m.metal[4], 0, 15, 66, 1);
    fill(ctx, BRASS[1], 0, 15, 2, 4);
    for (const x of [18, 42]) fill(ctx, m.metal[0], x, 14, 2, 6);              // braçadeiras
  });
}

// A caixa de munição é desenhada a cada quadro (ela cai na recarga): a parte de baixo dela ganha mais um gomo.
function extendGatling(art) {
  const layer = art.layers.find(candidate => candidate.isAmmoBox), box = art.ammoBox;
  if (!layer || !box) return;
  const paint = layer.paint, [dark, base, , light] = box.colors, y = box.y + box.h - 1, extra = 6;
  layer.paint = (ctx, pose) => {
    fill(ctx, dark, box.x, y, box.w, extra + 1);
    fill(ctx, base, box.x + 1, y, box.w - 2, extra - 1);
    fill(ctx, light, box.x + 1, y + 1, box.w - 2, 1);
    fill(ctx, dark, box.x + 2, y + extra - 2, box.w - 4, 1);
    paint(ctx, pose);
  };
}

function quickMagazine(art, spot) {
  const [lx, ly] = spot ?? art.load;
  paintOn(layerAt(art, lx, ly, 10), ctx => {                                  // fita de puxar, para trocar rápido
    fill(ctx, PULL_TAB[0], lx - 1, ly - 1, 4, 6);
    fill(ctx, PULL_TAB[1], lx, ly - 1, 2, 5);
  });
}

// Cada tipo de munição em pé na tira: `step` é a distância entre uma e outra.
const BELT_ITEMS = {
  rounds: { step: 3, draw: (ctx, x, y, tip) => {
    fill(ctx, BRASS[1], x, y, 2, 5);
    fill(ctx, BRASS[2], x, y, 1, 5);
    fill(ctx, tip, x, y - 1, 2, 2);                                            // a ponta tem a cor da munição
    fill(ctx, BRASS[0], x, y + 4, 2, 1);
  } },
  shells: { step: 4, draw: (ctx, x, y, tip) => {
    fill(ctx, SHELL[1], x, y - 1, 3, 5);
    fill(ctx, SHELL[2], x, y - 1, 1, 5);
    fill(ctx, tip === TIP.stock ? SHELL[0] : tip, x, y - 2, 3, 1);
    fill(ctx, BRASS[1], x, y + 4, 3, 2);
  } },
  grenades: { step: 5, draw: (ctx, x, y) => {
    fill(ctx, GRENADE[1], x, y - 2, 4, 6);
    fill(ctx, GRENADE[2], x, y - 2, 1, 6);
    fill(ctx, GRENADE[0], x, y - 2, 4, 1);
    fill(ctx, BRASS[1], x, y + 4, 4, 2);
  } },
  bolts: { step: 4, draw: (ctx, x, y) => {
    fill(ctx, BOLT.tip, x, y - 4, 1, 2);
    fill(ctx, BOLT.shaft, x, y - 2, 1, 8);
    fill(ctx, BOLT.fletch, x - 1, y + 4, 3, 2);
  } },
};

// Tira de couro com a munição presa em pé.
function beltOfRounds(art, spot, ammo) {
  const { x, y, count, on, kind } = spot, item = BELT_ITEMS[kind], tip = TIP[ammo] ?? TIP.stock;
  paintOn(layerAt(art, on[0], on[1], 6) ?? art.layers[0], ctx => {
    const width = count * item.step + 1;
    fill(ctx, LEATHER[0], x - 1, y + 2, width, 3);
    fill(ctx, LEATHER[1], x - 1, y + 2, width, 1);
    for (let i = 0; i < count; i++) item.draw(ctx, x + i * item.step, y, tip);
  });
}

// --- munição ----------------------------------------------------------------------------------------------------

function ammoTag(art, [x, y], ammo) {
  const [dark, light] = TAG[ammo];
  paintOn(layerAt(art, x, y, 4), ctx => {
    fill(ctx, 0x08080a, x - 1, y - 1, 6, 4);
    fill(ctx, dark, x, y, 4, 2);
    fill(ctx, light, x, y, 4, 1);
    if (ammo === 'pierce') fill(ctx, light, x + 3, y + 1, 1, 1);
    if (ammo === 'impact') for (let i = 0; i < 2; i++) fill(ctx, light, x + hash(i, 7) * 3, y + 1, 1, 1);
  });
}

// `parts` como em weaponParts.sanitizeWeaponParts; o que estiver no original não desenha nada.
export function applyCombatParts(art, id, parts, m) {
  if (!parts) return art;
  const spot = SPOTS[id] ?? {};
  // O carregador e a munição primeiro: o cano curto apaga a ponta depois deles, e a empunhadura pinta por cima do cabo.
  if (parts.magazine === 'extended') spot.extend?.(art, m);
  if (parts.magazine === 'quick') quickMagazine(art, spot.quick);
  if (parts.magazine === 'belt' && spot.belt) beltOfRounds(art, spot.belt, parts.ammo);
  if (spot.tag && TAG[parts.ammo]) ammoTag(art, spot.tag, parts.ammo);
  if (parts.barrel === 'compensator') compensator(art, m);
  if (parts.barrel === 'heavy') heavyBarrel(art, m, spot.heavy);
  if (parts.barrel === 'short') shortBarrel(art, m);
  if (parts.barrel === 'choke') choke(art, m);
  if (parts.barrel === 'wide') choke(art, m, 2);
  if (parts.grip === 'firm') firmGrip(art);
  if (parts.grip === 'light') lightGrip(art);
  if (parts.grip === 'steady') (spot.pad ? buttPad(art, spot.pad) : steadyGrip(art));
  return art;
}
