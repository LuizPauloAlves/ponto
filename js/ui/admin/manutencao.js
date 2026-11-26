// manutencao.js — aba Ajustes (parte 2): envios pendentes, desempenho e conexão do aparelho.
import { HISTORICO_LOCAL_DIAS } from '../../config.js';
import { rotuloDoTipo } from '../../dominio/jornada.js';
import { dataCurta, horaLocal } from '../../dominio/tempo.js';
import { linkDeConfiguracao } from '../conexao.js';
import { $, el } from '../dom.js';

const LEITURAS_DO_TESTE = 150;
const MAX_ITENS_NA_TELA = 20;

const megabytes = (bytes) => (bytes ? `${(bytes / 1048576).toFixed(1)} MB` : 'indisponível neste navegador');

/** Estável = memória da IA parada e tempo por leitura sem piorar muito do começo ao fim. */
const desempenhoEstavel = (r) => (r.tensoresFim ?? 0) - (r.tensoresInicio ?? 0) <= 2 && r.msFim < r.msInicio * 1.5 + 20;

function descreverTeste(r) {
  const conclusao = desempenhoEstavel(r)
    ? 'Resultado: estável, sem vazamento de memória.'
    : 'Resultado: o desempenho caiu durante o teste. Feche outros apps e repita; se continuar, envie este texto ao suporte.';
  return `${r.leituras} leituras no motor ${r.backend}. Tempo por leitura: ${Math.round(r.msInicio)} ms no início e ${Math.round(r.msFim)} ms no fim. `
    + `Memória da IA: ${r.tensoresInicio} → ${r.tensoresFim} tensores. ${conclusao}`;
}

function descreverItemDaFila(item, agora) {
  const r = item.registro;
  const proxima = item.proximaEm > agora ? `Próxima às ${horaLocal(item.proximaEm)}.` : 'Na fila.';
  const erro = item.ultimoErro ? ` Último erro: ${item.ultimoErro}.` : '';
  return `${r.nome}, ${rotuloDoTipo(r.tipo)} ${horaLocal(r.timestamp)} (${dataCurta(r.timestamp)}). ${item.tentativas} tentativa(s).${erro} ${proxima}`;
}

/** Aviso antes de sair do modo empresa: o que acontece com o cadastro e com os envios pendentes. */
function avisoDeSaida(acao, pendentes) {
  const fila = pendentes
    ? ` ${pendentes} ponto(s) ainda não foram para a planilha: ficam guardados e são enviados se este aparelho for conectado de novo a este servidor.`
    : '';
  return `${acao} O cadastro baixado (com os modelos faciais) é apagado deste aparelho.${fila}`;
}

export function criarSecaoManutencao({ sincronizador, ia, banco, diario, telaCamera, aviso, catalogo, aparelho, modoDeUso }) {
  const fila = $('#aj-fila');
  const diagnostico = $('#aj-diag');
  const resultadoTeste = $('#aj-teste-res');
  const textoConexao = $('#aj-conexao');
  const visivel = () => !$('#tela-admin').hidden && !$('#aba-ajustes').hidden;

  function mostrarFila({ itens }) {
    if (!itens.length) { fila.replaceChildren(el('p', { class: 'texto-apoio', text: 'Nenhum envio pendente.' })); return; }
    const agora = Date.now();
    fila.replaceChildren(
      ...itens.slice(0, MAX_ITENS_NA_TELA).map((i) => el('div', { class: 'fila-item', text: descreverItemDaFila(i, agora) })),
      itens.length > MAX_ITENS_NA_TELA ? el('p', { class: 'texto-apoio', text: `E mais ${itens.length - MAX_ITENS_NA_TELA}.` }) : null,
    );
  }

  async function mostrarDiagnostico() {
    const s = ia.estatisticas();
    const [registros, pendentes, erros] = await Promise.all([banco.historico.contar(), banco.fila.contar(), diario.listar()]);
    const linhas = [
      ['Motor da IA', s.carregado ? (s.backend || '?') : 'ainda não carregado'],
      ['Tempo por leitura', s.msPorLeitura ? `${Math.round(s.msPorLeitura)} ms` : '–'],
      ['Memória da IA', s.tensores !== null ? `${s.tensores} tensores, ${megabytes(s.memoriaGPU)}` : '–'],
      ['Memória do app', megabytes(s.heap)],
      ['Histórico no aparelho', `${registros} registros (apaga sozinho após ${HISTORICO_LOCAL_DIAS} dias)`],
      ['Envios pendentes', String(pendentes)],
      ['Erros recentes', erros.length ? `${erros.length}. Último: ${erros[erros.length - 1].msg}` : 'nenhum'],
    ];
    diagnostico.replaceChildren(...linhas.flatMap(([chave, valor]) => [el('dt', { text: chave }), el('dd', { text: valor })]));
  }

  async function mostrarConexao() {
    const conexao = await banco.preferencias.ler('conexao');
    textoConexao.textContent = conexao ? `Conectado a ${conexao.url.replace(/(\/s\/.{6}).*(.{6}\/exec)$/, '$1…$2')}` : '';
  }

  async function testarDesempenho() {
    try {
      const r = await telaCamera.medirDesempenho(LEITURAS_DO_TESTE);
      if (!r) return;
      resultadoTeste.replaceChildren(el('p', { class: 'texto-apoio', text: descreverTeste(r) }));
      mostrarDiagnostico();
    } catch (e) {
      resultadoTeste.replaceChildren(el('p', { class: 'msg-erro', text: e.message }));
    }
  }

  async function copiarLink() {
    const link = linkDeConfiguracao(await banco.preferencias.ler('conexao'));
    try {
      await navigator.clipboard.writeText(link);
      aviso.mostrar('Link copiado. Abra no outro aparelho para conectar sem digitar. Não compartilhe em grupos públicos.', 6000);
    } catch {
      window.prompt('Copie o link:', link);
    }
  }

  /** Sai do modo empresa (desconectar ou trocar para a opção 2), depois de confirmar. */
  async function sairDoModoEmpresa(pergunta, trocar) {
    if (!window.confirm(avisoDeSaida(pergunta, await banco.fila.contar()))) return;
    await catalogo.esquecer();
    await aparelho.definirDono(null);
    await trocar();
    location.replace(location.pathname);
  }

  $('#aj-enviar').addEventListener('click', async () => {
    aviso.mostrar('Enviando…');
    await sincronizador.sincronizar({ forcar: true });
    mostrarDiagnostico();
  });
  $('#aj-teste').addEventListener('click', testarDesempenho);
  $('#aj-link').addEventListener('click', copiarLink);
  $('#aj-desconectar').addEventListener('click', () =>
    sairDoModoEmpresa('Desconectar este aparelho? Na próxima abertura ele mostra a escolha entre as opções 1 e 2.', modoDeUso.voltarParaEscolha));
  $('#aj-pessoal').addEventListener('click', () =>
    sairDoModoEmpresa('Trocar este aparelho para a opção 2 (só neste celular, sem rosto e sem GPS)?', modoDeUso.usarSoNesteCelular));
  sincronizador.aoMudar((estado) => { if (visivel()) mostrarFila(estado); });

  return {
    async mostrar() {
      mostrarFila(await sincronizador.status());
      mostrarDiagnostico();
      mostrarConexao();
    },
  };
}
