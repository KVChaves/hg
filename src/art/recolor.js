// Recolore uma imagem mantendo as luzes e sombras: escuro vira preto, meio-tom vira a cor, claro vira branco.

export function gradientMap(source, color) {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  const target = [(color >> 16) & 255, (color >> 8) & 255, color & 255];

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const luma = Math.min(1, (0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2]) / 255 * 1.7);
    for (let c = 0; c < 3; c++) {
      data[i + c] = luma < 0.5 ? target[c] * luma * 2 : target[c] + (255 - target[c]) * (luma - 0.5) * 2;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

export function hslToHex(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const channel = n => {
    const k = (n + h * 12) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return (channel(0) << 16) | (channel(8) << 8) | channel(4);
}
