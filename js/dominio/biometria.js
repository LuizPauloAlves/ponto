// biometria.js — comparação de "impressões faciais" (vetores de 1024 números) e as decisões
// tomadas com elas. Puro: quem compara pode ser trocado (parâmetro `comparar`), sem estado global.
import { AJUSTES_PADRAO, APRENDIZADO } from '../config.js';
import { decodificarModelo } from './codificacao.js';

/** Similaridade 0..1 entre dois vetores; mesma fórmula de match.similarity da biblioteca Human. */
export function similaridade(a, b, { ordem = 2, multiplicador = 25, min = 0.2, max = 0.8 } = {}) {
  if (!a || !b || a.length === 0 || a.length !== b.length) return 0;
  let soma = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    soma += d * d;
  }
  const distancia = Math.round(100 * multiplicador * soma) / 100;
  if (distancia === 0) return 1;
  const raiz = ordem === 2 ? Math.sqrt(distancia) : distancia ** (1 / ordem);
  const normalizada = (1 - raiz / 100 - min) / (max - min);
  return Math.round(100 * Math.max(Math.min(normalizada, 1), 0)) / 100;
}

/** Média de vários vetores (vários quadros da câmera viram uma leitura mais estável). */
export function mediaVetores(lista) {
  const validos = lista.filter((v) => v && v.length);
  if (!validos.length) return null;
  const media = new Float32Array(validos[0].length);
  for (const v of validos) for (let i = 0; i < media.length; i++) media[i] += v[i];
  for (let i = 0; i < media.length; i++) media[i] /= validos.length;
  return media;
}

/**
 * Identificação 1:N. Cada pessoa vale pela MAIOR similaridade entre seus modelos:
 * um modelo "de maquiagem" ou "cabelo novo" basta para reconhecer.
 * candidatos: [{ funcionarioId, nome, templates: Float32Array[] }]
 * → { status: ok | desconhecido | ambiguo | sem_cadastro, melhor, segundo }
 */
export function identificar(vetor, candidatos, {
  limiar = AJUSTES_PADRAO.limiar, margem = AJUSTES_PADRAO.margem, comparar = similaridade,
} = {}) {
  if (!vetor || !candidatos?.length) return { status: 'sem_cadastro', melhor: null, segundo: null };
  const placar = candidatos.map((c) => ({
    funcionarioId: c.funcionarioId,
    nome: c.nome,
    similaridade: Math.max(0, ...c.templates.map((t) => comparar(vetor, t))),
  })).sort((x, y) => y.similaridade - x.similaridade);
  const [melhor, segundo = null] = placar;
  if (melhor.similaridade < limiar) return { status: 'desconhecido', melhor, segundo };
  if (segundo && melhor.similaridade - segundo.similaridade < margem) return { status: 'ambiguo', melhor, segundo };
  return { status: 'ok', melhor, segundo };
}

/** Menor similaridade entre pares: mostra se as capturas de um cadastro ficaram coerentes. */
export function consistencia(templates, comparar = similaridade) {
  let menor = 1;
  for (let i = 0; i < templates.length; i++) {
    for (let j = i + 1; j < templates.length; j++) menor = Math.min(menor, comparar(templates[i], templates[j]));
  }
  return menor;
}

/**
 * Aprendizado de visual novo (maquiagem, cabelo, barba, óculos): só guarda um modelo quando o
 * reconhecimento foi FORTE e sem dúvida, mas o rosto de hoje traz algo diferente dos já salvos.
 */
export function deveAprender(resultado, { limiar, margem }, ultimaVez, agora, regras = APRENDIZADO) {
  if (resultado?.status !== 'ok') return false;
  const s = resultado.melhor.similaridade;
  if (s < limiar + regras.folga || s >= regras.teto) return false;
  if (resultado.segundo && s - resultado.segundo.similaridade < margem * 1.5) return false;
  return agora - (ultimaVez || 0) >= regras.intervaloMs;
}

/**
 * Acrescenta um modelo aprendido mantendo no máximo `max` deles (os mais antigos saem).
 * Os modelos do cadastro original nunca saem: são a âncora que impede o sistema de
 * "migrar" aos poucos para outra pessoa.
 */
export function guardarModeloAprendido(templates, novo, max = APRENDIZADO.maxModelos) {
  const doCadastro = templates.filter((t) => t.tipo !== 'adaptativo');
  const aprendidos = [...templates.filter((t) => t.tipo === 'adaptativo'), novo];
  return [...doCadastro, ...aprendidos.slice(-max)];
}

/** Converte o cadastro (funcionários + modelos em texto) em candidatos prontos para comparar. */
export function montarCandidatos({ funcionarios = [], templates = [] } = {}, { somenteId = null } = {}) {
  const porId = new Map(funcionarios
    .filter((f) => f.ativo && (!somenteId || f.id === somenteId))
    .map((f) => [f.id, { funcionarioId: f.id, nome: f.nome, templates: [] }]));
  for (const t of templates) {
    const vetor = porId.has(t.funcionarioId) ? decodificarModelo(t.emb) : null;
    if (vetor) porId.get(t.funcionarioId).templates.push(vetor);
  }
  return [...porId.values()].filter((c) => c.templates.length);
}

/**
 * Confere um cadastro novo antes de salvar. Devolve alertas para a pessoa confirmar:
 * { tipo: 'parecido', nome, similaridade } — parece outra pessoa já cadastrada;
 * { tipo: 'inconsistente' } — as capturas ficaram diferentes entre si;
 * { tipo: 'diferente' } — "visual novo" muito distante do cadastro da própria pessoa.
 */
export function avaliarNovoCadastro({ templates, outros, proprio = null, limiar, comparar = similaridade }) {
  const alertas = [];
  const parecidos = templates
    .map((t) => identificar(t, outros, { limiar: 0, margem: 0, comparar }).melhor)
    .filter((m) => m && m.similaridade >= limiar)
    .sort((a, b) => b.similaridade - a.similaridade);
  if (parecidos.length) alertas.push({ tipo: 'parecido', nome: parecidos[0].nome, similaridade: parecidos[0].similaridade });
  if (consistencia(templates, comparar) < limiar - 0.05) alertas.push({ tipo: 'inconsistente' });
  if (proprio?.length) {
    const atual = identificar(mediaVetores(templates), proprio, { limiar: 0, margem: 0, comparar }).melhor;
    if (atual && atual.similaridade < 0.35) alertas.push({ tipo: 'diferente' });
  }
  return alertas;
}
