// ============================================================
// RPA SERVER-SIDE — Playwright (headless Chromium)
// ------------------------------------------------------------
// Mantém uma sessão de browser/page por visitante (X-Visitor-Id)
// e expõe endpoints REST sob /api/rpa para o frontend dirigir a
// automação via screenshots + ações, contornando o bloqueio
// cross-origin do iframe no ambiente publicado (pplx.app).
//
// Se o Playwright/Chromium não puder iniciar (sandbox sem
// suporte), todos os endpoints respondem 503 com mensagem clara
// e o frontend cai para o aviso amigável / iframe local.
// ============================================================

import type { Express, Request, Response } from 'express';
import express from 'express';

// Tipagem leve — o playwright é importado dinamicamente para que a
// ausência do pacote/chromium nunca derrube o servidor.
type AnyBrowser = any;
type AnyPage = any;

interface RpaSession {
  browser: AnyBrowser;
  page: AnyPage;
  lastUsed: number;
}

const VIEWPORT = { width: 1280, height: 800 };
const SESSION_TTL_MS = 5 * 60 * 1000; // 5 min de inatividade
const NAV_TIMEOUT_MS = 30000;

let playwrightModule: any | null = null;
let playwrightAvailable: boolean | null = null; // null = ainda não testado
let playwrightError = '';

const sessions = new Map<string, RpaSession>();

function visitorIdOf(req: Request): string {
  const id = (req.header('X-Visitor-Id') || req.header('x-visitor-id') || '').trim();
  return id || 'singleton';
}

// Tenta carregar o playwright e validar o lançamento do chromium uma única vez.
async function ensurePlaywright(): Promise<boolean> {
  if (playwrightAvailable !== null) return playwrightAvailable;
  try {
    // import dinâmico — não quebra o build/lint se o pacote faltar.
    playwrightModule = await import('playwright');
    // Validação real: lança e fecha um chromium de teste.
    const testBrowser = await playwrightModule.chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    await testBrowser.close();
    playwrightAvailable = true;
    console.log('[rpa] Playwright/Chromium disponível.');
  } catch (e: any) {
    playwrightAvailable = false;
    playwrightError = e?.message || String(e);
    console.warn('[rpa] Playwright/Chromium indisponível — endpoints /api/rpa retornarão 503.', playwrightError);
  }
  return playwrightAvailable;
}

async function getSession(visitorId: string): Promise<RpaSession> {
  const existing = sessions.get(visitorId);
  if (existing) {
    existing.lastUsed = Date.now();
    return existing;
  }
  const browser = await playwrightModule.chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({ viewport: VIEWPORT, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  const session: RpaSession = { browser, page, lastUsed: Date.now() };
  sessions.set(visitorId, session);
  return session;
}

async function closeSession(visitorId: string) {
  const s = sessions.get(visitorId);
  if (!s) return;
  sessions.delete(visitorId);
  try { await s.browser.close(); } catch { /* ignore */ }
}

// GC de sessões inativas.
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.lastUsed > SESSION_TTL_MS) {
      void closeSession(id);
    }
  }
}, 60 * 1000).unref?.();

