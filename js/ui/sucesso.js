// sucesso.js — o "carimbo" que confirma o ponto (o único momento animado do app).
import { rotuloDoTipo } from '../dominio/jornada.js';
import { horaLocal } from '../dominio/tempo.js';
import { $ } from './dom.js';

const DURACAO_MS = 3800;
const MENSAGEM_POR_METODO = Object.freeze({
  pin: 'Registrado com PIN. Fica marcado na planilha para conferência.',
  facial: 'Registrado. O envio para a planilha segue em segundo plano, mesmo sem internet agora.',
  pessoal: 'Salvo neste celular.',
});

export function criarSucesso() {
  const raiz = $('#sucesso');
  const carimbo = raiz.querySelector('.carimbo');
  let timer = null;

  function mostrar(registro) {
    $('#suc-tipo').textContent = rotuloDoTipo(registro.tipo);
    $('#suc-hora').textContent = horaLocal(registro.timestamp);
    $('#suc-nome').textContent = registro.nome ?? '';
    $('#suc-msg').textContent = MENSAGEM_POR_METODO[registro.metodo] ?? MENSAGEM_POR_METODO.facial;
    raiz.hidden = false;
    carimbo.style.animation = 'none';
    void carimbo.offsetWidth; // reinicia a animação
    carimbo.style.animation = '';
    clearTimeout(timer);
    timer = setTimeout(() => { raiz.hidden = true; }, DURACAO_MS);
  }

  raiz.addEventListener('click', () => { raiz.hidden = true; });
  return { mostrar };
}
