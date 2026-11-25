// admin.js — entrada na área do administrador (PIN) e navegação entre as abas.
// Cada aba é um módulo próprio que recebe só o que usa.
import { $, $$, botaoQueEnviou, comBotaoOcupado, mostrarTela } from '../dom.js';
import { criarAbaAjustes } from './ajustes.js';
import { criarAbaLocais } from './locais.js';
import { criarSecaoManutencao } from './manutencao.js';
import { criarAbaPessoas } from './pessoas.js';
import { criarAbaRelatorio } from './relatorio.js';

/** Junta várias partes numa aba só (a aba Ajustes tem ajustes + manutenção). */
const juntar = (...partes) => ({ mostrar: () => partes.forEach((p) => p.mostrar()) });

export function criarAdmin(dependencias) {
  const { servidor, catalogo, aviso, aoSair } = dependencias;
  const dialogo = $('#dlg-admin');
  const campo = $('#admin-pin');
  const erro = $('#admin-erro');
  let pin = null;
  let abaAtual = 'relatorio';

  const chamarAdmin = (acao, dados = {}, opcoes) => servidor.chamar(acao, { pinAdmin: pin, ...dados }, opcoes);
  const recarregar = () => catalogo.atualizar({ forcar: true });
  const contexto = { ...dependencias, chamarAdmin, recarregar };
  const abas = {
    relatorio: criarAbaRelatorio(contexto),
    pessoas: criarAbaPessoas(contexto),
    locais: criarAbaLocais(contexto),
    ajustes: juntar(criarAbaAjustes(contexto), criarSecaoManutencao(contexto)),
  };

  function abrirAba(nome) {
    abaAtual = nome;
    aviso.esconder();
    for (const botao of $$('.abas button')) botao.setAttribute('aria-selected', String(botao.dataset.aba === nome));
    for (const painel of $$('.aba')) painel.hidden = painel.id !== `aba-${nome}`;
    abas[nome].mostrar();
  }

  function pedirAcesso() {
    if (!navigator.onLine) { aviso.mostrar('A área do administrador precisa de internet.'); return; }
    campo.value = '';
    erro.textContent = '';
    dialogo.showModal();
  }

  async function entrar(tentativa) {
    try {
      await servidor.chamar('verificarAdmin', { pinAdmin: tentativa });
      pin = tentativa;
      dialogo.close();
      await recarregar().catch(() => {});
      location.hash = 'admin';
    } catch (e) {
      erro.textContent = e.codigo === 'admin' ? 'PIN incorreto.' : e.message;
    }
  }

  $('#btn-admin').addEventListener('click', pedirAcesso);
  $('#admin-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (e.submitter?.value === 'cancelar') { dialogo.close(); return; }
    comBotaoOcupado(botaoQueEnviou(e), () => entrar(campo.value.trim()));
  });
  $('#btn-voltar').addEventListener('click', () => {
    pin = null;
    history.replaceState(null, '', location.pathname);
    aoSair();
  });
  for (const botao of $$('.abas button')) botao.addEventListener('click', () => abrirAba(botao.dataset.aba));

  return {
    mostrar() { mostrarTela('admin'); abrirAba(abaAtual); },
    sair() { pin = null; },
    autenticado: () => pin !== null,
  };
}
