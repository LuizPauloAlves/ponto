// dialogoPin.js — PIN de reserva, para quando o rosto não é reconhecido. Bloqueia por alguns
// minutos depois de várias tentativas erradas.
import { PIN_TENTATIVAS } from '../config.js';
import { criarLimitador, pinConfere } from '../dominio/seguranca.js';
import { horaLocal } from '../dominio/tempo.js';
import { $, el } from './dom.js';

export function criarDialogoPin({ agora = () => Date.now() } = {}) {
  const dialogo = $('#dlg-pin');
  const seletor = $('#pin-func');
  const campo = $('#pin-valor');
  const erro = $('#pin-erro');
  const limitador = criarLimitador({ ...PIN_TENTATIVAS, agora });
  let pessoas = [];
  let resolver = null;

  function concluir(pessoa) {
    const responder = resolver;
    resolver = null;
    if (dialogo.open) dialogo.close();
    responder?.(pessoa);
  }

  async function conferir() {
    const bloqueio = limitador.bloqueadoAte();
    if (bloqueio) { erro.textContent = `Muitas tentativas. Aguarde até ${horaLocal(bloqueio)}.`; return; }
    const pessoa = pessoas.find((p) => p.id === seletor.value);
    if (!(await pinConfere(pessoa, campo.value.trim()))) {
      limitador.registrarFalha();
      erro.textContent = 'PIN incorreto.';
      return;
    }
    limitador.registrarSucesso();
    concluir(pessoa);
  }

  /** Abre o diálogo com a lista de quem tem PIN; resolve com a pessoa ou null. */
  function pedir(lista) {
    pessoas = lista;
    seletor.replaceChildren(...lista.map((p) => el('option', { value: p.id, text: p.nome })));
    campo.value = '';
    erro.textContent = '';
    dialogo.showModal();
    return new Promise((r) => { resolver = r; });
  }

  $('#pin-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (e.submitter?.value === 'cancelar') concluir(null);
    else conferir();
  });
  dialogo.addEventListener('cancel', () => concluir(null)); // tecla Esc ou voltar do Android

  return { pedir };
}
