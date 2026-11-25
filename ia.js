// ia.js — reconhecimento facial com a biblioteca Human (@vladmandic/human), rodando no próprio
// aparelho (TensorFlow.js/WebGL). Nenhuma foto sai do celular: daqui só sai o vetor do rosto.
import { HUMAN_VERSAO } from '../config.js';

const CDN = `https://cdn.jsdelivr.net/npm/@vladmandic/human@${HUMAN_VERSAO}`;
const AMOSTRAS_DE_TEMPO = 60;

const CONFIG_HUMAN = {
  modelBasePath: `${CDN}/models/`,
  cacheModels: true,          // guarda os modelos no aparelho: depois da 1ª vez, abre sem internet
  debug: false,
  warmup: 'face',
  filter: { enabled: true, equalization: true, flip: false }, // equaliza a luz: ajuda com sombra e maquiagem
  face: {
    enabled: true,
    detector: { rotation: true, maxDetected: 1, minConfidence: 0.5, return: false },
    mesh: { enabled: true },
    iris: { enabled: false },
    attention: { enabled: false },
    emotion: { enabled: false },
    description: { enabled: true, skipFrames: 0, skipTime: 0 }, // a "impressão facial" (vetor)
    antispoof: { enabled: true, skipFrames: 0, skipTime: 0 },   // detecta foto ou tela
    liveness: { enabled: true, skipFrames: 0, skipTime: 0 },    // detecta rosto vivo
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  gesture: { enabled: false },
  segmentation: { enabled: false },
};

// A Human guarda a configuração de cada leitura para as próximas: por isso toda leitura diz qual quer.
const LEITURA_COMPLETA = Object.freeze({ face: { description: { enabled: true } } });
const LEITURA_SEM_VETOR = Object.freeze({ face: { description: { enabled: false } } }); // pula o modelo mais pesado

let human = null;
let carregando = null;
const tempos = [];

export const carregada = () => human !== null;

export function carregar() {
  if (human) return Promise.resolve(human);
  carregando ??= (async () => {
    const modulo = await import(`${CDN}/dist/human.esm.js`);
    const Human = modulo.Human || modulo.default;
    const instancia = new Human(CONFIG_HUMAN);
    await instancia.load();
    await instancia.warmup();
    human = instancia;
    return instancia;
  })().catch((e) => {
    carregando = null;
    throw new Error(`Não foi possível carregar o reconhecimento facial (${e.message}). Na primeira vez é preciso internet.`);
  });
  return carregando;
}

/** Converte o resultado da Human para o formato que as regras de captura usam. */
function paraRosto(f) {
  if (!f) return null;
  const angulo = f.rotation?.angle || {};
  return {
    score: f.score ?? f.faceScore ?? 0,
    yaw: angulo.yaw ?? 0,
    pitch: angulo.pitch ?? 0,
    real: typeof f.real === 'number' ? f.real : null,
    live: typeof f.live === 'number' ? f.live : null,
    embedding: f.embedding?.length ? Float32Array.from(f.embedding) : null,
    largura: f.box?.[2] ?? 0,
  };
}

/**
 * Lê um quadro (vídeo ou imagem) e devolve o rosto encontrado, ou null.
 * `comVetor: false` não calcula a impressão facial (embedding fica null); o resto da leitura é igual.
 */
export async function lerRosto(fonte, { comVetor = true } = {}) {
  const inicio = performance.now();
  const resultado = await human.detect(fonte, comVetor ? LEITURA_COMPLETA : LEITURA_SEM_VETOR);
  tempos.push(performance.now() - inicio);
  if (tempos.length > AMOSTRAS_DE_TEMPO) tempos.shift();
  return paraRosto(resultado.face?.[0]);
}

export function estatisticas() {
  const memoria = human?.tf?.memory?.();
  return {
    carregado: human !== null,
    backend: human?.tf?.getBackend?.() || null,
    tensores: memoria ? memoria.numTensors : null,
    memoriaGPU: memoria ? memoria.numBytes : null,
    msPorLeitura: tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : null,
    heap: performance.memory ? performance.memory.usedJSHeapSize : null,
  };
}

/**
 * Teste de desempenho no aparelho: faz N leituras seguidas e compara o começo com o fim.
 * Se os tensores ou o tempo crescerem, há vazamento de memória ou superaquecimento.
 */
export async function medirDesempenho(fonte, leituras, aoProgresso, sessao) {
  await carregar();
  const antes = estatisticas();
  const ms = [];
  const tensores = [];
  for (let i = 0; i < leituras && !sessao.cancelado; i++) {
    const inicio = performance.now();
    await human.detect(fonte, LEITURA_COMPLETA);
    ms.push(performance.now() - inicio);
    tensores.push(human.tf?.memory?.().numTensors ?? 0);
    if (i % 5 === 0) aoProgresso((i + 1) / leituras);
    await new Promise((r) => setTimeout(r, 0));
  }
  const fatia = Math.max(5, Math.floor(ms.length / 5));
  const media = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  return {
    leituras: ms.length,
    msInicio: media(ms.slice(0, fatia)),
    msFim: media(ms.slice(-fatia)),
    tensoresInicio: tensores[0] ?? antes.tensores,
    tensoresFim: tensores[tensores.length - 1] ?? antes.tensores,
    backend: estatisticas().backend,
  };
}
