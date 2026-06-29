# CLAUDE.md — Chico IA (instruções estáveis do projeto)

> Carregado automaticamente ao trabalhar neste repositório. Leia antes de implementar.
> Documentação de continuidade detalhada em `docs/` (HANDOFF, DECISOES-ARQUITETURA,
> PROXIMOS-PASSOS, VALIDACAO-LOCAL).

## O que é
Assistente de IA conversacional ("Chico/Chica") — sistema web **autônomo e independente**:
voz/texto/visão (Gemini Live), navegador interno com automação (RPA), leitura/busca web,
tarefas autônomas, FocoFlow (tarefas/finanças), painel admin. PWA.

## Stack
- **Frontend:** React 19 + TypeScript + Vite 6 + Tailwind 4. Componente principal `App.tsx` (grande).
- **IA:** `@google/genai` (Gemini) — chamado **no cliente** (voz/texto/visão).
- **Backend:** Express (`server.ts`, rodado por `tsx`). Monta rotas `/api/rpa` (Playwright),
  `/api/web` (Firecrawl→fallback Playwright), `/api/skyvern` (nuvem) e `/proxy` (navegador interno).
- **Dados/Auth:** Firebase (Auth, Firestore, Storage). Config web em `firebase-applet-config.json`
  (a `apiKey` do Firebase é pública por design; proteção real = `firestore.rules` + domínios autorizados).

## Estrutura
- `App.tsx`, `index.tsx`, `Auth.tsx`, `AdminPanel.tsx`, páginas `*.tsx` — frontend.
- `services/` — geminiService, agentService, rpaService/rpaClient, focoFlowService, webClient, skyvernClient, etc.
- `components/` — InternalBrowser, SettingsModal, MessageItem, modais, etc.
- `server.ts` + `rpaServer.ts` + `firecrawlServer.ts` + `skyvernServer.ts` — backend.
- `public/` — `service-worker.js`, `manifest.json` (servidos na raiz).
- `Dockerfile` — imagem de produção (Node + Chromium do Playwright).

## Comandos (ver docs/VALIDACAO-LOCAL.md)
- Dev: `npm run dev` (server.ts + Vite). Build: `npm run build`. Type-check: `npm run lint` (`tsc --noEmit`).
- Servir build localmente: `SERVE_DIST=1 PORT=8123 npm run dev`.
- RPA local exige browser: `npx playwright install chromium`.

## Variáveis de ambiente (NUNCA commitar — `.env*` está no .gitignore)
- `GEMINI_API_KEY` — chave do Gemini (cliente). Em produção pode ser embutida no build OU o
  usuário informa em ⚙️ Configurações (BYO key, tem prioridade).
- `FIRECRAWL_API_KEY`, `SKYVERN_API_KEY` — backend (lidos em runtime; aceitam header do cliente).
- `PORT` — porta do servidor (host injeta; padrão 8000).

## Convenções / regras
- **Chaves de API por usuário (BYO):** Gemini via `setUserApiKey` (cliente); Firecrawl/Skyvern via
  header (`X-Firecrawl-Key`/`X-Skyvern-Key`) — o backend prefere o header sobre o env.
- **Busca web:** preferir a função `pesquisar` (Firecrawl), NÃO abrir o Google e digitar (CAPTCHA).
- **Anti-bot / multi-passo:** usar `tarefa_autonoma` (Skyvern, navegador stealth).
- **Não misturar** `googleSearch` nativo do Gemini com `functionDeclarations` na mesma requisição.
- **Segurança:** não expor segredos; não embutir credenciais; o agente NÃO preenche senhas — o
  humano preenche direto no navegador interno (modo misto).

## Pendências de segurança conhecidas (ver docs/PROXIMOS-PASSOS.md)
Senha admin hardcoded em `AdminPanel.tsx`; `/proxy` aberto (SSRF); endpoints de autonomia sem auth;
chave Gemini no bundle (mitigada por BYO key). Tratar antes de exposição pública ampla.

## Deploy
Produção atual: `chico-rudson.pplx.app` (Perplexity Labs — builda do workspace do Perplexity,
**separado** deste GitHub). Para deploy independente completo (com RPA Playwright), usar host Node
via `Dockerfile` (Railway/Render). Detalhes em `docs/HANDOFF.md` e `docs/PROXIMOS-PASSOS.md`.
