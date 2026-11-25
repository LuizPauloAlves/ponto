// tempo.js — datas, horas e durações. Funções puras: quem chama informa o instante
// (nada de relógio escondido), o que deixa tudo fácil de testar.
import { MESES } from '../config.js';

const doisDigitos = (n) => String(n).padStart(2, '0');

/** "2026-11-25", no fuso do aparelho. */
export function dataLocal(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
}

/** "25/11/2026". */
export const dataCurta = (ts) => dataLocal(ts).split('-').reverse().join('/');

/** "08:05". */
export function horaLocal(ts) {
  const d = new Date(ts);
  return `${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;
}

/** Instante das 00:00 do dia de `ts`. */
export function inicioDoDia(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** "08:05" ou "8:05" → 485 minutos. Texto inválido → null. */
export function paraMinutos(texto) {
  if (texto === null || texto === undefined) return null;
  const m = String(texto).trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const horas = Number(m[1]);
  const minutos = Number(m[2]);
  return horas > 23 || minutos > 59 ? null : horas * 60 + minutos;
}

/** 485 → "8h05"; negativos com sinal de menos. */
export function formatarDuracao(min) {
  if (min === null || min === undefined || Number.isNaN(min)) return '–';
  const absoluto = Math.abs(Math.round(min));
  return `${min < 0 ? '−' : ''}${Math.floor(absoluto / 60)}h${doisDigitos(absoluto % 60)}`;
}

/** 485 → "8:05" (formato do campo de jornada). */
export const formatarHoraMinuto = (min) => `${Math.floor(min / 60)}:${doisDigitos(min % 60)}`;

export const nomeMes = (mes) => MESES[mes - 1];

/** Os últimos `n` meses, do atual para trás: [{ ano, mes, rotulo }]. */
export function mesesRecentes(n, hoje) {
  const lista = [];
  let ano = hoje.getFullYear();
  let mes = hoje.getMonth() + 1;
  for (let k = 0; k < n; k++) {
    lista.push({ ano, mes, rotulo: `${nomeMes(mes)} de ${ano}` });
    mes -= 1;
    if (mes === 0) { mes = 12; ano -= 1; }
  }
  return lista;
}
