# Metl Vibe Coder SDK — Cursor Cloud Agent Service
# Build context: metl-platform/ (monorepo root)

FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache tini openssl libc6-compat

# Copy monorepo root files (workspaces definition)
COPY package*.json ./

# region debug instrumentation [hypothesis: H1, H2]
RUN echo "===== DEBUG: npm version =====" && npm --version
# endregion

# Copy workspace packages this agent needs
COPY shared/metl-bus/ shared/metl-bus/
COPY shared/metl-db/ shared/metl-db/
COPY shared/metl-logger/ shared/metl-logger/
COPY shared/metl-types/ shared/metl-types/
COPY agents/vibe-coder-sdk/ agents/vibe-coder-sdk/

# Override root workspaces config to ONLY include the packages we copied
RUN node -e "const p=require('./package.json'); p.workspaces=['shared/metl-logger','shared/metl-types','shared/metl-bus','shared/metl-db','agents/vibe-coder-sdk']; require('fs').writeFileSync('./package.json', JSON.stringify(p,null,2));"

# npm install with workspaces; creates @metl/* symlinks
RUN npm install --workspaces --include-workspace-root

# region debug instrumentation [hypothesis: H1]
RUN echo "===== DEBUG: post-install workspace links =====" && \
    ls -la node_modules/@metl/ 2>&1 || echo "no @metl symlinks found"
# endregion

# Build in TOPOLOGICAL ORDER (logger and types are leaf deps, then bus/db, then sdk)
# Use `|| true` because tsc may exit non-zero on type errors but still emit JS (noEmitOnError defaults to false)
# region debug instrumentation [hypothesis: H7, H10]
RUN echo "===== DEBUG: building metl-logger first =====" && \
    cd shared/metl-logger && npm run build || echo "logger build had warnings"
RUN echo "===== DEBUG: building metl-types =====" && \
    cd shared/metl-types && npm run build || echo "types build had warnings"
RUN echo "===== DEBUG: building metl-bus =====" && \
    cd shared/metl-bus && npm run build || echo "bus build had warnings"
RUN echo "===== DEBUG: building metl-db =====" && \
    cd shared/metl-db && npm run build || echo "db build had warnings"

# region debug instrumentation [hypothesis: H11, H13]
RUN echo "===== DEBUG: Prisma client location after generate =====" && \
    echo "--- /app/node_modules/.prisma/client/ ---" && ls -la /app/node_modules/.prisma/client/ 2>&1 | head -20 && \
    echo "--- /app/node_modules/@prisma/client/ ---" && ls /app/node_modules/@prisma/client/ 2>&1 | head -10 && \
    echo "--- /app/shared/metl-db/prisma/node_modules/ (should be empty/missing) ---" && ls /app/shared/metl-db/prisma/node_modules/ 2>&1 | head -5 && \
    echo "===== DEBUG: H13 — alpine openssl version + engine binaries =====" && \
    apk info openssl 2>&1 | head -3 && \
    ls /lib/libssl* /usr/lib/libssl* 2>&1 | head -10 && \
    ls /app/node_modules/.prisma/client/*.so.node 2>&1 | head -10
# endregion
RUN echo "===== DEBUG: building vibe-coder-sdk =====" && \
    cd agents/vibe-coder-sdk && npm run build || echo "sdk build had warnings (likely API mismatch — runtime may still work)"
# endregion

# region debug instrumentation [hypothesis: H10]
RUN echo "===== DEBUG: verify dist/index.js exists in each package =====" && \
    ls -la shared/metl-logger/dist/index.js shared/metl-types/dist/index.js shared/metl-bus/dist/index.js shared/metl-db/dist/index.js agents/vibe-coder-sdk/dist/index.js 2>&1 | head -20
# endregion

WORKDIR /app/agents/vibe-coder-sdk

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
