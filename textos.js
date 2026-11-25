// textos.js — as frases que aparecem na tela, num só lugar. As regras devolvem códigos
// (dentro, fora, ambiguo...); aqui eles viram palavras.
import { horaLocal } from '../dominio/tempo.js';

/** Situação do GPS em relação ao local. `curto` para o selo da câmera; longo para a confirmação. */
export function descreverLocal(local, { curto = false } = {}) {
  const { motivo, precisao, distancia, local: nome } = local;
  if (motivo === 'sem_local_cadastrado') return curto ? `GPS ±${precisao} m` : `Localização registrada (±${precisao} m). Nenhum local cadastrado ainda.`;
  if (motivo === 'dentro') return curto ? `${nome}, ${distancia} m` : `${nome}, a ${distancia} m.`;
  if (motivo === 'sinal_fraco') return curto ? `GPS fraco ±${precisao} m` : `GPS fraco (±${precisao} m).`;
  return curto ? `Fora do local (${distancia} m)` : `Fora do local: ${distancia} m de ${nome}.`;
}

/** Por que o ponto não pode ser registrado aqui. */
export function motivoDaRecusa(local) {
  if (local.motivo === 'sinal_fraco') return `Sinal de GPS fraco (±${local.precisao} m). Vá para perto de uma janela e busque o GPS de novo.`;
  return `Você está a ${local.distancia} m de ${local.local} (limite de ${local.raio} m). O ponto só pode ser registrado no local.`;
}

const NAO_RECONHECIDO = 'Rosto não reconhecido. Tente de novo com o rosto bem iluminado.';
export const FALHA_RECONHECIMENTO = Object.freeze({
  tempo: 'Não consegui ver o rosto direito. Procure mais luz e tente de novo.',
  vivacidade: 'Não foi possível confirmar que é uma pessoa ao vivo. Tire óculos escuros ou boné e tente de novo.',
  ambiguo: 'Reconhecimento incerto. Olhe de frente, sem nada no rosto, e tente de novo.',
  desconhecido: NAO_RECONHECIDO,
  sem_cadastro: NAO_RECONHECIDO,
});

export const FALHA_CADASTRO = Object.freeze({
  tempo: 'Demorou demais. Tente de novo com mais luz.',
  vivacidade: 'Não parece um rosto ao vivo (foto ou tela?). Tente de novo.',
});

/** Pergunta de confirmação para cada alerta de um cadastro novo. */
export function perguntaDoAlerta(alerta, nome) {
  if (alerta.tipo === 'parecido') return `Este rosto se parece com ${alerta.nome} (${Math.round(alerta.similaridade * 100)}%). Pode ser cadastro duplicado. Salvar mesmo assim?`;
  if (alerta.tipo === 'inconsistente') return 'As capturas ficaram diferentes entre si (luz fraca ou rosto coberto?). Salvar mesmo assim?';
  return `Este rosto está bem diferente do cadastro de ${nome}. É mesmo a mesma pessoa?`;
}

/** Frase e cor do status de envio na tela inicial. */
export function statusDeEnvio({ pendentes, proxima, ultimoErro, ultimoEnvio }, agora) {
  if (!pendentes) {
    return { classe: '', texto: ultimoEnvio ? `Tudo enviado para a planilha às ${horaLocal(ultimoEnvio)}.` : 'Tudo enviado para a planilha.' };
  }
  const quantos = pendentes === 1 ? '1 registro aguardando envio.' : `${pendentes} registros aguardando envio.`;
  const quando = proxima && proxima > agora ? ` Nova tentativa às ${horaLocal(proxima)}.` : ' Enviando…';
  return { classe: ultimoErro ? 'erro' : 'pendente', texto: `${quantos}${quando} Toque para enviar agora.` };
}
