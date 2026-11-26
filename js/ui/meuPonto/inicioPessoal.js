// inicioPessoal.js — tela inicial do modo "só neste celular": o cartão de hoje e o botão de registrar.
// É a mesma tela do modo empresa; aqui mudam só os textos e o que cada botão faz.
import { consolidarDia } from '../../dominio/jornada.js';
import { $, el } from '../dom.js';
import { cartaoDoDia } from '../inicio.js';

const STATUS = Object.freeze({
  garantido: 'Salvo só neste celular. Toque para ver o mês e exportar.',
  semGarantia: 'Salvo só neste celular. Exporte o mês de vez em quando para não perder.',
});

export function criarInicioPessoal({ meuPonto, confirmacao, sucesso, aoAbrirMes }) {
  const tela = $('#tela-inicio');
  const lista = $('#lista-hoje');
  const status = $('#status-envio');

  async function atualizarHoje() {
    const [hoje] = consolidarDia(await meuPonto.hoje());
    lista.replaceChildren(hoje
      ? cartaoDoDia({ porTipo: hoje.porTipo }, { pendente: () => false }) // nada fica "aguardando envio"
      : el('p', { class: 'vazio-texto', text: 'Nenhum ponto registrado hoje.' }));
  }

  async function registrar() {
    const [ajustes, sugerido] = await Promise.all([meuPonto.ajustes(), meuPonto.sugestao()]);
    const registro = await confirmacao.abrir({ pessoa: { nome: ajustes.nome }, sugerido, registrar: (tipo) => meuPonto.registrar(tipo) });
    if (!registro) return;
    sucesso.mostrar({ ...registro, nome: ajustes.nome, metodo: 'pessoal' });
    atualizarHoje();
  }

  /** `garantido`: o navegador prometeu não apagar os dados sozinho (app instalado, em geral). */
  function mostrarStatus(garantido) {
    status.className = `status-envio ${garantido ? '' : 'pendente'}`.trim();
    status.textContent = garantido ? STATUS.garantido : STATUS.semGarantia;
  }

  $('.marca', tela).textContent = 'Meu ponto';
  $('#t-hoje').textContent = 'Hoje';
  $('#btn-admin').setAttribute('aria-label', 'Meu mês, exportar e ajustes');
  $('#btn-admin').addEventListener('click', aoAbrirMes);
  status.addEventListener('click', aoAbrirMes);
  $('#btn-registrar').addEventListener('click', registrar);

  return { atualizarHoje, mostrarStatus };
}
