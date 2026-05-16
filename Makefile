.PHONY: help dev build deploy test clean

help:
	@echo "Metal Platform - Available Commands"
	@echo ""
	@echo "  make dev          - Start local development stack"
	@echo "  make build        - Build all service images"
	@echo "  make push         - Push images to ACR"
	@echo "  make deploy       - Deploy to AKS"
	@echo "  make test         - Run integration tests"
	@echo "  make clean        - Clean up local resources"
	@echo "  make provision    - Provision Azure infrastructure"
	@echo "  make bootstrap    - Bootstrap AKS with Helm charts"

# Local Development
dev:
	docker-compose -f docker-compose.dev.yml up -d
	@echo "Metal platform is running locally"
	@echo "  Control Plane: http://localhost:3000"
	@echo "  Simple Vault:  http://localhost:3002"
	@echo "  SonarQube:     http://localhost:9000"
	@echo "  NATS:          nats://localhost:4222"
	@echo "  PostgreSQL:    localhost:5432"
	@echo "  Redis:         localhost:6379"

dev-down:
	docker-compose -f docker-compose.dev.yml down

dev-logs:
	docker-compose -f docker-compose.dev.yml logs -f

# Build
build:
	@echo "Building all service images..."
	docker build -t metl/control-plane:latest ./services/control-plane
	docker build -t metl/orchestration-agent:latest ./services/orchestration-agent
	docker build -t metl/resource-allocator:latest ./services/resource-allocator
	docker build -t metl/deployment-engine:latest ./services/deployment-engine
	docker build -t metl/sre-agent:latest ./services/sre-agent
	docker build -t metl/eco-mode:latest ./services/eco-mode
	docker build -t metl/simple-vault:latest ./services/simple-vault
	docker build -t metl/vibe-coder:latest ./agents/vibe-coder
	docker build -t metl/security-hunter:latest ./agents/security-hunter
	docker build -t metl/frontend:latest ./frontend
	@echo "Build complete!"

# Push to ACR
push:
	@echo "Pushing images to ACR..."
	az acr login --name $(ACR_NAME)
	docker tag metl/control-plane:latest $(ACR_NAME).azurecr.io/metl/control-plane:latest
	docker tag metl/orchestration-agent:latest $(ACR_NAME).azurecr.io/metl/orchestration-agent:latest
	docker tag metl/resource-allocator:latest $(ACR_NAME).azurecr.io/metl/resource-allocator:latest
	docker tag metl/deployment-engine:latest $(ACR_NAME).azurecr.io/metl/deployment-engine:latest
	docker tag metl/sre-agent:latest $(ACR_NAME).azurecr.io/metl/sre-agent:latest
	docker tag metl/eco-mode:latest $(ACR_NAME).azurecr.io/metl/eco-mode:latest
	docker tag metl/vibe-coder:latest $(ACR_NAME).azurecr.io/metl/vibe-coder:latest
	docker tag metl/security-hunter:latest $(ACR_NAME).azurecr.io/metl/security-hunter:latest
	docker tag metl/frontend:latest $(ACR_NAME).azurecr.io/metl/frontend:latest
	docker push $(ACR_NAME).azurecr.io/metl/control-plane:latest
	docker push $(ACR_NAME).azurecr.io/metl/orchestration-agent:latest
	docker push $(ACR_NAME).azurecr.io/metl/resource-allocator:latest
	docker push $(ACR_NAME).azurecr.io/metl/deployment-engine:latest
	docker push $(ACR_NAME).azurecr.io/metl/sre-agent:latest
	docker push $(ACR_NAME).azurecr.io/metl/eco-mode:latest
	docker push $(ACR_NAME).azurecr.io/metl/vibe-coder:latest
	docker push $(ACR_NAME).azurecr.io/metl/security-hunter:latest
	docker push $(ACR_NAME).azurecr.io/metl/frontend:latest
	@echo "Push complete!"

# Deploy to AKS
deploy:
	@echo "Deploying to AKS..."
	kubectl apply -f k8s/
	@echo "Deployment complete!"

# Azure Infrastructure
provision:
	cd infra && ./azure-provision.sh

bootstrap:
	cd infra && ./aks-bootstrap.sh

# Testing
test:
	@echo "Running integration tests..."
	cd tests && npm test

clean:
	docker-compose -f docker-compose.dev.yml down -v
	docker system prune -f
	@echo "Cleanup complete!"
