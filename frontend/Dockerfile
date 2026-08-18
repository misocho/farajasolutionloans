# ── Faraja frontend — Next.js 16 + pnpm, multi-stage ─────────────────────────
FROM node:22-alpine AS deps

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Retry once: pnpm's store keeps completed downloads, so a retry only fetches
# what's missing — helps on flaky registry connections.
RUN pnpm install --frozen-lockfile || pnpm install --frozen-lockfile

# ── Stage 2: build (NEXT_PUBLIC_* vars are baked in at build time) ───────────
FROM node:22-alpine AS builder

RUN corepack enable
WORKDIR /app

ARG NEXT_PUBLIC_API_URL=/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
# Reuse the deps stage's corepack cache so `pnpm` resolves offline (no registry
# download needed here — resilient on flaky networks).
COPY --from=deps /root/.cache/node/corepack /root/.cache/node/corepack
COPY . .
RUN pnpm build

# ── Stage 3: minimal runtime (Next standalone output) ────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]