// abertura.js — tela de abertura: segura o primeiro toque enquanto o reconhecimento facial carrega
// por trás. Em vez de um tempo fixo, fecha quando a IA fica pronta, respeitando um mínimo (a animação
// não pisca) e um máximo (ninguém fica preso se a IA demorar ou falhar: a câmera avisa depois).
// A animação é só CSS com transform e opacity: roda fora do processamento da IA e não trava.

const FOLGA_DA_TRANSICAO_MS = 600; // se o navegador não avisar o fim do esmaecimento (ex.: movimento reduzido)

export function criarAbertura(elemento, { minimoMs, maximoMs }) {
  const inicio = performance.now();
  let encerrada = false;

  function encerrar() {
    if (encerrada) return;
    encerrada = true;
    const esconder = () => { elemento.hidden = true; };
    elemento.classList.add('saindo');
    elemento.addEventListener('transitionend', esconder, { once: true });
    setTimeout(esconder, FOLGA_DA_TRANSICAO_MS);
  }

  setTimeout(encerrar, maximoMs);

  return {
    /** Fecha quando `pronto` terminar (com sucesso ou erro), mas nunca antes do tempo mínimo. */
    encerrarQuando(pronto = Promise.resolve()) {
      Promise.resolve(pronto).catch(() => {}).then(() => {
        const faltam = Math.max(0, minimoMs - (performance.now() - inicio));
        setTimeout(encerrar, faltam);
      });
    },
    encerrada: () => encerrada,
  };
}
