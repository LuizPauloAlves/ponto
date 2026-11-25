// relogio.js — o relógio grande da tela inicial. Para quando o app vai para segundo plano (bateria).
import { el } from './dom.js';

const doisDigitos = (n) => String(n).padStart(2, '0');

export function iniciarRelogio({ hora, data, agora, aoMudarDia = () => {} }) {
  const horasMinutos = document.createTextNode('');
  const segundos = el('span', { class: 'seg' });
  hora.replaceChildren(horasMinutos, segundos);
  const formatoData = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  let ultimaData = '';
  let timer = null;

  function tique() {
    const d = new Date(agora());
    horasMinutos.data = `${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;
    segundos.textContent = doisDigitos(d.getSeconds());
    hora.setAttribute('datetime', d.toISOString());
    const texto = formatoData.format(d);
    if (texto === ultimaData) return;
    ultimaData = texto;
    data.textContent = texto;
    aoMudarDia();
  }

  const ligar = () => { clearInterval(timer); tique(); timer = setInterval(tique, 1000); };
  ligar();
  document.addEventListener('visibilitychange', () => (document.hidden ? clearInterval(timer) : ligar()));
}
