// arquivo.js — entrega um arquivo gerado no aparelho. No celular abre o "Compartilhar" do sistema
// (salvar no Drive, mandar por WhatsApp, e-mail…); no computador, baixa direto.

const ehCelular = () => window.matchMedia?.('(pointer: coarse)').matches;

function baixar(arquivo) {
  const endereco = URL.createObjectURL(arquivo);
  const link = Object.assign(document.createElement('a'), { href: endereco, download: arquivo.name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(endereco), 60000);
}

/** Devolve 'compartilhado', 'baixado' ou 'cancelado' (a pessoa fechou o Compartilhar). */
export async function entregarArquivo(nome, conteudo, tipo = 'text/csv') {
  const arquivo = new File([conteudo], nome, { type: tipo });
  if (ehCelular() && navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: nome });
      return 'compartilhado';
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelado';
      // sem permissão para compartilhar (ex.: o toque "expirou"): baixa
    }
  }
  baixar(arquivo);
  return 'baixado';
}
