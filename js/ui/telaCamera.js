// telaCamera.js — a tela cheia da câmera: abre, mostra instruções e progresso, e repete a
// leitura quando a pessoa pede. O laço "abrir → ler → falhou? tentar de novo / PIN / cancelar"
// existe uma vez só (capturar) e serve ao ponto e ao cadastro.
import { $ } from './dom.js';
import { FALHA_CADASTRO } from './textos.js';

export function criarTelaCamera({ camera, leitor, ia }) {
  const raiz = $('#camera');
  const video = $('#video');
  const textoInstrucao = $('#instrucao');
  const arco = $('#guia-progresso');
  const selo = $('#chip-gps');
  const acoes = $('#cam-acoes');
  const botaoTentar = $('#cam-tentar');
  const botaoPin = $('#cam-pin');
  let sessao = null;            // { cancelado } da leitura em andamento
  let responderEscolha = null;  // resolve a pergunta "tentar | pin | cancelar" em aberto

  const instrucao = (texto) => { textoInstrucao.textContent = texto; };
  const progresso = (fracao) => { arco.style.strokeDashoffset = String(100 - Math.max(0, Math.min(1, fracao)) * 100); };
  const mostrarEstado = (e) => { instrucao(e.instrucao); progresso(e.progresso); };
  const mostrarPasso = (e) => {
    instrucao(e.concluido ? 'Pronto' : `${e.instrucao} (${Math.min(e.passo + 1, e.total)} de ${e.total})`);
    progresso(e.progresso);
  };

  function escolher(opcao) {
    const responder = responderEscolha;
    responderEscolha = null;
    acoes.hidden = true;
    responder?.(opcao);
  }

  function fechar() {
    if (sessao) sessao.cancelado = true;
    sessao = null;
    escolher('cancelar');
    camera.fechar(video);
    raiz.hidden = true;
  }

  /** Abre a câmera numa sessão nova. Devolve a sessão, ou null se cancelaram enquanto abria. */
  async function abrir({ comGps }) {
    fechar();
    const nova = { cancelado: false };
    sessao = nova;
    raiz.hidden = false;
    selo.hidden = !comGps;
    selo.textContent = 'Localizando…';
    selo.className = 'chip';
    acoes.hidden = true;
    progresso(0);
    instrucao('Abrindo câmera…');
    await camera.abrir(video);
    if (nova.cancelado) { camera.fechar(video); return null; }
    if (!ia.carregada()) instrucao('Carregando reconhecimento facial… (só demora na primeira vez)');
    return nova;
  }

  /** Mostra a mensagem e espera a pessoa escolher: 'tentar' | 'pin' | 'cancelar'. */
  function perguntar(mensagem, { podeTentar, podePin }) {
    if (!sessao) return Promise.resolve('cancelar');
    instrucao(mensagem);
    progresso(0);
    botaoTentar.hidden = !podeTentar;
    botaoPin.hidden = !podePin;
    acoes.hidden = false;
    return new Promise((resolve) => { responderEscolha = resolve; });
  }

  function encerrar(opcao) {
    fechar();
    return opcao === 'pin' ? { pin: true } : null;
  }

  /**
   * Abre a câmera e repete `ler` até `interpretar` aceitar, a pessoa cancelar ou pedir o PIN.
   * interpretar(leitura) → { ok: true, valor } | { ok: false, mensagem }
   * Devolve { valor } | { pin: true } | null (cancelado).
   */
  async function capturar({ comGps, ler, interpretar, podePin = () => false }) {
    let atual;
    try {
      atual = await abrir({ comGps });
      if (!atual) return null;
    } catch (e) {
      return encerrar(await perguntar(e.message, { podeTentar: false, podePin: podePin(Infinity) }));
    }
    for (let falhas = 0; ;) {
      let leitura;
      try {
        leitura = await ler(atual);
      } catch (e) {
        return encerrar(await perguntar(e.message, { podeTentar: false, podePin: podePin(Infinity) }));
      }
      if (!leitura || atual.cancelado) return null;
      const resultado = interpretar(leitura);
      if (resultado.ok) { fechar(); return { valor: resultado.valor }; }
      falhas += 1;
      const opcao = await perguntar(resultado.mensagem, { podeTentar: true, podePin: podePin(falhas) });
      if (opcao !== 'tentar') return encerrar(opcao);
    }
  }

  const capturarPonto = ({ ajustes, interpretar, podePin }) => capturar({
    comGps: true,
    interpretar,
    podePin,
    ler: (s) => leitor.lerParaPonto(video, { ajustes, sessao: s, aoEstado: mostrarEstado }),
  });

  const capturarCadastro = ({ passos, ajustes }) => capturar({
    comGps: false,
    ler: (s) => leitor.lerParaCadastro(video, { passos, ajustes, sessao: s, aoEstado: mostrarPasso }),
    interpretar: (r) => (r.status === 'capturado' ? { ok: true, valor: r.templates } : { ok: false, mensagem: FALHA_CADASTRO[r.status] }),
  });

  async function medirDesempenho(leituras) {
    try {
      const atual = await abrir({ comGps: false });
      if (!atual) return null;
      instrucao(`Mantenha o rosto na câmera. Medindo ${leituras} leituras…`);
      return await ia.medirDesempenho(video, leituras, progresso, atual);
    } finally {
      fechar();
    }
  }

  function mostrarGps(texto, ok) {
    selo.className = `chip ${ok ? 'ok' : 'ruim'}`;
    selo.textContent = texto;
  }

  $('#cam-fechar').addEventListener('click', fechar);
  botaoTentar.addEventListener('click', () => escolher('tentar'));
  botaoPin.addEventListener('click', () => escolher('pin'));
  // Saiu do app com a câmera aberta? Desliga tudo (privacidade e bateria).
  document.addEventListener('visibilitychange', () => { if (document.hidden && !raiz.hidden) fechar(); });

  return { capturarPonto, capturarCadastro, medirDesempenho, mostrarGps, fechar };
}
