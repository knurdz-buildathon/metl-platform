# Metl Platform

Open Agentic Cloud Fabric - Build, deploy, and scale applications with zero vendor lock-in.

## Architecture

Metl is built on Azure's industry-standard cloud-native stack:

- **AKS** - Managed Kubernetes orchestration
- **Azure PostgreSQL** - Managed relational database
- **Azure Redis** - Managed cache
- **Azure Blob Storage** - Object storage
- **Azure Key Vault** - Secret management with Workload Identity
- **Azure Container Registry** - Docker image registry
- **Application Gateway** - WAF + SSL ingress

## Quick Start

### 1. Provision Azure Infrastructure

```bash
cd metl-platform/infra
chmod +x azure-provision.sh
./azure-provision.sh
```

### 2. Bootstrap AKS

```bash
chmod +x aks-bootstrap.sh
./aks-bootstrap.sh
```

### 3. Deploy Services

```bash
# Build and push images
make build-images
make push-images

# Deploy to AKS
make deploy
```

## Local Development

```bash
# Start local stack
cd metl-platform
docker-compose -f docker-compose.dev.yml up -d

# Run individual services
cd services/control-plane
npm run dev
```

## Project Structure

```
metl-platform/
|-- infra/              # Azure provisioning scripts
|-- shared/             # Internal libraries
|   |-- metl-bus       # NATS JetStream wrapper
|   |-- metl-db        # Prisma database client
|   |-- metl-k8s       # Kubernetes helpers
|   |-- metl-azure     # Azure SDK wrappers
|   |-- metl-logger    # Structured logging + OTel
|   |-- metl-types     # Shared TypeScript types
|-- services/           # Platform services
|   |-- control-plane   # API Gateway + Task Engine
|   |-- orchestration-agent
|   |-- resource-allocator
|   |-- deployment-engine
|   |-- sre-agent
|   |-- eco-mode
|   |-- simple-vault
|-- agents/             # AI agents
|   |-- vibe-coder      # Code generation (Gemini)
|   |-- security-hunter # Security scanning
|-- frontend/           # Next.js dashboard
|-- ejection-engine/    # Zero lock-in export
|-- cli/                # Command line interface
```

## The 7 Specialized Modules

1. **Vibe Coder** - AI code generation with Gemini
2. **Security Hunter** - DeepSec + SonarQube vulnerability scanning
3. **Resource Allocator** - Azure resource provisioning + BYOK
4. **Orchestration Agent** - K8s manifest generation and provider injection
5. **Deployment Engine** - BuildKit builds + ACR push + K8s deployment
6. **SRE Agent** - Health checks + Prometheus metrics
7. **Eco-Mode Tracker** - KEDA scale-to-zero + carbon tracking

## Features

- **Glass Box Architecture** - Real-time K8s topology visualization
- **Provider Matrix** - Toggle between Metl Local and BYOK
- **Ejection Engine** - Export as Helm chart, Docker Compose, or Terraform
- **Zero Lock-In** - Your code, your data, your infrastructure

## License

MIT
