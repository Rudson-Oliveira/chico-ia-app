# Decisões de Arquitetura — Chico IA

Registro das decisões tomadas (e o porquê), para não serem revertidas por engano.

## 1. Chaves de API gerenciadas pelo usuário (BYO key)
- **Gemini** (cliente): `geminiService.setUserApiKey()` guarda a chave informada em Configurações
  (localStorage `userChicoApiKey`); `getApiKey()` retorna `userKey || process.env.GEMINI_API_KEY`.
  Antes, o campo existia mas não era usado — agora funciona em voz/texto/visão.
- **Firecrawl/Skyvern** (backend): o cliente envia a chave via header (`X-Firecrawl-Key`/
  `X-Skyvern-Key`); o servidor **prefere o header** e cai para `process.env` se ausente.
  Motivo: esses serviços rodam no backend, então a chave do usuário precisa chegar ao servidor.

## 2. googleSearch nativo NÃO coexiste com functionDeclarations
- A API Gemini recusa misturar ferramenta nativa (`googleSearch`) com function calling
  ("include_server_side_tool_invocations"). Decisão: só usar `googleSearch` quando NÃO há funções
  (`needsSearch && !needsFunctions`). Para buscar, o agente usa a função própria `pesquisar` (Firecrawl).

## 3. Navegação e interação do agente no navegador interno
- Adicionada a função **`navigateBrowser(url)`** (antes só existia `openBrowser`, que não navegava →
  o agente "alucinava" sucesso). `navigateBrowser` aguarda a navegação concluir (rpaClient).
- **Interação** (`interactWithBrowser`, `inspectBrowserPage`) usa `rpaClient` (Playwright real) quando
  `rpaClient.isAvailable()`, com ação `press` (Enter) e seletor opcional. Decisão por `isAvailable()`
  em vez de `isServerSideMode()` para não depender do timing do componente.

## 4. Modo misto humano + agente (Claude Code-style)
- O navegador interno em modo server mostra um **screenshot ao vivo**; humano e agente atuam na
  **mesma sessão** Playwright. Para o humano digitar de forma confiável, há um **textarea invisível**
  sobreposto que captura clique e teclado (o `<img>` não segura foco entre atualizações).
- Teclas são enfileiradas (ordem preservada) e o screenshot é re-capturado com debounce (~250ms).
- O **agente NÃO preenche senhas** — o humano preenche direto (segurança). Removida uma "barra de
  preenchimento" que usava campo `type=password` e disparava o autofill do navegador (vazava credenciais).

## 5. Busca x Tarefa autônoma
- **Buscar informação** → `pesquisar` (Firecrawl): sem navegador, sem CAPTCHA, retorna fontes.
- **Sites com CAPTCHA/anti-bot ou objetivos multi-passo** → `tarefa_autonoma` (Skyvern, stealth).
  O objetivo enviado pede retorno estruturado; se o Skyvern não retornar `output`, expõe o link/gravação.

## 6. PWA / Service Worker
- `service-worker.js` e `manifest.json` movidos para `public/` (Vite copia para `dist`; servidos com
  MIME correto). SW reescrito: **HTML = network-first**, assets = stale-while-revalidate, ignora
  `/api` e `/proxy`, `skipWaiting` + `clients.claim`, limpa caches antigos (cache `v2`).
  Motivo: o SW antigo era cache-first em tudo (servia index.html velho → usuário preso em versão antiga).

## 7. Deploy
- Produção pplx builda do workspace do Perplexity (cópia separada do GitHub). Para deploy
  independente **completo** (com RPA Playwright), usar **host Node** via `Dockerfile`
  (base `node:20` + `playwright install --with-deps chromium`, build do Vite, `start` = `tsx server.ts`
  com `NODE_ENV=production` servindo o `dist`). Serverless (Vercel) não roda o Playwright.
- O Chico **não usa** redis/postgres (usa Firebase) — não criar esses serviços no host.

## 8. Performance
- Lista de mensagens com `content-visibility` (virtualização nativa, sem lib).
- Visualizador (galáxia/áudio) com cap de 30fps + respeito a `prefers-reduced-motion`.
- `MessageItem` memoizado (o App re-renderiza a cada frame de transcrição).
