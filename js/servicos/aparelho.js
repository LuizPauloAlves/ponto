// aparelho.js — o que é deste aparelho: identificador, dono (celular pessoal) e acerto do relógio.
import { gerarId } from '../dominio/seguranca.js';

const DIFERENCA_IGNORADA_MS = 30000; // até 30 s de diferença com o servidor, vale o relógio do aparelho

export async function carregarAparelho({ preferencias, relogio = () => Date.now() }) {
  let id = await preferencias.ler('aparelhoId');
  if (!id) {
    id = gerarId().slice(0, 8);
    await preferencias.gravar('aparelhoId', id);
  }
  let dono = (await preferencias.ler('modo'))?.funcionarioId ?? null;
  let diferenca = (await preferencias.ler('offsetRelogio')) || 0;

  return {
    id,
    /** Hora certa: a do aparelho corrigida pela do servidor. */
    agora: () => relogio() + diferenca,
    donoId: () => dono,
    async definirDono(funcionarioId) {
      dono = funcionarioId || null;
      await preferencias.gravar('modo', { funcionarioId: dono });
    },
    ajustarRelogio(novaDiferenca) {
      diferenca = Math.abs(novaDiferenca) > DIFERENCA_IGNORADA_MS ? Math.round(novaDiferenca) : 0;
      return preferencias.gravar('offsetRelogio', diferenca);
    },
  };
}
