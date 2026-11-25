// diario.js — guarda os últimos erros do app no aparelho (aparecem em Ajustes > Desempenho).
const MAXIMO = 30;
const TAMANHO_MAXIMO = 300;

export function criarDiario({ preferencias }) {
  async function registrar(mensagem) {
    try {
      const lista = (await preferencias.ler('erros')) || [];
      lista.push({ em: Date.now(), msg: String(mensagem).slice(0, TAMANHO_MAXIMO) });
      await preferencias.gravar('erros', lista.slice(-MAXIMO));
    } catch {
      // sem armazenamento disponível: não há onde guardar, e o erro original já aconteceu
    }
  }
  const listar = async () => (await preferencias.ler('erros')) || [];
  return { registrar, listar };
}
