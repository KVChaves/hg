// Texto da tela PATCH NOTES do menu inicial: o que mudou no multiplayer desde o último commit ("novas fases").
// Cada seção tem um título e uma lista de itens; a tela quebra as linhas e rola com a roda do mouse.

export const PATCH_NOTES = [
  {
    title: 'SALAS E CONEXAO',
    items: [
      'Chat GLOBAL: todos os jogadores conectados leem todas as mensagens, em sala, corrida, menu ou garagem. Mensagem nova mostra um icone de envelope no canto inferior esquerdo; ENTER ou um clique nele abre a caixa, e a mensagem e digitada ali. ENTER com texto envia e a caixa continua aberta; ENTER sem digitar nada, clicar fora ou ESC fecha. Mensagem nova toca um som de notificacao.',
      'O jogo conecta ao servidor ja na abertura, para o chat funcionar tambem fora das salas; o seu nome vale no chat mesmo sem estar numa sala.',
      'Reconexao: quem cai da sala guarda a vaga por alguns segundos e retoma de onde parou.',
      'ESC na garagem da sala volta ao menu principal.',
      'Espectando, o atalho para ir a garagem (online) ou ver os resultados passou de ENTER para ESPACO, porque o ENTER agora abre o chat.',
      'A sala pode proibir tiro para tras: com o olhar virado alem de 90 graus nada dispara.',
    ],
  },
  {
    title: 'RANKING E HISTORICO',
    items: [
      'Ranking novo do servidor, com desempenho, corridas, vitorias, podios, posicao media, abates e partidas.',
      'Abas RANKING, HISTORICO e RANKING ANTIGO (o ranking local foi substituido).',
      'Historico das corridas online: detalhe de cada corrida, filtro por jogador e resumo da partida com pontos.',
    ],
  },
  {
    title: 'DENTRO DA CORRIDA ONLINE',
    items: [
      'O clima dinamico (chuva, nevasca e neblina) sai da semente da corrida: todos da sala veem a mesma coisa ao mesmo tempo.',
      'Os bots do seu navegador aprendem a arma dos carros remotos e passam a levar em conta o que cada jogador usa.',
      'A rede do lanca-redes fica visivel em todos os navegadores por cima do carro preso, e o aviso chega a quem simula o alvo.',
      'A mina grudada que passa de um carro para outro numa batida avisa a rede de novo a cada troca.',
      'As pecas do carro (como a suspensao que muda o vacuo) funcionam entre jogadores: cada um so manda o id da peca.',
    ],
  },
];
