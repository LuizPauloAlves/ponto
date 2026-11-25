// confirmacao.js — depois do rosto: "Olá, Maria", situação do GPS e a escolha do tipo de ponto.
import { TIPOS_PONTO } from '../config.js';
import { $, el, primeiroNome } from './dom.js';
import { descreverLocal, motivoDaRecusa } from './textos.js';

export function criarConfirmacao() {
  const raiz = $('#confirmar');
  const titulo = $('#conf-nome');
  const textoLocal = $('#conf-local');
  const tipos = $('#conf-tipos');
  const erro = $('#conf-erro');
  const botaoGps = $('#conf-gps');
  let atual = null; // { resolver, gps, avaliar, registrar }

  function fechar(valor) {
    const aberta = atual;
    atual = null;
    raiz.hidden = true;
    aberta?.resolver(valor);
  }

  function travar(sim) { for (const b of tipos.querySelectorAll('button')) b.disabled = sim; }

  function recusar(mensagem) {
    erro.textContent = mensagem;
    botaoGps.hidden = false;
    travar(false);
  }

  /** Mostra a situação do GPS quando a leitura chegar (ignora leituras antigas, de antes de "buscar de novo"). */
  function acompanharGps() {
    const { gps, avaliar } = atual;
    const leitura = gps.posicao();
    const aindaVale = () => atual && gps.posicao() === leitura;
    textoLocal.textContent = 'Confirmando localização…';
    leitura.then(
      (pos) => { if (aindaVale()) textoLocal.textContent = descreverLocal(avaliar(pos)); },
      (e) => { if (aindaVale() && e.message !== 'cancelado') textoLocal.textContent = e.message; },
    );
  }

  async function escolher(tipo) {
    const aberta = atual;
    if (!aberta) return;
    travar(true);
    erro.textContent = '';
    let posicao;
    try {
      posicao = await aberta.gps.posicao();
    } catch (e) {
      recusar(e.message);
      return;
    }
    if (atual !== aberta) return;
    const local = aberta.avaliar(posicao);
    if (!local.ok) { recusar(motivoDaRecusa(local)); return; }
    try {
      fechar(await aberta.registrar(tipo, posicao, local));
    } catch (e) {
      recusar(`Não foi possível salvar o ponto: ${e.message}`);
    }
  }

  /**
   * Abre a folha e resolve com o registro feito, ou null se a pessoa cancelar.
   * gps: { posicao(), iniciar() }; avaliar(pos) → local; registrar(tipo, pos, local) → registro
   */
  function abrir({ pessoa, sugerido, gps, avaliar, registrar }) {
    fechar(null);
    return new Promise((resolver) => {
      atual = { resolver, gps, avaliar, registrar };
      titulo.textContent = `Olá, ${primeiroNome(pessoa.nome)}`;
      erro.textContent = '';
      botaoGps.hidden = true;
      tipos.replaceChildren(...TIPOS_PONTO.map((t) => el('button', {
        class: `tipo${t.id === sugerido ? ' sugerido' : ''}`,
        type: 'button',
        onclick: () => escolher(t.id),
      }, t.rotulo, t.id === sugerido ? el('small', { text: 'sugerido' }) : null)));
      raiz.hidden = false;
      acompanharGps();
      tipos.querySelector('.sugerido')?.focus();
    });
  }

  $('#conf-cancelar').addEventListener('click', () => fechar(null));
  botaoGps.addEventListener('click', () => {
    if (!atual) return;
    erro.textContent = '';
    botaoGps.hidden = true;
    atual.gps.iniciar();
    acompanharGps();
  });

  return { abrir };
}
