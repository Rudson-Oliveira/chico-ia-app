// ============================================================
// RPA CLIENT — fala com os endpoints /api/rpa do server-side
// (Playwright headless). Usado quando o navegador interno roda
// em modo "screenshot" (publicado, onde o iframe é bloqueado
// por cross-origin) ou quando o backend tem Playwright.
// ============================================================
import { getProxyBase } from '../proxyBase';

export interface RpaResponse {
  ok: boolean;
  url?: string;
  title?: string;
  screenshot?: string; // base64 PNG (sem prefixo data:)
  error?: string;
  message?: string;
  available?: boolean;
}

export interface RpaDomElement {
  index: number;
  tagName: string;
  type?: string;
  placeholder?: string;
  text?: string;
  label?: string;
  id?: string;
  name?: string;
  rect: { x: number; y: number; width: number; height: number };
}

// Id estável por visitante (espelha o X-Visitor-Id que o proxy pode injetar).
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

function rpaUrl(path: string): string {
  return `${getProxyBase()}/api/rpa${path}`;
}

async function call(path: string, method: 'GET' | 'POST', body?: any): Promise<RpaResponse> {
  const res = await fetch(rpaUrl(path), {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Visitor-Id': getVisitorId(),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data: RpaResponse;
  try {
    data = await res.json();
  } catch {
    data = { ok: false, error: `HTTP ${res.status}` };
  }
  if (res.status === 503) {
    return { ok: false, available: false, message: data.message || 'Automação indisponível.', error: data.error };
  }
  return data;
}

let availabilityCache: boolean | null = null;

export const rpaClient = {
  async isAvailable(force = false): Promise<boolean> {
    if (availabilityCache !== null && !force) return availabilityCache;
    try {
      const res = await fetch(rpaUrl('/status'), {
        headers: { 'X-Visitor-Id': getVisitorId() },
      });
      availabilityCache = res.ok;
    } catch {
      availabilityCache = false;
    }
    return availabilityCache;
  },
  navigate: (url: string) => call('/navigate', 'POST', { url }),
  screenshot: (fullPage = false) => call('/screenshot', 'POST', { fullPage }),
  clickAt: (x: number, y: number) => call('/click', 'POST', { x, y }),
  clickSelector: (selector: string) => call('/click', 'POST', { selector }),
  type: (text: string, selector?: string, clear = false) => call('/type', 'POST', { text, selector, clear }),
  pressKey: (key: string) => call('/key', 'POST', { key }),
  scroll: (dy: number) => call('/scroll', 'POST', { dy }),
  async dom(): Promise<{ ok: boolean; url?: string; title?: string; elements?: RpaDomElement[]; error?: string }> {
    const res = await fetch(rpaUrl('/dom'), {
      headers: { 'X-Visitor-Id': getVisitorId() },
    });
    try {
      return await res.json();
    } catch {
      return { ok: false, error: `HTTP ${res.status}` };
    }
  },
  close: () => call('/close', 'POST', {}),
};
