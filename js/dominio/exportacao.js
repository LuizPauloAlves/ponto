// exportacao.js — planilhas em CSV para o modo "só neste celular". Funções puras.
// Ponto e vírgula e BOM: é o formato que o Excel em português e o Google Planilhas abrem direto, com acentos.
import { DIAS_SEMANA } from '../config.js';
import { rotuloDoTipo } from './jornada.js';
import { dataCurta, formatarHoraMinuto, horaLocal, nomeMes } from './tempo.js';

const BOM = '﻿';
const SEPARADOR = ';';
const FIM_DE_LINHA = '\r\n';

/** Campo com ; aspas ou quebra de linha vai entre aspas (aspas internas dobradas). */
function campo(valor) {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  return /[;"\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

const montarCsv = (linhas) => BOM + linhas.map((l) => l.map(campo).join(SEPARADOR)).join(FIM_DE_LINHA) + FIM_DE_LINHA;

/** "8:05" ou "-1:30": duração que a planilha entende. */
const duracao = (min) => `${min < 0 ? '-' : ''}${formatarHoraMinuto(Math.abs(Math.round(min)))}`;

const SITUACAO = Object.freeze({ completo: '', incompleto: 'incompleto', vazio: '' });

/** O mês dia a dia (a partir do `resumoMes`), com total e saldo no fim. */
export function csvDoMes(resumo, { ano, mes }) {
  const linhas = [['Data', 'Dia', 'Entrada', 'Saída almoço', 'Volta almoço', 'Saída', 'Horas trabalhadas', 'Situação']];
  for (const d of resumo.dias) {
    const data = new Date(ano, mes - 1, d.dia);
    linhas.push([
      dataCurta(data.getTime()), DIAS_SEMANA[data.getDay()],
      d.entrada ?? '', d.saidaAlmoco ?? '', d.voltaAlmoco ?? '', d.saida ?? '',
      d.status === 'completo' ? duracao(d.trabalhado) : '', SITUACAO[d.status] ?? '',
    ]);
  }
  linhas.push([], [`Total de ${nomeMes(mes).toLowerCase()} de ${ano}`, '', '', '', '', '', duracao(resumo.total), '']);
  linhas.push(['Saldo da jornada', '', '', '', '', '', duracao(resumo.saldo), '']);
  return montarCsv(linhas);
}

/** Todas as batidas, uma por linha, em ordem: serve de cópia de segurança. */
export function csvDasBatidas(registros) {
  const ordenados = [...registros].sort((a, b) => a.timestamp - b.timestamp);
  return montarCsv([
    ['Data', 'Hora', 'Tipo', 'Origem'],
    ...ordenados.map((r) => [dataCurta(r.timestamp), horaLocal(r.timestamp), rotuloDoTipo(r.tipo), r.manual ? 'ajuste manual' : 'registrado no app']),
  ]);
}
