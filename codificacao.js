// codificacao.js — guarda a "impressão facial" (1024 números) como texto compacto:
// cada número em float16 (2 bytes) e o resultado em base64, com o prefixo "f16:" (~2,7 KB).

const f32 = new Float32Array(1);
const i32 = new Int32Array(f32.buffer);

/** float32 → float16 (bits), com arredondamento para o mais próximo. */
export function paraHalf(valor) {
  f32[0] = valor;
  const x = i32[0];
  let bits = (x >> 16) & 0x8000;
  let mantissa = (x >> 12) & 0x07ff;
  const expoente = (x >> 23) & 0xff;
  if (expoente < 103) return bits;
  if (expoente > 142) {
    bits |= 0x7c00;
    bits |= (expoente === 255 ? 0 : 1) && x & 0x007fffff;
    return bits;
  }
  if (expoente < 113) {
    mantissa |= 0x0800;
    bits |= (mantissa >> (114 - expoente)) + ((mantissa >> (113 - expoente)) & 1);
    return bits;
  }
  bits |= ((expoente - 112) << 10) | (mantissa >> 1);
  bits += mantissa & 1;
  return bits;
}

/** float16 (bits) → número. */
export function deHalf(h) {
  const sinal = h & 0x8000 ? -1 : 1;
  const expoente = (h & 0x7c00) >> 10;
  const fracao = h & 0x03ff;
  if (expoente === 0) return sinal * 2 ** -14 * (fracao / 1024);
  if (expoente === 0x1f) return fracao ? NaN : sinal * Infinity;
  return sinal * 2 ** (expoente - 15) * (1 + fracao / 1024);
}

export function codificarModelo(vetor) {
  const bytes = new Uint8Array(vetor.length * 2);
  const visao = new DataView(bytes.buffer);
  for (let i = 0; i < vetor.length; i++) visao.setUint16(i * 2, paraHalf(vetor[i]), true);
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return `f16:${btoa(binario)}`;
}

/** Texto "f16:..." → Float32Array. Qualquer outro texto → null. */
export function decodificarModelo(texto) {
  if (!texto || !texto.startsWith('f16:')) return null;
  const binario = atob(texto.slice(4));
  const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
  const visao = new DataView(bytes.buffer);
  const vetor = new Float32Array(bytes.length / 2);
  for (let i = 0; i < vetor.length; i++) vetor[i] = deHalf(visao.getUint16(i * 2, true));
  return vetor;
}
