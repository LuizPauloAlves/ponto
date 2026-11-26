// mesNaTela.js — como um mês de ponto aparece na tela: o resumo e a tabela dia a dia.
// Usado pelo relatório do administrador e pelo "Meu ponto" (o mesmo conhecimento em um lugar só).
import { DIAS_SEMANA } from '../config.js';
import { formatarDuracao } from '../dominio/tempo.js';
import { el } from './dom.js';

export const itemDoResumo = (rotulo, valor, { classe = null, destaque = null } = {}) =>
  el('div', { class: destaque }, el('dt', { text: rotulo }), el('dd', { class: classe, text: valor }));

/** Resumo do mês (o que `resumoMes` calcula). */
export const blocoResumo = (r) => el('dl', { class: 'resumo' },
  itemDoResumo('Horas trabalhadas', formatarDuracao(r.total), { destaque: 'total' }),
  itemDoResumo('Dias trabalhados', String(r.diasTrabalhados)),
  itemDoResumo('Média por dia', r.diasTrabalhados ? formatarDuracao(r.media) : '–'),
  itemDoResumo('Saldo da jornada', formatarDuracao(r.saldo), { classe: r.saldo < 0 ? 'negativo' : null }),
  itemDoResumo('Dias incompletos', String(r.incompletos), { classe: r.incompletos ? 'negativo' : null }));

export const tabela = (cabecalho, linhas) => el('div', { class: 'rolagem' }, el('table', { class: 'ponto' },
  el('thead', {}, el('tr', {}, cabecalho.map((h) => el('th', { scope: 'col', text: h })))),
  el('tbody', {}, linhas)));

/** Uma linha por dia. Com `aoTocarDia`, a linha vira um botão (abre a correção do dia). */
function linhaDoDia(dia, { ano, mes, diasTrabalho, aoTocarDia }) {
  const data = new Date(ano, mes - 1, Number(dia.dia));
  const folga = !diasTrabalho.includes(data.getDay());
  const classes = [folga ? 'fim-de-semana' : '', dia.status === 'incompleto' ? 'incompleto' : ''].join(' ').trim();
  const horas = { completo: formatarDuracao(dia.trabalhado), incompleto: 'incompl.' }[dia.status] ?? '';
  const rotuloDia = `${String(dia.dia).padStart(2, '0')} ${DIAS_SEMANA[data.getDay()].toLowerCase()}`;
  return el('tr', {
    class: classes || null,
    title: dia.obs || null,
    dataset: aoTocarDia ? { dia: String(dia.dia) } : null,
    tabindex: aoTocarDia ? '0' : null,
    'aria-label': aoTocarDia ? `Corrigir o dia ${rotuloDia}` : null,
    onclick: aoTocarDia ? () => aoTocarDia(data) : null,
    onkeydown: aoTocarDia ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); aoTocarDia(data); } } : null,
  },
  el('td', { text: rotuloDia }),
  el('td', { text: dia.entrada || '' }),
  el('td', { text: dia.saidaAlmoco || '' }),
  el('td', { text: dia.voltaAlmoco || '' }),
  el('td', { text: dia.saida || '' }),
  el('td', { class: 'horas', text: horas }));
}

/** Tabela do mês. opcoes: { ano, mes, diasTrabalho, aoTocarDia? } */
export const tabelaDoMes = (dias, opcoes) =>
  tabela(['Dia', 'Entrada', 'Almoço', 'Volta', 'Saída', 'Horas'], dias.map((d) => linhaDoDia(d, opcoes)));
