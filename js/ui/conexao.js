// conexao.js — primeiro uso: liga o aparelho ao servidor (endereço do Apps Script + token)
// ou escolhe o modo "só neste celular", que não precisa de servidor.
import { $, comBotaoOcupado, mostrarTela } from './dom.js';

const ENDERECO_VALIDO = /^https:\/\/script\.google\.com\/.+\/exec$/;

/** Link que conecta outro aparelho sem digitar nada (contém o token: compartilhar só em privado). */
export const linkDeConfiguracao = ({ url, token }) =>
  `${location.origin}${location.pathname}?url=${encodeURIComponent(url)}&token=${encodeURIComponent(token)}`;

/** Se a página foi aberta por um link de configuração, guarda a conexão e limpa o endereço. */
export async function aceitarLinkDeConfiguracao(preferencias) {
  const parametros = new URLSearchParams(location.search);
  if (!parametros.get('url') || !parametros.get('token')) return;
  await preferencias.gravar('conexao', { url: parametros.get('url'), token: parametros.get('token') });
  history.replaceState(null, '', location.pathname);
}

export function criarTelaConexao({ servidor, preferencias, modoDeUso, aoConectar = () => location.reload() }) {
  async function usarSoNesteCelular() {
    await modoDeUso.usarSoNesteCelular();
    aoConectar();
  }

  const campoUrl = $('#cfg-url');
  const campoToken = $('#cfg-token');
  const erro = $('#cfg-erro');
  const botao = $('#cfg-conectar');

  async function conectar() {
    erro.textContent = '';
    const conexao = { url: campoUrl.value.trim(), token: campoToken.value.trim() };
    if (!ENDERECO_VALIDO.test(conexao.url)) { erro.textContent = 'O endereço deve começar com https://script.google.com/ e terminar com /exec.'; return; }
    if (!conexao.token) { erro.textContent = 'Informe o token.'; return; }
    try {
      await servidor.chamar('ping', {}, { conexao });
      await preferencias.gravar('conexao', conexao);
      aoConectar();
    } catch (e) {
      erro.textContent = e.codigo === 'token' ? 'Token não confere com o do Apps Script.' : e.message;
    }
  }

  botao.addEventListener('click', () => comBotaoOcupado(botao, conectar, 'Conectando…'));
  $('#cfg-pessoal').addEventListener('click', usarSoNesteCelular);

  /** Mostra a tela; com `url`, já preenche o endereço (ex.: o token mudou no servidor). */
  function mostrar({ url = '', mensagem = '' } = {}) {
    campoUrl.value = url;
    erro.textContent = mensagem;
    mostrarTela('config');
  }

  return { mostrar };
}
