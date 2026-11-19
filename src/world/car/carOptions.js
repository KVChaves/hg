import { CAR_PARTS, DEFAULT_PARTS, PART_KEYS } from '../../game/carUpgrades.js';

// Peças externas do carro do jogador. `options` são as variações; `colorDefault` indica que a peça
// aceita qualquer cor. Peças só com cor não têm `options`; a altura não tem cor.

const named = entries => Object.fromEntries(entries.map(([id, name]) => [id, { name, value: id }]));

export const CAR_SLOTS = {
  body: {
    label: 'Carroceria', short: 'CARRO', default: 'coupe', colorDefault: 0xc8c4bc,
    options: named([['coupe', 'Esportivo'], ['muscle', 'Muscle'], ['wedge', 'Cunha'], ['hatch', 'Hatch'], ['wagon', 'Perua']]),
  },
  pattern: {
    label: 'Pintura', short: 'PINTURA', default: 'digital', colorDefault: 0x98161e,
    options: named([['plain', 'Lisa'], ['digital', 'Blocos'], ['bands', 'Faixas'], ['split', 'Duas cores'], ['stripe', 'Faixa central'], ['checker', 'Xadrez'], ['flames', 'Chamas'], ['rust', 'Ferrugem'], ['camo', 'Camuflada'], ['tiger', 'Tigrada'], ['racing', 'Faixas de corrida'], ['carbon', 'Fibra de carbono'], ['fade', 'Degrade']]),
  },
  finish: {
    label: 'Acabamento', short: 'BRILHO', default: 'gloss',
    options: named([['gloss', 'Brilhante'], ['matte', 'Fosco'], ['metallic', 'Metalico'], ['pearl', 'Perolado'], ['chrome', 'Cromado']]),
  },
  decal: { label: 'Adesivo', short: 'ADESIVO', default: 'crosses', colorDefault: 0xe8e4dc, options: named([['none', 'Nenhum'], ['crosses', 'Cruzes'], ['number', 'Numero'], ['bolt', 'Raio'], ['stars', 'Estrelas'], ['bars', 'Barras'], ['skull', 'Caveira'], ['flag', 'Bandeira xadrez'], ['flame', 'Chama'], ['chevrons', 'Setas'], ['heart', 'Coracao'], ['crown', 'Coroa'], ['target', 'Alvo'], ['wings', 'Asas']]) },
  decalSpot: {
    label: 'Posicao do adesivo', short: 'POSICAO', default: 'auto',
    options: named([['auto', 'Padrao'], ['door', 'Porta'], ['fender', 'Lateral traseira'], ['nose', 'Lateral dianteira'], ['roof', 'Teto'], ['hood', 'Capo'], ['trunk', 'Porta-malas']]),
  },
  decalSize: {
    label: 'Tamanho do adesivo', short: 'TAMANHO', default: 'normal',
    options: { small: { name: 'Pequeno', value: 0.7 }, normal: { name: 'Normal', value: 1 }, large: { name: 'Grande', value: 1.4 } },
  },
  decalNumber: {
    label: 'Numero do adesivo', short: 'NUMERO', default: '27',
    options: named([['27', '27'], ['07', '07'], ['13', '13'], ['42', '42'], ['69', '69'], ['88', '88'], ['99', '99'], ['1', '1'], ['00', '00'], ['3', '3'], ['11', '11'], ['77', '77']]),
  },
  trim: {
    label: 'Friso lateral', short: 'FRISO', default: 'none', colorDefault: 0xe8e4dc,
    options: named([['none', 'Nenhum'], ['line', 'Fino'], ['thick', 'Grosso'], ['double', 'Duplo'], ['dashed', 'Tracejado'], ['zigzag', 'Zigue-zague'], ['fade', 'Faixa degrade']]),
  },
  spoiler: { label: 'Aerofolio', short: 'AEROF', default: 'wing', colorDefault: 0x7a1218, options: named([['none', 'Sem aerofolio'], ['lip', 'Discreto'], ['duck', 'Rabo de pato'], ['wing', 'Medio'], ['twin', 'Duplo'], ['gt', 'GT alto']]) },
  hood: {
    label: 'Capo', short: 'CAPO', default: 'none', colorDefault: 0xd8d4cc,
    options: named([['none', 'Nenhum'], ['skull', 'Caveira'], ['blower', 'Motor externo'], ['scoop', 'Entrada de ar'], ['horns', 'Chifres'], ['star', 'Adesivo estrela'], ['target', 'Adesivo alvo']]),
  },
  roof: {
    label: 'Teto', short: 'TETO', default: 'none', colorDefault: 0x26282e,
    options: named([['none', 'Nada'], ['rack', 'Bagageiro'], ['antenna', 'Antena com bandeira'], ['fin', 'Barbatana'], ['scoop', 'Entrada de ar'], ['beacon', 'Giroflex']]),
  },
  height: {
    label: 'Altura', short: 'ALTURA', default: 'stock',
    options: { slammed: { name: 'Bem rebaixado', value: -0.13 }, low: { name: 'Rebaixado', value: -0.08 }, stock: { name: 'Original', value: 0 }, high: { name: 'Elevado', value: 0.12 }, lifted: { name: 'Bem elevado', value: 0.22 } },
  },
  tire: {
    label: 'Pneus', short: 'PNEU', default: 'street', colorDefault: 0x0a0a0c,
    options: {
      street: { name: 'Rua', value: { width: 1, radius: 1 } },
      wide: { name: 'Largo', value: { width: 1.45, radius: 1 } },
      offroad: { name: 'Off-road', value: { width: 1.35, radius: 1.18 } },
      slim: { name: 'Fino', value: { width: 0.8, radius: 1 } },
      big: { name: 'Gigante', value: { width: 1.6, radius: 1.28 } },
    },
  },
  rim: { label: 'Aro', short: 'ARO', default: 'spokes', colorDefault: 0xb01820, options: named([['spokes', 'Raios finos'], ['star', 'Estrela'], ['disc', 'Disco'], ['mesh', 'Malha'], ['turbine', 'Turbina'], ['deep', 'Fundo'], ['split', 'Raios duplos'], ['hubcap', 'Calota']]) },
  headlight: {
    label: 'Farol', short: 'FAROL', default: 'rect', colorDefault: 0xf8f4d8,
    options: named([['rect', 'Retangular'], ['round', 'Redondo'], ['twin', 'Duplo'], ['slim', 'Fino'], ['covered', 'Com grade'], ['angry', 'Bravo'], ['led', 'Faixa de LED']]),
  },
  neon: {
    label: 'Neon', short: 'NEON', default: 'none', colorDefault: 0x30e0ff,
    options: named([['none', 'Desligado'], ['under', 'Embaixo'], ['wheels', 'Nas rodas'], ['pulse', 'Pulsante'], ['rainbow', 'Arco-iris']]),
  },
  bumper: { label: 'Para-choque', short: 'CHOQUE', default: 'stock', colorDefault: 0x34343a, options: named([['stock', 'Original'], ['sport', 'Esportivo'], ['steel', 'Aco'], ['ram', 'Ariete'], ['explosive', 'Explosivo'], ['absorber', 'Absorvedor']]) },
  bumperTrim: { label: 'Detalhe do para-choque', short: 'DETALHE', colorDefault: 0xd8b840 },
  exhaust: {
    label: 'Escapamento', short: 'ESCAPE', default: 'stock', colorDefault: 0x2a2a2e,
    options: named([['stock', 'Original'], ['muffled', 'Abafado'], ['sport', 'Esportivo'], ['drift', 'Coletor'], ['turbo', 'Turbo duplo'], ['explosive', 'Explosivo']]),
  },
  glass: {
    label: 'Vidros', short: 'VIDRO', default: 'clear', colorDefault: 0x3a3c44,
    options: { clear: { name: 'Claro', value: 0 }, light: { name: 'Leve', value: 0.18 }, medium: { name: 'Fume', value: 0.35 }, dark: { name: 'Escuro', value: 0.7 }, black: { name: 'Blindado', value: 0.92 } },
  },
};

