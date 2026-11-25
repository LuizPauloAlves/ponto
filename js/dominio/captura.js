// captura.js — regras da leitura do rosto, quadro a quadro: qualidade, desafio de vivacidade
// (mover a câmera em volta do rosto parado) e o roteiro guiado do cadastro. São máquinas de estado puras: recebem um rosto
// por chamada e devolvem o estado; quem lê a câmera fica em servicos/leitorFacial.js.
import { AJUSTES_PADRAO, CAPTURA, PASSOS_CADASTRO } from '../config.js';
import { mediaVetores } from './biometria.js';

export const INSTRUCOES = Object.freeze({
  sem_rosto: 'Posicione o rosto dentro do oval',
  longe: 'Aproxime a câmera do rosto',
  demais: 'Passou do ponto: volte a câmera um pouco',
  mesmo_lado: 'Esse lado já foi: agora para o outro lado',
  baixa_qualidade: 'Procure um lugar com mais luz no rosto',
});

const PASSOS_DE_LADO = new Set(['lado_a', 'lado_b']);

const media = (valores) => (valores.length ? valores.reduce((s, v) => s + v, 0) / valores.length : null);

/** Guarda os últimos `max` valores numéricos (antispoof e vivacidade variam de quadro a quadro). */
function criarJanela(max = Infinity) {
  const valores = [];
  return {
    somar(v) { if (typeof v === 'number') { valores.push(v); if (valores.length > max) valores.shift(); } },
    media: () => media(valores),
  };
}

/**
 * O rosto serve? { ok } ou { ok: false, motivo }.
 * `exigirVetor: false` vale para quadros lidos sem a impressão facial (só posição, anti-foto e vivacidade).
 */
export function avaliarRosto(rosto, larguraVideo, { regras = CAPTURA, exigirVetor = true } = {}) {
  if (!rosto) return { ok: false, motivo: 'sem_rosto' };
  if ((rosto.score ?? 0) < regras.scoreMin) return { ok: false, motivo: 'baixa_qualidade' };
  if ((rosto.largura ?? 0) < Math.max(regras.larguraMinPx, larguraVideo * regras.larguraMinFracao)) return { ok: false, motivo: 'longe' };
  if (exigirVetor && !rosto.embedding?.length) return { ok: false, motivo: 'baixa_qualidade' };
  return { ok: true };
}

/** Antispoof (anti-foto) e vivacidade acima do mínimo. Valor ausente (modelo indisponível) não reprova. */
export function vivacidadeAprovada(real, live, { minReal, minLive }) {
  return (real === null || real >= minReal) && (live === null || live >= minLive);
}

/**
 * Desafio de vivacidade: mudar o ângulo câmera/rosto para um lado e voltar de frente. Uma foto parada
 * não consegue. Somado aos modelos antispoof e liveness da Human, dificulta bastante fraudes.
 * Fases: procurando → virar → frente → pronto | falhou.
 * Só a fase "frente" usa a impressão facial (precisaVetor): antes dela, ler o vetor seria trabalho jogado fora.
 */
export function criarDesafio(opcoes = {}) {
  const o = { ...CAPTURA, minReal: AJUSTES_PADRAO.minReal, minLive: AJUSTES_PADRAO.minLive, ...opcoes };
  let fase = 'procurando';
  const reais = criarJanela(20);
  const vivos = criarJanela(20);
  const vetores = [];

  const PROGRESSO = { procurando: () => 0.08, virar: () => 0.33, frente: () => 0.6 + (0.35 * vetores.length) / o.framesFrente, pronto: () => 1, falhou: () => 1 };
  const TEXTO = {
    virar: 'Mova a câmera levemente para um lado, com o rosto parado',
    frente: 'Agora volte a câmera para a frente do rosto',
    pronto: 'Reconhecendo…',
    falhou: 'Não foi possível confirmar que é uma pessoa ao vivo',
  };

  function estado(motivo) {
    const encerrado = fase === 'pronto' || fase === 'falhou';
    const instrucao = fase === 'procurando' || (motivo && !encerrado) ? INSTRUCOES[motivo] || INSTRUCOES.sem_rosto : TEXTO[fase];
    return { fase, instrucao, progresso: PROGRESSO[fase](), embeddings: vetores.slice(), real: reais.media(), live: vivos.media() };
  }

  function avancar(rosto) {
    const yaw = Math.abs(rosto.yaw ?? 0);
    if (fase === 'procurando') fase = 'virar';
    if (fase === 'virar') {
      if (yaw >= o.yawVirar) fase = 'frente';
      return;
    }
    const deFrente = yaw < o.yawFrente && Math.abs(rosto.pitch ?? 0) < o.pitchFrente;
    if (!deFrente) { vetores.length = 0; return; }
    vetores.push(rosto.embedding);
    if (vetores.length >= o.framesFrente) fase = vivacidadeAprovada(reais.media(), vivos.media(), o) ? 'pronto' : 'falhou';
  }

  return {
    precisaVetor: () => fase === 'frente',
    atualizar(rosto, qualidade) {
      if (fase === 'pronto' || fase === 'falhou') return estado();
      if (!rosto || (qualidade && !qualidade.ok)) {
        if (fase === 'frente') vetores.length = 0;
        return estado(qualidade?.motivo || 'sem_rosto');
      }
      reais.somar(rosto.real);
      vivos.somar(rosto.live);
      avancar(rosto);
      return estado();
    },
  };
}

