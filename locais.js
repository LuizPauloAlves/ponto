// locais.js — aba Locais: cadastra o local de trabalho a partir de onde o celular está.
import { GPS } from '../../config.js';
import { obterPosicao } from '../../infra/gps.js';
import { $, botaoQueEnviou, comBotaoOcupado, el } from '../dom.js';

export function criarAbaLocais({ catalogo, chamarAdmin, recarregar, aviso }) {
  const lista = $('#loc-lista');
  const formulario = $('#loc-form');
  const campoNome = $('#loc-nome');
  const campoRaio = $('#loc-raio');
  const status = $('#loc-status');

  async function remover(local) {
    if (!window.confirm(`Remover ${local.nome}?`)) return;
    try {
      await chamarAdmin('removerLocal', { id: local.id });
      await recarregar();
      mostrar();
    } catch (e) {
      aviso.mostrar(e.message);
    }
  }

  const itemDaLista = (local) => el('li', {},
    el('div', { class: 'info' }, el('strong', { text: local.nome }), el('small', { text: `Raio de ${local.raio} m` })),
    el('div', { class: 'acoes' },
      el('a', { class: 'btn btn-secundario', href: `https://www.google.com/maps?q=${local.lat},${local.lng}`, target: '_blank', rel: 'noopener', text: 'Mapa' }),
      el('button', { class: 'btn btn-perigo', type: 'button', text: 'Remover', onclick: () => remover(local) })));

  function mostrar() {
    const locais = catalogo.locais();
    if (!locais.length) {
      lista.replaceChildren(el('li', {}, el('span', { class: 'texto-apoio', text: 'Nenhum local cadastrado. Sem local, o ponto é aceito em qualquer lugar e fica marcado na planilha.' })));
      return;
    }
    lista.replaceChildren(...locais.map(itemDaLista));
  }

  async function salvar() {
    status.textContent = 'Buscando sua localização…';
    const regras = GPS.cadastroLocal;
    try {
      const { promessa } = obterPosicao({
        tempoMax: regras.tempoMaxMs,
        precisaoAlvo: regras.precisaoAlvoM,
        aoAtualizar: (p) => { status.textContent = `Precisão atual: ±${Math.round(p.precisao)} m…`; },
      });
      const posicao = await promessa;
      const precisao = Math.round(posicao.precisao);
      if (precisao > regras.precisaoAceitavelM && !window.confirm(`A precisão do GPS está em ±${precisao} m (o ideal é abaixo de 30 m). Salvar mesmo assim?`)) {
        status.textContent = '';
        return;
      }
      await chamarAdmin('salvarLocal', { nome: campoNome.value.trim(), lat: posicao.lat, lng: posicao.lng, raio: Number(campoRaio.value) });
      await recarregar();
      mostrar();
      campoNome.value = '';
      status.textContent = `Local salvo com precisão de ±${precisao} m.`;
    } catch (e) {
      status.textContent = e.message;
    }
  }

  formulario.addEventListener('submit', (e) => {
    e.preventDefault();
    comBotaoOcupado(botaoQueEnviou(e), salvar);
  });

  return { mostrar };
}
