// modoDeUso.js — com que modo o aparelho abre: empresa (conectado ao servidor), só neste celular,
// ou a tela de escolha. É o único lugar que sabe onde essa escolha fica guardada.
export const MODO = Object.freeze({ empresa: 'empresa', pessoal: 'pessoal', escolher: 'escolher' });

const CHAVE_CONEXAO = 'conexao';
const CHAVE_MODO = 'modoDeUso';
const CHAVE_ANTIGA = 'modo'; // a primeira versão da opção 2 guardava 'pessoal' aqui (chave que o dono do aparelho também usa)

/** preferencias: { ler(chave), gravar(chave, valor), apagar(chave) } */
export function criarModoDeUso({ preferencias }) {
  /** Traz a escolha da primeira versão da opção 2 para a chave própria. */
  async function migrarChaveAntiga() {
    if (await preferencias.ler(CHAVE_ANTIGA) !== MODO.pessoal) return;
    await preferencias.gravar(CHAVE_MODO, MODO.pessoal);
    await preferencias.apagar(CHAVE_ANTIGA);
  }

  return {
    /** Conectado ao servidor vale mais que a escolha da opção 2 (ex.: abriu um link de configuração). */
    async atual() {
      if (await preferencias.ler(CHAVE_CONEXAO)) return MODO.empresa;
      await migrarChaveAntiga();
      return (await preferencias.ler(CHAVE_MODO)) === MODO.pessoal ? MODO.pessoal : MODO.escolher;
    },

    /** Opção 2. Se estava conectado, a conexão sai; os pontos pessoais e os envios pendentes ficam. */
    async usarSoNesteCelular() {
      await preferencias.apagar(CHAVE_CONEXAO);
      await preferencias.gravar(CHAVE_MODO, MODO.pessoal);
    },

    /** Volta para a tela de escolha (desconectar, ou sair da opção 2). Nada guardado é apagado. */
    async voltarParaEscolha() {
      await preferencias.apagar(CHAVE_CONEXAO);
      await preferencias.apagar(CHAVE_MODO);
    },
  };
}
