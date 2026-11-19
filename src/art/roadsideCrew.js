import { Raster } from './raster.js';
import { plotTrapIcon } from './trapIcons.js';

// Quem entrega cada item na beira da pista. O personagem já diz o que oferece antes de a placa ficar legível:
// frentista com o cilindro de nitro, equipe de box com o nitro azul, contrabandista com a caixa de munição,
// bombeiro com o extintor e vendedor ambulante com as armadilhas.

export const CREW_SKINS = [0xd8a878, 0xb88058, 0x8a5a3a];

const BANDOLIER = 0x6a4420, BULLET = 0xd8b048, WHITE = 0xf0ece0, REFLECTIVE = 0xe8e470, SILVER = 0xc0c4c8;

// Adereço que cada um segura na frente do corpo. (x, y) é onde a mão aperta.
const PROPS = {
  ammoBox(r, x, y) {
    r.rect(x - 5, y - 3, 10, 7, 0x2a3218);
    r.rect(x - 4, y - 2, 8, 5, 0x4a5630);
    r.rect(x - 4, y, 8, 1, 0xd8c040);
    r.rect(x - 2, y - 5, 4, 2, 0x1a1a14);
  },
  cylinder(colors) {
    return (r, x, y) => {
      r.rect(x - 2, y - 6, 5, 11, colors.body);
      r.rect(x - 2, y - 6, 1, 11, colors.light);
      r.rect(x - 2, y - 1, 5, 2, colors.band);
      r.rect(x - 1, y - 8, 3, 2, 0x9a9aa2);
    };
  },
  extinguisher(r, x, y) {
    r.rect(x - 2, y - 6, 5, 12, 0xd02018);
    r.rect(x - 2, y - 6, 1, 12, 0xf06048);
    r.rect(x - 1, y - 9, 3, 3, SILVER);
    r.line(x + 1, y - 8, x + 5, y - 4, 0x141010);
    r.rect(x - 2, y + 1, 5, 2, 0xe8e0c8);
  },
  tray(r, x, y) {
    r.rect(x - 6, y - 2, 12, 5, 0x7a5024);
    r.rect(x - 5, y - 2, 10, 2, 0xb07a3c);
    r.rect(x - 4, y - 4, 2, 2, 0xd03020);
    r.rect(x - 1, y - 5, 2, 3, 0x3a3a42);
    r.rect(x + 2, y - 4, 2, 2, 0x40a040);
  },
};

// Chapéus. `hx` é o centro da cabeça; o topo da cabeça fica em y = 5.
const HEADWEAR = {
  cap(r, hx, { color, trim }) {
    r.ellipse(hx, 5, 5, 2.5, color);
    r.rect(hx - 5, 5, 11, 2, color);
    r.rect(hx - 2, 3, 4, 2, trim);
    r.rect(hx - 6, 7, 12, 1, 0x141010);
  },
  helmet(r, hx, { color, trim }) {
    r.ellipse(hx, 5, 6, 4, color);
    r.rect(hx - 8, 7, 17, 2, color);
    r.rect(hx - 8, 8, 17, 1, 0x5a0c08);
    r.rect(hx - 1, 2, 3, 4, trim);
  },
  straw(r, hx, { color, trim }) {
    r.rect(hx - 4, 1, 9, 5, color);
    r.rect(hx - 4, 4, 9, 1, trim);
    r.rect(hx - 9, 6, 19, 2, color);
    for (let x = hx - 9; x <= hx + 9; x += 3) r.put(x, 7, 0xa08840);
  },
  headset(r, hx, { color, trim }) {
    r.rect(hx - 4, 4, 9, 1, color);
    r.rect(hx - 6, 5, 1, 5, color);
    r.rect(hx + 6, 5, 1, 5, color);
    r.rect(hx - 7, 8, 3, 4, trim);
    r.rect(hx + 5, 8, 3, 4, trim);
    r.line(hx - 5, 11, hx - 2, 13, color);
  },
};

// Detalhes do uniforme no tronco, que vai de x a x + 11 e de y = 15 a 32.
const DETAILS = {
  bandolier(r, x) {
    r.line(x + 10, 15, x + 1, 31, BANDOLIER, 2);
    for (let i = 1; i < 6; i++) r.put(x + 10 - i * 1.6, 15 + i * 2.8, BULLET);
  },
  chestStripe(r, x) { r.rect(x, 21, 12, 2, WHITE); },
  sideStripes(r, x) { r.rect(x + 2, 15, 1, 18, WHITE); r.rect(x + 9, 15, 1, 18, WHITE); },
  reflective(r, x) {
    for (const y of [20, 28]) { r.rect(x, y, 12, 2, REFLECTIVE); r.rect(x, y + 1, 12, 1, SILVER); }
  },
  flowers(r, x) {
    for (let j = 16; j < 32; j += 4) for (let i = (j >> 2) & 1 ? 1 : 3; i < 11; i += 5) {   // flores de 3x3
      r.rect(x + i, j + 1, 3, 1, 0xf8e8a0);
      r.rect(x + i + 1, j, 1, 3, 0xf8e8a0);
      r.put(x + i + 1, j + 1, 0xd03020);
    }
  },
};

