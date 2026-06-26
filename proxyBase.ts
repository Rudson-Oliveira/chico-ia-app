// Resolve o caminho base do backend (rota /proxy do server.ts).
//
// - Desenvolvimento / mesma origem (Vite ou server.ts servindo o dist):
//   o backend responde em /proxy na propria origem -> base vazia.
// - Site publicado (*.pplx.app): os arquivos estaticos vem do S3 e o backend
//   roda no sandbox, acessivel pelo prefixo de proxy `port/<PORT>`. Como o app
//   foi publicado com PORT=8000, o caminho correto e `/port/8000`.
//
// A deteccao e feita em runtime pelo hostname, evitando depender de reescrita
// de tokens no build.
export function getProxyBase(): string {
  try {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    if (host.endsWith('.pplx.app')) {
      return '/port/8000';
    }
  } catch {
    // ignore
  }
  return '';
}
