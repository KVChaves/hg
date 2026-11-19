// Texto da tela PATCH NOTES do menu inicial: o que mudou no multiplayer desde o último commit ("novas fases").
// Cada seção tem um título e uma lista de itens; a tela quebra as linhas e rola com a roda do mouse.

export const PATCH_NOTES = [
  {
    title: 'GARAGEM: APARENCIA',
    items: [
      'Nova peca ACABAMENTO: Brilhante, Fosco, Metalico (com purpurina), Perolado e Cromado.',
      'Nova peca TETO: Bagageiro, Antena com bandeira, Barbatana, Entrada de ar e Giroflex que pisca. Aceita qualquer cor.',
      'Nova peca NEON embaixo do carro: Embaixo, Nas rodas, Pulsante e Arco-iris. Os outros jogadores tambem veem.',
      'Novas pinturas: Camuflada, Tigrada, Faixas de corrida, Fibra de carbono e Degrade.',
      'Novos adesivos (Coracao, Coroa, Alvo e Asas), frisos (Tracejado, Zigue-zague e Faixa degrade), farois (Bravo e Faixa de LED), aros (Raios duplos e Calota) e numeros (00, 3, 11 e 77).',
      'Botao SORTEAR na aba APARENCIA: sorteia pecas e cores que combinam entre si, sem mexer nas pecas de desempenho compradas.',
      'Paleta com 20 cores prontas abaixo do seletor de cor.',
      'Pecas com muitas opcoes mostram as miniaturas em duas linhas, sem ficarem espremidas.',
      'O seletor de cor nao passa mais por cima do painel da direita.',
    ],
  },
  {
    title: 'DESEMPENHO',
    items: [
      'Nova opcao QUALIDADE GRAFICA em CONFIGURACOES: BAIXA, MEDIA e ALTA. Na BAIXA o mundo e desenhado em resolucao menor (a cabine continua nitida), a vista alcanca menos, o retrovisor desliga e ha menos particulas de clima.',
      'O retrovisor redesenha a cada poucos quadros e enxerga ate 150 metros, em vez de redesenhar a pista inteira a cada quadro.',
      'A camera para de desenhar logo depois do fim da neblina, onde nada mais aparece.',
      'Arvores, predios e outros enfeites fora da tela deixam de ser desenhados.',
      'Os efeitos sonoros viraram MP3: o download ficou cerca de 10 MB menor.',
    ],
  },
  {
    title: 'SALAS E CONEXAO',
    items: [
      'O menu inicial mostra no canto de cima, a direita, quantos jogadores estao conectados ao servidor agora (contando voce).',
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
