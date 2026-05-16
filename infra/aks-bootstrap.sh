#!/bin/bash
# metl-platform/infra/aks-bootstrap.sh
# Bootstrap AKS with all required Helm charts

set -e

echo "=== Metl AKS Bootstrap ==="
echo ""

# Ensure we have AKS credentials
if ! kubectl cluster-info &>/dev/null; then
  echo "Error: kubectl not connected to AKS cluster."
  echo "Run: az aks get-credentials --resource-group metl-rg --name metl-aks"
  exit 1
fi

# Create namespaces
echo "Creating namespaces..."
kubectl create namespace metl-system --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace ingress --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace cert-manager --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace keda --dry-run=client -o yaml | kubectl apply -f -

# Add Helm repos
echo "Adding Helm repositories..."
helm repo add traefik https://traefik.github.io/charts
helm repo add jetstack https://charts.jetstack.io
helm repo add nats https://nats-io.github.io/k8s/helm/charts/
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo add kedacore https://kedacore.github.io/charts
helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
helm repo add sonarqube https://SonarSource.github.io/helm-chart-sonarqube
helm repo update

# Install Traefik Ingress Controller
echo "Installing Traefik..."
helm upgrade --install traefik traefik/traefik \
  --namespace ingress \
  --create-namespace \
  -f helm-values/traefik.yaml

# Install Cert-Manager
echo "Installing Cert-Manager..."
helm upgrade --install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --set installCRDs=true

# Wait for cert-manager to be ready
kubectl wait --for=condition=ready pod -l app=cert-manager -n cert-manager --timeout=120s

# Install NATS with JetStream
echo "Installing NATS..."
helm upgrade --install nats nats/nats \
  --namespace metl-system \
  --create-namespace \
  -f helm-values/nats.yaml

# Install Kube-Prometheus-Stack
echo "Installing Kube-Prometheus-Stack..."
helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  -f helm-values/prometheus.yaml

# Install Loki
echo "Installing Loki..."
helm upgrade --install loki grafana/loki-stack \
  --namespace monitoring \
  -f helm-values/loki.yaml

# Install KEDA
echo "Installing KEDA..."
helm upgrade --install keda kedacore/keda \
  --namespace keda \
  --create-namespace

# Install OpenTelemetry Collector
echo "Installing OpenTelemetry Collector..."
helm upgrade --install otel open-telemetry/opentelemetry-collector \
  --namespace metl-system \
  -f helm-values/otel.yaml

# Install SonarQube
echo "Installing SonarQube..."
helm upgrade --install sonarqube sonarqube/sonarqube \
  --namespace metl-system \
  -f helm-values/sonarqube.yaml

# Metl specific configurations
echo "Applying Metl-specific configurations..."

# Create service account for workload identity
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ServiceAccount
metadata:
  name: metl-workload-identity
  namespace: metl-system
  annotations:
    azure.workload.identity/client-id: "${AZURE_CLIENT_ID}"
EOF

# Create ConfigMap for Metl platform settings
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: metl-config
  namespace: metl-system
data:
  NATS_URL: "nats://nats:4222"
  POSTGRES_HOST: "metl-postgres.postgres.database.azure.com"
  POSTGRES_PORT: "5432"
  REDIS_HOST: "metl-redis.redis.cache.windows.net"
  REDIS_PORT: "6380"
  STORAGE_ACCOUNT: "${STORAGE_NAME}"
  KEYVAULT_URL: "https://${KEYVAULT_NAME}.vault.azure.net"
  ACR_NAME: "${ACR_NAME}"
  DNS_ZONE: "metl.run"
EOF

echo ""
echo "=== Metl AKS bootstrap complete! ==="
echo ""
echo "Installed components:"
echo "  - Traefik Ingress Controller"
echo "  - Cert-Manager"
echo "  - NATS JetStream"
echo "  - Kube-Prometheus-Stack (Prometheus + Grafana + AlertManager)"
echo "  - Loki log aggregation"
echo "  - KEDA event-driven autoscaling"
echo "  - OpenTelemetry Collector"
echo "  - SonarQube"
echo ""
echo "Access points:"
echo "  Grafana: kubectl port-forward svc/prometheus-grafana 3000:80 -n monitoring"
echo "  Prometheus: kubectl port-forward svc/prometheus-kube-prometheus-prometheus 9090:9090 -n monitoring"
echo "  Traefik Dashboard: kubectl port-forward svc/traefik 9000:9000 -n ingress"
echo "  NATS: kubectl port-forward svc/nats 4222:4222 -n metl-system"
