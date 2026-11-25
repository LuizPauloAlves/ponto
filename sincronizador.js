// sincronizador.js — fila de envio. Cada registro fica guardado no aparelho até o servidor
// confirmar aquele ID; falhou, tenta de novo seguindo a política de reenvio.
// Recebe tudo de fora (fila, envio, relógio, temporizador): a página e o service worker usam o
// mesmo código, cada um com suas peças, e os testes simulam semanas em milissegundos.
import { REENVIO } from '../config.js';

/** Política de reenvio: espera curta nas primeiras falhas, depois mais longa. Sem limite de tentativas. */
export function proximaTentativa(tentativas, agora, regras = REENVIO) {
  const minutos = tentativas <= regras.tentativasNoInicio ? regras.minutosNoInicio : regras.minutosDepois;
  return agora + minutos * 60000;
}

const TEMPORIZADOR_DO_NAVEGADOR = Object.freeze({ definir: (fn, ms) => setTimeout(fn, ms), limpar: (t) => clearTimeout(t) });

/** Objeto nulo: para quem envia uma vez e não agenda nada (o service worker). */
export const SEM_TEMPORIZADOR = Object.freeze({ definir: () => null, limpar: () => {} });

const navegadorOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);
const RODADAS_MAXIMAS = 25; // após dias sem internet: até 25 lotes seguidos numa sincronização

/**
 * @param fila        { todos, adicionar, atualizar, remover }
 * @param enviar      async (registros) => { confirmados: [ids], erros: {id: motivo}, horaServidor }
 * @param aoConfirmar async (ids) chamado depois que o servidor confirmou
 */
export function criarSincronizador({
  fila,
  enviar,
  agora = () => Date.now(),
  online = navegadorOnline,
  temporizador = TEMPORIZADOR_DO_NAVEGADOR,
  aoConfirmar = async () => {},
  aoHoraServidor = () => {},
}) {
  let timer = null;
  let emAndamento = null;
  let ultimoErro = null;
  let ultimoEnvio = null;
  const ouvintes = new Set();

  const maisCedo = (itens) => itens.reduce((min, i) => Math.min(min, i.proximaEm), Infinity);

  async function status() {
    const itens = await fila.todos();
    return { pendentes: itens.length, proxima: itens.length ? maisCedo(itens) : null, ultimoErro, ultimoEnvio, itens };
  }

  async function notificar() {
    if (!ouvintes.size) return;
    const atual = await status();
    ouvintes.forEach((fn) => { try { fn(atual); } catch (e) { console.error(e); } });
  }

  function pararTimer() {
    if (timer !== null) temporizador.limpar(timer);
    timer = null;
  }

  async function agendar() {
    pararTimer();
    const itens = await fila.todos();
    if (!itens.length) return;
    const espera = Math.max(1000, Math.min(maisCedo(itens) - agora(), REENVIO.verificacaoMaxMs));
    timer = temporizador.definir(() => { timer = null; sincronizar(); }, espera);
  }

  async function adiar(itens, motivo) {
    ultimoErro = motivo;
    const t = agora();
    await fila.atualizar(itens.map((i) => ({
      ...i, tentativas: i.tentativas + 1, proximaEm: proximaTentativa(i.tentativas + 1, t), ultimoErro: motivo,
    })));
  }

  async function processarResposta(devidos, { confirmados = [], erros = {} }) {
    const aceitos = new Set(confirmados);
    const ids = devidos.filter((i) => aceitos.has(i.id)).map((i) => i.id);
    if (ids.length) {
      await fila.remover(ids);
      await aoConfirmar(ids);
    }
    const recusados = devidos.filter((i) => !aceitos.has(i.id));
    if (recusados.length) await adiar(recusados, erros[recusados[0].id] || 'Servidor não confirmou');
    else ultimoErro = null;
    ultimoEnvio = agora();
    return ids.length;
  }

  /** Envia um lote do que estiver vencido (ou tudo, se `forcar`). Devolve quantos foram confirmados. */
  async function enviarLote(forcar) {
    const t = agora();
    const devidos = (await fila.todos())
      .filter((i) => forcar || i.proximaEm <= t)
      .sort((a, b) => a.criadoEm - b.criadoEm)
      .slice(0, REENVIO.lote);
    if (!devidos.length) return 0;
    if (!online()) { await adiar(devidos, 'Sem internet'); return 0; }
    try {
      const inicio = agora();
      const resposta = await enviar(devidos.map((i) => ({ ...i.registro, tentativa: i.tentativas + 1 })));
      const fim = agora();
      // Resposta rápida: dá para estimar a diferença entre o relógio do aparelho e o do servidor.
      if (resposta.horaServidor && fim - inicio < 5000) aoHoraServidor(resposta.horaServidor - (inicio + fim) / 2);
      return await processarResposta(devidos, resposta);
    } catch (e) {
      await adiar(devidos, e.message || String(e));
      return 0;
    }
  }

  /** Chamadas simultâneas reaproveitam a mesma execução (nunca duas requisições ao mesmo tempo). */
  function sincronizar({ forcar = false } = {}) {
    if (emAndamento) return emAndamento;
    emAndamento = (async () => {
      let enviados = 0;
      try {
        for (let rodada = 0; rodada < RODADAS_MAXIMAS; rodada++) {
          const n = await enviarLote(forcar);
          enviados += n;
          if (n < REENVIO.lote) break;
        }
      } finally {
        emAndamento = null;
        await agendar();
        await notificar();
      }
      return enviados;
    })();
    return emAndamento;
  }

  async function enfileirar(registro) {
    await fila.adicionar({ id: registro.id, registro, tentativas: 0, proximaEm: 0, criadoEm: agora() });
    await notificar();
    return sincronizar();
  }

  const aoMudar = (fn) => { ouvintes.add(fn); return () => ouvintes.delete(fn); };

  return { enfileirar, sincronizar, status, aoMudar, notificar, parar: pararTimer };
}
