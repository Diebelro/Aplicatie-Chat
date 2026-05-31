# syntax=docker/dockerfile:1

# ----------------------------------------------------------------------------
# Diebel / chat.diebel.ro — Next.js (standalone) pentru deploy pe VPS (fără Vercel)
# ----------------------------------------------------------------------------

FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# OpenSSL + CA: necesare pentru Prisma (query engine) și conexiuni TLS (Neon).
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# --- Dependențe (inclusiv dev: necesare la build) ---------------------------
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# --- Build Next.js (standalone) ---------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# --- Runtime minimal --------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Server autonom + assets statice + fișiere publice
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma client + query engine (uneori lipsesc din trasarea standalone)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Director pentru atașamente chat salvate pe disc (CHAT_LOCAL_UPLOAD=true)
RUN mkdir -p /app/public/_chatDev && chown -R nextjs:nodejs /app/public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
