// ============================================================
// SKYVERN SERVER-SIDE — automacao autonoma por OBJETIVO
// ------------------------------------------------------------
// Camada para tarefas COMPLEXAS/multi-passo em linguagem natural
// (ex.: "entre no portal X, busque o paciente Y, gere a guia").
// O Skyvern usa visao + LLM para navegar sozinho, resiliente a
// mudancas de layout.
//
// Contrato real da API Skyvern (nuvem, descoberto via curl +
// openapi.json em https://api.skyvern.com/openapi.json):
//   Auth: header `x-api-key: <SKYVERN_API_KEY>`
//   POST /v1/run/tasks   body {prompt, url?, max_steps?, ...}
//                        -> {run_id:"tsk_...", status, output, ...}
//   GET  /v1/runs/{run_id}
//                        -> {run_id, status, output, failure_reason,
//                            step_count, app_url, ...}
//   status (RunStatus): created|queued|running|timed_out|failed|
//                       terminated|completed|canceled
//
// Endpoints expostos (sob /api/skyvern):
//   POST /run            {prompt, url?, max_steps?} -> {ok, taskId, status, appUrl}
//   GET  /status/:taskId -> {ok, status, output, failureReason, stepCount, appUrl, done}
//
// A chave SKYVERN_API_KEY vem de process.env e NUNCA e logada.
// Sem chave -> 503 com aviso amigavel.
// ============================================================

import type { Express, Request, Response } from 'express';
import express from 'express';
import axios from 'axios';

const SKYVERN_BASE = 'https://api.skyvern.com';
const SKYVERN_TIMEOUT_MS = 30000;

// Status terminais: nao adianta continuar o polling.
const TERMINAL_STATUSES = new Set([
  'completed',
  'failed',
  'terminated',
  'timed_out',
  'canceled',
]);

function skyvernKey(req?: Request): string {
  // Prioridade: chave enviada pelo usuário (header) > variável de ambiente.
  const fromHeader = req ? (req.header('x-skyvern-key') || '') : '';
  return (fromHeader || process.env.SKYVERN_API_KEY || '').trim();
}

function hasSkyvern(req?: Request): boolean {
  return skyvernKey(req).length > 0;
}

function isHttpUrl(u: string): boolean {
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function skyvernHeaders(req?: Request) {
  return {
    'x-api-key': skyvernKey(req),
    'Content-Type': 'application/json',
  };
}

export function mountSkyvernRoutes(app: Express) {
  const router = express.Router();
  router.use(express.json({ limit: '2mb' }));

  // Sem chave -> 503 amigavel em todas as rotas.
  router.use((req: Request, res: Response, next) => {
    if (!hasSkyvern(req)) {
      return res.status(503).json({
        ok: false,
        available: false,
        error: 'skyvern_indisponivel',
        message: 'Automação autônoma por objetivo requer SKYVERN_API_KEY configurado.',
      });
    }
    next();
  });

  // POST /api/skyvern/run {prompt, url?, max_steps?} -> cria task no Skyvern.
  router.post('/run', async (req: Request, res: Response) => {
    const prompt = String(req.body?.prompt || '').trim();
    if (!prompt) return res.status(400).json({ ok: false, error: 'prompt obrigatório' });

    const url = String(req.body?.url || '').trim();
    if (url && !isHttpUrl(url)) {
      return res.status(400).json({ ok: false, error: 'URL http/https inválida' });
    }

    const body: Record<string, unknown> = { prompt };
    if (url) body.url = url;
    const maxSteps = Number(req.body?.max_steps);
    if (Number.isFinite(maxSteps) && maxSteps > 0) body.max_steps = Math.min(maxSteps, 50);

    try {
      const r = await axios.post(`${SKYVERN_BASE}/v1/run/tasks`, body, {
        headers: skyvernHeaders(req),
        timeout: SKYVERN_TIMEOUT_MS,
      });
      const data = r.data || {};
      const taskId = data.run_id;
      console.log(`[skyvern/run] task criada taskId=${taskId} status=${data.status} url=${url || '(auto)'}`);
      return res.json({
        ok: true,
        taskId,
        status: data.status,
        appUrl: data.app_url,
      });
    } catch (e: any) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail || e?.message || String(e);
      console.warn(`[skyvern/run] falhou status=${status || 'n/a'} detail=${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
      return res.status(502).json({
        ok: false,
        error: 'skyvern_run_falhou',
        message: 'Não foi possível criar a tarefa autônoma no Skyvern.',
        detail: typeof detail === 'string' ? detail : undefined,
      });
    }
  });

  // GET /api/skyvern/status/:taskId -> consulta status da task.
  router.get('/status/:taskId', async (req: Request, res: Response) => {
    const taskId = String(req.params.taskId || '').trim();
    if (!taskId) return res.status(400).json({ ok: false, error: 'taskId obrigatório' });

    try {
      const r = await axios.get(`${SKYVERN_BASE}/v1/runs/${encodeURIComponent(taskId)}`, {
        headers: skyvernHeaders(req),
        timeout: SKYVERN_TIMEOUT_MS,
      });
      const data = r.data || {};
      const status = data.status;
      console.log(`[skyvern/status] taskId=${taskId} status=${status} steps=${data.step_count ?? '?'}`);
      return res.json({
        ok: true,
        status,
        done: TERMINAL_STATUSES.has(status),
        output: data.output ?? null,
        failureReason: data.failure_reason ?? null,
        stepCount: data.step_count ?? null,
        appUrl: data.app_url,
      });
    } catch (e: any) {
      const httpStatus = e?.response?.status;
      const detail = e?.response?.data?.detail || e?.message || String(e);
      console.warn(`[skyvern/status] falhou taskId=${taskId} status=${httpStatus || 'n/a'}`);
      if (httpStatus === 404) {
        return res.status(404).json({ ok: false, error: 'task_nao_encontrada', message: 'Tarefa não encontrada no Skyvern.' });
      }
      return res.status(502).json({
        ok: false,
        error: 'skyvern_status_falhou',
        message: 'Não foi possível consultar o status da tarefa.',
        detail: typeof detail === 'string' ? detail : undefined,
      });
    }
  });

  app.use('/api/skyvern', router);
  console.log('[skyvern] rotas /api/skyvern montadas (run/status).');
}
