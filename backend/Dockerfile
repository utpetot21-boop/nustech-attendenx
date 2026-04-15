# ── Build stage ───────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy monorepo root + workspace manifests
COPY package.json package-lock.json* tsconfig.base.json ./
COPY backend/package.json ./backend/
COPY shared/package.json ./shared/

# Install workspace dependencies
RUN npm ci --workspace=backend --workspace=shared --legacy-peer-deps

# Copy source files
COPY shared/ ./shared/
COPY backend/ ./backend/

# Build shared first, then NestJS backend
RUN npm run build --workspace=shared && npm run build --workspace=backend

# ── Production stage ──────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV TZ=Asia/Makassar

# Production-only deps
COPY package.json package-lock.json* ./
COPY backend/package.json ./backend/
COPY shared/package.json ./shared/

RUN npm ci --workspace=backend --workspace=shared --legacy-peer-deps --omit=dev

# Copy compiled output
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/shared/dist ./shared/dist

# Copy Handlebars templates for BA PDF
COPY backend/src/modules/service-reports/templates ./backend/dist/modules/service-reports/templates

# Copy Handlebars templates for SP (Surat Peringatan) PDF
COPY backend/src/modules/warning-letters/templates ./backend/dist/modules/warning-letters/templates

# Install postgresql-client untuk pg_dump (backup job)
RUN apk add --no-cache postgresql-client

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

WORKDIR /app/backend

EXPOSE 3001

# Path sesuai dengan nest build output + tsconfig rootDir monorepo
# backend/dist/backend/src/main.js
CMD ["node", "dist/backend/src/main"]
