// Ajudas para pintar os muros dos biomas.

export function speckle(ctx, w, h, colors, amount) {
  for (let i = 0; i < amount; i++) {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(Math.floor(Math.random() * w), Math.floor(Math.random() * h), 1 + Math.floor(Math.random() * 3), 1);
  }
}

// Fileiras de blocos desencontrados. `drawBlock(x, y, width, height)` pinta cada um.
export function paintBlocks(w, h, blockWidth, blockHeight, drawBlock) {
  for (let row = 0; row * blockHeight < h; row++) {
    const shift = row % 2 ? -Math.floor(blockWidth / 2) : 0;
    for (let x = shift; x < w; x += blockWidth) drawBlock(x, row * blockHeight, blockWidth, blockHeight);
  }
}

// Abre recortes no topo da imagem: `depthAt(x)` diz quantos pixels some em cada coluna.
export function cutTop(ctx, w, depthAt) {
  for (let x = 0; x < w; x++) ctx.clearRect(x, 0, 1, depthAt(x));
}
