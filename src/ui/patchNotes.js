// Texto da tela PATCH NOTES do menu inicial: o que mudou no multiplayer desde o último commit ("novas fases").
// Cada seção tem um título e uma lista de itens; a tela quebra as linhas e rola com a roda do mouse.
// A fonte desenha os acentos das minúsculas; nas maiúsculas fica só a letra (art/font.js).

export const PATCH_NOTES = [
  {
    title: 'ESTATÍSTICAS',
    items: [
      'Nas estatísticas, o número fica verde quando aquele jogador é o melhor de todos naquele item (nas mortes, quedas em armadilha e lideranças perdidas, o melhor é o menor).',
      'Nova estatística no COMBATE: maior sequência de abates numa corrida, sem morrer no meio. Conta a partir das próximas corridas rankeadas.',
    ],
  },
  {
    title: 'CORREÇÕES',
    items: [
      'Em alguns pontos da Floresta, Praia, Pântano Elétrico, Estrada do Rei e Porto dos Piratas o cenário inteiro sumia e só sobrava a mão. Corrigido.',
      'As muralhas do castelo da Estrada do Rei não deixam mais ver através delas por dentro do pátio.',
      'Em algumas pistas da Estrada do Rei a ponte levadiça era impossível: o começo do pátio virava uma parede e todo mundo caía no fosso. Corrigido.',
    ],
  },
  {
    title: 'RANKING: ESTATÍSTICAS',
    items: [
      'Nova aba ESTATÍSTICAS no lugar do RANKING ANTIGO, com duas páginas: GERAL e COMBATE (botões à direita do nome do jogador).',
      'As setas trocam o jogador; clicar no nome volta para as suas. Clicar num jogador da tabela do ranking abre as estatísticas dele.',
      'GERAL: desempenho, vitórias, pódios, abates por partida, maiores sequências de vitórias e de pódios, distância média para o vencedor e photo finishes (chegadas a menos de 0,5 s de alguém). Vale para todas as corridas rankeadas já jogadas.',
      'GERAL também mostra o melhor mapa, o pior e o mais jogado, e o confronto direto contra cada adversário: quantas corridas juntos e quem chegou na frente mais vezes.',
      'COMBATE: abates, mortes, abates por morte, % de mira, armadilhas soltas e quantas pegaram alguém, vezes que caiu em armadilha, vítimas favoritas, carrascos e forma do abate (tiro, pancada, fogo, explosão).',
      'COMBATE também mostra a liderança: % do tempo na frente, tempo médio na frente por corrida e quantas vezes perdeu a ponta. Quem mede é o admin, então todos veem o mesmo número.',
      'A mira conta os disparos que machucaram algum carro; a explosão de granada que pega alguém também vale. Toda destruição conta como morte, até queda e obstáculo.',
      'Os números de COMBATE só contam a partir desta versão e só em partidas rankeadas. Todos da sala precisam estar com o jogo atualizado.',
      'A aba RANKING não fica mais presa em CARREGANDO... quando aberta logo depois de abrir o jogo.',
    ],
  },
  {
    title: 'ITENS NOVOS: CAMUFLAGEM E BARREIRA INFLÁVEL',
    items: [
      'CAMUFLAGEM (defesa): o carro some da frente para trás em 0,8 s e fica invisível por 6 s. Só a lataria some: fogo, tinta, rede, escudo e mina grudada continuam à vista, e o motor continua roncando. A fumaça do dano some junto.',
      'Camuflado, ninguém trava a mira em você: os bots não atiram e mina, rede e arpão não o escolhem como alvo (a mina já em voo perde o rastro). Bala perdida e batida ainda pegam. Destruído, a camuflagem acaba.',
      'BARREIRA INFLÁVEL (controle): cai atrás do carro, com a largura de um carro, e enche em 1 s (só bloqueia depois de cheia). Quem bate estoura a barreira e perde muita velocidade. Aguenta uns 3 tiros de revólver e murcha sozinha depois de 25 s.',
      'Dino agora leva a barreira no lugar da fumaça, e Ruiva a camuflagem no lugar do escudo.',
    ],
  },
  {
    title: 'MAPA NOVO: PORTO DOS PIRATAS',
    items: [
      'A pista inteira é um píer de tábuas sobre palafitas, com mar dos dois lados, ao entardecer. Navios piratas ficam atracados colados no píer e ancorados pelo mar, com botes, gaivotas e faróis em ilhotas de pedra.',
      'Duas travessias por cima de navios: uma prancha sobe até o convés, que é bem mais estreito que a pista e não tem mureta, e outra prancha desce. Quem sai pela beirada cai no mar.',
      'Pista dividida: num trecho o meio do píer abre para o mar e sobram duas faixas, uma de cada lado. A boia vermelha marca a ponta; quem segue pelo meio cai.',
      'Navios atracados bem perto da pista atiram com os canhões: uma mira vermelha pisca no chão onde a bala vai cair, o canhão estoura no costado e a bala chega em arco. Saia de cima da mira.',
      'Barris escapam dos atracadouros de carga e atravessam a pista rolando. Uma ponte de corda sem mureta e a maré alta, que alaga o píer e deixa as tábuas escorregando.',
    ],
  },
  {
    title: 'DESFILADEIRO: BEIRA DO PENHASCO',
    items: [
      'Em dois ou três trechos a estrada corre na beira do penhasco: um dos lados não tem muro, e depois da zebra é o abismo até o rio lá embaixo. O lado aberto muda de um trecho para o outro.',
      'Quem passa da beira cai e volta no começo do trecho, como quem cai da ponte. As rajadas de vento sopram nesses trechos, e as pedras caem do paredão do outro lado.',
    ],
  },
  {
    title: 'MAPA NOVO: ESTRADA DO REI',
    items: [
      'Estrada de pedra entre campos de grama, aldeias com telhado de palha, moinhos e cercas de madeira.',
      'Mata fechada longa (uns 800 m) de curvas bem onduladas e pista estreita, cercada de moitas e árvores coladas na estrada. Cervos e javalis (bem mais rápidos) atravessam a pista, e há bichos pastando entre as árvores.',
      'Carruagens andam devagar pela estrada (umas 7 ou 8 por pista, uma delas parada logo antes da ponte). Elas não quebram: quem bate quica e perde velocidade, e tiro não as derruba.',
      'Ponte levadiça: ela é a rampa sobre o fosso e joga o carro pelo portão do castelo. O portão é baixo: quem sai do bico entre ~75 e ~105 km/h passa. Mais rápido que isso o carro bate na muralha e cai no fosso, então tire o pé antes da ponte. Devagar demais, não alcança a outra margem.',
      'Dentro do castelo a pista é um carro mais estreita, com piso de mármore e tapete do rei, e faz quatro curvas fechadas de 90° em volta do pátio da torre de menagem.',
    ],
  },
  {
    title: 'VOTAÇÃO DE MAPA',
    items: [
      'A partir da segunda corrida da partida, quem venceu a corrida anterior pode excluir um dos mapas da votação: é o botão X no canto do mapa. O mapa fica riscado e quem tinha votado nele escolhe outro. Se um bot venceu, o direito vai para o humano mais bem colocado.',
      'Quem mais abateu na corrida anterior tem o voto dobrado (aparecem dois quadradinhos). Empate em abates não dá o voto dobrado a ninguém.',
      'Quando alguém pode excluir um mapa, a votação dura 4 segundos a mais. Na primeira corrida nada disso vale. Todos da sala precisam estar com o jogo atualizado.',
    ],
  },
  {
    title: 'MAPAS MAIS NATURAIS',
    items: [
      'FLORESTA, PRAIA e PÂNTANO ELÉTRICO não têm mais muro: depois do acostamento vem o próprio cenário (moitas e mata na FLORESTA, capim de duna, pedras e coqueiros na PRAIA, juncal no PÂNTANO).',
      'Nesses três mapas o acostamento ficou com o dobro da largura, plano e no nível da pista. Fora da pista o carro continua freando.',
      'Vegetação nova: coqueiros de tronco curvo com folhas caídas e cocos, árvores com galhos e copa cheia, pinheiros, moitas, capim de duna, taboas e ciprestes com barba-de-velho.',
      'Piso novo: trilha de terra coberta de folhas na FLORESTA, areia dura com marcas de pneu na PRAIA e lama sem faixas pintadas no PÂNTANO.',
      'PRAIA sem quiosques, torres de salva-vidas, guarda-sóis, pranchas e bandeirolas na beira, e com acostamento de areia molhada no lugar do calçadão. No PÂNTANO os lampiões viraram cogumelos que brilham.',
      'PÂNTANO ELÉTRICO: os raios caem um pouco menos.',
    ],
  },
  {
    title: 'ABATES',
    items: ['Abater um rival agora também devolve vida: 10% da vida total, ou 15% se você estiver atrás.'],
  },
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
      'Abas RANKING, HISTÓRICO e ESTATÍSTICAS (o ranking local foi substituído).',
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
