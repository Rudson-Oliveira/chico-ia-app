// ============================================================
// WEB READER/SEARCH/EXTRACT — orquestracao complementar
// ------------------------------------------------------------
// Familia A (LER/pesquisar/extrair): tenta Firecrawl primeiro
// (conteudo limpo em markdown/estruturado) e, se falhar ou nao
// houver chave, cai para o Playwright server-side (innerText),
// reaproveitando a sessao do rpaServer.ts.
//
// Endpoints (sob /api/web):
//   POST /read    {url}          -> {ok, source, markdown|text, title, url}
//   POST /search  {query, limit} -> {ok, source, results:[{title,url,snippet}]}
//   POST /extract {url, schema?} -> {ok, source, data, title, url}
//
// A chave FIRECRAWL_API_KEY vem de process.env e NUNCA e logada.
// ============================================================

import type { Express, Request, Response } from 'express';
import express from 'express';
import axios from 'axios';
import { readPageText } from './rpaServer';

const FIRECRAWL_BASE = 'https://api.firecrawl.dev';
const FIRECRAWL_TIMEOUT_MS = 30000;

function firecrawlKey(): string {
  return (process.env.FIRECRAWL_API_KEY || '').trim();
}

function hasFirecrawl(): boolean {
  return firecrawlKey().length > 0;
}

function visitorIdOf(req: Request): string {
  const id = (req.header('X-Visitor-Id') || req.header('x-visitor-id') || '').trim();
  return id || 'singleton';
}

function isHttpUrl(u: string): boolean {
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function firecrawlPost(path: string, body: any): Promise<any> {
  const res = await axios.post(`${FIRECRAWL_BASE}${path}`, body, {
    headers: {
      Authorization: `Bearer ${firecrawlKey()}`,
      'Content-Type': 'application/json',
    },
    timeout: FIRECRAWL_TIMEOUT_MS,
  });
  return res.data;
}

// Tenta o Firecrawl scrape (markdown). Lanca em erro/timeout/sem conteudo.
async function firecrawlScrape(url: string): Promise<{ markdown: string; title?: string }> {
  const data = await firecrawlPost('/v1/scrape', { url, formats: ['markdown'] });
  const markdown = data?.data?.markdown ?? data?.markdown ?? '';
  if (!markdown || !String(markdown).trim()) {
    throw new Error('firecrawl: conteudo vazio');
  }
  const title = data?.data?.metadata?.title || data?.metadata?.title || undefined;
  return { markdown: String(markdown), title };
}

export function mountWebRoutes(app: Express) {
  const router = express.Router();
  router.use(express.json({ limit: '2mb' }));

  // POST /api/web/read {url} -> Firecrawl scrape (markdown); fallback Playwright innerText.
  router.post('/read', async (req: Request, res: Response) => {
    const url = String(req.body?.url || '').trim();
    if (!isHttpUrl(url)) return res.status(400).json({ ok: false, error: 'URL http/https inválida' });

    if (hasFirecrawl()) {
      try {
        const { markdown, title } = await firecrawlScrape(url);
        console.log(`[web/read] source=firecrawl url=${url}`);
        return res.json({ ok: true, source: 'firecrawl', markdown, title, url });
      } catch (e: any) {
        console.warn(`[web/read] firecrawl falhou (${e?.message || e}); caindo para playwright. url=${url}`);
      }
    } else {
      console.log(`[web/read] sem FIRECRAWL_API_KEY; usando playwright. url=${url}`);
    }

    const fallback = await readPageText(visitorIdOf(req), url);
    if (fallback.ok) {
      console.log(`[web/read] source=playwright url=${url}`);
      return res.json({ ok: true, source: 'playwright', text: fallback.text, title: fallback.title, url: fallback.url || url });
    }
    return res.status(502).json({
      ok: false,
      error: 'leitura_indisponivel',
      message: 'Não foi possível ler a página via Firecrawl nem via navegador.',
      detail: fallback.error,
    });
  });

  // POST /api/web/search {query, limit} -> Firecrawl search.
  router.post('/search', async (req: Request, res: Response) => {
    const query = String(req.body?.query || '').trim();
    if (!query) return res.status(400).json({ ok: false, error: 'query obrigatória' });
    if (!hasFirecrawl()) {
      return res.status(503).json({
        ok: false,
        error: 'firecrawl_indisponivel',
        message: 'Pesquisa requer Firecrawl (FIRECRAWL_API_KEY) configurado.',
      });
    }
    try {
      const limit = Math.min(Math.max(Number(req.body?.limit) || 5, 1), 20);
      const data = await firecrawlPost('/v1/search', { query, limit });
      const raw: any[] = data?.data || data?.results || [];
      const results = raw.map((r: any) => ({
        title: r.title || r.metadata?.title || '',
        url: r.url || r.link || '',
        snippet: r.description || r.snippet || r.markdown?.slice(0, 200) || '',
      }));
      console.log(`[web/search] source=firecrawl query="${query}" results=${results.length}`);
      return res.json({ ok: true, source: 'firecrawl', results });
    } catch (e: any) {
      console.warn(`[web/search] firecrawl falhou (${e?.message || e})`);
      return res.status(503).json({
        ok: false,
        error: 'firecrawl_falhou',
        message: 'Pesquisa indisponível no momento.',
        detail: e?.message || String(e),
      });
    }
  });

  // POST /api/web/extract {url, schema?} -> Firecrawl extract (dados estruturados).
  // Usa scrape com formats:["json"] (sincrono) para reaproveitar schema/prompt.
  router.post('/extract', async (req: Request, res: Response) => {
    const url = String(req.body?.url || '').trim();
    if (!isHttpUrl(url)) return res.status(400).json({ ok: false, error: 'URL http/https inválida' });
    if (!hasFirecrawl()) {
      return res.status(503).json({
        ok: false,
        error: 'firecrawl_indisponivel',
        message: 'Extração estruturada requer Firecrawl (FIRECRAWL_API_KEY) configurado.',
      });
    }
    try {
      const schema = req.body?.schema;
      const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt : undefined;
      const jsonOptions: any = {};
      if (schema) jsonOptions.schema = schema;
      if (prompt) jsonOptions.prompt = prompt;
      const body: any = { url, formats: ['json'] };
      if (Object.keys(jsonOptions).length) body.jsonOptions = jsonOptions;
      const data = await firecrawlPost('/v1/scrape', body);
      const extracted = data?.data?.json ?? data?.json ?? data?.data ?? null;
      const title = data?.data?.metadata?.title || data?.metadata?.title || undefined;
      console.log(`[web/extract] source=firecrawl url=${url}`);
      return res.json({ ok: true, source: 'firecrawl', data: extracted, title, url });
    } catch (e: any) {
      console.warn(`[web/extract] firecrawl falhou (${e?.message || e})`);
      return res.status(503).json({
        ok: false,
        error: 'firecrawl_falhou',
        message: 'Extração indisponível no momento.',
        detail: e?.message || String(e),
      });
    }
  });

  app.use('/api/web', router);
  console.log('[web] rotas /api/web montadas (read/search/extract).');
}
