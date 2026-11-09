# Sons novos das armas

Coloque os arquivos `.wav` nestas pastas. Enquanto um arquivo não existir, o jogo toca o som da arma parecida (sem erro).

## Ainda faltam

| Arquivo | Quando toca | Como deve soar |
|---|---|---|
| `autoshotgun/port-open.wav` | abre a janela de carga | clique leve |
| `autoshotgun/slide.wav` | fecha a ação ao fim da recarga | "tchac-tchac" da ação |
| `flamethrower/tank-out.wav` | tira o tanque | rosca soltando e tanque saindo |
| `flamethrower/tank-in.wav` | encaixa o tanque | rosca apertando e tanque travando |

## Já implementados (cortados de `temp/new-guns`)

Revólver pesado: `magnum/fire`, `open`, `close`. Sniper: `sniper/fire`, `bolt-open`, `bolt-close`.
Escopeta auto: `autoshotgun/fire`. Besta: `crossbow/fire`, `crank`, `bolt-in`, `latch`.
Lança-chamas: `flamethrower/fire-loop` (em laço enquanto atira) e `fire-short` (ouvido de longe).
