// catalogo.js — o cadastro baixado do servidor (pessoas, modelos faciais, locais e ajustes),
// guardado no aparelho para funcionar sem internet. Avisa quem quiser saber quando ele muda.
import { normalizarAjustes } from '../dominio/ajustes.js';
import { guardarModeloAprendido, montarCandidatos } from '../dominio/biometria.js';

export const porNome = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR');

export function criarCatalogo({ preferencias, servidor, agora = () => Date.now() }) {
  let dados = null;          // { versao, funcionarios, templates, locais, ajustes, em }
  let aprendizagens = {};    // funcionarioId → instante do último visual aprendido
  let cache = { chave: null, lista: [] };
  const ouvintes = new Set();

  const avisar = () => ouvintes.forEach((fn) => fn());
  const invalidarCandidatos = () => { cache = { chave: null, lista: [] }; };

  async function carregar() {
    dados = (await preferencias.ler('cadastro')) || null;
    aprendizagens = (await preferencias.ler('adaptacoes')) || {};
  }

  /** Baixa o cadastro se mudou (o servidor responde "naoMudou" quando a versão é a mesma). */
  async function atualizar({ forcar = false } = {}) {
    const r = await servidor.chamar('obterCadastro', { versao: forcar ? null : dados?.versao ?? null });
    if (r.naoMudou && dados) {
      dados.em = agora();
      return;
    }
    dados = {
      versao: r.versao,
      funcionarios: r.funcionarios || [],
      templates: r.templates || [],
      locais: r.locais || [],
      ajustes: r.ajustes || {},
      em: agora(),
    };
    invalidarCandidatos();
    await preferencias.gravar('cadastro', dados);
    avisar();
  }

  /** Candidatos para comparar o rosto (decodificados uma vez e guardados até o cadastro mudar). */
  function candidatos(somenteId = null) {
    const chave = `${dados?.versao}|${somenteId}`;
    if (cache.chave !== chave) cache = { chave, lista: montarCandidatos(dados ?? {}, { somenteId }) };
    return cache.lista;
  }

  async function aprender(funcionarioId, modeloTexto) {
    aprendizagens = { ...aprendizagens, [funcionarioId]: agora() };
    const meus = dados.templates.filter((t) => t.funcionarioId === funcionarioId);
    const outros = dados.templates.filter((t) => t.funcionarioId !== funcionarioId);
    const novo = { funcionarioId, tipo: 'adaptativo', emb: modeloTexto };
    dados = { ...dados, templates: [...outros, ...guardarModeloAprendido(meus, novo)] };
    invalidarCandidatos();
    await Promise.all([preferencias.gravar('adaptacoes', aprendizagens), preferencias.gravar('cadastro', dados)]);
  }

  const funcionarios = () => [...(dados?.funcionarios ?? [])].sort(porNome);
  const ativos = () => funcionarios().filter((f) => f.ativo);

  return {
    carregar,
    atualizar,
    candidatos,
    aprender,
    funcionarios,
    ativos,
    temDados: () => dados !== null,
    ajustes: () => normalizarAjustes(dados?.ajustes),
    locais: () => dados?.locais ?? [],
    funcionario: (id) => dados?.funcionarios.find((f) => f.id === id) ?? null,
    /** Quem tem PIN de reserva (opcionalmente só o dono do aparelho). */
    comPin: (somenteId = null) => ativos().filter((f) => f.pinHash && (!somenteId || f.id === somenteId)),
    quantidadeModelos: (id) => (dados?.templates ?? []).filter((t) => t.funcionarioId === id).length,
    ultimaAprendizagem: (id) => aprendizagens[id] || 0,
    idadeMs: () => (dados ? agora() - (dados.em || 0) : Infinity),
    aoMudar: (fn) => { ouvintes.add(fn); return () => ouvintes.delete(fn); },
  };
}
