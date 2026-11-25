// main.js — ponto de entrada. É o único arquivo que conhece todas as peças: cria cada uma,
// entrega a cada outra o que ela precisa (injeção de dependências) e liga as telas.
// Nenhum outro módulo importa banco, servidor ou tela diretamente para "se virar sozinho".
import { HISTORICO_LOCAL_DIAS } from './config.js';
import * as banco from './infra/banco.js';
import * as camera from './infra/camera.js';
import * as ia from './infra/ia.js';
import { criarServidor } from './infra/servidor.js';
import { carregarAparelho } from './servicos/aparelho.js';
import { criarCatalogo } from './servicos/catalogo.js';
import { criarDiario } from './servicos/diario.js';
import { criarLeitorFacial } from './servicos/leitorFacial.js';
import { criarReconhecimento } from './servicos/reconhecimento.js';
import { criarRegistroPonto } from './servicos/registroPonto.js';
import { criarSincronizador } from './servicos/sincronizador.js';
import { criarAdmin } from './ui/admin/admin.js';
import { criarConfirmacao } from './ui/confirmacao.js';
import { aceitarLinkDeConfiguracao, criarTelaConexao } from './ui/conexao.js';
import { criarDialogoPin } from './ui/dialogoPin.js';
import { $, criarAviso, mostrarTela } from './ui/dom.js';
import { criarFluxoPonto } from './ui/fluxoPonto.js';
import { criarTelaInicio } from './ui/inicio.js';
import { iniciarRelogio } from './ui/relogio.js';
import { criarSucesso } from './ui/sucesso.js';
import { criarTelaCamera } from './ui/telaCamera.js';

const DIA_MS = 86400000;
const ATUALIZAR_CADASTRO_MS = 30 * 60000;
const CADASTRO_VELHO_MS = 10 * 60000;
const PRE_CARGA_DA_IA_MS = 1500;
const TEMPO_DO_ENVIO_MS = 45000;

const aviso = criarAviso($('#aviso'));
const diario = criarDiario({ preferencias: banco.preferencias });
window.addEventListener('error', (e) => diario.registrar(e.message));
window.addEventListener('unhandledrejection', (e) => diario.registrar(e.reason?.message || e.reason));

/** Registrado já na primeira abertura, antes mesmo de conectar: o app passa a abrir sem internet. */
function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js', { type: 'module' }).catch((e) => diario.registrar(`SW: ${e.message}`));
}

/** O service worker avisa quando enviou a fila em segundo plano. */
function aoServiceWorkerEnviar(fn) {
  navigator.serviceWorker?.addEventListener('message', (e) => { if (e.data?.tipo === 'fila-atualizada') fn(); });
}

/** No Android, pede ao navegador que envie a fila quando a internet voltar, mesmo com o app fechado. */
function pedirEnvioEmSegundoPlano() {
  navigator.serviceWorker?.ready.then((r) => r.sync?.register('enviar-pontos')).catch(() => {});
}

async function iniciar() {
  registrarServiceWorker();
  await aceitarLinkDeConfiguracao(banco.preferencias);
  const servidor = criarServidor({ obterConexao: () => banco.preferencias.ler('conexao') });
  const telaConexao = criarTelaConexao({ servidor, preferencias: banco.preferencias });
  const conexao = await banco.preferencias.ler('conexao');
  if (!conexao) { telaConexao.mostrar(); return; }

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
    servidor, catalogo, aparelho, sincronizador, reconhecimento, telaCamera, ia, banco, diario, aviso,
    aoSair: rotear,
    aoMudarDono: () => { telaInicio.atualizarModo(); telaInicio.atualizarHoje(); },
  });

  // Eventos
  $('#btn-registrar').addEventListener('click', () => fluxoPonto.iniciar());
  window.addEventListener('hashchange', rotear);
  window.addEventListener('online', () => sincronizador.sincronizar({ forcar: true }));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && catalogo.idadeMs() > CADASTRO_VELHO_MS) atualizarCatalogo();
  });
  aoServiceWorkerEnviar(() => sincronizador.notificar());

  // Partida
  rotear();
  iniciarRelogio({ hora: $('#hora'), data: $('#data'), agora: aparelho.agora, aoMudarDia: telaInicio.atualizarHoje });
  telaInicio.atualizarModo();
  sincronizador.sincronizar();
  atualizarCatalogo();
  banco.historico.apagarAntesDe(Date.now() - HISTORICO_LOCAL_DIAS * DIA_MS).catch(() => {});
  setTimeout(() => ia.carregar().catch((e) => diario.registrar(`IA: ${e.message}`)), PRE_CARGA_DA_IA_MS);
  setInterval(() => { if (!document.hidden) atualizarCatalogo(); }, ATUALIZAR_CADASTRO_MS);
}

iniciar().catch((e) => {
  diario.registrar(e.message);
  aviso.mostrar(`Erro ao iniciar: ${e.message}`, 8000);
});
