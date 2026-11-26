// ajustesPessoais.js — ajustes do "Meu ponto": nome, horas por dia e dias de trabalho (para o saldo).
import { formatarHoraMinuto, paraMinutos } from '../../dominio/tempo.js';
import { $, botaoQueEnviou, comBotaoOcupado, diasMarcados, preencherDias } from '../dom.js';

export function criarAjustesPessoais({ meuPonto, aviso, aoSalvar, aoTrocarParaEmpresa }) {
  const formulario = $('#meu-ajustes');
  const campoNome = $('#meu-nome');
  const campoJornada = $('#meu-jornada');
  const dias = $('#meu-dias');

  async function mostrar() {
    const ajustes = await meuPonto.ajustes();
    campoNome.value = ajustes.nome;
    campoJornada.value = formatarHoraMinuto(ajustes.jornadaMin);
    preencherDias(dias, ajustes.diasTrabalho);
  }

  async function salvar() {
    const jornadaMin = paraMinutos(campoJornada.value);
    if (jornadaMin === null) { aviso.mostrar('Informe as horas por dia no formato 8:00.'); return; }
    const diasTrabalho = diasMarcados(dias);
    if (!diasTrabalho.length) { aviso.mostrar('Marque pelo menos um dia de trabalho.'); return; }
    await meuPonto.salvarAjustes({ nome: campoNome.value, jornadaMin, diasTrabalho });
    aviso.mostrar('Ajustes salvos.');
    aoSalvar();
  }

  formulario.addEventListener('submit', (e) => {
    e.preventDefault();
    comBotaoOcupado(botaoQueEnviou(e), salvar);
  });
  $('#meu-conectar').addEventListener('click', () => {
    if (window.confirm('Trocar para a opção 1 (empresa)? Seus horários continuam guardados neste celular e voltam a aparecer se você escolher a opção 2 de novo.')) aoTrocarParaEmpresa();
  });

  return { mostrar };
}
