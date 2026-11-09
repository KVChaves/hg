import { Raster } from './raster.js';

// Ícones dos itens do bagageiro (18x14), usados no painel e na tela de escolha.

export const TRAP_ICON_SIZE = { width: 18, height: 14 };

const PLOTTERS = {
  spikes(r, ox, oy, dim) {
    const color = dim(0xb8b8b8);
    for (let i = 0; i < 4; i++) {
      const x = ox + 1 + i * 4;
      r.poly([[x, oy + 12], [x + 2, oy + 1], [x + 4, oy + 12]], color);
    }
    r.rect(ox, oy + 12, 18, 2, dim(0x6a6a6a));
  },
  oil(r, ox, oy, dim) {
    r.poly([[ox + 9, oy], [ox + 15, oy + 8], [ox + 3, oy + 8]], dim(0x6a5a9a));
    r.ellipse(ox + 9, oy + 9, 6, 5, dim(0x6a5a9a));
    r.rect(ox + 6, oy + 7, 2, 3, dim(0xc8c0e8));
  },
  paint(r, ox, oy, dim) {
    r.rect(ox + 1, oy + 4, 9, 9, dim(0x9a9aa0));
    r.rect(ox + 1, oy + 4, 9, 2, dim(0xd0e430));
    r.ellipse(ox + 13, oy + 10, 4.5, 3, dim(0xd0e430));
    r.poly([[ox + 8, oy + 2], [ox + 12, oy + 3], [ox + 12, oy + 8]], dim(0xd0e430));
  },
  dynamite(r, ox, oy, dim) {
    for (const x of [1, 5, 9]) {
      r.rect(ox + x, oy + 5, 4, 9, dim(0xc02818));
      r.rect(ox + x, oy + 5, 1, 9, dim(0xe05838));
    }
    r.line(ox + 7, oy + 5, ox + 13, oy + 2, dim(0xb0a080));
    r.rect(ox + 14, oy, 3, 3, dim(0xffd040));
  },
  extinguisher(r, ox, oy, dim) {
    r.rect(ox + 5, oy + 4, 8, 10, dim(0xd02018));
    r.rect(ox + 5, oy + 4, 2, 10, dim(0xf06a50));
    r.rect(ox + 7, oy + 1, 4, 3, dim(0x4a4a50));
    r.rect(ox + 3, oy, 8, 2, dim(0x8a8a90));
    r.line(ox + 11, oy + 2, ox + 16, oy + 5, dim(0x2a2a30), 1);
    r.rect(ox + 7, oy + 7, 4, 3, dim(0xf0e8d8));
  },
  harpoon(r, ox, oy, dim) {
    r.line(ox, oy + 12, ox + 11, oy + 4, dim(0x9a7a50), 2);
    r.poly([[ox + 17, oy], [ox + 9, oy + 2], [ox + 12, oy + 3], [ox + 11, oy + 7], [ox + 14, oy + 5], [ox + 15, oy + 8]], dim(0xd0d4dc));
  },
  smoke(r, ox, oy, dim) {
    r.disc(ox + 5, oy + 9, 4.5, dim(0x8a8682));
    r.disc(ox + 12, oy + 9, 5, dim(0x6e6a66));
    r.disc(ox + 9, oy + 5, 4.5, dim(0xa8a4a0));
  },
};

const darken = c => (((c >> 16 & 255) * 0.3) << 16) | (((c >> 8 & 255) * 0.3) << 8) | ((c & 255) * 0.3);

export function plotTrapIcon(r, id, x, y, disabled = false) {
  PLOTTERS[id](r, x, y, disabled ? darken : c => c);
}

export function paintTrapIcon(id) {
  const r = new Raster(TRAP_ICON_SIZE.width, TRAP_ICON_SIZE.height);
  plotTrapIcon(r, id, 0, 0);
  return r.commit();
}
