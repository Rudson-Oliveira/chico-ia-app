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
- **Mapeamento de clique considera o letterbox:** o `<img>` usa `object-contain`, que deixa bordas
  quando o container tem proporção ≠ 1280×800. `handleImageClick` calcula a área renderizada real e
  o offset antes de converter para coordenadas do Chromium — senão o clique cai errado, o campo não
  foca e digitar não funciona (bug real corrigido em produção).
- **Digitação em lote:** cada tecla seria uma ida-e-volta de rede até o host (RPA no Railway/EUA) →
  lento e com letras "sobrando" na fila ao trocar de campo. Caracteres normais são acumulados num
  buffer e enviados em UMA requisição `/type` por rajada (~80ms); teclas especiais e cliques esvaziam
  o buffer antes (ordem preservada) e o clique também entra na fila. Resultado: digitação fluida.
  Nota de locality: rodar o RPA **localmente** (mesma rede) torna a digitação instantânea.
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

## 4d. Interação Manual (revezamento humano ↔ agente)
- O navegador server-side é **uma única sessão compartilhada** entre humano e agente — nunca
  "pausa"; o estado (login, página, campos) persiste continuamente.
- Toggle **"Manual"** (barra do navegador, modo server): LIGADO → o humano assume o controle e o
  AGENTE fica pausado (`handleRpaCommand` no App bloqueia ações ≠ open/closeBrowser e devolve uma
  mensagem para o agente aguardar). DESLIGADO → o agente retoma do estado atual. Banner
  "✋ Você está no controle — agente pausado". Estado vive no App (`manualBrowserMode`) porque é o
  agente, no App, que precisa respeitar a pausa.
- **Teclado:** Ctrl/Cmd+letra são repassados como combo `Control+<letra>` ao Chromium (selecionar
  tudo/copiar/colar/recortar/desfazer) — antes Ctrl+A digitava "a" e era impossível limpar o campo.
  O polling de screenshot pausa enquanto o textarea está focado (não rouba o foco ao digitar devagar).

## 6b. OpenRouter como economia/fallback de LLM (texto)
- Os modelos do Chico já são todos **Flash/Flash-Lite** (os mais baratos do Gemini) — não há
  Pro a "rebaixar". O custo real em escala é a **voz (Live API)**, não o texto.
- OpenRouter entra como **plano B de texto**: BYO key + modelo em ⚙️ Configurações
  (`setOpenRouterConfig`, localStorage `userOpenRouterKey`/`userOpenRouterModel`). Se a chamada
  de texto do Gemini falhar (após retries), `sendTextMessage` cai para o OpenRouter
  (API compatível com OpenAI, `POST /api/v1/chat/completions`) — **somente texto, sem function
  calling** nessa rota. Voz/Live, visão e imagem permanecem no Gemini (OpenRouter não faz voz
  em tempo real). Modelo padrão: `deepseek/deepseek-chat` (configurável).

## 6c. n8n ↔ Skyvern + Firecrawl (plano B / redundância)
- Em `integrations/n8n/` há workflows importáveis (webhook → HTTP) que chamam os mesmos
  endpoints que o Chico usa: Firecrawl (`/v1/search`, `/v1/scrape`) e Skyvern (`/v1/run/tasks`).
  Chaves NÃO ficam nos arquivos (credencial Header Auth criada pelo usuário no n8n). Hoje é só
  redundância disponível; para o Chico cair no n8n, ligar um `fetch` no `catch` dos servidores.

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
