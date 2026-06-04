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
# Variabile necesare DOAR la build (colectare date pagini / NextAuth în producție).
# Secretul real vine la RUNTIME din .env.production; placeholder-ul de mai jos NU
# ajunge la clienți (server-only) și nu e folosit la rulare.
ARG NEXTAUTH_SECRET="build-placeholder-secret-0000000000000000"
ARG NEXTAUTH_URL="https://chat.diebel.ro"
ARG NEXT_PUBLIC_APP_URL="https://chat.diebel.ro"
ARG BUILD_COMMIT_SHA="unknown"
ENV NODE_ENV=production
ENV BUILD_COMMIT_SHA=$BUILD_COMMIT_SHA
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET
ENV NEXTAUTH_URL=$NEXTAUTH_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
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
