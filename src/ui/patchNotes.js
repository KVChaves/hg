// Texto da tela PATCH NOTES do menu inicial: o que mudou no multiplayer desde o último commit ("novas fases").
// Cada seção tem um título e uma lista de itens; a tela quebra as linhas e rola com a roda do mouse.
// A fonte desenha os acentos das minúsculas; nas maiúsculas fica só a letra (art/font.js).

export const PATCH_NOTES = [
  {
    title: 'AJUDA DE BEIRA DE ESTRADA',
    items: [
      'A ajuda mira deixar você a 90 a 110 metros do líder, distância em que ainda dá para se enxergar. Quanto mais longe do líder, maior a ajuda; mais perto que 90 metros ela diminui até sumir aos 30.',
      'Os dois NPCs da estrada sempre trazem uma oferta, e um deles sempre oferece NITRO. O outro traz o que mais falta a você: munição, armadilha ou extintor.',
      'O nitro do NPC pode ir de 15% até o tanque cheio, conforme a distância do líder. Acabou o intervalo de 30 segundos sem nitro entre uma oferta e outra.',
      'O NITRO AZUL do último colocado aparece quando ele está a mais de 110 metros do penúltimo.',
      'Os suprimentos de cada volta e a recompensa por abater um rival seguem a mesma medida de distância.',
    ],
  },
  {
    title: 'DENTRO DA CORRIDA',
    items: [
      'Olhar para trás pela janela não deixa mais o carro mais lento.',
    ],
  },
  {
    title: 'GARAGEM: APARÊNCIA',
    items: [
      'Nova peça ACABAMENTO: Brilhante, Fosco, Metálico (com purpurina), Perolado e Cromado.',
      'Nova peça TETO: Bagageiro, Antena com bandeira, Barbatana, Entrada de ar e Giroflex que pisca. Aceita qualquer cor.',
      'Nova peça NEON embaixo do carro: Embaixo, Nas rodas, Pulsante e Arco-íris. Os outros jogadores também veem.',
      'Novas pinturas: Camuflada, Tigrada, Faixas de corrida, Fibra de carbono e Degradê.',
      'Novos adesivos (Coração, Coroa, Alvo e Asas), frisos (Tracejado, Zigue-zague e Faixa degradê), faróis (Bravo e Faixa de LED), aros (Raios duplos e Calota) e números (00, 3, 11 e 77).',
      'Botão SORTEAR na aba APARÊNCIA: sorteia peças e cores que combinam entre si, sem mexer nas peças de desempenho compradas.',
      'Paleta com 20 cores prontas abaixo do seletor de cor.',
      'Peças com muitas opções mostram as miniaturas em duas linhas, sem ficarem espremidas.',
      'O seletor de cor não passa mais por cima do painel da direita.',
    ],
  },
  {
    title: 'DESEMPENHO',
    items: [
      'Nova opção QUALIDADE GRÁFICA em CONFIGURAÇÕES: BAIXA, MÉDIA e ALTA. Na BAIXA o mundo é desenhado em resolução menor (a cabine continua nítida), a vista alcança menos, o retrovisor desliga e há menos partículas de clima.',
      'O retrovisor redesenha a cada poucos quadros e enxerga até 150 metros, em vez de redesenhar a pista inteira a cada quadro.',
      'A câmera para de desenhar logo depois do fim da neblina, onde nada mais aparece.',
      'Árvores, prédios e outros enfeites fora da tela deixam de ser desenhados.',
      'Os efeitos sonoros viraram MP3: o download ficou cerca de 10 MB menor.',
    ],
  },
  {
    title: 'SALAS E CONEXÃO',
    items: [
      'O menu inicial mostra no canto de cima, à direita, quantos jogadores estão conectados ao servidor agora (contando você).',
      'Chat GLOBAL: todos os jogadores conectados leem todas as mensagens, em sala, corrida, menu ou garagem. Mensagem nova mostra um ícone de envelope no canto inferior esquerdo; ENTER ou um clique nele abre a caixa, e a mensagem é digitada ali. ENTER com texto envia e a caixa continua aberta; ENTER sem digitar nada, clicar fora ou ESC fecha. Mensagem nova toca um som de notificação.',
      'O jogo conecta ao servidor já na abertura, para o chat funcionar também fora das salas; o seu nome vale no chat mesmo sem estar numa sala.',
      'Reconexão: quem cai da sala guarda a vaga por alguns segundos e retoma de onde parou.',
      'ESC na garagem da sala volta ao menu principal.',
      'Espectando, o atalho para ir à garagem (online) ou ver os resultados passou de ENTER para ESPAÇO, porque o ENTER agora abre o chat.',
      'A sala pode proibir tiro para trás: com o olhar virado além de 90 graus nada dispara.',
      'Se o ADMIN sair, a sala não fecha mais: o jogador mais antigo da sala vira o novo admin e passa a controlar a partida e os bots. A sala só some quando fica vazia.',
    ],
  },
  {
    title: 'RANKING E HISTÓRICO',
    items: [
      'Ranking novo do servidor, com desempenho, corridas, vitórias, pódios, posição média, abates e partidas.',
      'Abas RANKING, HISTÓRICO e RANKING ANTIGO (o ranking local foi substituído).',
      'Histórico das corridas online: detalhe de cada corrida, filtro por jogador e resumo da partida com pontos.',
    ],
  },
  {
    title: 'DENTRO DA CORRIDA ONLINE',
    items: [
      'O clima dinâmico (chuva, nevasca e neblina) sai da semente da corrida: todos da sala veem a mesma coisa ao mesmo tempo.',
      'Os bots do seu navegador aprendem a arma dos carros remotos e passam a levar em conta o que cada jogador usa.',
      'A rede do lança-redes fica visível em todos os navegadores por cima do carro preso, e o aviso chega a quem simula o alvo.',
      'A mina grudada que passa de um carro para outro numa batida avisa a rede de novo a cada troca.',
      'As peças do carro (como a suspensão que muda o vácuo) funcionam entre jogadores: cada um só manda o id da peça.',
    ],
  },
];
