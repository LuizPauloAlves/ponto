// registroPonto.js — caso de uso "bater o ponto": monta o registro, guarda no aparelho,
// aprende o visual do dia quando for o caso e põe na fila de envio.
import { consolidarDia, proximoTipo } from '../dominio/jornada.js';
import { avaliarLocal } from '../dominio/localizacao.js';
import { gerarId } from '../dominio/seguranca.js';
import { dataLocal, inicioDoDia } from '../dominio/tempo.js';

const arredondar = (valor, casas) => (valor === null || valor === undefined ? null : Math.round(valor * 10 ** casas) / 10 ** casas);

/** O registro no formato que o servidor espera (contrato da ação registrarPontos). */
export function montarRegistro({ id, pessoa, tipo, timestamp, relogioAparelho, posicao, local, aparelhoId }) {
  return {
    id,
    funcionarioId: pessoa.funcionarioId,
    nome: pessoa.nome,
    tipo,
    timestamp,
    relogioAparelho,
    metodo: pessoa.metodo,
    similaridade: pessoa.similaridade ?? null,
    real: arredondar(pessoa.real, 2),
    live: arredondar(pessoa.live, 2),
    gps: {
      lat: arredondar(posicao.lat, 6),
      lng: arredondar(posicao.lng, 6),
      precisao: local.precisao,
      distancia: local.distancia,
      local: local.local,
      motivo: local.motivo,
    },
    aparelho: aparelhoId,
    novoTemplate: pessoa.novoModelo || null,
  };
}

export function criarRegistroPonto({ historico, sincronizador, aparelho, catalogo, aoErro = () => {} }) {
  async function deHoje() {
    const agora = aparelho.agora();
    const hoje = dataLocal(agora);
    const registros = await historico.desde(inicioDoDia(agora));
    return registros.filter((r) => r.dataLocal === hoje).sort((a, b) => a.timestamp - b.timestamp);
  }

  /** Batidas de hoje agrupadas por pessoa (só as do dono, num celular pessoal). */
  async function resumoDeHoje() {
    const dono = aparelho.donoId();
    const registros = await deHoje();
    return consolidarDia(dono ? registros.filter((r) => r.funcionarioId === dono) : registros);
  }

  async function sugestao(funcionarioId) {
    const tipos = (await deHoje()).filter((r) => r.funcionarioId === funcionarioId).map((r) => r.tipo);
    return proximoTipo(tipos);
  }

  const avaliarPosicao = (posicao) => avaliarLocal(posicao, catalogo.locais());

  async function registrar({ pessoa, tipo, posicao, local }) {
    const timestamp = aparelho.agora();
    const registro = montarRegistro({
      id: gerarId(), pessoa, tipo, timestamp, relogioAparelho: Date.now(), posicao, local, aparelhoId: aparelho.id,
    });
    const { novoTemplate, ...semBiometria } = registro; // o histórico local não guarda dado biométrico
    await historico.adicionar({ ...semBiometria, status: 'pendente', dataLocal: dataLocal(timestamp) });
    if (novoTemplate) await catalogo.aprender(pessoa.funcionarioId, novoTemplate);
    sincronizador.enfileirar(registro).catch((e) => aoErro(`fila: ${e.message}`));
    return registro;
  }

  return { resumoDeHoje, sugestao, avaliarPosicao, registrar };
}
