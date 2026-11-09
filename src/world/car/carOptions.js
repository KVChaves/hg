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
    options: named([['plain', 'Lisa'], ['digital', 'Blocos'], ['bands', 'Faixas'], ['split', 'Duas cores'], ['stripe', 'Faixa central'], ['checker', 'Xadrez'], ['flames', 'Chamas'], ['rust', 'Ferrugem']]),
  },
  decal: { label: 'Adesivo', short: 'ADESIVO', default: 'crosses', colorDefault: 0xe8e4dc, options: named([['none', 'Nenhum'], ['crosses', 'Cruzes'], ['number', 'Numero 27'], ['bolt', 'Raio'], ['stars', 'Estrelas'], ['bars', 'Barras']]) },
  spoiler: { label: 'Aerofolio', short: 'AEROF', default: 'wing', colorDefault: 0x7a1218, options: named([['none', 'Sem aerofolio'], ['lip', 'Discreto'], ['duck', 'Rabo de pato'], ['wing', 'Medio'], ['twin', 'Duplo'], ['gt', 'GT alto']]) },
  hood: {
    label: 'Capo', short: 'CAPO', default: 'none', colorDefault: 0xd8d4cc,
    options: named([['none', 'Nenhum'], ['skull', 'Caveira'], ['blower', 'Motor externo'], ['scoop', 'Entrada de ar'], ['horns', 'Chifres'], ['star', 'Adesivo estrela'], ['target', 'Adesivo alvo']]),
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
  rim: { label: 'Aro', short: 'ARO', default: 'spokes', colorDefault: 0xb01820, options: named([['spokes', 'Raios finos'], ['star', 'Estrela'], ['disc', 'Disco'], ['mesh', 'Malha'], ['turbine', 'Turbina'], ['deep', 'Fundo']]) },
  headlight: {
    label: 'Farol', short: 'FAROL', default: 'rect', colorDefault: 0xf8f4d8,
    options: named([['rect', 'Retangular'], ['round', 'Redondo'], ['twin', 'Duplo'], ['slim', 'Fino'], ['covered', 'Com grade']]),
  },
  glass: {
    label: 'Vidros', short: 'VIDRO', default: 'clear', colorDefault: 0x3a3c44,
    options: { clear: { name: 'Claro', value: 0 }, light: { name: 'Leve', value: 0.18 }, medium: { name: 'Fume', value: 0.35 }, dark: { name: 'Escuro', value: 0.7 }, black: { name: 'Blindado', value: 0.92 } },
  },
};

const STORAGE_KEY = 'halfgrip.car';

export function loadCarSelection() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { /* sem armazenamento: usa o padrão */ }

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
    decal: value('decal'),
    glyph: colors.decal,
    spoiler: value('spoiler'),
    spoilerColor: colors.spoiler,
    hood: value('hood'),
    hoodColor: colors.hood,
    height: value('height'),
    tire: value('tire'),
    tireColor: colors.tire,
    rim: value('rim'),
    rimColor: colors.rim,
    headlight: colors.headlight,
    glass: { color: colors.glass, level: value('glass') },
  };
}
