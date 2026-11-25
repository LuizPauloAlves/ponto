// sw.js — service worker (em módulo): abre o app sem internet, guarda a IA no aparelho e, no
// Android, envia a fila quando a internet volta, mesmo com o app fechado. Reaproveita os mesmos
// módulos da página (banco, servidor, sincronizador): nada de lógica copiada aqui.
import * as banco from './js/infra/banco.js';
import { criarServidor } from './js/infra/servidor.js';
import { criarSincronizador, SEM_TEMPORIZADOR } from './js/servicos/sincronizador.js';

const VERSAO = 'ponto-v3';             // mude a cada nova versão do app: os celulares baixam tudo de novo
const RECURSOS = 'ponto-recursos-v1';  // biblioteca e modelos da IA: versão fixa, não mudam
const TEMPO_DO_ENVIO_MS = 45000;

// Tudo o que o app precisa para abrir sem internet. tests/contrato.test.mjs confere esta lista.
const ARQUIVOS_DO_APP = [
  './', './index.html', './manifest.webmanifest',
  './css/app.css', './css/fonts.css',
  './fonts/doto-latin-800-normal.woff2', './fonts/atkinson-hyperlegible-latin-400-normal.woff2', './fonts/atkinson-hyperlegible-latin-700-normal.woff2',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
  './js/main.js', './js/config.js',
  './js/dominio/ajustes.js', './js/dominio/biometria.js', './js/dominio/captura.js', './js/dominio/codificacao.js',
  './js/dominio/jornada.js', './js/dominio/localizacao.js', './js/dominio/seguranca.js', './js/dominio/tempo.js',
  './js/infra/banco.js', './js/infra/camera.js', './js/infra/gps.js', './js/infra/ia.js', './js/infra/servidor.js',
  './js/servicos/aparelho.js', './js/servicos/catalogo.js', './js/servicos/diario.js', './js/servicos/leitorFacial.js',
  './js/servicos/reconhecimento.js', './js/servicos/registroPonto.js', './js/servicos/sincronizador.js',
  './js/ui/conexao.js', './js/ui/confirmacao.js', './js/ui/dialogoPin.js', './js/ui/dom.js', './js/ui/fluxoPonto.js',
  './js/ui/inicio.js', './js/ui/instalacao.js', './js/ui/relogio.js', './js/ui/sucesso.js', './js/ui/telaCamera.js', './js/ui/textos.js',
  './js/ui/admin/admin.js', './js/ui/admin/ajustes.js', './js/ui/admin/locais.js', './js/ui/admin/manutencao.js',
  './js/ui/admin/pessoas.js', './js/ui/admin/relatorio.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS_DO_APP)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const nome of await caches.keys()) if (nome !== VERSAO && nome !== RECURSOS) await caches.delete(nome);
    await self.clients.claim();
  })());
});

/** Biblioteca da IA (versão fixa): do cache primeiro; só vai à rede se ainda não tiver. */
async function cacheAntes(pedido) {
  const cache = await caches.open(RECURSOS);
  const guardado = await cache.match(pedido);
  if (guardado) return guardado;
  const resposta = await fetch(pedido);
  if (resposta.ok) cache.put(pedido, resposta.clone());
  return resposta;
}

/** Arquivos do app: responde do cache na hora e atualiza em segundo plano para a próxima abertura. */
async function cacheEAtualiza(evento) {
  const pedido = evento.request;
  const cache = await caches.open(VERSAO);
  const guardado = await cache.match(pedido, { ignoreSearch: pedido.mode === 'navigate' });
  const daRede = fetch(pedido).then((resposta) => { if (resposta.ok) cache.put(pedido, resposta.clone()); return resposta; }).catch(() => null);
  if (guardado) { evento.waitUntil(daRede); return guardado; }
  return (await daRede) || (await cache.match('./index.html')) || Response.error();
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.hostname === 'cdn.jsdelivr.net') e.respondWith(cacheAntes(e.request));
  else if (url.origin === self.location.origin) e.respondWith(cacheEAtualiza(e));
});

async function avisarPaginas() {
  for (const pagina of await self.clients.matchAll()) pagina.postMessage({ tipo: 'fila-atualizada' });
}

/** Envio em segundo plano: o mesmo sincronizador da página, sem agendar nada (o navegador reagenda). */
async function enviarPendentes() {
  const servidor = criarServidor({ obterConexao: () => banco.preferencias.ler('conexao') });
  const sincronizador = criarSincronizador({
    fila: banco.fila,
    enviar: (registros) => servidor.chamar('registrarPontos', { registros }, { timeout: TEMPO_DO_ENVIO_MS }),
    temporizador: SEM_TEMPORIZADOR,
    aoConfirmar: async (ids) => { await banco.historico.marcarEnviados(ids); await avisarPaginas(); },
  });
  await sincronizador.sincronizar({ forcar: true });
  // Ainda sobrou algo? Falhar aqui faz o navegador tentar de novo mais tarde.
  if ((await banco.fila.contar()) > 0) throw new Error('Ainda há registros pendentes');
}

self.addEventListener('sync', (e) => {
  if (e.tag === 'enviar-pontos') e.waitUntil(enviarPendentes());
});