/** Roteiro guiado do cadastro: cada passo gera 1 modelo (média de alguns quadros). */
export function criarRoteiroCadastro(passos = PASSOS_CADASTRO, opcoes = {}) {
  const o = { ...CAPTURA, ...opcoes };
  let indice = 0;
  let coletados = [];
  let pausa = 0;
  let quadrosNoPasso = 0;
  let ladoInicial = 0;
  let larguraDeFrente = 0;
  const templates = [];
  const reais = criarJanela();
  const vivos = criarJanela();

  const deFrente = (r) => Math.abs(r.yaw ?? 0) < o.yawFrente && Math.abs(r.pitch ?? 0) < o.pitchFrente;
  const deLado = (r) => Math.abs(r.yaw ?? 0) >= o.yawLadoMin && Math.abs(r.yaw ?? 0) <= o.yawLadoMax;
  const CONDICOES = {
    lado_a: deLado,
    lado_b: (r) => deLado(r) && Math.sign(r.yaw) === -ladoInicial,
    distante: (r) => deFrente(r) && (larguraDeFrente === 0 || r.largura <= larguraDeFrente * 0.85 || quadrosNoPasso > o.toleranciaDistante),
  };
  const atende = (passo, rosto) => (CONDICOES[passo.id] || deFrente)(rosto);
  /** Dica para os passos de lado: rosto inteiro virado (ângulo demais) ou repetiu o lado do passo anterior. */
  function dicaDeLado(passo, rosto) {
    if (!PASSOS_DE_LADO.has(passo.id)) return null;
    if (Math.abs(rosto.yaw ?? 0) > o.yawLadoMax) return 'demais';
    if (passo.id === 'lado_b' && deLado(rosto) && Math.sign(rosto.yaw) === ladoInicial) return 'mesmo_lado';
    return null;
  }

  function estado(motivo) {
    const concluido = indice >= passos.length;
    const passo = passos[Math.min(indice, passos.length - 1)];
    let instrucao = pausa > 0 ? 'Muito bem' : passo.instrucao;
    if (motivo) instrucao = INSTRUCOES[motivo];
    if (concluido) instrucao = 'Pronto';
    return {
      concluido, passo: indice, total: passos.length, instrucao,
      progresso: (indice + coletados.length / o.framesPorPasso) / passos.length,
      templates: templates.slice(), real: reais.media(), live: vivos.media(),
    };
  }

  function concluirPasso(passo) {
    templates.push(mediaVetores(coletados.map((c) => c.embedding)));
    if (passo.id === 'lado_a') ladoInicial = Math.sign(media(coletados.map((c) => c.yaw ?? 0))) || 1;
    if (passo.id === 'frente') larguraDeFrente = media(coletados.map((c) => c.largura ?? 0));
    coletados = [];
    quadrosNoPasso = 0;
    pausa = o.pausaEntrePassos;
    indice += 1;
  }

  return {
    atualizar(rosto, qualidade) {
      if (indice >= passos.length) return estado();
      if (!rosto || (qualidade && !qualidade.ok)) { coletados = []; return estado(qualidade?.motivo || 'sem_rosto'); }
      reais.somar(rosto.real);
      vivos.somar(rosto.live);
      if (pausa > 0) { pausa -= 1; return estado(); }
      quadrosNoPasso += 1;
      const passo = passos[indice];
      const dica = dicaDeLado(passo, rosto);
      if (dica) { coletados = []; return estado(dica); }
      if (!atende(passo, rosto)) { coletados = []; return estado(); }
      coletados.push(rosto);
      if (coletados.length >= o.framesPorPasso) concluirPasso(passo);
      return estado();
    },
  };
}
