// dom.js — utilidades pequenas de tela, usadas por todas as telas (DRY).
import { DIAS_SEMANA } from '../config.js';

export const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
export const $$ = (seletor, raiz = document) => [...raiz.querySelectorAll(seletor)];

/** Cria um elemento: el('p', { class: 'x', text: 'Oi', onclick: fn }, filho1, filho2). */
export function el(tag, propriedades = {}, ...filhos) {
  const elemento = document.createElement(tag);
  for (const [chave, valor] of Object.entries(propriedades)) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (chave === 'class') elemento.className = valor;
    else if (chave === 'text') elemento.textContent = valor;
    else if (chave === 'dataset') Object.assign(elemento.dataset, valor);
    else if (chave.startsWith('on')) elemento.addEventListener(chave.slice(2), valor);
    else elemento.setAttribute(chave, valor === true ? '' : valor);
  }
  for (const filho of filhos.flat()) {
    if (filho !== null && filho !== undefined && filho !== false) elemento.append(filho instanceof Node ? filho : String(filho));
  }
  return elemento;
}

/** Mostra uma das telas principais (config, inicio, admin) e esconde as outras. */
export function mostrarTela(nome) {
  for (const tela of $$('.tela')) tela.hidden = tela.id !== `tela-${nome}`;
}

/** Aviso flutuante no rodapé, que some sozinho. */
export function criarAviso(elemento) {
  let timer = null;
  return {
    mostrar(mensagem, duracaoMs = 3500) {
      elemento.textContent = mensagem;
      elemento.hidden = false;
      clearTimeout(timer);
      timer = setTimeout(() => { elemento.hidden = true; }, duracaoMs);
    },
    esconder() {
      clearTimeout(timer);
      elemento.hidden = true;
    },
  };
}

/** O botão que enviou o formulário (navegadores antigos não informam `submitter`). */
export const botaoQueEnviou = (evento) => evento.submitter || evento.target.querySelector('button[type=submit], button:not([type])');

/** Desliga o botão enquanto a tarefa roda (evita clique duplo) e devolve o resultado da tarefa. */
export async function comBotaoOcupado(botao, tarefa, textoOcupado = null) {
  const textoOriginal = botao.textContent;
  botao.disabled = true;
  if (textoOcupado) botao.textContent = textoOcupado;
  try {
    return await tarefa();
  } finally {
    botao.disabled = false;
    if (textoOcupado) botao.textContent = textoOriginal;
  }
}

export const decimal = (valor) => Number(valor).toFixed(2).replace('.', ',');
export const primeiroNome = (nome) => String(nome || '').trim().split(/\s+/)[0];

/** Caixinhas Dom…Sáb dentro de `caixa`, marcando `selecionados` (números 0–6). */
export const preencherDias = (caixa, selecionados) => caixa.replaceChildren(...DIAS_SEMANA.map((nome, i) => el('label', {},
  el('input', { type: 'checkbox', value: String(i), checked: selecionados.includes(i) }), nome)));

/** Os dias marcados nas caixinhas, como números 0–6. */
export const diasMarcados = (caixa) => [...caixa.querySelectorAll('input:checked')].map((i) => Number(i.value));
