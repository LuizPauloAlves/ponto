// ajustes.js — aba Ajustes (parte 1): dono do aparelho, jornada e rigor do reconhecimento.
import { DIAS_SEMANA } from '../../config.js';
import { ajustesParaServidor } from '../../dominio/ajustes.js';
import { formatarHoraMinuto, paraMinutos } from '../../dominio/tempo.js';
import { $, botaoQueEnviou, comBotaoOcupado, decimal, el } from '../dom.js';

/** Controles deslizantes: id no HTML → chave do ajuste. */
const CONTROLES_DE_RIGOR = Object.freeze([['limiar', 'limiar'], ['real', 'minReal'], ['live', 'minLive']]);

export function criarAbaAjustes({ catalogo, aparelho, chamarAdmin, recarregar, aviso, aoMudarDono }) {
  const formulario = $('#aj-form');
  const seletorDono = $('#aj-modo');
  const campoJornada = $('#aj-jornada');
  const dias = $('#aj-dias');
  const caixaPin = $('#aj-pin');
  const controle = (id) => $(`#aj-${id}`);
  const rotulo = (id) => $(`#aj-${id}-v`);

  function mostrar() {
    const ajustes = catalogo.ajustes();
    seletorDono.replaceChildren(
      el('option', { value: '', text: 'Compartilhado (várias pessoas)' }),
      ...catalogo.ativos().map((f) => el('option', { value: f.id, text: `Celular pessoal de ${f.nome}` })),
    );
    seletorDono.value = aparelho.donoId() || '';
    campoJornada.value = formatarHoraMinuto(ajustes.jornadaMin);
    dias.replaceChildren(...DIAS_SEMANA.map((nome, i) => el('label', {},
      el('input', { type: 'checkbox', value: String(i), checked: ajustes.diasTrabalho.includes(i) }), nome)));
    for (const [id, chave] of CONTROLES_DE_RIGOR) {
      controle(id).value = String(ajustes[chave]);
      rotulo(id).textContent = decimal(ajustes[chave]);
    }
    caixaPin.checked = ajustes.permitirPin;
  }

  /** Lê o formulário; devolve os ajustes ou null (e avisa) se algo estiver inválido. */
  function lerFormulario() {
    const jornadaMin = paraMinutos(campoJornada.value);
    if (jornadaMin === null) { aviso.mostrar('Informe as horas por dia no formato 8:00.'); return null; }
    const diasTrabalho = [...dias.querySelectorAll('input:checked')].map((i) => Number(i.value));
    if (!diasTrabalho.length) { aviso.mostrar('Marque pelo menos um dia de trabalho.'); return null; }
    const ajustes = { jornadaMin, diasTrabalho, permitirPin: caixaPin.checked };
    for (const [id, chave] of CONTROLES_DE_RIGOR) ajustes[chave] = Number(controle(id).value);
    return ajustes;
  }

  async function salvar() {
    const ajustes = lerFormulario();
    if (!ajustes) return;
    try {
      await chamarAdmin('salvarAjustes', { ajustes: ajustesParaServidor(ajustes) });
      await recarregar();
      aviso.mostrar('Ajustes salvos para todos os aparelhos.');
    } catch (e) {
      aviso.mostrar(e.message);
    }
  }

  formulario.addEventListener('submit', (e) => {
    e.preventDefault();
    comBotaoOcupado(botaoQueEnviou(e), salvar);
  });
  for (const [id] of CONTROLES_DE_RIGOR) controle(id).addEventListener('input', (e) => { rotulo(id).textContent = decimal(e.target.value); });
  seletorDono.addEventListener('change', async () => {
    await aparelho.definirDono(seletorDono.value || null);
    aoMudarDono();
    aviso.mostrar(aparelho.donoId() ? 'Este aparelho agora reconhece só o dono.' : 'Este aparelho agora é compartilhado.');
  });

  return { mostrar };
}
