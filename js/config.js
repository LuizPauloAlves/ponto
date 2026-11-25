// config.js — todas as constantes do app num só lugar (DRY): nenhum outro arquivo
// tem números ou listas "mágicas". O servidor (servidor/src/00_config.gs) repete
// TIPOS_PONTO e AJUSTES_PADRAO; tests/contrato.test.mjs falha se os dois lados divergirem.

/** Tipos de ponto na ordem do dia. `regra`: qual horário vale quando há mais de um no mesmo dia. */
export const TIPOS_PONTO = Object.freeze([
  Object.freeze({ id: 'entrada', rotulo: 'Entrada', regra: 'primeiro' }),
  Object.freeze({ id: 'saida_almoco', rotulo: 'Saída almoço', regra: 'primeiro' }),
  Object.freeze({ id: 'volta_almoco', rotulo: 'Volta almoço', regra: 'primeiro' }),
  Object.freeze({ id: 'saida', rotulo: 'Saída', regra: 'ultimo' }),
]);

/** Ajustes usados enquanto o administrador não muda nada (o servidor guarda os atuais). */
export const AJUSTES_PADRAO = Object.freeze({
  jornadaMin: 480,
  diasTrabalho: Object.freeze([1, 2, 3, 4, 5]),
  limiar: 0.55,        // similaridade mínima para aceitar o rosto
  margem: 0.06,        // diferença mínima entre o 1º e o 2º mais parecidos
  minReal: 0.55,       // anti-foto (antispoof)
  minLive: 0.55,       // vivacidade
  permitirPin: true,
  raioPadrao: 150,
});

export const MESES = Object.freeze(['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho',
  'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']);
export const DIAS_SEMANA = Object.freeze(['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']);

/** Fila de envio: 5 min nas 3 primeiras falhas, depois 10 min, sem limite, até o servidor confirmar. */
export const REENVIO = Object.freeze({
  minutosNoInicio: 5,
  tentativasNoInicio: 3,
  minutosDepois: 10,
  lote: 40,                  // registros por requisição
  verificacaoMaxMs: 60000,   // se o celular dormiu, o timer pode atrasar: confere ao menos 1x por minuto
});

export const GPS = Object.freeze({
  precisaoMaxM: 200,         // leitura pior que isso: "sinal fraco"
  folgaMaxM: 50,             // quanto da imprecisão conta a favor de quem está na borda do raio
  ponto: Object.freeze({ tempoMaxMs: 25000, precisaoAlvoM: 25 }),
  cadastroLocal: Object.freeze({ tempoMaxMs: 30000, precisaoAlvoM: 15, precisaoAceitavelM: 60 }),
});

/** Regras da leitura do rosto (ângulos em radianos, tamanhos em pixels). */
export const CAPTURA = Object.freeze({
  scoreMin: 0.6,
  larguraMinPx: 110,
  larguraMinFracao: 0.2,
  yawVirar: 0.25,            // ângulo (~14°) que a câmera precisa mudar no desafio de vivacidade
  yawFrente: 0.13,
  pitchFrente: 0.3,
  framesFrente: 3,
  yawLadoMin: 0.12,          // ~7°: "levemente" já basta
  yawLadoMax: 0.55,          // ~31°: passou disso, o app pede para voltar um pouco
  framesPorPasso: 3,
  pausaEntrePassos: 5,
  toleranciaDistante: 70,
  intervaloLeituraMs: 90,    // no máximo ~10 leituras por segundo
  tempoMaxPontoMs: 30000,
  tempoMaxCadastroMs: 120000,
});

/** Aprendizado de visual novo: só com reconhecimento forte, no máximo 1 por dia e 5 por pessoa. */
export const APRENDIZADO = Object.freeze({ folga: 0.08, teto: 0.88, intervaloMs: 20 * 3600 * 1000, maxModelos: 5 });

/**
 * Passos do cadastro. Quem segura o celular move a CÂMERA e o rosto fica parado: assim a pessoa
 * continua olhando para a tela e consegue ler a próxima instrução (virar o rosto inteiro escondia o texto).
 * Os lados aceitam qualquer ordem; "esquerda" e "direita" só orientam quem está segurando.
 */
const PASSO = Object.freeze({
  frente: Object.freeze({ id: 'frente', instrucao: 'Rosto de frente para a câmera' }),
  esquerda: Object.freeze({ id: 'lado_a', instrucao: 'Mova a câmera levemente para a esquerda, com o rosto parado' }),
  direita: Object.freeze({ id: 'lado_b', instrucao: 'Agora mova a câmera levemente para a direita (o outro lado)' }),
  sorriso: Object.freeze({ id: 'sorriso', instrucao: 'De frente para a câmera, com um sorriso' }),
  distante: Object.freeze({ id: 'distante', instrucao: 'Afaste um pouco a câmera, ainda de frente para o rosto' }),
});
export const PASSOS_CADASTRO = Object.freeze([PASSO.frente, PASSO.esquerda, PASSO.direita, PASSO.sorriso, PASSO.distante]);
export const PASSOS_VISUAL_NOVO = Object.freeze([PASSO.frente, PASSO.sorriso]);

/** Câmera usada no cadastro: a própria pessoa (frontal) ou alguém enquadrando o rosto dela (traseira). */
export const CAMERAS = Object.freeze({ frontal: 'frontal', traseira: 'traseira' });

export const PIN_TENTATIVAS = Object.freeze({ max: 5, bloqueioMs: 5 * 60000 });
export const HISTORICO_LOCAL_DIAS = 45;

/** Tela de abertura: fica até a IA estar pronta, entre estes limites (num celular, em geral 1,5 a 3 s). */
export const ABERTURA = Object.freeze({ minimoMs: 1500, maximoMs: 4000 });
export const HUMAN_VERSAO = '3.3.6';
