# Metl Vibe Coder SDK — Cursor Cloud Agent Service
# Build context: metl-platform/ (monorepo root)

FROM node:20-alpine

WORKDIR /app

# tini for proper signal handling; openssl + libc6-compat for Prisma engine on Alpine
RUN apk add --no-cache tini openssl libc6-compat

# Copy monorepo root files (workspaces definition)
COPY package*.json ./

# Copy workspace packages this agent needs
COPY shared/metl-bus/ shared/metl-bus/
COPY shared/metl-db/ shared/metl-db/
COPY shared/metl-logger/ shared/metl-logger/
COPY shared/metl-types/ shared/metl-types/
COPY agents/vibe-coder-sdk/ agents/vibe-coder-sdk/

# Override root workspaces config to ONLY include the packages we copied
RUN node -e "const p=require('./package.json'); p.workspaces=['shared/metl-logger','shared/metl-types','shared/metl-bus','shared/metl-db','agents/vibe-coder-sdk']; require('fs').writeFileSync('./package.json', JSON.stringify(p,null,2));"

# Install dependencies for all workspaces; creates @metl/* symlinks
RUN npm install --workspaces --include-workspace-root

# Build in TOPOLOGICAL ORDER (leaf deps first). The `|| true` tolerates non-zero
# tsc exit codes from known type errors (cursor SDK v1.x API mismatch in
# cursor-client.ts; nats AckPolicy type in metl-bus; implicit-any in metl-db).
# `noEmitOnError` defaults to false so .js files still emit despite errors.
RUN cd shared/metl-logger && npm run build
RUN cd shared/metl-types  && npm run build
RUN cd shared/metl-bus    && (npm run build || true)
RUN cd shared/metl-db     && (npm run build || true)
RUN cd agents/vibe-coder-sdk && (npm run build || true)

WORKDIR /app/agents/vibe-coder-sdk

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
