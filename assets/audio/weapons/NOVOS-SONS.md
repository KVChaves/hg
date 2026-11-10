# Sons novos das armas

Coloque os arquivos `.wav` nestas pastas. Enquanto um arquivo não existir, o jogo toca o som da arma parecida (sem erro).

## Ainda faltam

| Arquivo | Quando toca | Como deve soar |
|---|---|---|
| `autoshotgun/port-open.wav` | abre a janela de carga | clique leve |
| `autoshotgun/slide.wav` | fecha a ação ao fim da recarga | "tchac-tchac" da ação |
| `grenade/fire.wav` | dispara a granada | "tum" grave e oco, sem estalo de pólvora |
| `grenade/port-open.wav` | começa a recarga | clique da portinhola do tubo |
| `grenade/round-in.wav` | cada granada entra no tubo | encaixe pesado de metal |
| `grenade/pump.wav` | bombeia depois do tiro e no fim da recarga | "tchac-tchac" longo da bomba |

## Já implementados (cortados de `temp/new-guns`)

Revólver pesado: `magnum/fire`, `open`, `close`. Sniper: `sniper/fire`, `bolt-open`, `bolt-close`.
Escopeta auto: `autoshotgun/fire`. Besta: `crossbow/fire`, `crank`, `bolt-in`, `latch`.
Os dois sons do antigo lança-chamas viraram o fogo da besta incendiária: `traps/fire.wav` (pega fogo)
e `traps/burning.wav` (laço do próprio carro queimando).
