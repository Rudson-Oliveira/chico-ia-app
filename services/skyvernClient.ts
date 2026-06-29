// ============================================================
// SKYVERN CLIENT — fala com os endpoints /api/skyvern do
// server-side (Skyvern nuvem). Usado pelo agente para executar
// tarefas COMPLEXAS por objetivo em linguagem natural, com
// polling de status ate concluir.
// ============================================================
import { getProxyBase } from '../proxyBase';

export interface SkyvernRunResponse {
  ok: boolean;
  taskId?: string;
  status?: string;
  appUrl?: string;
  error?: string;
  message?: string;
}

export interface SkyvernStatusResponse {
  ok: boolean;
  status?: string;
  done?: boolean;
  output?: any;
  failureReason?: string | null;
  stepCount?: number | null;
  appUrl?: string;
  recordingUrl?: string | null;
  error?: string;
  message?: string;
}

function skyvernUrl(path: string): string {
  return `${getProxyBase()}/api/skyvern${path}`;
}

function userSkyvernKey(): string {
  try { return (localStorage.getItem('userSkyvernKey') || '').trim(); } catch { return ''; }
}

async function request<T>(path: string, method: 'GET' | 'POST', body?: any): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  // Chave do usuario (Configuracoes) tem prioridade sobre a do servidor.
  const skKey = userSkyvernKey();
  if (skKey) headers['X-Skyvern-Key'] = skKey;
  const res = await fetch(skyvernUrl(path), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  try {
    return (await res.json()) as T;
  } catch {
    return { ok: false, error: `HTTP ${res.status}` } as unknown as T;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const skyvernClient = {
  run: (prompt: string, url?: string, maxSteps?: number) =>
    request<SkyvernRunResponse>('/run', 'POST', { prompt, url, max_steps: maxSteps }),

  status: (taskId: string) =>
    request<SkyvernStatusResponse>(`/status/${encodeURIComponent(taskId)}`, 'GET'),

  // Faz polling ate o status terminal (ou estourar o orcamento de tentativas).
  // onProgress recebe cada snapshot para refletir progresso no chat.
  async waitUntilDone(
    taskId: string,
    opts?: { intervalMs?: number; maxPolls?: number; onProgress?: (s: SkyvernStatusResponse) => void },
  ): Promise<SkyvernStatusResponse> {
    const intervalMs = opts?.intervalMs ?? 5000;
    const maxPolls = opts?.maxPolls ?? 60; // ~5 min com 5s
    let last: SkyvernStatusResponse = { ok: false, error: 'sem_polling' };
    for (let i = 0; i < maxPolls; i++) {
      last = await this.status(taskId);
      opts?.onProgress?.(last);
      if (!last.ok) return last;
      if (last.done) return last;
      await sleep(intervalMs);
    }
    return { ...last, message: 'Tempo limite de acompanhamento atingido; a tarefa pode ainda estar em execução.' };
  },
};
