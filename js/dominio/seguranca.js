// seguranca.js — identificadores, PIN e limite de tentativas.

export function gerarId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** SHA-256 de salt + PIN, em hexadecimal (o servidor calcula igual). */
export async function hashPin(salt, pin) {
  const dados = new TextEncoder().encode(String(salt) + String(pin));
  const resumo = await globalThis.crypto.subtle.digest('SHA-256', dados);
  return [...new Uint8Array(resumo)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function pinConfere(funcionario, pin) {
  return Boolean(funcionario?.pinHash) && (await hashPin(funcionario.pinSalt, pin)) === funcionario.pinHash;
}

/** Bloqueia por `bloqueioMs` depois de `max` falhas seguidas (atrasa quem tenta adivinhar o PIN). */
export function criarLimitador({ max, bloqueioMs, agora = () => Date.now() }) {
  let falhas = 0;
  let bloqueadoAte = 0;
  return {
    /** Instante em que o bloqueio acaba, ou 0 se não houver bloqueio. */
    bloqueadoAte: () => (agora() < bloqueadoAte ? bloqueadoAte : 0),
    registrarFalha() {
      falhas += 1;
      if (falhas >= max) { bloqueadoAte = agora() + bloqueioMs; falhas = 0; }
    },
    registrarSucesso() { falhas = 0; },
  };
}
