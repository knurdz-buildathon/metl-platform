FROM node:20-alpine

WORKDIR /app

# Copy workspace root for shared deps
COPY package*.json ./
COPY tsconfig.json ./

# Copy shared packages that this service depends on
COPY shared/metl-bus/package*.json ./shared/metl-bus/
COPY shared/metl-db/package*.json ./shared/metl-db/
COPY shared/metl-logger/package*.json ./shared/metl-logger/
COPY shared/metl-types/package*.json ./shared/metl-types/
COPY shared/metl-azure/package*.json ./shared/metl-azure/
COPY shared/metl-k8s/package*.json ./shared/metl-k8s/
COPY ejection-engine/package*.json ./ejection-engine/

# Install all workspace dependencies
RUN npm install --workspaces

# Copy source code
COPY shared/ ./shared/
COPY ejection-engine/ ./ejection-engine/

# Build shared packages first, then service
RUN npm run build --workspace=@metl/bus
RUN npm run build --workspace=@metl/db
RUN npm run build --workspace=@metl/logger
RUN npm run build --workspace=@metl/types
RUN npm run build --workspace=@metl/azure
RUN npm run build --workspace=@metl/k8s
RUN npm run build --workspace=@metl/ejection-engine

EXPOSE 3000

CMD ["node", "ejection-engine/dist/index.js"]
