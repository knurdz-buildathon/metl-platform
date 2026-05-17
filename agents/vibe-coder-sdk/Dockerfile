# Metl Vibe Coder SDK — Cursor Cloud Agent Service
# Build context: metl-platform/ (monorepo root)

FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache tini

# Copy monorepo root files (workspaces definition)
COPY package*.json ./

# region debug instrumentation [hypothesis: H1, H2]
RUN echo "===== DEBUG: npm version =====" && npm --version
RUN echo "===== DEBUG: root package.json workspaces field =====" && \
    node -e "console.log(JSON.stringify(require('./package.json').workspaces, null, 2))"
# endregion

# Copy workspace packages this agent needs (only the ones referenced)
COPY shared/metl-bus/ shared/metl-bus/
COPY shared/metl-db/ shared/metl-db/
COPY shared/metl-logger/ shared/metl-logger/
COPY shared/metl-types/ shared/metl-types/
COPY agents/vibe-coder-sdk/ agents/vibe-coder-sdk/

# region debug instrumentation [hypothesis: H1, H3, H4]
RUN echo "===== DEBUG: shared/ workspace dirs =====" && ls -la shared/ && \
    echo "===== DEBUG: shared/metl-bus/package.json =====" && cat shared/metl-bus/package.json && \
    echo "===== DEBUG: agents/vibe-coder-sdk/package.json (THIS HAS workspace:*) =====" && cat agents/vibe-coder-sdk/package.json
# endregion

# Override root workspaces config to ONLY include the packages we copied.
# Without this, npm tries to resolve services/*, frontend, etc. which don't exist here.
RUN node -e "const p=require('./package.json'); p.workspaces=['shared/metl-bus','shared/metl-db','shared/metl-logger','shared/metl-types','agents/vibe-coder-sdk']; require('fs').writeFileSync('./package.json', JSON.stringify(p,null,2));"

# region debug instrumentation [hypothesis: H2]
RUN echo "===== DEBUG: rewritten workspaces =====" && \
    node -e "console.log(JSON.stringify(require('./package.json').workspaces))"
# endregion

# npm install with workspaces; --include-workspace-root ensures hoisting
RUN npm install --workspaces --include-workspace-root

# region debug instrumentation [hypothesis: H1]
RUN echo "===== DEBUG: post-install workspace links =====" && \
    ls -la node_modules/@metl/ 2>&1 || echo "no @metl symlinks found"
# endregion

# Build all workspace packages
RUN npm run build --workspaces --if-present

WORKDIR /app/agents/vibe-coder-sdk

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
