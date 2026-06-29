# Validação Local — Chico IA

Como rodar e validar o projeto localmente (Windows/macOS/Linux com Node 20+).

## Setup
```bash
npm install
npx playwright install chromium      # necessário para o RPA server-side (navegar/clicar/digitar)
```

Crie um `.env` (NUNCA commitar — está no .gitignore) com as chaves de backend:
```
FIRECRAWL_API_KEY=fc-...
SKYVERN_API_KEY=...
```
A chave do **Gemini** pode ir num `.env.local` (`GEMINI_API_KEY=...`) para embutir no build,
ou ser informada em ⚙️ Configurações na app (recomendado; tem prioridade).

## Verificações estáticas
```bash
npm run lint     # tsc --noEmit  -> deve dar 0 erros
npm run build    # vite build    -> deve concluir (gera dist/)
```

## Rodar
- **Dev (Vite + backend):** `npm run dev`  → http://localhost:8000 (ou a PORT definida).
- **Servir o build (como produção):** `SERVE_DIST=1 PORT=8123 npm run dev` → http://localhost:8123
  (o `server.ts` serve `dist/` e monta `/api` e `/proxy`).

## Roteiro de teste manual
1. Abrir a URL local; em ⚙️ **Configurações → Chave da API (Gemini)**, colar a chave (`AIzaSy...` ou `AQ....`).
2. **Voz:** clicar no microfone → falar → o Chico responde por voz. (Console deve logar
   "Microphone started and connected to session"; NÃO deve haver flood de "WebSocket CLOSING/CLOSED".)
3. **Buscar:** "pesquise na web sobre X" → deve usar Firecrawl e retornar fontes (sem abrir o Google).
4. **Navegador (RPA):** "entre no site google.com.br" → o navegador interno navega; clicar/digitar
   direto na tela preenche os campos (modo misto). Pesquisar no Google direto pode dar CAPTCHA → usar Skyvern.
5. **Skyvern:** "tarefa autônoma: ..." → cria task na nuvem; acompanha status até `completed`.
6. **Zoom:** Ctrl+scroll deve ampliar a página (acessibilidade).

## Marcadores para confirmar que o build está atualizado (no bundle `assets/index-*.js`)
- `navigateBrowser`, `agent-navigate`, `Chave da API`, `Chaves de Servi` → presentes = código novo.
- Service worker: `service-worker.js` deve responder `Content-Type: text/javascript` e o console
  logar "Service Worker registrado com sucesso" (sem erro de MIME). Cache = `chico-ia-cache-v2`.

## Comandos úteis
```bash
# Testar endpoints do backend (com server rodando em 8123):
curl -X POST localhost:8123/api/web/search -H "Content-Type: application/json" -d '{"query":"home care","limit":3}'
curl -X POST localhost:8123/api/rpa/navigate -H "Content-Type: application/json" -H "X-Visitor-Id: t1" -d '{"url":"https://example.com"}'
# Limpar service worker no navegador (DevTools Console), se pegar cache antigo:
# (async()=>{for(const r of await navigator.serviceWorker.getRegistrations())await r.unregister();for(const k of await caches.keys())await caches.delete(k);location.reload()})()
```

## Notas
- RPA Playwright só funciona com host Node (local/desktop ou Railway/Render) — não em serverless/pplx.
- Se o RPA retornar 503 "playwright_unavailable", rode `npx playwright install chromium`.
