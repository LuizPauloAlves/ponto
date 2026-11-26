// meuPonto.js — caso de uso do modo "só neste celular": registrar, corrigir e ler os pontos
// guardados no aparelho. Sem rosto, sem GPS e sem servidor; quem guarda é o `armazem` injetado.
import { AJUSTES_PADRAO } from '../config.js';
import { normalizarAjustes } from '../dominio/ajustes.js';
import { proximoTipo } from '../dominio/jornada.js';
import { inicioDoDia, inicioDoDiaSeguinte, instanteNoDia } from '../dominio/tempo.js';

const PREFERENCIA_AJUSTES = 'meuPontoAjustes';
const AJUSTES_INICIAIS = Object.freeze({ nome: '', jornadaMin: AJUSTES_PADRAO.jornadaMin, diasTrabalho: AJUSTES_PADRAO.diasTrabalho });

const emOrdem = (registros) => [...registros].sort((a, b) => a.timestamp - b.timestamp);

/**
 * armazem: { entre(inicio, fim), gravar(registro), apagar(id), todos() }
 * preferencias: { ler(chave), gravar(chave, valor) }
 */
export function criarMeuPonto({ armazem, preferencias, agora = Date.now, novoId = () => crypto.randomUUID() }) {
  const doDia = async (ts) => emOrdem(await armazem.entre(inicioDoDia(ts), inicioDoDiaSeguinte(ts)));

  /** Horário "HH:MM" no dia `diaTs`; recusa horário inválido ou no futuro. */
  function instante(diaTs, hora) {
    const ts = instanteNoDia(diaTs, hora);
    if (ts === null) throw new Error('Informe o horário no formato 08:00.');
    if (ts > agora()) throw new Error('Esse horário ainda não chegou.');
    return ts;
  }

  async function ajustes() {
    const salvos = await preferencias.ler(PREFERENCIA_AJUSTES);
    const { jornadaMin, diasTrabalho } = normalizarAjustes({ ...AJUSTES_INICIAIS, ...salvos });
    return { nome: String(salvos?.nome ?? ''), jornadaMin, diasTrabalho };
  }

  return {
    ajustes,
    salvarAjustes: ({ nome, jornadaMin, diasTrabalho }) =>
      preferencias.gravar(PREFERENCIA_AJUSTES, { nome: String(nome || '').trim(), jornadaMin, diasTrabalho }),

    hoje: () => doDia(agora()),
    doDia,
    doMes: async (ano, mes) => emOrdem(await armazem.entre(new Date(ano, mes - 1, 1).getTime(), new Date(ano, mes, 1).getTime())),
    todos: async () => emOrdem(await armazem.todos()),
    /** Quando começou o controle (o ponto mais antigo), ou null se ainda não há nenhum. */
    inicio: async () => {
      const registros = await armazem.todos();
      return registros.length ? new Date(Math.min(...registros.map((r) => r.timestamp))) : null;
    },

    /** O próximo ponto do dia, como no modo empresa: entrada → almoço → volta → saída. */
    sugestao: async () => proximoTipo((await doDia(agora())).map((r) => r.tipo)),

    async registrar(tipo) {
      const registro = { id: novoId(), tipo, timestamp: agora() };
      await armazem.gravar(registro);
      return registro;
    },

    /** Inclui um ponto esquecido no dia `diaTs`. Fica marcado como ajuste manual. */
    async incluir(diaTs, { tipo, hora }) {
      const registro = { id: novoId(), tipo, timestamp: instante(diaTs, hora), manual: true };
      await armazem.gravar(registro);
      return registro;
    },

    /** Troca o tipo ou o horário (no mesmo dia). Fica marcado como ajuste manual. */
    async corrigir(registro, { tipo = registro.tipo, hora }) {
      const timestamp = hora === undefined ? registro.timestamp : instante(registro.timestamp, hora);
      const corrigido = { ...registro, tipo, timestamp, manual: true };
      await armazem.gravar(corrigido);
      return corrigido;
    },

    apagar: (id) => armazem.apagar(id),
  };
}
