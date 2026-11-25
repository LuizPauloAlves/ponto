// relatorio.js — aba Relatório: horas de uma pessoa (dia a dia) ou da equipe, no mês escolhido.
import { DIAS_SEMANA } from '../../config.js';
import { normalizarAjustes } from '../../dominio/ajustes.js';
import { resumoMes } from '../../dominio/jornada.js';
import { formatarDuracao, mesesRecentes, nomeMes } from '../../dominio/tempo.js';
import { $, comBotaoOcupado, el } from '../dom.js';

const MESES_NA_LISTA = 24;

export function criarAbaRelatorio({ catalogo, aparelho, chamarAdmin }) {
  const seletorPessoa = $('#rel-func');
  const seletorMes = $('#rel-mes');
  const botao = $('#rel-gerar');
  const saida = $('#rel-saida');

  function preencherPessoas() {
    const atual = seletorPessoa.value;
    seletorPessoa.replaceChildren(
      el('option', { value: 'todos', text: 'Todos' }),
      ...catalogo.funcionarios().map((f) => el('option', { value: f.id, text: f.ativo ? f.nome : `${f.nome} (inativo)` })),
    );
    if ([...seletorPessoa.options].some((o) => o.value === atual)) seletorPessoa.value = atual;
  }

  function preencherMeses() {
    const meses = mesesRecentes(MESES_NA_LISTA, new Date(aparelho.agora()));
    seletorMes.replaceChildren(...meses.map((m) => el('option', { value: `${m.ano}-${m.mes}`, text: m.rotulo })));
  }

  const resumir = (pessoa, { ano, mes, ajustes, hoje }) =>
    resumoMes(pessoa.dias || [], { ano, mes, hoje, jornadaMin: ajustes.jornadaMin, diasTrabalho: ajustes.diasTrabalho });

  const item = (rotulo, valor, { classe = null, destaque = null } = {}) =>
    el('div', { class: destaque }, el('dt', { text: rotulo }), el('dd', { class: classe, text: valor }));

  const blocoResumo = (r) => el('dl', { class: 'resumo' },
    item('Horas trabalhadas', formatarDuracao(r.total), { destaque: 'total' }),
    item('Dias trabalhados', String(r.diasTrabalhados)),
    item('Média por dia', r.diasTrabalhados ? formatarDuracao(r.media) : '–'),
    item('Saldo da jornada', formatarDuracao(r.saldo), { classe: r.saldo < 0 ? 'negativo' : null }),
    item('Dias incompletos', String(r.incompletos), { classe: r.incompletos ? 'negativo' : null }));

  const tabela = (cabecalho, linhas) => el('div', { class: 'rolagem' }, el('table', { class: 'ponto' },
    el('thead', {}, el('tr', {}, cabecalho.map((h) => el('th', { scope: 'col', text: h })))),
    el('tbody', {}, linhas)));

  function linhaDoDia(dia, { ano, mes, ajustes }) {
    const data = new Date(ano, mes - 1, Number(dia.dia));
    const folga = !ajustes.diasTrabalho.includes(data.getDay());
    const classes = [folga ? 'fim-de-semana' : '', dia.status === 'incompleto' ? 'incompleto' : ''].join(' ').trim();
    const horas = { completo: formatarDuracao(dia.trabalhado), incompleto: 'incompl.' }[dia.status] ?? '';
    return el('tr', { class: classes || null, title: dia.obs || null },
      el('td', { text: `${String(dia.dia).padStart(2, '0')} ${DIAS_SEMANA[data.getDay()].toLowerCase()}` }),
      el('td', { text: dia.entrada || '' }),
      el('td', { text: dia.saidaAlmoco || '' }),
      el('td', { text: dia.voltaAlmoco || '' }),
      el('td', { text: dia.saida || '' }),
      el('td', { class: 'horas', text: horas }));
  }

  function mostrarPessoa(pessoa, opcoes) {
    const r = resumir(pessoa, opcoes);
    saida.replaceChildren(
      el('h2', { class: 'titulo-bloco', text: `${pessoa.nome}, ${nomeMes(opcoes.mes).toLowerCase()} de ${opcoes.ano}` }),
      blocoResumo(r),
      el('p', { class: 'texto-apoio', text: `Saldo calculado sobre ${formatarDuracao(opcoes.ajustes.jornadaMin)} por dia de trabalho. Feriados não são descontados.` }),
      tabela(['Dia', 'Entrada', 'Almoço', 'Volta', 'Saída', 'Horas'], r.dias.map((d) => linhaDoDia(d, opcoes))),
      pessoa.url
        ? el('a', { class: 'link-planilha', href: pessoa.url, target: '_blank', rel: 'noopener', text: 'Abrir planilha no Google Sheets' })
        : el('p', { class: 'texto-apoio', text: 'Ainda não há planilha deste mês para esta pessoa.' }));
  }

  function mostrarEquipe(pessoas, opcoes) {
    if (!pessoas.length) { saida.replaceChildren(el('p', { class: 'texto-apoio', text: 'Nenhuma pessoa cadastrada.' })); return; }
    const resumos = pessoas.map((p) => ({ pessoa: p, r: resumir(p, opcoes) }));
    const linhas = resumos.map(({ pessoa, r }) => el('tr', {
      dataset: { func: pessoa.id },
      onclick: () => { seletorPessoa.value = pessoa.id; gerar(); },
    },
    el('td', { text: pessoa.nome }),
    el('td', { text: String(r.diasTrabalhados) }),
    el('td', { class: 'horas', text: formatarDuracao(r.total) }),
    el('td', { class: r.saldo < 0 ? 'negativo' : null, text: formatarDuracao(r.saldo) }),
    el('td', { class: r.incompletos ? 'negativo' : null, text: String(r.incompletos) })));
    const totalEquipe = resumos.reduce((soma, { r }) => soma + r.total, 0);
    saida.replaceChildren(
      el('h2', { class: 'titulo-bloco', text: `Equipe, ${nomeMes(opcoes.mes).toLowerCase()} de ${opcoes.ano}` }),
      el('dl', { class: 'resumo' }, item('Horas da equipe', formatarDuracao(totalEquipe), { destaque: 'total' })),
      tabela(['Pessoa', 'Dias', 'Horas', 'Saldo', 'Incompl.'], linhas),
      el('p', { class: 'texto-apoio', text: 'Toque em uma pessoa para ver o detalhe do mês.' }));
  }

  async function buscarEMostrar() {
    const [ano, mes] = seletorMes.value.split('-').map(Number);
    const funcionarioId = seletorPessoa.value;
    try {
      const r = await chamarAdmin('relatorio', { funcionarioId, ano, mes }, { timeout: 180000 });
      const opcoes = { ano, mes, ajustes: normalizarAjustes(r.ajustes ?? catalogo.ajustes()), hoje: new Date(aparelho.agora()) };
      if (funcionarioId === 'todos') mostrarEquipe(r.funcionarios || [], opcoes);
      else if (r.funcionarios?.[0]) mostrarPessoa(r.funcionarios[0], opcoes);
    } catch (e) {
      saida.replaceChildren(el('p', { class: 'msg-erro', text: e.message }));
    }
  }

  function gerar() {
    saida.replaceChildren();
    return comBotaoOcupado(botao, buscarEMostrar, 'Gerando…');
  }

  botao.addEventListener('click', gerar);

  return {
    mostrar() {
      preencherPessoas();
      if (!seletorMes.options.length) preencherMeses();
    },
  };
}
