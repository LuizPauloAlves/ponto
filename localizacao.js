// localizacao.js — distância e decisão "está no local de trabalho?".
import { GPS } from '../config.js';

const RAIO_DA_TERRA_M = 6371000;
const GRAU = Math.PI / 180;

/** Distância em metros entre dois pontos (fórmula de haversine). */
export function distanciaMetros(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * GRAU;
  const dLon = (lon2 - lon1) * GRAU;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * GRAU) * Math.cos(lat2 * GRAU) * Math.sin(dLon / 2) ** 2;
  return 2 * RAIO_DA_TERRA_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** O local cadastrado mais próximo, descontando o raio de cada um. */
function localMaisProximo(pos, locais) {
  let melhor = null;
  for (const local of locais) {
    const distancia = distanciaMetros(pos.lat, pos.lng, Number(local.lat), Number(local.lng));
    const folga = distancia - Number(local.raio);
    if (!melhor || folga < melhor.folga) melhor = { local, distancia, folga };
  }
  return melhor;
}

/**
 * Decide se a posição vale para bater o ponto. Devolve { ok, motivo, local, distancia, precisao, raio },
 * com motivo: dentro | fora | sinal_fraco | sem_local_cadastrado | sem_gps.
 * A imprecisão do GPS conta a favor até `folgaMaxM` (evita recusar quem está na porta).
 */
export function avaliarLocal(pos, locais = [], { precisaoMaxM = GPS.precisaoMaxM, folgaMaxM = GPS.folgaMaxM } = {}) {
  if (!pos) return { ok: false, motivo: 'sem_gps' };
  const precisao = Math.round(pos.precisao ?? Infinity);
  if (!locais.length) return { ok: true, motivo: 'sem_local_cadastrado', precisao, local: null, distancia: null };
  const { local, distancia } = localMaisProximo(pos, locais);
  const base = { local: local.nome, distancia: Math.round(distancia), precisao, raio: Number(local.raio) };
  if (precisao > precisaoMaxM) return { ...base, ok: false, motivo: 'sinal_fraco' };
  const dentro = base.distancia - Math.min(precisao, folgaMaxM) <= base.raio;
  return { ...base, ok: dentro, motivo: dentro ? 'dentro' : 'fora' };
}
