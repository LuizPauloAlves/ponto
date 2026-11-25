// inicio.js — tela inicial: o cartão de ponto de hoje e o status de envio.
import { TIPOS_PONTO } from '../config.js';
import { horaLocal } from '../dominio/tempo.js';
import { $, el } from './dom.js';
import { statusDeEnvio } from './textos.js';

export function criarTelaInicio({ registroPonto, sincronizador, catalogo, aparelho, aviso }) {
  const lista = $('#lista-hoje');
  const status = $('#status-envio');
  const avisoModo = $('#aviso-modo');

  function celula(tipo, registro) {
    const situacao = !registro ? 'vazio' : registro.status === 'enviado' ? '' : 'pendente';
    return el('div', { class: 'cartao-celula' },
      el('span', { class: 'cartao-rotulo', text: tipo.rotulo }),
      el('span', {
        class: `cartao-hora ${situacao}`.trim(),
        title: situacao === 'pendente' ? 'Aguardando envio para a planilha' : null,
        text: registro ? horaLocal(registro.timestamp) : '--:--',
      }));
  }

  const cartao = (pessoa) => el('div', { class: 'cartao-linha' },
    el('div', { class: 'cartao-nome', text: pessoa.nome }),
    el('div', { class: 'cartao-grade' }, TIPOS_PONTO.map((tipo) => celula(tipo, pessoa.porTipo[tipo.id]))));

  async function atualizarHoje() {
    const pessoas = await registroPonto.resumoDeHoje();
    lista.replaceChildren(...(pessoas.length ? pessoas.map(cartao) : [el('p', { class: 'vazio-texto', text: 'Nenhum ponto registrado hoje.' })]));
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