// Pneus, vidro, altura e para-choque são peças de desempenho: nome, preço e efeito vêm de game/carUpgrades.js.
for (const key of PART_KEYS) {
  for (const [id, variant] of Object.entries(CAR_PARTS[key].variants)) {
    Object.assign(CAR_SLOTS[key].options[id], { id, name: variant.name, price: variant.price, detail: `R$ ${variant.price}  ${variant.summary}` });
  }
}

const STORAGE_KEY = 'halfgrip.car';

// Carro do primeiro acesso: peças e cores sorteadas, só nas peças de aparência. Vidro, farol e pneu ficam no padrão.
const RANDOM_COLORED = ['body', 'pattern', 'decal', 'spoiler', 'hood', 'rim', 'trim', 'roof', 'neon'];
// No primeiro carro estas ficam desligadas: o sorteio da garagem (botão SORTEAR) é que pode ligá-las.
const FIRST_CAR_PLAIN = ['roof', 'neon', 'finish'];

function randomColor() {
  const hue = Math.random(), saturation = 0.55 + Math.random() * 0.35, lightness = 0.35 + Math.random() * 0.25;
  const f = n => {
    const k = (n + hue * 12) % 12, a = saturation * Math.min(lightness, 1 - lightness);
    return lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)].reduce((hex, channel) => (hex << 8) | Math.round(channel * 255), 0);
}

