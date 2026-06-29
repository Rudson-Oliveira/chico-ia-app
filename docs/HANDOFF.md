# HANDOFF — Chico IA

Checkpoint de continuidade. Última atualização: sessão de melhorias + deploy (jun/2026).

## Objetivo do projeto
Assistente de IA autônomo (voz/texto/visão) com navegador interno automatizável (RPA),
busca/leitura web, tarefas autônomas e FocoFlow. Sistema web independente da empresa.

## Estado atual
- **Código:** branch `master` no GitHub (`Rudson-Oliveira/chico-ia-app`) contém **todas** as
  melhorias desta sessão (12 commits, `b01bb7a` → `b0a5be2`). `tsc --noEmit` = 0 erros; `vite build` OK.
- **Validado localmente** (servindo o build em `localhost:8123`): chat, voz (Gemini Live), navegação
  e interação no navegador interno (clicar/digitar), Firecrawl (busca), Skyvern (tarefa autônoma concluída).
- **Produção `chico-rudson.pplx.app`:** ainda roda código ANTIGO. A pplx builda do workspace do
  Perplexity, que é uma cópia separada deste GitHub — os pushes ao GitHub não chegam à pplx sozinhos.
- **Railway:** ainda NÃO tem o Chico. Os projetos existentes são `evolution-api` (WhatsApp) e
  `hospitalar-automation` (offline). O Chico precisa ser criado como **novo serviço a partir do repo**.

## O que foi feito nesta sessão (resumo dos commits)
1. UX/perf/acessibilidade (zoom liberado, aria-labels, content-visibility, throttle de animação, MessageItem memo, extração de utils).
2. Campo de **chave Gemini** em Configurações (BYO key funcional).
3. Campos de **chave Firecrawl/Skyvern** em Configurações (cliente envia via header; backend prefere header).
4. **navigateBrowser** (agente navega de verdade) + correção do erro de mistura de tools (googleSearch x functions).
5. **Interação real** server-side (digitar/clicar/Enter via rpaClient) + roteamento texto/live.
6. **Firecrawl em buscas** + **Skyvern** para anti-bot, também na **voz** (sessão Live).
7. Extração de dados do Skyvern + **service-worker** seguro (network-first) movido para `public/`.
8. Remoção do **menu fake** do navegador interno (largura total).
9. **Captura de teclado confiável** (textarea invisível) para preenchimento direto (modo misto humano+agente).
10. **Dockerfile** (Node + Playwright) + script `start` para deploy em host Node.

## Pendências
- **Deploy do Chico no Railway** (novo serviço do repo `chico-ia-app`, NÃO template). Ver PROXIMOS-PASSOS.
- Após deploy: adicionar o domínio do Railway nos **Authorized domains** do Firebase (senão login falha).
- Definir env vars em produção: `FIRECRAWL_API_KEY`, `SKYVERN_API_KEY` (e Gemini via Settings ou build).
- Atualizar a produção pplx (importar o código novo no workspace do Perplexity) — OU migrar para o Railway.
- Hardening de segurança (senha admin, SSRF /proxy, auth nos endpoints, Gemini→backend).
- Refactor incremental do `App.tsx` (Header/InputBar + Context) — opcional.

## Riscos
- **RPA Playwright** só roda em host Node (local/desktop ou Railway/Render) — não em serverless/pplx.
- Senha admin `'0102'` hardcoded e `/proxy` aberto: não expor publicamente sem hardening.
- SW agora cacheia: já é network-first (HTML sempre novo), mas mudanças exigem bump de versão do cache.
- `package-lock.json` pode estar levemente fora de sintonia (faltava `dotenv`) — `npm install` reconcilia.
- Credencial do Hospitalar foi exposta em print durante testes → **trocar a senha**.

## Próximo passo seguro
Criar no Railway: **New Project → Deploy from GitHub repo → `Rudson-Oliveira/chico-ia-app`**
(detecta o `Dockerfile`), definir `FIRECRAWL_API_KEY`/`SKYVERN_API_KEY`, gerar domínio, e então
adicionar o domínio no Firebase Authorized domains. Detalhes em PROXIMOS-PASSOS.md.

## Prompt para continuar em nova sessão
> Projeto chico-ia-app (assistente Chico IA). O código completo está na branch `master` do GitHub
> e validado localmente (ver docs/VALIDACAO-LOCAL.md). Preciso concluir o **deploy independente**
> em host Node (Railway) a partir do repo (usa o Dockerfile com Playwright), configurar as env vars
> (FIRECRAWL_API_KEY, SKYVERN_API_KEY; Gemini via Settings), adicionar o domínio nos Authorized
> domains do Firebase e validar no ar (login, voz, Firecrawl, Skyvern, RPA navegando/clicando).
> Leia docs/HANDOFF.md, docs/DECISOES-ARQUITETURA.md e docs/PROXIMOS-PASSOS.md antes de implementar.
> Não refatore amplamente, não apague arquivos, não exponha segredos.
