// Service Worker do Chico IA.
//
// Estratégia (evita o usuário ficar preso em versão antiga após deploy):
//  - HTML / navegação  -> network-first: sempre busca o index.html novo (que aponta
//    para o bundle JS/CSS mais recente); cai para o cache só se estiver offline.
//  - Demais assets same-origin (JS/CSS com hash, imagens) -> stale-while-revalidate:
//    responde rápido do cache e atualiza em segundo plano.
//  - Requisições a /api e /proxy NÃO são cacheadas (dados dinâmicos / backend).
//  - skipWaiting + clients.claim: a nova versão assume imediatamente.
//
// Bump o sufixo de CACHE_NAME a cada mudança estrutural para invalidar caches antigos.
const CACHE_NAME = 'chico-ia-cache-v2';
const PRECACHE = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // allSettled: não falha a instalação se algum recurso não existir.
      Promise.allSettled(PRECACHE.map((u) => cache.add(u)))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Não interfere em cross-origin (APIs externas, fontes, Gemini, etc.).
  if (url.origin !== self.location.origin) return;
  // Não cacheia backend dinâmico.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/proxy')) return;

  const isHTML =
    req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    // network-first
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put('/index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/index.html')))
    );
    return;
  }

  // stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
