// Cilindros de nitro. `palette` é a cor original; `style` escolhe o grafismo pintado sobre o cilindro.
export const NITROS = {
  standard: { name: 'Cilindro', palette: [0x2a0806, 0x4a0e0a, 0x6c1710, 0x8c251a, 0xa83c2a], style: 'plain' },
  racing: { name: 'Faixas de corrida', palette: [0x08142a, 0x10244a, 0x1a3a70, 0x285294, 0x4a78b8], style: 'stripes' },
  hazard: { name: 'Perigo', palette: [0x4a3804, 0x8a6a08, 0xc09a10, 0xe0bc20, 0xf4d850], style: 'hazard' },
  flames: { name: 'Chamas', palette: [0x08080a, 0x141418, 0x202026, 0x2e2e36, 0x44444e], style: 'flames' },
  chrome: { name: 'Cromado', palette: [0x34363c, 0x5a5e66, 0x868c94, 0xb0b6be, 0xe0e4ea], style: 'bands' },
};
