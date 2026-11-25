// servidor.js — cliente do servidor no Google (Apps Script). Só sabe enviar {token, acao, ...dados}
// e devolver a resposta; quais ações existem é assunto de quem chama.

export class ErroServidor extends Error {
  constructor(mensagem, codigo) {
    super(mensagem);
    this.name = 'ErroServidor';
    this.codigo = codigo;
  }
}

const TEMPO_PADRAO_MS = 30000;

async function lerJson(resposta) {
  try {
    return await resposta.json();
  } catch {
    throw new ErroServidor('Resposta inesperada do servidor. Confira se a implantação está como "Qualquer pessoa".', 'resposta');
  }
}

/**
 * @param obterConexao  função que devolve { url, token } (ou null se o aparelho não foi conectado)
 * @param buscar        o fetch a usar (trocável nos testes)
 */
export function criarServidor({ obterConexao, buscar = (...args) => globalThis.fetch(...args) }) {
  async function postar(url, corpo, timeout) {
    const controle = new AbortController();
    const timer = setTimeout(() => controle.abort(), timeout);
    try {
      // text/plain evita a requisição "preflight" de CORS, que o Apps Script não responde.
      return await buscar(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(corpo),
        redirect: 'follow',
        signal: controle.signal,
      });
    } catch (e) {
      throw new ErroServidor(e.name === 'AbortError' ? 'O servidor demorou para responder' : 'Sem conexão com o servidor', 'rede');
    } finally {
      clearTimeout(timer);
    }
  }

  async function chamar(acao, dados = {}, { timeout = TEMPO_PADRAO_MS, conexao = null } = {}) {
    const destino = conexao || (await obterConexao());
    if (!destino?.url || !destino?.token) throw new ErroServidor('App ainda não conectado à planilha', 'sem_conexao');
    const json = await lerJson(await postar(destino.url, { token: destino.token, acao, ...dados }, timeout));
    if (!json.ok) throw new ErroServidor(json.erro || 'Erro no servidor', json.codigo || 'servidor');
    return json;
  }

  return { chamar };
}
