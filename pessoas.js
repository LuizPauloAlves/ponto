// pessoas.js — aba Pessoas: cadastro facial, "visual novo" e desativar/reativar.
import { CAMERAS, PASSOS_CADASTRO, PASSOS_VISUAL_NOVO } from '../../config.js';
import { codificarModelo } from '../../dominio/codificacao.js';
import { $, $$, el, primeiroNome } from '../dom.js';
import { perguntaDoAlerta } from '../textos.js';

const PIN_VALIDO = /^\d{4,6}$/;
const PREFERENCIA_CAMERA = 'cameraCadastro';

export function criarAbaPessoas({ catalogo, chamarAdmin, recarregar, telaCamera, reconhecimento, aviso, banco }) {
  const opcoesCamera = $$('input[name=pes-camera]');
  const lista = $('#pes-lista');
  const formulario = $('#pes-form');
  const botaoNova = $('#pes-nova');
  const campoNome = $('#pes-nome');
  const campoPin = $('#pes-pin');

  function abrirFormulario(aberto) {
    formulario.hidden = !aberto;
    botaoNova.hidden = aberto;
    if (aberto) campoNome.focus();
  }

  const cameraEscolhida = () => opcoesCamera.find((o) => o.checked)?.value || CAMERAS.frontal;

  /** Volta a câmera usada da última vez: quem ajuda nos cadastros costuma repetir a escolha. */
  async function lembrarCamera() {
    const salva = await banco.preferencias.ler(PREFERENCIA_CAMERA).catch(() => null);
    const opcao = opcoesCamera.find((o) => o.value === salva);
    if (opcao) opcao.checked = true;
  }

  async function salvar({ funcionarioId, nome, pin, templates }) {
    aviso.mostrar('Salvando cadastro…', 10000);
    const modelos = templates.map(codificarModelo);
    if (funcionarioId) await chamarAdmin('adicionarTemplates', { funcionarioId, templates: modelos });
    else await chamarAdmin('salvarFuncionario', { nome, pin, templates: modelos });
    await recarregar();
  }

  /** Captura o rosto, confere os alertas com a pessoa e salva. Devolve true se salvou. */
  async function cadastrar({ funcionarioId = null, nome, pin = '', passos }) {
    const frontal = cameraEscolhida() === CAMERAS.frontal;
    const captura = await telaCamera.capturarCadastro({ passos, ajustes: catalogo.ajustes(), frontal });
    if (!captura) return false;
    const templates = captura.valor;
    const alertas = reconhecimento.conferirNovoCadastro(templates, funcionarioId);
    if (!alertas.every((alerta) => window.confirm(perguntaDoAlerta(alerta, nome)))) return false;
    try {
      await salvar({ funcionarioId, nome, pin, templates });
      mostrar();
      aviso.mostrar(funcionarioId ? 'Visual novo salvo.' : `${primeiroNome(nome)} foi cadastrado(a).`);
      return true;
    } catch (e) {
      aviso.mostrar(`Não foi possível salvar: ${e.message}`, 6000);
      return false;
    }
  }

  async function alternarAtivo(pessoa) {
    if (pessoa.ativo && !window.confirm(`Desativar ${pessoa.nome}? A pessoa deixa de ser reconhecida, mas as planilhas continuam.`)) return;
    try {
      await chamarAdmin('alterarFuncionario', { funcionarioId: pessoa.id, ativo: !pessoa.ativo });
      await recarregar();
      mostrar();
    } catch (e) {
      aviso.mostrar(e.message);
    }
  }

  function itemDaLista(pessoa) {
    const detalhes = `${catalogo.quantidadeModelos(pessoa.id)} modelos faciais${pessoa.pinHash ? ', com PIN' : ''}${pessoa.ativo ? '' : ', inativo'}`;
    return el('li', { class: pessoa.ativo ? null : 'inativo' },
      el('div', { class: 'info' }, el('strong', { text: pessoa.nome }), el('small', { text: detalhes })),
      el('div', { class: 'acoes' },
        pessoa.ativo ? el('button', {
          class: 'btn btn-secundario', type: 'button', text: 'Visual novo',
          onclick: () => cadastrar({ funcionarioId: pessoa.id, nome: pessoa.nome, passos: PASSOS_VISUAL_NOVO }),
        }) : null,
        el('button', {
          class: pessoa.ativo ? 'btn btn-perigo' : 'btn btn-secundario', type: 'button',
          text: pessoa.ativo ? 'Desativar' : 'Reativar', onclick: () => alternarAtivo(pessoa),
        })));
  }

  function mostrar() {
    const pessoas = catalogo.funcionarios().sort((a, b) => Number(b.ativo) - Number(a.ativo)); // ativos primeiro, por nome
    if (!pessoas.length) {
      lista.replaceChildren(el('li', {}, el('span', { class: 'texto-apoio', text: 'Ninguém cadastrado ainda. Comece por você mesmo para testar.' })));
      return;
    }
    lista.replaceChildren(...pessoas.map(itemDaLista));
  }

  opcoesCamera.forEach((o) => o.addEventListener('change', () => banco.preferencias.gravar(PREFERENCIA_CAMERA, cameraEscolhida()).catch(() => {})));
  lembrarCamera();
  botaoNova.addEventListener('click', () => abrirFormulario(true));
  $('#pes-cancelar').addEventListener('click', () => abrirFormulario(false));
  formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pin = campoPin.value.trim();
    if (pin && !PIN_VALIDO.test(pin)) { aviso.mostrar('O PIN deve ter de 4 a 6 números.'); return; }
    if (await cadastrar({ nome: campoNome.value.trim(), pin, passos: PASSOS_CADASTRO })) {
      formulario.reset();
      abrirFormulario(false);
    }
  });

  return { mostrar };
}
