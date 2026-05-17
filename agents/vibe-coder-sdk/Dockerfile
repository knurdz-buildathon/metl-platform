# Metl Vibe Coder SDK — Cursor Cloud Agent Service
# Builds from monorepo root to access workspace packages
# docker compose context: metl-platform/ (repo root)
# docker compose dockerfile: agents/vibe-coder-sdk/Dockerfile

FROM node:20-alpine AS base

FROM base AS builder
WORKDIR /app

# Copy monorepo package.json (provides workspace definitions)
COPY package*.json ./

# Copy ALL workspace packages needed (agents, services, shared)
COPY shared/ shared/
COPY agents/ agents/

# Install and build with workspaces
RUN npm install && npm run build --workspaces --if-present || true

# Prune to only production deps for this agent
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 metl

# Copy only what we need for runtime
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/agents/vibe-coder-sdk/dist ./dist
COPY --from=builder /app/shared/*/dist ./shared/
COPY --from=builder /app/agents/vibe-coder-sdk/package.json ./
COPY --from=builder /app/package.json ./package-root.json

USER metl
EXPOSE 3000

CMD ["node", "dist/index.js"]