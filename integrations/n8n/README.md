# n8n ↔ Skyvern + Firecrawl (plano B)

Workflows prontos para importar no n8n. Servem como **redundância**: se a integração
direta do Chico (`/api/web` Firecrawl, `/api/skyvern`) falhar, o n8n consegue chamar os
mesmos serviços. Também úteis para automações no hub (WhatsApp/Evolution, agendamentos).

> **Segurança:** as chaves NÃO estão nos arquivos. Você cria as credenciais no n8n (abaixo).

## Importar
1. n8n → **Workflows → Import from File** → selecione:
   - `chico-firecrawl.json`
   - `chico-skyvern.json`
2. Em cada um, abra o nó HTTP (`Firecrawl API` / `Skyvern API`) → **Credential → Create new**
   → tipo **Header Auth**:
   - **Firecrawl:** Name = `Authorization` · Value = `Bearer fc-SUACHAVE`
   - **Skyvern:** Name = `x-api-key` · Value = `SUACHAVE`
3. **Save** e **Active** (ative o webhook). Pegue a Production URL do nó Webhook.

## Como chamar (plano B)
Ambos são disparados por **webhook POST** (JSON no body).

**Firecrawl** — `POST https://SEU-N8N/webhook/chico-firecrawl`
```json
{ "action": "search", "query": "home care idosos", "limit": 5 }
```
```json
{ "action": "scrape", "url": "https://exemplo.com.br" }
```

**Skyvern** — `POST https://SEU-N8N/webhook/chico-skyvern`
```json
{ "prompt": "Entrar no site X e extrair os preços", "url": "https://x.com", "max_steps": 10 }
```
Retorna o JSON do Skyvern (inclui o `task id`; o status é consultado em
`GET https://api.skyvern.com/v1/runs/{taskId}` com header `x-api-key`).

## Endpoints reais (espelham o que o Chico já usa)
| Serviço | Base | Auth | Endpoint |
|---|---|---|---|
| Firecrawl | `https://api.firecrawl.dev` | `Authorization: Bearer` | `POST /v1/search` · `POST /v1/scrape` |
| Skyvern | `https://api.skyvern.com` | `x-api-key` | `POST /v1/run/tasks` · `GET /v1/runs/{id}` |

## Opcional: Chico usar o n8n como fallback
Se algum dia quiser que o Chico caia para o n8n quando o Firecrawl/Skyvern diretos
falharem, basta apontar uma variável (ex.: `N8N_FIRECRAWL_WEBHOOK`) e dar `fetch` na
URL do webhook dentro de `firecrawlServer.ts` / `skyvernServer.ts` no `catch`. Hoje não
está ligado (é só plano B disponível).
