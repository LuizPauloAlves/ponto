// gps.js — pega a melhor leitura de GPS num intervalo curto e desliga o sensor (bateria).

const PERMISSAO_NEGADA = 1;

/**
 * Devolve { promessa, cancelar }. A promessa resolve com a leitura mais precisa obtida
 * ({ lat, lng, precisao, em }) assim que atingir `precisaoAlvo`, ou ao fim de `tempoMax`.
 */
export function obterPosicao({ tempoMax, precisaoAlvo, aoAtualizar = () => {} }) {
  let vigia = null;
  let timer = null;
  let melhor = null;
  let encerrar = () => {};

  const promessa = new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Este aparelho não tem GPS disponível no navegador'));
      return;
    }
    encerrar = (erro) => {
      if (vigia !== null) navigator.geolocation.clearWatch(vigia);
      clearTimeout(timer);
      vigia = null;
      if (melhor) resolve(melhor);
      else reject(erro || new Error('Não foi possível obter a localização'));
    };
    vigia = navigator.geolocation.watchPosition(
      (p) => {
        const leitura = { lat: p.coords.latitude, lng: p.coords.longitude, precisao: p.coords.accuracy, em: p.timestamp };
        if (!melhor || leitura.precisao < melhor.precisao) melhor = leitura;
        aoAtualizar(melhor);
        if (melhor.precisao <= precisaoAlvo) encerrar();
      },
      (e) => {
        // Outros erros (sinal, tempo interno) seguem tentando até tempoMax.
        if (e.code !== PERMISSAO_NEGADA) return;
        melhor = null;
        encerrar(new Error('Permissão de localização negada. Libere a localização para este site nas configurações do navegador.'));
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: tempoMax },
    );
    timer = setTimeout(() => encerrar(new Error('Tempo esgotado ao buscar o GPS. Tente perto de uma janela.')), tempoMax);
  });

  promessa.catch(() => {}); // quem precisar do erro usa a própria promessa
  return { promessa, cancelar: () => encerrar(new Error('cancelado')) };
}
