// editorDia.js — corrige um dia do "Meu ponto": muda o tipo ou o horário, apaga, ou inclui um esquecido.
import { DIAS_SEMANA, TIPOS_PONTO } from '../../config.js';
import { proximoTipo } from '../../dominio/jornada.js';
import { dataCurta, horaLocal } from '../../dominio/tempo.js';
import { $, el } from '../dom.js';

const CONFIRMAR_APAGAR_MS = 4000; // apagar pede um segundo toque dentro deste tempo

export function criarEditorDia({ meuPonto }) {
  const dialogo = $('#dlg-dia');
  const titulo = $('#dia-titulo');
  const lista = $('#dia-lista');
  const formulario = $('#dia-novo');
  const seletorTipo = $('#dia-tipo');
  const campoHora = $('#dia-hora');
  const erro = $('#dia-erro');
  let dia = null;
  let aoFechar = null;

  const opcoesDeTipo = (selecionado) =>
    TIPOS_PONTO.map((t) => el('option', { value: t.id, text: t.rotulo, selected: t.id === selecionado }));

  /**
   * Executa a alteração e redesenha a lista com o que ficou salvo. Se der erro, mostra e mantém o que
   * a pessoa escolheu em "Incluir" (para ela só ajustar o horário); com `sugerir`, sugere o próximo tipo.
   */
  async function tentar(alteracao, { sugerir = false } = {}) {
    erro.textContent = '';
    try {
      await alteracao();
    } catch (e) {
      erro.textContent = e.message;
      sugerir = false;
    }
    await desenhar({ sugerir });
  }

  function botaoApagar(registro) {
    let timer = null;
    const botao = el('button', { type: 'button', class: 'btn-texto perigo', text: 'Apagar' });
    botao.addEventListener('click', () => {
      if (botao.dataset.confirmar) { clearTimeout(timer); tentar(() => meuPonto.apagar(registro.id)); return; }
      botao.dataset.confirmar = 'sim';
      botao.textContent = 'Toque de novo';
      timer = setTimeout(() => { delete botao.dataset.confirmar; botao.textContent = 'Apagar'; }, CONFIRMAR_APAGAR_MS);
    });
    return botao;
  }

  const linha = (registro) => el('li', { class: 'batida' },
    el('select', { 'aria-label': 'Tipo', onchange: (e) => tentar(() => meuPonto.corrigir(registro, { tipo: e.target.value })) },
      opcoesDeTipo(registro.tipo)),
    el('span', { class: 'batida-hora' },
      el('input', { type: 'time', value: horaLocal(registro.timestamp), 'aria-label': 'Horário', required: true,
        onchange: (e) => tentar(() => meuPonto.corrigir(registro, { hora: e.target.value })) }),
      registro.manual ? el('small', { text: 'ajustado à mão' }) : null),
    botaoApagar(registro));

  async function desenhar({ sugerir = false } = {}) {
    const registros = await meuPonto.doDia(dia.getTime());
    lista.replaceChildren(...(registros.length
      ? registros.map(linha)
      : [el('li', { class: 'vazio-texto', text: 'Nenhum ponto neste dia.' })]));
    if (sugerir) seletorTipo.replaceChildren(...opcoesDeTipo(proximoTipo(registros.map((r) => r.tipo))));
  }

  formulario.addEventListener('submit', (e) => {
    e.preventDefault();
    tentar(async () => {
      await meuPonto.incluir(dia.getTime(), { tipo: seletorTipo.value, hora: campoHora.value });
      campoHora.value = '';
    }, { sugerir: true });
  });
  dialogo.addEventListener('close', () => aoFechar?.());

  return {
    /** Abre o dia (um Date) e resolve quando a pessoa fechar. */
    abrir(data) {
      dia = data;
      erro.textContent = '';
      campoHora.value = '';
      titulo.textContent = `${DIAS_SEMANA[data.getDay()]}, ${dataCurta(data.getTime())}`;
      return new Promise((resolver) => {
        aoFechar = resolver;
        desenhar({ sugerir: true }).then(() => dialogo.showModal());
      });
    },
  };
}
