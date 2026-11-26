// main.js — ponto de entrada. É o único arquivo que conhece todas as peças: cria cada uma,
// entrega a cada outra o que ela precisa (injeção de dependências) e liga as telas.
// Nenhum outro módulo importa banco, servidor ou tela diretamente para "se virar sozinho".
import { ABERTURA, HISTORICO_LOCAL_DIAS } from './config.js';
import * as banco from './infra/banco.js';
import * as camera from './infra/camera.js';
import * as ia from './infra/ia.js';
import { criarServidor } from './infra/servidor.js';
import { carregarAparelho } from './servicos/aparelho.js';
import { criarCatalogo } from './servicos/catalogo.js';
import { criarDiario } from './servicos/diario.js';
import { criarLeitorFacial } from './servicos/leitorFacial.js';
import { criarModoDeUso, MODO } from './servicos/modoDeUso.js';
import { criarMeuPonto } from './servicos/meuPonto.js';
import { criarReconhecimento } from './servicos/reconhecimento.js';
import { criarRegistroPonto } from './servicos/registroPonto.js';
import { criarSincronizador } from './servicos/sincronizador.js';
import { criarAbertura } from './ui/abertura.js';
import { criarAdmin } from './ui/admin/admin.js';
import { criarConfirmacao } from './ui/confirmacao.js';
import { aceitarLinkDeConfiguracao, criarTelaConexao } from './ui/conexao.js';
import { criarDialogoPin } from './ui/dialogoPin.js';
import { $, criarAviso, mostrarTela } from './ui/dom.js';
import { criarFluxoPonto } from './ui/fluxoPonto.js';
import { criarTelaInicio } from './ui/inicio.js';
import { criarConviteInstalacao } from './ui/instalacao.js';
import { criarAjustesPessoais } from './ui/meuPonto/ajustesPessoais.js';
import { criarEditorDia } from './ui/meuPonto/editorDia.js';
import { criarInicioPessoal } from './ui/meuPonto/inicioPessoal.js';
import { criarMeuMes } from './ui/meuPonto/meuMes.js';
import { iniciarRelogio } from './ui/relogio.js';
import { criarSucesso } from './ui/sucesso.js';
import { criarTelaCamera } from './ui/telaCamera.js';

const DIA_MS = 86400000;
const ATUALIZAR_CADASTRO_MS = 30 * 60000;
const CADASTRO_VELHO_MS = 10 * 60000;
const TEMPO_DO_ENVIO_MS = 45000;

const abertura = criarAbertura($('#abertura'), ABERTURA);
const aviso = criarAviso($('#aviso'));
const diario = criarDiario({ preferencias: banco.preferencias });
const modoDeUso = criarModoDeUso({ preferencias: banco.preferencias });
window.addEventListener('error', (e) => diario.registrar(e.message));
window.addEventListener('unhandledrejection', (e) => diario.registrar(e.reason?.message || e.reason));
criarConviteInstalacao({ preferencias: banco.preferencias }); // antes de qualquer await: o aviso do navegador chega cedo

/** Registrado já na primeira abertura, antes mesmo de conectar: o app passa a abrir sem internet. */
function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js', { type: 'module' }).catch((e) => diario.registrar(`SW: ${e.message}`));
}

/** O service worker avisa quando enviou a fila em segundo plano. */
function aoServiceWorkerEnviar(fn) {
  navigator.serviceWorker?.addEventListener('message', (e) => { if (e.data?.tipo === 'fila-atualizada') fn(); });
}

/**
 * Carrega a IA (a parte mais demorada) antes do toque em "Registrar ponto". Repetir é barato: carrega uma vez só.
 * A promessa termina quando a IA fica pronta ou falha (o erro vai para o diário; a câmera avisa a pessoa depois).
 */
const prepararIa = () => (ia.carregada() ? Promise.resolve() : ia.carregar().then(() => {}, (e) => diario.registrar(`IA: ${e.message}`)));

/** Roda logo depois de a tela aparecer: o trabalho pesado não atrasa o primeiro desenho. */
const depoisDoPrimeiroDesenho = (fn) => requestAnimationFrame(() => setTimeout(fn, 0));

/** No Android, pede ao navegador que envie a fila quando a internet voltar, mesmo com o app fechado. */
function pedirEnvioEmSegundoPlano() {
  navigator.serviceWorker?.ready.then((r) => r.sync?.register('enviar-pontos')).catch(() => {});
}

/** O navegador promete não apagar os dados sozinho? (Em geral sim com o app instalado.) */
const pedirArmazenamentoGarantido = () => navigator.storage?.persist?.().catch(() => false) ?? Promise.resolve(false);

/** Modo "só neste celular": registrar, ver o mês, corrigir e exportar. Sem rosto, GPS nem servidor. */
function iniciarModoPessoal() {
  abertura.mostrarTexto('Abrindo o seu ponto…');
  const meuPonto = criarMeuPonto({ armazem: banco.meuPonto, preferencias: banco.preferencias });
  const meuMes = criarMeuMes({ meuPonto, editorDia: criarEditorDia({ meuPonto }), aviso });
  const ajustes = criarAjustesPessoais({
    meuPonto, aviso,
    aoSalvar: () => meuMes.atualizar(),
    aoTrocarParaEmpresa: async () => { await modoDeUso.voltarParaEscolha(); location.replace(location.pathname); },
  });
  const inicio = criarInicioPessoal({
    meuPonto, confirmacao: criarConfirmacao(), sucesso: criarSucesso(),
    aoAbrirMes: () => { location.hash = 'meu'; },
  });

  function rotear() {
    aviso.esconder();
    if (location.hash === '#meu') {
      mostrarTela('meu');
      meuMes.mostrar();
      ajustes.mostrar();
      return;
    }
    mostrarTela('inicio');
    inicio.atualizarHoje();
  }

  $('#meu-voltar').addEventListener('click', () => history.back());
  window.addEventListener('hashchange', rotear);
  if (location.hash === '#meu') history.replaceState(null, '', location.pathname); // sempre abre no início
  rotear();
  iniciarRelogio({ hora: $('#hora'), data: $('#data'), agora: Date.now, aoMudarDia: inicio.atualizarHoje });
  pedirArmazenamentoGarantido().then(inicio.mostrarStatus);
  abertura.encerrarQuando({ minimoMs: ABERTURA.pessoalMs }); // sem câmera nem GPS: só a animação, mais curta
}

