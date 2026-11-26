// inicio.js — tela inicial: o cartão de ponto de hoje e o status de envio.
import { TIPOS_PONTO } from '../config.js';
import { horaLocal } from '../dominio/tempo.js';
import { $, el } from './dom.js';
import { statusDeEnvio } from './textos.js';

const aguardandoEnvio = (registro) => registro.status !== 'enviado';

function celula(tipo, registro, pendente) {
  const situacao = !registro ? 'vazio' : pendente(registro) ? 'pendente' : '';
  return el('div', { class: 'cartao-celula' },
    el('span', { class: 'cartao-rotulo', text: tipo.rotulo }),
    el('span', {
      class: `cartao-hora ${situacao}`.trim(),
      title: situacao === 'pendente' ? 'Aguardando envio para a planilha' : null,
      text: registro ? horaLocal(registro.timestamp) : '--:--',
    }));
}

/** O cartão de ponto do dia de uma pessoa ({ nome, porTipo }). `pendente` diz quais horários aparecem apagados. */
export const cartaoDoDia = (pessoa, { pendente = aguardandoEnvio } = {}) => el('div', { class: 'cartao-linha' },
  pessoa.nome ? el('div', { class: 'cartao-nome', text: pessoa.nome }) : null,
  el('div', { class: 'cartao-grade' }, TIPOS_PONTO.map((tipo) => celula(tipo, pessoa.porTipo[tipo.id], pendente))));

export function criarTelaInicio({ registroPonto, sincronizador, catalogo, aparelho, aviso }) {
  const lista = $('#lista-hoje');
  const status = $('#status-envio');
  const avisoModo = $('#aviso-modo');

  async function atualizarHoje() {
    const pessoas = await registroPonto.resumoDeHoje();
    lista.replaceChildren(...(pessoas.length ? pessoas.map((p) => cartaoDoDia(p)) : [el('p', { class: 'vazio-texto', text: 'Nenhum ponto registrado hoje.' })]));
  }

  function mostrarStatus(estado) {
    const { classe, texto } = statusDeEnvio(estado, Date.now());
    status.className = `status-envio ${classe}`.trim();
    status.textContent = texto;
  }

  function atualizarModo() {
    const dono = aparelho.donoId();
    avisoModo.hidden = !dono;
    if (!dono) return;
    const pessoa = catalogo.funcionario(dono);
    avisoModo.textContent = pessoa ? `Celular pessoal de ${pessoa.nome}.` : 'Celular pessoal (dono não encontrado no cadastro).';
  }

  status.addEventListener('click', () => {
    aviso.mostrar('Enviando…');
    sincronizador.sincronizar({ forcar: true });
  });
  sincronizador.aoMudar((estado) => { mostrarStatus(estado); atualizarHoje(); });
  catalogo.aoMudar(atualizarModo);

  return { atualizarHoje, atualizarModo };
}
