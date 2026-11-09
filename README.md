# Half Grip

Jogo de corrida e combate de carros para navegador, em visão de cabine e estilo pixel art.

## Como rodar

O jogo usa módulos JavaScript, que os navegadores não carregam abrindo o arquivo direto (`file://`).
Rode um servidor local na pasta do projeto e abra o endereço que ele mostrar:

```sh
./run.sh
# abra http://localhost:8000
```

Não há etapa de build nem dependências para instalar: basta o Python 3. O Three.js está em `vendor/`.

## Multiplayer

O `./run.sh` também é o servidor das salas. Quem está na mesma rede abre o endereço que ele mostra no terminal
(`http://IP-DA-MAQUINA:8000`), entra em **Multiplayer** e cria uma sala ou entra em uma da lista. Para jogar pela
internet, é preciso liberar a porta no roteador ou publicar o servidor em uma máquina acessível.

Quem cria a sala é o admin: define corredores (até 8, contando os bots) e corridas, expulsa jogadores e inicia a partida.
A primeira corrida só larga quando todos clicarem em Pronto na garagem. Se o admin sair, a sala é encerrada. Cada navegador simula o próprio carro e o do admin simula também os bots.

## Controles

| Tecla | Ação |
|---|---|
| W / S | acelera / freia e dá ré |
| A / D | direção |
| Espaço | nitro |
| Shift | drift (freio de mão) |
| E | usar item do bagageiro |
| Roda do mouse | trocar item do bagageiro |
| Q (segurar) | ver o carro por fora |
| H | buzina |
| Mouse | olhar (clique para capturar, Esc solta) |
| Clique | atirar |
| Botão direito (segurar) | pegar a arma e mirar |
| R | recarregar |
| C | centralizar a visão |

## Organização

```
server/server.py    entrega o jogo, cuida das salas do multiplayer e guarda o ranking em server/ranking.json
index.html          página e mapa de importação
assets/audio/       sons: car/, effects/, music/, traps/ e weapons/
css/                estilo da página
vendor/three/       Three.js r128
src/
  main.js           monta o jogo e roda o loop
  config.js         resolução, velocidade, voltas
  core/             renderer e entrada (teclado/mouse)
  audio/            motor, efeitos e música
  art/              rasterizador de pixel art, dithering e fontes bitmap
  world/            pista procedural, relevo, céu, túneis, biomas (biomes/) e modelo dos carros (car/)
  game/             carro, câmbio, adversários e seu combate, corrida, armas e armadilhas
  net/              ligação com o servidor de salas e sincronização da partida online
  cabin/
    cabin.js        monta a cabine e atualiza as peças
    layout.js       posição de cada elemento na tela
    sprite.js       imagem 2D presa à cabine
    dashboard.js    mostradores, marcha, nitro e munição
    nitroFlame.js   fogo do nitro
    mirror.js       retrovisor
    scoreboard.js   placar pendurado no teto
    shell/          pintura do interior (frente, portas e teto)
    parts/          peças trocáveis
  ui/               menu inicial, HUD, mãos, armas (guns/), oficina e garagem (garage/)
```

## Como a cabine funciona

A cabeça do piloto só gira em torno do olho. Por isso a cabine é pintada como um cenário ao redor
da câmera: uma caixa cuja parede frontal coincide com o enquadramento de 640x360. As peças móveis
são sprites posicionados em pixels da tela, definidos em `src/cabin/layout.js`.

## Adicionando uma peça

Acrescente uma entrada em `src/cabin/parts/wheels.js`, `shifters.js` ou `healthMeters.js`. O menu e
o salvamento passam a incluí-la sozinhos. Volantes e câmbios aceitam o caminho de um PNG no campo
`image`, desenhado no tamanho original (1 pixel da imagem = 1 pixel da tela):

```js
export const WHEELS = {
  // gripRadius: distância do centro até onde as mãos seguram o aro
  meuVolante: { name: 'Meu volante', image: 'assets/volante.png', gripRadius: 60 },
};

export const SHIFTERS = {
  // anchor: pixel da imagem que encosta na grade em H; grip: onde a mão segura
  minhaAlavanca: { name: 'Minha alavanca', image: 'assets/alavanca.png', anchor: [15, 57], grip: [15, 18] },
};
```
