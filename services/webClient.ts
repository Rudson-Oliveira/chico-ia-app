// ============================================================
// WEB CLIENT — fala com os endpoints /api/web do server-side
// (Firecrawl -> fallback Playwright). Usado pelo agente para
// LER/pesquisar/extrair conteudo de paginas.
// ============================================================
import { getProxyBase } from '../proxyBase';

export interface WebReadResponse {
  ok: boolean;
  source?: 'firecrawl' | 'playwright';
  markdown?: string;
  text?: string;
  title?: string;
  url?: string;
  error?: string;
  message?: string;
}

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchResponse {
  ok: boolean;
  source?: 'firecrawl';
  results?: WebSearchResult[];
  error?: string;
  message?: string;
}

export interface WebExtractResponse {
  ok: boolean;
  source?: 'firecrawl';
  data?: any;
  title?: string;
  url?: string;
  error?: string;
  message?: string;
}

function getVisitorId(): string {
  try {
    let id = localStorage.getItem('chico_visitor_id');
    if (!id) {
      id = `v_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem('chico_visitor_id', id);
    }
    return id;
  } catch {
    return 'singleton';
  }
}

function webUrl(path: string): string {
  return `${getProxyBase()}/api/web${path}`;
}

function userFirecrawlKey(): string {
  try { return (localStorage.getItem('userFirecrawlKey') || '').trim(); } catch { return ''; }
}

async function post<T>(path: string, body: any): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Visitor-Id': getVisitorId(),
  };
  // Chave do usuario (Configuracoes) tem prioridade sobre a do servidor.
  const fcKey = userFirecrawlKey();
  if (fcKey) headers['X-Firecrawl-Key'] = fcKey;
  const res = await fetch(webUrl(path), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  try {
    return (await res.json()) as T;
  } catch {
    return { ok: false, error: `HTTP ${res.status}` } as unknown as T;
  }
}

export const webClient = {
  read: (url: string) => post<WebReadResponse>('/read', { url }),
  search: (query: string, limit?: number) => post<WebSearchResponse>('/search', { query, limit }),
  extract: (url: string, schema?: any, prompt?: string) =>
    post<WebExtractResponse>('/extract', { url, schema, prompt }),
};
