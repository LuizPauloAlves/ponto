// jornada.js — regras da jornada: ordem dos pontos, consolidação do dia e horas do mês.
import { AJUSTES_PADRAO, TIPOS_PONTO } from '../config.js';
import { horaLocal, paraMinutos } from './tempo.js';

const TIPO_POR_ID = new Map(TIPOS_PONTO.map((t) => [t.id, t]));
const IDS_TIPOS = TIPOS_PONTO.map((t) => t.id);
const MINUTOS_NO_DIA = 1440;

export const rotuloDoTipo = (id) => TIPO_POR_ID.get(id)?.rotulo ?? id;

/** Próximo ponto esperado, dado o que a pessoa já marcou hoje (em ordem). Depois da saída, recomeça. */
export function proximoTipo(tiposDeHoje = []) {
  const ultimo = IDS_TIPOS.indexOf(tiposDeHoje[tiposDeHoje.length - 1]);
  return IDS_TIPOS[(ultimo + 1) % IDS_TIPOS.length];
}

/** true se o horário novo deve tomar o lugar do atual (regra "primeiro" ou "ultimo" do tipo). */
export function substitui(tipo, novo, atual) {
  return TIPO_POR_ID.get(tipo)?.regra === 'ultimo' ? novo > atual : novo < atual;
}

/** Campo de cada tipo na grade do dia (o mesmo nome que o relatório do servidor usa). */
const CAMPO_DO_TIPO = Object.freeze({ entrada: 'entrada', saida_almoco: 'saidaAlmoco', volta_almoco: 'voltaAlmoco', saida: 'saida' });

/** Agrupa as batidas do dia por pessoa, com a mesma regra que a planilha usa. */
export function consolidarDia(registros) {
  const porPessoa = new Map();
  for (const r of registros) {
    if (!porPessoa.has(r.funcionarioId)) porPessoa.set(r.funcionarioId, { funcionarioId: r.funcionarioId, nome: r.nome, porTipo: {} });
    const pessoa = porPessoa.get(r.funcionarioId);
    const atual = pessoa.porTipo[r.tipo];
    if (!atual || substitui(r.tipo, r.timestamp, atual.timestamp)) pessoa.porTipo[r.tipo] = r;
  }
  return [...porPessoa.values()];
}

/**
 * O mês dia a dia a partir das batidas guardadas no aparelho, com a regra da planilha
 * (entrada e almoço: o primeiro horário do dia; saída: o último). Formato igual ao do relatório do servidor.
 */
export function gradeDoMes(registros, { ano, mes }) {
  const porDia = new Map();
  for (const r of registros) {
    const d = new Date(r.timestamp);
    if (d.getFullYear() !== ano || d.getMonth() + 1 !== mes) continue;
    if (!porDia.has(d.getDate())) porDia.set(d.getDate(), []);
    porDia.get(d.getDate()).push(r);
  }
  return Array.from({ length: new Date(ano, mes, 0).getDate() }, (_, i) => {
    const linha = { dia: i + 1 };
    const [consolidado] = consolidarDia(porDia.get(i + 1) ?? []);
    for (const [tipo, registro] of Object.entries(consolidado?.porTipo ?? {})) linha[CAMPO_DO_TIPO[tipo]] = horaLocal(registro.timestamp);
    return linha;
  });
}

const intervalo = (inicio, fim) => (fim - inicio + MINUTOS_NO_DIA) % MINUTOS_NO_DIA; // aceita virada da meia-noite

/** Horas de um dia a partir dos horários "HH:MM": { status: vazio|incompleto|completo, trabalhado, almoco }. */
export function calcularDia(dia) {
  const [entrada, saidaAlmoco, voltaAlmoco, saida] = [dia.entrada, dia.saidaAlmoco, dia.voltaAlmoco, dia.saida].map(paraMinutos);
  const incompleto = (almoco = null) => ({ status: 'incompleto', trabalhado: 0, almoco });
  if ([entrada, saidaAlmoco, voltaAlmoco, saida].every((v) => v === null)) return { status: 'vazio', trabalhado: 0, almoco: null };
  if (entrada === null || saida === null) return incompleto();
  if ((saidaAlmoco === null) !== (voltaAlmoco === null)) return incompleto();
  const almoco = saidaAlmoco === null ? null : intervalo(saidaAlmoco, voltaAlmoco);
  const trabalhado = intervalo(entrada, saida) - (almoco ?? 0);
  return trabalhado < 0 ? incompleto(almoco) : { status: 'completo', trabalhado, almoco };
}

/** Último dia do mês que já deve contar na jornada esperada (hoje só conta se o dia já fechou). */
function ultimoDiaQueConta(ano, mes, hoje, dias) {
  const hojeAno = hoje.getFullYear();
  const hojeMes = hoje.getMonth() + 1;
  if (ano > hojeAno || (ano === hojeAno && mes > hojeMes)) return 0;
  if (ano < hojeAno || mes < hojeMes) return new Date(ano, mes, 0).getDate();
  const diaHoje = hoje.getDate();
  const registroDeHoje = dias.find((d) => Number(d.dia) === diaHoje);
  return registroDeHoje?.status === 'completo' ? diaHoje : diaHoje - 1;
}

/** Primeiro dia do mês que conta na jornada esperada: com `desde`, os dias anteriores a ele não contam. */
function primeiroDiaQueConta(ano, mes, desde) {
  if (!desde) return 1;
  if (desde < new Date(ano, mes - 1, 1)) return 1;
  if (desde >= new Date(ano, mes, 1)) return Infinity;
  return desde.getDate();
}

function minutosEsperados(ano, mes, { deDia, ateDia }, jornadaMin, diasTrabalho) {
  let total = 0;
  for (let d = deDia; d <= ateDia; d++) if (diasTrabalho.includes(new Date(ano, mes - 1, d).getDay())) total += jornadaMin;
  return total;
}

/**
 * Resumo do mês: total, dias trabalhados, incompletos, média, esperado e saldo (minutos).
 * `desde` (opcional): começo do controle; os dias antes dele não entram na jornada esperada.
 */
export function resumoMes(dias, {
  ano, mes, hoje, jornadaMin = AJUSTES_PADRAO.jornadaMin, diasTrabalho = AJUSTES_PADRAO.diasTrabalho, desde = null,
}) {
  const calculados = dias.map((d) => ({ ...d, ...calcularDia(d) }));
  const completos = calculados.filter((d) => d.status === 'completo');
  const total = completos.reduce((soma, d) => soma + d.trabalhado, 0);
  const periodo = { deDia: primeiroDiaQueConta(ano, mes, desde), ateDia: ultimoDiaQueConta(ano, mes, hoje, calculados) };
  const esperado = minutosEsperados(ano, mes, periodo, jornadaMin, diasTrabalho);
  return {
    dias: calculados,
    total,
    diasTrabalhados: completos.length,
    incompletos: calculados.filter((d) => d.status === 'incompleto').length,
    media: completos.length ? Math.round(total / completos.length) : 0,
    esperado,
    saldo: total - esperado,
  };
}
