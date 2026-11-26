// banco.js — armazenamento no aparelho (IndexedDB). É o ÚNICO lugar que conhece o esquema:
// a página e o service worker importam este mesmo módulo (antes o esquema era copiado nos dois).
const NOME = 'ponto-facial';
const VERSAO = 2; // 2: loja "meuPonto" (modo só neste celular)
let conexao = null;

function criarEsquema(db) {
  if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
  if (!db.objectStoreNames.contains('fila')) db.createObjectStore('fila', { keyPath: 'id' });
  if (!db.objectStoreNames.contains('registros')) {
    db.createObjectStore('registros', { keyPath: 'id' }).createIndex('timestamp', 'timestamp');
  }
  if (!db.objectStoreNames.contains('meuPonto')) {
    db.createObjectStore('meuPonto', { keyPath: 'id' }).createIndex('timestamp', 'timestamp');
  }
}

function abrir() {
  if (!conexao) {
    conexao = new Promise((resolve, reject) => {
      const pedido = indexedDB.open(NOME, VERSAO);
      pedido.onupgradeneeded = () => criarEsquema(pedido.result);
      pedido.onsuccess = () => {
        const db = pedido.result;
        db.onversionchange = () => { db.close(); conexao = null; };
        resolve(db);
      };
      pedido.onerror = () => { conexao = null; reject(pedido.error); };
    });
  }
  return conexao;
}

/** Roda `operacao(loja, definirResultado)` numa transação e resolve quando ela termina. */
async function transacao(loja, modo, operacao) {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const t = db.transaction(loja, modo);
    let resultado;
    t.oncomplete = () => resolve(resultado);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transação abortada'));
    operacao(t.objectStore(loja), (valor) => { resultado = valor; });
  });
}

const ler = (loja, pedir) => transacao(loja, 'readonly', (s, definir) => {
  const pedido = pedir(s);
  pedido.onsuccess = () => definir(pedido.result);
});
const gravar = (loja, operacao) => transacao(loja, 'readwrite', operacao);

/** Atualiza cada item só se ele ainda existir (o outro lado pode tê-lo removido no meio-tempo). */
const atualizarExistentes = (s, itens, alterar) => itens.forEach((item) => {
  const pedido = s.get(item.id ?? item);
  pedido.onsuccess = () => { if (pedido.result) s.put(alterar(pedido.result, item)); };
});

/** Valores avulsos do aparelho: conexão, cadastro em cache, preferências, erros recentes. */
export const preferencias = Object.freeze({
  ler: (chave) => ler('kv', (s) => s.get(chave)),
  gravar: (chave, valor) => gravar('kv', (s) => { s.put(valor, chave); }),
  apagar: (chave) => gravar('kv', (s) => { s.delete(chave); }),
});

/** Registros aguardando a confirmação do servidor. */
export const fila = Object.freeze({
  todos: () => ler('fila', (s) => s.getAll()),
  contar: () => ler('fila', (s) => s.count()),
  adicionar: (item) => gravar('fila', (s) => { s.put(item); }),
  remover: (ids) => gravar('fila', (s) => { ids.forEach((id) => s.delete(id)); }),
  atualizar: (itens) => gravar('fila', (s) => atualizarExistentes(s, itens, (_, novo) => novo)),
});

/** Cópia local das batidas (para "Hoje neste aparelho"); a planilha é a fonte oficial. */
export const historico = Object.freeze({
  adicionar: (registro) => gravar('registros', (s) => { s.put(registro); }),
  desde: (ts) => ler('registros', (s) => s.index('timestamp').getAll(IDBKeyRange.lowerBound(ts))),
  contar: () => ler('registros', (s) => s.count()),
  marcarEnviados: (ids) => gravar('registros', (s) => atualizarExistentes(s, ids, (r) => ({ ...r, status: 'enviado' }))),
  /** Apaga o que for mais antigo que `ts`, para o app não crescer sem limite. Devolve quantos apagou. */
  apagarAntesDe: (ts) => gravar('registros', (s, definir) => {
    let apagados = 0;
    const cursor = s.index('timestamp').openCursor(IDBKeyRange.upperBound(ts, true));
    cursor.onsuccess = () => {
      const c = cursor.result;
      if (!c) { definir(apagados); return; }
      c.delete();
      apagados += 1;
      c.continue();
    };
  }),
});

/** Pontos do modo "só neste celular": ficam aqui sem prazo, porque não há planilha por trás. */
export const meuPonto = Object.freeze({
  entre: (inicio, fim) => ler('meuPonto', (s) => s.index('timestamp').getAll(IDBKeyRange.bound(inicio, fim, false, true))),
  todos: () => ler('meuPonto', (s) => s.getAll()),
  gravar: (registro) => gravar('meuPonto', (s) => { s.put(registro); }),
  apagar: (id) => gravar('meuPonto', (s) => { s.delete(id); }),
});
