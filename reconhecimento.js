// reconhecimento.js — transforma uma leitura da câmera em "quem é", e confere cadastros novos.
// Devolve códigos (ok, desconhecido, ambiguo, tempo, vivacidade); as frases ficam na tela.
import { avaliarNovoCadastro, deveAprender, identificar, mediaVetores } from '../dominio/biometria.js';
import { codificarModelo } from '../dominio/codificacao.js';

/** A pessoa que entrou pelo PIN de reserva (sem dados biométricos). */
export const pessoaPorPin = (funcionario) => ({
  funcionarioId: funcionario.id, nome: funcionario.nome, metodo: 'pin', similaridade: null, real: null, live: null, novoModelo: null,
});

export function criarReconhecimento({ catalogo, aparelho }) {
  /** leitura: { status: capturado|tempo|vivacidade, embeddings, real, live } */
  function identificarCaptura(leitura) {
    if (leitura.status !== 'capturado') return { status: leitura.status };
    const ajustes = catalogo.ajustes();
    const vetor = mediaVetores(leitura.embeddings);
    const resultado = identificar(vetor, catalogo.candidatos(aparelho.donoId()), ajustes);
    if (resultado.status !== 'ok') return { status: resultado.status };
    const { funcionarioId, nome, similaridade } = resultado.melhor;
    const aprender = deveAprender(resultado, ajustes, catalogo.ultimaAprendizagem(funcionarioId), aparelho.agora());
    return {
      status: 'ok',
      pessoa: {
        funcionarioId, nome, metodo: 'facial', similaridade, real: leitura.real, live: leitura.live,
        novoModelo: aprender ? codificarModelo(vetor) : null,
      },
    };
  }

  /** Alertas sobre um cadastro novo (ou "visual novo" de `funcionarioId`), para a pessoa confirmar. */
  function conferirNovoCadastro(templates, funcionarioId = null) {
    const todos = catalogo.candidatos();
    return avaliarNovoCadastro({
      templates,
      outros: todos.filter((c) => c.funcionarioId !== funcionarioId),
      proprio: funcionarioId ? todos.filter((c) => c.funcionarioId === funcionarioId) : null,
      limiar: catalogo.ajustes().limiar,
    });
  }

  return { identificarCaptura, conferirNovoCadastro };
}
