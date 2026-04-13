# ── Build stage ───────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy monorepo root
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/
COPY shared/package.json ./shared/

# Install with workspaces
RUN npm ci --workspace=apps/web --workspace=shared --legacy-peer-deps

# Copy sources
COPY shared/ ./shared/
COPY apps/web/ ./apps/web/

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCKET_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL

RUN npm run build --workspace=apps/web

# ── Production stage ──────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV TZ=Asia/Makassar

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

USER appuser

WORKDIR /app/apps/web

EXPOSE 3000

CMD ["node", "server.js"]