async function iniciar() {
  registrarServiceWorker();
  await aceitarLinkDeConfiguracao(banco.preferencias);
  const servidor = criarServidor({ obterConexao: () => banco.preferencias.ler('conexao') });
  const telaConexao = criarTelaConexao({ servidor, preferencias: banco.preferencias, modoDeUso });
  const modo = await modoDeUso.atual(); // abre direto no modo escolhido antes
  if (modo === MODO.empresa) return iniciarModoEmpresa({ conexao: await banco.preferencias.ler('conexao'), servidor, telaConexao });
  if (modo === MODO.pessoal) return iniciarModoPessoal();
  telaConexao.mostrar();
  abertura.encerrarQuando();
  return undefined;
}

/** Modo empresa: rosto, GPS e envio para a planilha do Drive. */
async function iniciarModoEmpresa({ conexao, servidor, telaConexao }) {
  abertura.mostrarTexto('Preparando o reconhecimento facial…');
  // Serviços
  const aparelho = await carregarAparelho({ preferencias: banco.preferencias });
  const catalogo = criarCatalogo({ preferencias: banco.preferencias, servidor });
  await catalogo.carregar();
  const sincronizador = criarSincronizador({
    fila: banco.fila,
    enviar: (registros) => servidor.chamar('registrarPontos', { registros }, { timeout: TEMPO_DO_ENVIO_MS }),
    aoHoraServidor: (diferenca) => aparelho.ajustarRelogio(diferenca),
    aoConfirmar: (ids) => banco.historico.marcarEnviados(ids),
  });
  const registroPonto = criarRegistroPonto({ historico: banco.historico, sincronizador, aparelho, catalogo, aoErro: diario.registrar });
  const reconhecimento = criarReconhecimento({ catalogo, aparelho });

  // Telas
  const telaCamera = criarTelaCamera({ camera, ia, leitor: criarLeitorFacial({ ia }) });
  const telaInicio = criarTelaInicio({ registroPonto, sincronizador, catalogo, aparelho, aviso });

  /** Atualiza o cadastro sem travar nada; se o token mudou no servidor, volta para a tela de conexão. */
  function atualizarCatalogo() {
    return catalogo.atualizar().then(() => true, (e) => {
      if (e.codigo === 'token') telaConexao.mostrar({ url: conexao.url, mensagem: 'O token mudou no servidor. Digite o token novo.' });
      return false;
    });
  }

  function rotear() {
    if (location.hash === '#admin' && admin.autenticado()) { admin.mostrar(); return; }
    if (location.hash === '#admin') history.replaceState(null, '', location.pathname);
    admin.sair();
    mostrarTela('inicio');
    aviso.esconder();
    telaInicio.atualizarHoje();
  }

  const fluxoPonto = criarFluxoPonto({
    catalogo, aparelho, registroPonto, reconhecimento, telaCamera, aviso,
    confirmacao: criarConfirmacao(),
    dialogoPin: criarDialogoPin(),
    sucesso: criarSucesso(),
    aoFaltarCadastro: atualizarCatalogo,
    aoRegistrar: () => { telaInicio.atualizarHoje(); pedirEnvioEmSegundoPlano(); },
  });
  const admin = criarAdmin({
    servidor, catalogo, aparelho, sincronizador, reconhecimento, telaCamera, ia, banco, diario, aviso, modoDeUso,
    aoSair: rotear,
    aoMudarDono: () => { telaInicio.atualizarModo(); telaInicio.atualizarHoje(); },
  });

  // Eventos
  $('#btn-registrar').addEventListener('click', () => fluxoPonto.iniciar());
  window.addEventListener('hashchange', rotear);
  window.addEventListener('online', () => sincronizador.sincronizar({ forcar: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    prepararIa(); // se falhou antes (ex.: sem internet na primeira vez), tenta de novo ao voltar ao app
    if (catalogo.idadeMs() > CADASTRO_VELHO_MS) atualizarCatalogo();
  });
  aoServiceWorkerEnviar(() => sincronizador.notificar());

  // Partida
  rotear();
  iniciarRelogio({ hora: $('#hora'), data: $('#data'), agora: aparelho.agora, aoMudarDia: telaInicio.atualizarHoje });
  telaInicio.atualizarModo();
  sincronizador.sincronizar();
  atualizarCatalogo();
  banco.historico.apagarAntesDe(Date.now() - HISTORICO_LOCAL_DIAS * DIA_MS).catch(() => {});
  depoisDoPrimeiroDesenho(() => abertura.encerrarQuando({ pronto: prepararIa() }));
  setInterval(() => { if (!document.hidden) atualizarCatalogo(); }, ATUALIZAR_CADASTRO_MS);
}

iniciar().catch((e) => {
  abertura.encerrarQuando();
  diario.registrar(e.message);
  aviso.mostrar(`Erro ao iniciar: ${e.message}`, 8000);
});
