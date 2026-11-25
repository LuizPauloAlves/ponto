// ajustes.js — converte os ajustes vindos do servidor (texto) para valores de uso, com padrões seguros.
import { AJUSTES_PADRAO } from '../config.js';

const NUMERICOS = ['jornadaMin', 'limiar', 'margem', 'minReal', 'minLive', 'raioPadrao'];

function lerDias(valor) {
  if (Array.isArray(valor)) return valor;
  if (typeof valor !== 'string') return AJUSTES_PADRAO.diasTrabalho;
  return valor.split(',').map((s) => s.trim()).filter(Boolean).map(Number).filter((n) => n >= 0 && n <= 6);
}

export function normalizarAjustes(bruto = {}) {
  const ajustes = { ...AJUSTES_PADRAO, ...bruto };
  for (const chave of NUMERICOS) {
    const n = Number(ajustes[chave]);
    ajustes[chave] = Number.isFinite(n) ? n : AJUSTES_PADRAO[chave];
  }
  ajustes.diasTrabalho = lerDias(ajustes.diasTrabalho);
  ajustes.permitirPin = ajustes.permitirPin === true || ajustes.permitirPin === 'true';
  return ajustes;
}

/** Formato que o servidor guarda: dias de trabalho como "1,2,3,4,5". */
export const ajustesParaServidor = (ajustes) => ({ ...ajustes, diasTrabalho: ajustes.diasTrabalho.join(',') });
