# Próximos Passos — Chico IA

Ordenado por prioridade. Não refatorar amplamente; não apagar arquivos; não expor segredos.

## 1. Deploy independente no Railway (em andamento) ⭐
1. Railway → **New Project → Deploy from GitHub repo** → `Rudson-Oliveira/chico-ia-app` (branch `master`).
   **Não usar template** (o que está lá hoje é evolution-api/WhatsApp, não o Chico).
2. O Railway detecta o `Dockerfile` e builda (Node + Chromium do Playwright, ~3–5 min).
3. **Variables:** `FIRECRAWL_API_KEY`, `SKYVERN_API_KEY`. (PORT é injetada pelo Railway.)
   - Opcional: `GEMINI_API_KEY` como build arg para embutir; senão o usuário informa em Configurações.
4. **Settings → Networking → Generate Domain** → obter a URL pública.
5. Remover redis/postgres se tiverem sido criados (o Chico usa Firebase, não precisa deles).

## 2. Firebase — domínio autorizado (obrigatório pós-deploy)
- Console Firebase → projeto `chico-app-rudson` → **Authentication → Settings → Authorized domains
  → Add domain** → colar a URL do Railway. Sem isso, o login Firebase falha na nova URL.

## 3. Validar no ar
- Abrir a URL, informar a chave Gemini em ⚙️ Configurações, e testar: login, voz, Firecrawl (pesquisar),
  Skyvern (tarefa autônoma) e RPA (navegar/clicar/digitar). Conferir marcadores (ver VALIDACAO-LOCAL.md).

## 4. Atualizar a produção pplx (ou aposentá-la)
- `chico-rudson.pplx.app` roda código antigo do workspace do Perplexity. Para atualizá-la, importar o
  código novo do GitHub no workspace do Perplexity e publicar — OU migrar de vez para o Railway.

## 5. Hardening de segurança (antes de exposição pública ampla)
- Remover senha admin hardcoded (`AdminPanel.tsx`, `'0102'`) → usar Firebase Custom Claims/role.
- `/proxy` (`server.ts`): bloquear IPs privados/loopback/metadata (SSRF) e/ou exigir auth.
- Endpoints `/api/rpa`, `/api/skyvern`: adicionar autenticação (hoje sem auth; `X-Visitor-Id` é falsificável).
- Mover a chave **Gemini para um proxy de backend** (hoje vai no bundle do cliente; BYO key mitiga).
- Rate limiting nos endpoints de automação.
- **Trocar a senha do Hospitalar** exposta em print durante os testes.

## 6. Melhorias opcionais
- Refactor incremental do `App.tsx` (extrair Header/InputBar + Context; hoje ~3k linhas, muitos useState).
- Skyvern com extração estruturada (data extraction goal) para retornar dados ao agente.
- Ícones do PWA (a manifest referencia `/icons/*.png` que não existem; favicon inline já funciona).
- `package-lock.json`: rodar `npm install` e commitar o lock reconciliado (faltava `dotenv`).
