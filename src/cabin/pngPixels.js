// Carrega um PNG como canvas, guardando o resultado. `loadPng(path)` devolve uma promessa;
// `pngNow(path)` devolve o canvas se já carregou (ou null).
const cache = new Map();

export function loadPng(path) {
  if (!cache.has(path)) {
    cache.set(path, new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        canvas.getContext('2d').drawImage(image, 0, 0);
        cache.set(path, canvas);
        resolve(canvas);
      };
      image.onerror = () => reject(new Error(`não carregou ${path}`));
      image.src = path;
    }));
  }
  const entry = cache.get(path);
  return entry instanceof Promise ? entry : Promise.resolve(entry);
}

export function pngNow(path) {
  const entry = cache.get(path);
  return entry && !(entry instanceof Promise) ? entry : null;
}
