# Imagem de produção do Chico IA.
# Base Node + Chromium do Playwright (com dependências de sistema) para o RPA
# server-side funcionar de verdade — diferente de hosts serverless.
FROM node:20-bookworm

WORKDIR /app

# Dependências (usa npm install para tolerar pequenas diferenças no lockfile).
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# Browser do Playwright + libs de sistema (necessário para o navegador RPA).
RUN npx playwright install --with-deps chromium

# Código + build do frontend (Vite -> dist).
COPY . .
RUN npm run build

# Produção: o server.ts serve o dist e monta as rotas /api e /proxy.
ENV NODE_ENV=production
# A porta real é injetada pelo host (Railway/Render) via env PORT; 8000 é só padrão.
ENV PORT=8000
EXPOSE 8000

CMD ["npm", "run", "start"]
