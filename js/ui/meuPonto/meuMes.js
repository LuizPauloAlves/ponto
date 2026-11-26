// meuMes.js — "Meu mês": resumo e tabela do mês (tocar no dia abre a correção), navegação e exportação.
import { csvDasBatidas, csvDoMes } from '../../dominio/exportacao.js';
import { gradeDoMes, resumoMes } from '../../dominio/jornada.js';
import { dataLocal, formatarDuracao, nomeMes } from '../../dominio/tempo.js';
import { entregarArquivo } from '../arquivo.js';
import { $, comBotaoOcupado, el } from '../dom.js';
import { blocoResumo, tabelaDoMes } from '../mesNaTela.js';

export function criarMeuMes({ meuPonto, editorDia, aviso, agora = Date.now }) {
  const titulo = $('#meu-titulo');
  const saida = $('#meu-saida');
  const botaoProximo = $('#meu-proximo');
  let ano = null;
  let mes = null;

  async function resumoAtual() {
    const [{ jornadaMin, diasTrabalho }, registros, desde] = await Promise.all([meuPonto.ajustes(), meuPonto.doMes(ano, mes), meuPonto.inicio()]);
    // O saldo conta a partir do primeiro ponto: quem começa a usar no meio do mês não fica devendo os dias anteriores.
    const resumo = resumoMes(gradeDoMes(registros, { ano, mes }), { ano, mes, hoje: new Date(agora()), jornadaMin, diasTrabalho, desde });
    return { resumo, jornadaMin, diasTrabalho };
  }

  async function desenhar() {
    const hoje = new Date(agora());
    titulo.textContent = `${nomeMes(mes)} de ${ano}`;
    botaoProximo.disabled = ano === hoje.getFullYear() && mes === hoje.getMonth() + 1; // não há mês futuro para ver
    const { resumo, jornadaMin, diasTrabalho } = await resumoAtual();
    saida.replaceChildren(
      blocoResumo(resumo),
      el('p', { class: 'texto-apoio', text: `Saldo sobre ${formatarDuracao(jornadaMin)} por dia de trabalho, a partir do primeiro ponto registrado. Toque em um dia para corrigir, apagar ou incluir um horário esquecido.` }),
      tabelaDoMes(resumo.dias, { ano, mes, diasTrabalho, aoTocarDia: corrigirDia }));
  }

  async function corrigirDia(data) {
    await editorDia.abrir(data);
    await desenhar();
  }

  function irParaMes(passo) {
    const alvo = new Date(ano, mes - 1 + passo, 1);
    ano = alvo.getFullYear();
    mes = alvo.getMonth() + 1;
    desenhar();
  }

  const avisarEntrega = (resultado) => { if (resultado === 'baixado') aviso.mostrar('Arquivo salvo na pasta de downloads.'); };

  async function exportarMes() {
    const { resumo } = await resumoAtual();
    avisarEntrega(await entregarArquivo(`ponto-${ano}-${String(mes).padStart(2, '0')}.csv`, csvDoMes(resumo, { ano, mes })));
  }

  async function exportarTudo() {
    const todos = await meuPonto.todos();
    if (!todos.length) { aviso.mostrar('Ainda não há pontos para exportar.'); return; }
    avisarEntrega(await entregarArquivo(`ponto-todos-ate-${dataLocal(agora())}.csv`, csvDasBatidas(todos)));
  }

  $('#meu-anterior').addEventListener('click', () => irParaMes(-1));
  botaoProximo.addEventListener('click', () => irParaMes(1));
  $('#meu-exportar-mes').addEventListener('click', (e) => comBotaoOcupado(e.currentTarget, exportarMes));
  $('#meu-exportar-tudo').addEventListener('click', (e) => comBotaoOcupado(e.currentTarget, exportarTudo));

  return {
    /** Abre no mês atual. */
    mostrar() {
      const hoje = new Date(agora());
      ano = hoje.getFullYear();
      mes = hoje.getMonth() + 1;
      return desenhar();
    },
    atualizar: () => desenhar(),
  };
}
