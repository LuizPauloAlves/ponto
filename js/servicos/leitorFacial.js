// leitorFacial.js — lê quadros da câmera com a IA e alimenta as regras de captura
// (desafio de vivacidade no ponto, roteiro guiado no cadastro).
import { CAPTURA } from '../config.js';
import { avaliarRosto, criarDesafio, criarRoteiroCadastro, vivacidadeAprovada } from '../dominio/captura.js';

export function criarLeitorFacial({ ia }) {
  /** Lê quadros (no máximo ~10/s) até `aoRosto` devolver um resultado; null se a sessão for cancelada. */
  function lerAte(video, sessao, aoRosto) {
    return new Promise((resolve, reject) => {
      let ultimaLeitura = 0;
      const agendar = () => (video.requestVideoFrameCallback ? video.requestVideoFrameCallback(passo) : requestAnimationFrame(passo));
      async function passo() {
        if (sessao.cancelado) { resolve(null); return; }
        const agora = performance.now();
        if (agora - ultimaLeitura >= CAPTURA.intervaloLeituraMs) {
          ultimaLeitura = agora;
          try {
            const rosto = await ia.lerRosto(video);
            if (sessao.cancelado) { resolve(null); return; }
            const resultado = aoRosto(rosto, video.videoWidth);
            if (resultado !== undefined) { resolve(resultado); return; }
          } catch (e) { reject(e); return; }
        }
        agendar();
      }
      agendar();
    });
  }

  /** Envolve `aoRosto` com um prazo: passou do tempo, devolve { status: 'tempo' }. */
  function comPrazo(limiteMs, aoRosto) {
    const inicio = performance.now();
    return (rosto, largura) => (performance.now() - inicio > limiteMs ? { status: 'tempo' } : aoRosto(rosto, largura));
  }

  async function lerParaPonto(video, { ajustes, sessao, aoEstado }) {
    await ia.carregar();
    const desafio = criarDesafio({ minReal: ajustes.minReal, minLive: ajustes.minLive });
    return lerAte(video, sessao, comPrazo(CAPTURA.tempoMaxPontoMs, (rosto, largura) => {
      const qualidade = avaliarRosto(rosto, largura);
      const estado = desafio.atualizar(qualidade.ok ? rosto : null, qualidade);
      aoEstado(estado);
      if (estado.fase === 'pronto') return { status: 'capturado', embeddings: estado.embeddings, real: estado.real, live: estado.live };
      if (estado.fase === 'falhou') return { status: 'vivacidade' };
      return undefined;
    }));
  }

  async function lerParaCadastro(video, { passos, ajustes, sessao, aoEstado }) {
    await ia.carregar();
    const roteiro = criarRoteiroCadastro(passos);
    return lerAte(video, sessao, comPrazo(CAPTURA.tempoMaxCadastroMs, (rosto, largura) => {
      const qualidade = avaliarRosto(rosto, largura);
      const estado = roteiro.atualizar(qualidade.ok ? rosto : null, qualidade);
      aoEstado(estado);
      if (!estado.concluido) return undefined;
      return vivacidadeAprovada(estado.real, estado.live, ajustes) ? { status: 'capturado', templates: estado.templates } : { status: 'vivacidade' };
    }));
  }

  return { lerParaPonto, lerParaCadastro };
}