function isHttpUrl(u: string): boolean {
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function screenshotBase64(page: AnyPage, fullPage = false): Promise<string> {
  const buf: Buffer = await page.screenshot({ type: 'png', fullPage });
  return buf.toString('base64');
}

export function mountRpaRoutes(app: Express) {
  const router = express.Router();
  router.use(express.json({ limit: '2mb' }));

  // Middleware: garante playwright; senão 503 com mensagem amigável.
  router.use(async (_req: Request, res: Response, next) => {
    const ok = await ensurePlaywright();
    if (!ok) {
      return res.status(503).json({
        ok: false,
        available: false,
        error: 'playwright_unavailable',
        message: 'Automação de navegador disponível apenas no modo local/desktop.',
        detail: playwrightError || undefined,
      });
    }
    next();
  });

  // Status/health — útil para o frontend decidir o modo.
  router.get('/status', (_req, res) => {
    res.json({ ok: true, available: true, viewport: VIEWPORT });
  });

  router.post('/navigate', async (req, res) => {
    const url = String(req.body?.url || '').trim();
    if (!isHttpUrl(url)) return res.status(400).json({ ok: false, error: 'URL http/https inválida' });
    try {
      const { page } = await getSession(visitorIdOf(req));
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
      const screenshot = await screenshotBase64(page);
      res.json({ ok: true, title: await page.title(), url: page.url(), screenshot });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || 'navigate failed' });
    }
  });

  router.post('/screenshot', async (req, res) => {
    const fullPage = Boolean(req.body?.fullPage);
    try {
      const { page } = await getSession(visitorIdOf(req));
      const screenshot = await screenshotBase64(page, fullPage);
      res.json({ ok: true, url: page.url(), title: await page.title(), screenshot });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || 'screenshot failed' });
    }
  });

  router.post('/click', async (req, res) => {
    const { x, y, selector } = req.body || {};
    try {
      const { page } = await getSession(visitorIdOf(req));
      if (typeof selector === 'string' && selector) {
        await page.click(selector, { timeout: NAV_TIMEOUT_MS });
      } else if (typeof x === 'number' && typeof y === 'number') {
        await page.mouse.click(x, y);
      } else {
        return res.status(400).json({ ok: false, error: 'Informe {x,y} ou {selector}' });
      }
      await page.waitForTimeout(400);
      const screenshot = await screenshotBase64(page);
      res.json({ ok: true, url: page.url(), screenshot });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || 'click failed' });
    }
  });

  router.post('/type', async (req, res) => {
    const { selector, text, clear } = req.body || {};
    const value = typeof text === 'string' ? text : '';
    try {
      const { page } = await getSession(visitorIdOf(req));
      if (typeof selector === 'string' && selector) {
        if (clear) await page.fill(selector, '');
        await page.click(selector, { timeout: NAV_TIMEOUT_MS });
        await page.type(selector, value, { delay: 20 });
      } else {
        // digita no elemento atualmente focado
        await page.keyboard.type(value, { delay: 20 });
      }
      await page.waitForTimeout(200);
      const screenshot = await screenshotBase64(page);
      res.json({ ok: true, url: page.url(), screenshot });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || 'type failed' });
    }
  });

  router.post('/key', async (req, res) => {
    const key = String(req.body?.key || '').trim();
    if (!key) return res.status(400).json({ ok: false, error: 'key obrigatório' });
    try {
      const { page } = await getSession(visitorIdOf(req));
      await page.keyboard.press(key);
      await page.waitForTimeout(300);
      const screenshot = await screenshotBase64(page);
      res.json({ ok: true, url: page.url(), screenshot });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || 'key failed' });
    }
  });

  router.post('/scroll', async (req, res) => {
    const dy = Number(req.body?.dy ?? 0);
    try {
      const { page } = await getSession(visitorIdOf(req));
      await page.mouse.wheel(0, dy || VIEWPORT.height * 0.8);
      await page.waitForTimeout(200);
      const screenshot = await screenshotBase64(page);
      res.json({ ok: true, url: page.url(), screenshot });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || 'scroll failed' });
    }
  });

  // Inventário de elementos interativos — o agente "vê" e decide.
  router.get('/dom', async (req, res) => {
    try {
      const { page } = await getSession(visitorIdOf(req));
      const data = await page.evaluate(() => {
        const els = Array.from(
          document.querySelectorAll('button, input, a, select, textarea, [role="button"], [onclick]')
        );
        const elements = els.map((el: any, index: number) => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          const label =
            (document.querySelector(`label[for="${el.id}"]`)?.textContent || '') ||
            el.getAttribute('aria-label') ||
            el.placeholder ||
            undefined;
          return {
            index,
            tagName: el.tagName,
            type: el.type || undefined,
            placeholder: el.placeholder || undefined,
            text: (el.innerText || el.value || '').substring(0, 60).trim(),
            label,
            id: el.id || undefined,
            name: el.name || undefined,
            rect: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
            isVisible:
              rect.width > 0 &&
              rect.height > 0 &&
              style.display !== 'none' &&
              style.visibility !== 'hidden',
          };
        }).filter((e: any) => e.isVisible);
        return { url: location.href, title: document.title, elements };
      });
      res.json({ ok: true, ...data });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || 'dom failed' });
    }
  });

  router.post('/close', async (req, res) => {
    await closeSession(visitorIdOf(req));
    res.json({ ok: true });
  });

  app.use('/api/rpa', router);
}
