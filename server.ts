import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { mountRpaRoutes } from './rpaServer';
import { mountWebRoutes } from './firecrawlServer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  // Porta via env (publicacao usa 8000). Sem porta fixa em codigo.
  const PORT = Number(process.env.PORT) || 8000;

  // RPA server-side (Playwright headless). Degrada com 503 se indisponivel.
  mountRpaRoutes(app);

  // Leitura/pesquisa/extracao (Firecrawl -> fallback Playwright).
  mountWebRoutes(app);

  // Dynamic Proxy with Header Stripping and Cookie Support
  app.use('/proxy', (req, res, next) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) return res.status(400).send('URL is required');

    try {
      const url = new URL(targetUrl);
      const proxy = createProxyMiddleware({
        target: url.origin,
        changeOrigin: true,
        pathRewrite: (path, req) => {
          const urlParam = new URL(req.url!, 'http://localhost').searchParams.get('url');
          return new URL(urlParam!).pathname + new URL(urlParam!).search;
        },
        on: {
          proxyRes: (proxyRes) => {
            delete proxyRes.headers['content-security-policy'];
            delete proxyRes.headers['x-frame-options'];
            delete proxyRes.headers['frame-options'];
          },
          proxyReq: (proxyReq, req) => {
            proxyReq.setHeader('Origin', url.origin);
            proxyReq.setHeader('Referer', url.origin);
          },
        },
        cookieDomainRewrite: "", 
        secure: false,
      });
      return proxy(req, res, next);
    } catch (e) {
      return res.status(400).send('Invalid URL');
    }
  });

  // Em producao serve o build estatico (dist). Em dev usa o Vite.
  if (process.env.NODE_ENV !== 'production' && process.env.SERVE_DIST !== '1') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    // SPA fallback compativel com Express 5: middleware no fim da cadeia.
    app.use((req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