const pickOne = list => list[Math.floor(Math.random() * list.length)];

function randomCarSelection() {
  const selection = { options: {}, colors: {} };
  for (const [key, slot] of Object.entries(CAR_SLOTS)) {
    if (PART_KEYS.includes(key)) {
      selection.options[key] = DEFAULT_PARTS[key];   // peças de desempenho custam: o carro novo começa com as de fábrica
    } else if (slot.options) {
      selection.options[key] = FIRST_CAR_PLAIN.includes(key) ? slot.default : pickOne(Object.keys(slot.options));
    }
    if (slot.colorDefault !== undefined) selection.colors[key] = RANDOM_COLORED.includes(key) ? randomColor() : slot.colorDefault;
  }
  return selection;
}

// Sorteia só o visual (peças grátis e cores) de `selection`, sem tocar nas peças de desempenho que o jogador pagou.
// As cores saem de uma mesma família: uma base, um contraste e um destaque, para o carro não virar um arco-íris.
export function randomizeLook(selection, keys) {
  const base = randomColor(), contrast = randomColor(), accent = Math.random() < 0.5 ? contrast : randomColor();
  const colorFor = { body: base, pattern: contrast, decal: accent, trim: accent, spoiler: Math.random() < 0.5 ? base : contrast, hood: accent, rim: Math.random() < 0.4 ? accent : 0xc8ccd4, roof: Math.random() < 0.5 ? 0x26282e : base, neon: accent };
  for (const key of keys) {
    const slot = CAR_SLOTS[key];
    if (slot.options) selection.options[key] = pickOne(Object.keys(slot.options));
    if (colorFor[key] !== undefined) selection.colors[key] = colorFor[key];
  }
}

export function loadCarSelection() {
  let raw = null;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch { /* sem armazenamento: segue sem salvo */ }
  if (raw === null) {                                // primeiro acesso: carro aleatório, que passa a ser o dele
    const selection = randomCarSelection();
    saveCarSelection(selection);
    return selection;
  }

  let saved = {};
  try { saved = JSON.parse(raw || '{}'); } catch { /* salvo corrompido: usa o padrão */ }

  const selection = { options: {}, colors: {} };
  for (const [key, slot] of Object.entries(CAR_SLOTS)) {
    if (slot.options) selection.options[key] = slot.options[saved.options?.[key]] ? saved.options[key] : slot.default;
    if (slot.colorDefault !== undefined) selection.colors[key] = Number.isInteger(saved.colors?.[key]) ? saved.colors[key] : slot.colorDefault;
  }
  return selection;
}

export function saveCarSelection(selection) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(selection)); } catch { /* sem armazenamento: não persiste */ }
}

// Converte a escolha do jogador nos valores usados pelo modelo.
export function resolveCarSpec({ options, colors }) {
  const value = key => CAR_SLOTS[key].options[options[key]].value;
  return {
    model: value('body'),
    headlightShape: value('headlight'),
    primary: colors.body,
    secondary: colors.pattern,
    pattern: value('pattern'),
    finish: value('finish'),
    decal: value('decal'),
    glyph: colors.decal,
    decalSpot: value('decalSpot'),
    decalScale: value('decalSize'),
    decalNumber: value('decalNumber'),
    trim: value('trim'),
    trimColor: colors.trim,
    spoiler: value('spoiler'),
    spoilerColor: colors.spoiler,
    hood: value('hood'),
    hoodColor: colors.hood,
    roof: value('roof'),
    roofColor: colors.roof,
    neon: value('neon'),
    neonColor: colors.neon,
    height: value('height'),
    bumper: options.bumper,
    tireKind: options.tire,
    heightKind: options.height,
    glassKind: options.glass,
    exhaustKind: options.exhaust,
    exhaustColor: colors.exhaust,
    bumperColor: colors.bumper,
    bumperTrimColor: colors.bumperTrim,
    tire: value('tire'),
    tireColor: colors.tire,
    rim: value('rim'),
    rimColor: colors.rim,
    headlight: colors.headlight,
    glass: { color: colors.glass, level: value('glass') },
  };
}
