# Sons novos das armas

Coloque os arquivos `.mp3` (WAV convertido com `ffmpeg -i som.wav -q:a 3 som.mp3`) nestas pastas. Enquanto um arquivo não existir, o jogo toca o som da arma parecida (sem erro).

## Ainda faltam

| Arquivo | Quando toca | Como deve soar |
|---|---|---|
| `autoshotgun/port-open.mp3` | abre a janela de carga | clique leve |
| `grenade/round-in.mp3` | cada granada entra no tubo | encaixe pesado de metal |
| `grenade/pump.mp3` | bombeia depois do tiro e no fim da recarga | "tchac-tchac" longo da bomba |

Já entraram: `autoshotgun/slide`, `grenade/fire` e `grenade/port-open`.

## Já implementados (cortados de `temp/new-guns`)

Revólver pesado: `magnum/fire`, `open`, `close`. Sniper: `sniper/fire`, `bolt-open`, `bolt-close`.
Escopeta auto: `autoshotgun/fire`. Besta: `crossbow/fire`, `crank`, `bolt-in`, `latch`.
Os dois sons do antigo lança-chamas viraram o fogo da besta incendiária: `traps/fire.mp3` (pega fogo)
e `traps/burning.mp3` (laço do próprio carro queimando).
