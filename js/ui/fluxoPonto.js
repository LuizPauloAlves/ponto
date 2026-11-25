// fluxoPonto.js — o fluxo completo de "Registrar ponto": GPS em paralelo, rosto (ou PIN),
// confirmação do tipo e carimbo. Só orquestra: cada passo é de outro módulo.
import { GPS } from '../config.js';
import { obterPosicao } from '../infra/gps.js';
import { pessoaPorPin } from '../servicos/reconhecimento.js';
import { descreverLocal, FALHA_RECONHECIMENTO } from './textos.js';

/** GPS de um registro: começa junto com a câmera e pode ser buscado de novo na confirmação. */
function criarRastreadorGps(aoAtualizar) {
  let atual = null;
  return {
    iniciar() {
      atual?.cancelar();
      atual = obterPosicao({ tempoMax: GPS.ponto.tempoMaxMs, precisaoAlvo: GPS.ponto.precisaoAlvoM, aoAtualizar });
    },
    posicao: () => atual.promessa,
    parar: () => atual?.cancelar(),
  };
}

export function criarFluxoPonto({
  catalogo, aparelho, registroPonto, reconhecimento, telaCamera, confirmacao, dialogoPin, sucesso, aviso,
  aoRegistrar = () => {}, aoFaltarCadastro = () => {},
}) {
  function podeComecar() {
    if (!catalogo.temDados()) {
      aviso.mostrar('O aparelho ainda não baixou o cadastro. Conecte à internet e tente de novo.');
      aoFaltarCadastro();
      return false;
    }
    const dono = aparelho.donoId();
    if (catalogo.candidatos(dono).length) return true;
    aviso.mostrar(dono ? 'O dono deste aparelho não tem rosto cadastrado.' : 'Nenhuma pessoa cadastrada ainda. Cadastre em Administração > Pessoas.', 5000);
    return false;
  }

  async function identificarPorPin() {
    const comPin = catalogo.comPin(aparelho.donoId());
    if (!comPin.length) { aviso.mostrar('Ninguém tem PIN de reserva cadastrado.'); return null; }
    const pessoa = await dialogoPin.pedir(comPin);
    return pessoa ? pessoaPorPin(pessoa) : null;
  }

  async function identificar() {
    const ajustes = catalogo.ajustes();
    const pinDisponivel = ajustes.permitirPin && catalogo.comPin().length > 0;
    const resultado = await telaCamera.capturarPonto({
      ajustes,
      podePin: (falhas) => pinDisponivel && falhas >= 2,
      interpretar: (leitura) => {
        const r = reconhecimento.identificarCaptura(leitura);
        return r.status === 'ok' ? { ok: true, valor: r.pessoa } : { ok: false, mensagem: FALHA_RECONHECIMENTO[r.status] };
      },
    });
    if (!resultado) return null;
    return resultado.pin ? identificarPorPin() : resultado.valor;
  }

  async function iniciar() {
    if (!podeComecar()) return;
    const gps = criarRastreadorGps((posicao) => {
      const local = registroPonto.avaliarPosicao(posicao);
      telaCamera.mostrarGps(descreverLocal(local, { curto: true }), local.ok);
    });
    gps.iniciar();
    try {
      const pessoa = await identificar();
      if (!pessoa) return;
      const registro = await confirmacao.abrir({
        pessoa,
        sugerido: await registroPonto.sugestao(pessoa.funcionarioId),
        gps,
        avaliar: registroPonto.avaliarPosicao,
        registrar: (tipo, posicao, local) => registroPonto.registrar({ pessoa, tipo, posicao, local }),
      });
      if (!registro) return;
      sucesso.mostrar(registro);
      aoRegistrar(registro);
    } finally {
      gps.parar();
    }
  }

  return { iniciar };
}
