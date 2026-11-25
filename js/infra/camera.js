// camera.js — liga e desliga a câmera frontal.
let fluxo = null;

export async function abrir(video) {
  fechar(video);
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador não permite usar a câmera. Abra pelo Chrome ou pelo Safari.');
  try {
    fluxo = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } },
    });
  } catch (e) {
    if (e.name === 'NotAllowedError') throw new Error('Permissão da câmera negada. Libere a câmera para este site nas configurações do navegador.');
    throw new Error('Não foi possível abrir a câmera frontal');
  }
  video.muted = true;
  video.playsInline = true;
  video.srcObject = fluxo;
  await video.play();
  if (!video.videoWidth) await new Promise((r) => video.addEventListener('loadedmetadata', r, { once: true }));
}

/** Desliga de verdade (luz da câmera apaga, bateria e memória liberadas). */
export function fechar(video) {
  fluxo?.getTracks().forEach((t) => t.stop());
  fluxo = null;
  if (video) {
    video.pause();
    video.srcObject = null;
  }
}
