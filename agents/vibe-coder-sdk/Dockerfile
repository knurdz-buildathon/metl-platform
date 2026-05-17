# Metl Vibe Coder SDK — Cursor Cloud Agent Service
# Builds from monorepo root to access workspace packages
# docker compose context: metl-platform/ (repo root)

FROM node:20-alpine

WORKDIR /app

# Install tini for proper process management
RUN apk add --no-cache tini

# Copy monorebo root files (workspaces definition)
COPY package*.json ./

# Copy workspace packages this agent needs
COPY shared/metl-bus/ shared/metl-bus/
COPY shared/metl-db/ shared/metl-db/
COPY shared/metl-logger/ shared/metl-logger/
COPY shared/metl-types/ shared/metl-types/

# Copy this agent's source
COPY agents/vibe-coder-sdk/ agents/vibe-coder-sdk/

# Install dependencies for the whole workspace, then build
RUN npm install
RUN npm run build --workspaces --if-present

WORKDIR /app/agents/vibe-coder-sdk

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]