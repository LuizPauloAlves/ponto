// instalacao.js — convida a pôr o app na tela inicial (ícone próprio, abre em tela cheia, sem barra do navegador).
// Android/Chrome: botão "Instalar" (evento beforeinstallprompt). iPhone: o Safari não tem esse evento,
// então mostramos o caminho pelo menu Compartilhar. O navegador de dentro de outros apps (WhatsApp,
// Instagram, Facebook) não instala nada: pedimos para abrir o link no Chrome ou no Safari.
import { $ } from './dom.js';

const PREFERENCIA_DISPENSADO = 'instalacaoDispensadaEm';
const DISPENSADO_POR_MS = 7 * 86400000;
const NAVEGADOR_EMBUTIDO = /FBAN|FBAV|Instagram|WhatsApp|\bLine\/|; wv\)/i;
const IOS = /iPhone|iPad|iPod/i;

export const TEXTOS_INSTALACAO = Object.freeze({
  embutido: 'Para instalar, abra este link no Chrome (Android) ou no Safari (iPhone): toque no menu ⋮ ou ••• e escolha "Abrir no navegador".',
  botao: 'Instale o Ponto na tela inicial: abre como um app, em tela cheia.',
  ios: 'Para criar o atalho: toque em Compartilhar (quadrado com seta ↑) e depois em "Adicionar à Tela de Início".',
  android: 'Para criar o atalho: no menu ⋮ do navegador, toque em "Instalar app" ou "Adicionar à tela inicial".',
});

/** iPad recente se apresenta como Mac; o toque denuncia. */
const ehIos = (userAgent, pontosDeToque) => IOS.test(userAgent) || (/Macintosh/.test(userAgent) && pontosDeToque > 1);

/**
 * Que convite mostrar neste navegador. Função pura (testável sem navegador).
 * Devolve { tipo: 'instalado' | 'embutido' | 'botao' | 'ios' | 'android' | 'nenhum', texto }.
 */
export function situacaoDeInstalacao({ userAgent = '', instalado = false, temConvite = false, pontosDeToque = 0 }) {
  if (instalado) return { tipo: 'instalado', texto: '' };
  if (NAVEGADOR_EMBUTIDO.test(userAgent)) return { tipo: 'embutido', texto: TEXTOS_INSTALACAO.embutido };
  if (temConvite) return { tipo: 'botao', texto: TEXTOS_INSTALACAO.botao };
  if (ehIos(userAgent, pontosDeToque)) return { tipo: 'ios', texto: TEXTOS_INSTALACAO.ios };
  if (/Android/i.test(userAgent)) return { tipo: 'android', texto: TEXTOS_INSTALACAO.android };
  return { tipo: 'nenhum', texto: '' }; // computador sem convite do navegador: não insiste
}

/** Liga a faixa de instalação. Precisa ser chamada logo na carga: o navegador avisa uma vez só. */
export function criarConviteInstalacao({ preferencias, janela = window }) {
  const faixa = $('#instalar');
  const texto = $('#instalar-texto');
  const botaoInstalar = $('#instalar-botao');
  let convite = null; // evento beforeinstallprompt guardado até a pessoa tocar em "Instalar"

  const instalado = () => janela.matchMedia?.('(display-mode: standalone)').matches || janela.navigator.standalone === true;

  async function dispensadoRecentemente() {
    const quando = await preferencias.ler(PREFERENCIA_DISPENSADO).catch(() => 0);
    return Date.now() - (quando || 0) < DISPENSADO_POR_MS;
  }

  async function atualizar() {
    const situacao = situacaoDeInstalacao({
      userAgent: janela.navigator.userAgent,
      instalado: instalado(),
      temConvite: Boolean(convite),
      pontosDeToque: janela.navigator.maxTouchPoints || 0,
    });
    texto.textContent = situacao.texto;
    botaoInstalar.hidden = situacao.tipo !== 'botao';
    faixa.hidden = !situacao.texto || (await dispensadoRecentemente());
  }

  async function instalar() {
    const pedido = convite;
    convite = null; // o navegador só deixa usar o convite uma vez
    if (!pedido) return;
    await pedido.prompt();
    await pedido.userChoice.catch(() => null);
    atualizar();
  }

  function dispensar() {
    faixa.hidden = true;
    preferencias.gravar(PREFERENCIA_DISPENSADO, Date.now()).catch(() => {});
  }

  janela.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); convite = e; atualizar(); });
  janela.addEventListener('appinstalled', () => { convite = null; atualizar(); });
  botaoInstalar.addEventListener('click', instalar);
  $('#instalar-fechar').addEventListener('click', dispensar);
  atualizar();
}
