import { Raster } from '../../art/raster.js';
import { colorRamp, dither, hash, vnoise } from '../../art/shade.js';

// Paleta e materiais compartilhados pelo desenho das armas.

export const STEEL = [0x1e1e20, 0x38383c, 0x56585c, 0x7c7e82, 0xa8aaae];
export const DARK_STEEL = [0x101012, 0x1e1e22, 0x2e2e34, 0x46464e, 0x62626c];
export const WOOD = [0x1a0f0a, 0x2c1a12, 0x42281a, 0x5a3a26, 0x764e30];
export const FLASH = [0xff9a30, 0xffd060, 0xfff2b0];

const PATTERN_TEST = {
  none: () => false,
  camo: (x, y) => vnoise(x / 9, y / 6) > 0.55,
  tiger: (x, y) => Math.sin((x + y * 0.6) / 3 + vnoise(x / 14, y / 9) * 4) > 0.55,
  engraved: (x, y) => (x * 3 + y * 5) % 7 === 0 && vnoise(x / 11, y / 7) > 0.4,
  worn: (x, y) => hash(x >> 1, y >> 1) > 0.86,
};
const PATTERN_DEFAULT = { none: 0x000000, camo: 0x4a5a30, tiger: 0xb08020, engraved: 0xd8b860, worn: 0xc0c0c0 };

export function materials(base, custom) {
  const metal = custom.colors.metal === null ? base : colorRamp(custom.colors.metal);
  const grip = custom.colors.grip === null ? WOOD : colorRamp(custom.colors.grip);
  const patternRamp = colorRamp(custom.colors.pattern ?? PATTERN_DEFAULT[custom.options.pattern]);
  const isPattern = PATTERN_TEST[custom.options.pattern];
  return {
    metal, grip,
    steel: tone => (x, y) => dither(x, y, tone - (y % 16) / 60, isPattern(x, y) ? patternRamp : metal, 0.8),
    wood: (tone, x0) => (x, y) => dither(x, y, tone - (x - x0) / 120 + ((y >> 1) & 1) * 0.08, grip, 0.9),
    flash: custom.colors.flash === null ? FLASH : [custom.colors.flash, colorRamp(custom.colors.flash)[4], 0xffffff],
  };
}

export const layerOf = (width, height, paint) => {
  const r = new Raster(width, height);
  paint(r);
  return r.commit();
};

