// jornada.js — regras da jornada: ordem dos pontos, consolidação do dia e horas do mês.
import { AJUSTES_PADRAO, TIPOS_PONTO } from '../config.js';
import { paraMinutos } from './tempo.js';

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

function minutosEsperados(ano, mes, ateDia, jornadaMin, diasTrabalho) {
  let total = 0;
  for (let d = 1; d <= ateDia; d++) if (diasTrabalho.includes(new Date(ano, mes - 1, d).getDay())) total += jornadaMin;
  return total;
}

/** Resumo do mês: total, dias trabalhados, incompletos, média, esperado e saldo (minutos). */
export function resumoMes(dias, {
  ano, mes, hoje, jornadaMin = AJUSTES_PADRAO.jornadaMin, diasTrabalho = AJUSTES_PADRAO.diasTrabalho,
}) {
  const calculados = dias.map((d) => ({ ...d, ...calcularDia(d) }));
  const completos = calculados.filter((d) => d.status === 'completo');
  const total = completos.reduce((soma, d) => soma + d.trabalhado, 0);
  const esperado = minutosEsperados(ano, mes, ultimoDiaQueConta(ano, mes, hoje, calculados), jornadaMin, diasTrabalho);
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