// `sleeve` é a faixa que aparece na manga quando o braço entra na cabine.
export const ROLES = {
  ammo: {
    jacket: 0x5a6a34, shade: 0x3a4622, pants: 0x3a3022, detail: 'bandolier', prop: PROPS.ammoBox,
    hat: { kind: 'cap', color: 0x2a2a1e, trim: 0x4a4a34 }, sleeve: null,
  },
  nitro: {
    jacket: 0xc8281c, shade: 0x8a1810, pants: 0xb02418, detail: 'chestStripe',
    prop: PROPS.cylinder({ body: 0xe8c020, light: 0xfff0a0, band: 0x1a1a22 }),
    hat: { kind: 'cap', color: 0xc8281c, trim: WHITE }, sleeve: WHITE,
  },
  blueNitro: {
    jacket: 0x2458c8, shade: 0x163a88, pants: 0x1c3c90, detail: 'sideStripes',
    prop: PROPS.cylinder({ body: 0x2f7bff, light: 0xa8d4ff, band: 0x10204a }),
    hat: { kind: 'headset', color: 0x18181c, trim: 0x3a3a44 }, sleeve: WHITE,
  },
  extinguisher: {
    jacket: 0xa88a50, shade: 0x6e5a32, pants: 0x8a7240, detail: 'reflective', prop: PROPS.extinguisher,
    hat: { kind: 'helmet', color: 0xc8201a, trim: 0xe8c040 }, sleeve: REFLECTIVE,
  },
  trap: {
    jacket: 0xe07a20, shade: 0xa85010, pants: 0x6a5a44, detail: 'flowers', prop: PROPS.tray,
    hat: { kind: 'straw', color: 0xd8b860, trim: 0x8a3020 }, sleeve: null,
  },
};

export const roleIdFor = item => (item.slot || item.type ? 'trap' : item.id);

// Pessoa de beira de pista, 36x50. `pose`: 'sign' (placa erguida), 'lowered' (braço da placa abaixado) ou 'cheer'.
export const CREW_SIZE = { width: 36, height: 50 };
export const SIGN_HAND = [22, 2];                    // pixel da mão que segura o cabo da placa
const TORSO_X = 6, HEAD_X = 12;

export function paintCrewMember(roleId, skin, { pose, step = 0 }) {
  const role = ROLES[roleId], x = TORSO_X;
  const r = new Raster(CREW_SIZE.width, CREW_SIZE.height);
  const lift = side => Math.max(0, side * step) * 2;           // uma perna levanta de cada vez
  r.rect(x + 1, 32, 4, 17 - lift(1), role.pants);
  r.rect(x + 7, 32, 4, 17 - lift(-1), role.pants);
  r.rect(x, 47 - lift(1), 5, 3, 0x141010);
  r.rect(x + 7, 47 - lift(-1), 5, 3, 0x141010);
  r.rect(x, 15, 12, 18, role.jacket);
  r.rect(x, 15, 2, 18, role.shade);
  DETAILS[role.detail](r, x);

  r.disc(HEAD_X, 10, 5, skin);
  r.rect(HEAD_X - 2, 10, 1, 1, 0x101010);
  r.rect(HEAD_X + 2, 10, 1, 1, 0x101010);
  HEADWEAR[role.hat.kind](r, HEAD_X, role.hat);

  const arm = (x0, y0, x1, y1) => { r.line(x0, y0, x1, y1, role.jacket, 3); r.disc(x1, y1, 2, skin); };
  if (pose === 'cheer') {                                       // os dois braços para o alto, de mãos vazias
    arm(x + 1, 17, 1, 3);
    arm(x + 11, 16, 23, 3);
    return r.commit();
  }
  r.line(x + 1, 17, x + 2, 27, role.jacket, 3);
  role.prop(r, x + 2, 28);
  r.disc(x + 2, 28, 2, skin);
  if (pose === 'sign') arm(x + 11, 16, ...SIGN_HAND);
  else arm(x + 11, 17, x + 14, 30);
  return r.commit();
}

// Ícones dos itens, desenhados numa célula de 24x24 a partir de (ox, oy).
const ICONS = {
  ammo(r, ox, oy) {
    for (const x of [4, 10, 16]) {
      r.rect(ox + x, oy + 9, 5, 12, 0xd0a040);
      r.poly([[ox + x, oy + 9], [ox + x + 2.5, oy + 3], [ox + x + 5, oy + 9]], 0xa86a30);
      r.rect(ox + x, oy + 18, 5, 3, 0x8a6020);
    }
  },
  nitro(r, ox, oy) { plotBottle(r, ox, oy, [0xe8c020, 0xfff0a0, 0x1a1a22, 0xe8e8e8]); },
  blueNitro(r, ox, oy) { plotBottle(r, ox, oy, [0x2f7bff, 0xa8d4ff, 0x10204a, 0xe8f4ff]); },
};

function plotBottle(r, ox, oy, [body, light, band, dot]) {
  r.rect(ox + 8, oy + 5, 8, 16, body);
  r.rect(ox + 8, oy + 5, 2, 16, light);
  r.rect(ox + 10, oy + 2, 4, 3, 0x9a9aa2);
  r.rect(ox + 8, oy + 11, 8, 4, band);
  r.rect(ox + 11, oy + 12, 2, 2, dot);
}

const trapIdOf = item => item.slot?.type.id ?? item.type?.id ?? (item.id === 'extinguisher' ? 'extinguisher' : null);

export function plotHelpIcon(r, item, ox, oy) {
  const trapId = trapIdOf(item);
  if (trapId) plotTrapIcon(r, trapId, ox + 3, oy + 5);
  else ICONS[item.id](r, ox, oy);
}

// O ícone sozinho, com contorno escuro para ler contra qualquer fundo.
export function paintHelpIcon(item, r = new Raster(26, 26)) {
  r.data.fill(0);
  plotHelpIcon(r, item, 1, 1);
  outline(r, 0x140c08);
  return r.commit();
}

function outline(r, color) {
  const { width, height, data } = r, solid = data.slice();
  const filled = (x, y) => x >= 0 && y >= 0 && x < width && y < height && solid[y * width + x] !== 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!filled(x, y) && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))) r.put(x, y, color);
  }
}

