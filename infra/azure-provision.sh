#!/bin/bash
# metl-platform/infra/azure-provision.sh
# Provision all Azure resources for the Metl platform

set -e

# Variables (customize these)
RESOURCE_GROUP="metl-rg"
LOCATION="eastus"
AKS_NAME="metl-aks"
POSTGRES_NAME="metl-postgres"
REDIS_NAME="metl-redis"
STORAGE_NAME="metlstorage${RANDOM}"
KEYVAULT_NAME="metl-kv-${RANDOM}"
ACR_NAME="metlacr${RANDOM}"
DNS_ZONE="metl.run"
APP_GW_NAME="metl-appgw"
LOG_WORKSPACE="metl-logs"

# Login and set subscription
az account show &>/dev/null || az login

# Create resource group
echo "Creating resource group..."
az group create --name "$RESOURCE_GROUP" --location "$LOCATION"

# Create Log Analytics workspace
echo "Creating Log Analytics workspace..."
az monitor log-analytics workspace create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$LOG_WORKSPACE" \
  --location "$LOCATION" \
  --sku PerGB2018

# Create AKS cluster with Azure CNI
echo "Creating AKS cluster..."
az aks create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$AKS_NAME" \
  --location "$LOCATION" \
  --node-count 3 \
  --node-vm-size Standard_D4s_v3 \
  --network-plugin azure \
  --network-policy calico \
  --enable-cluster-autoscaler \
  --min-count 3 \
  --max-count 6 \
  --enable-managed-identity \
  --enable-workload-identity \
  --enable-oidc-issuer \
  --attach-acr "$ACR_NAME" \
  --generate-ssh-keys

# Create Azure Container Registry
echo "Creating Azure Container Registry..."
az acr create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --location "$LOCATION" \
  --sku Premium \
  --admin-enabled true

# Create PostgreSQL Flexible Server
echo "Creating Azure Database for PostgreSQL..."
az postgres flexible-server create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$POSTGRES_NAME" \
  --location "$LOCATION" \
  --sku-name Standard_B2ms \
  --tier Burstable \
  --storage-size 32 \
  --version 15 \
  --high-availability ZoneRedundant \
  --public-access Disabled

# Create Redis Enterprise
echo "Creating Azure Cache for Redis Enterprise..."
az redisenterprise create \
  --cluster-name "$REDIS_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --sku Enterprise_E10 \
  --capacity 2 \
  --zones 1 2 3

# Create Storage Account
echo "Creating Azure Storage Account..."
az storage account create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$STORAGE_NAME" \
  --location "$LOCATION" \
  --sku Standard_GRS \
  --kind StorageV2 \
  --enable-hierarchical-namespace true \
  --min-tls-version TLS1_2

# Create Key Vault
echo "Creating Azure Key Vault..."
az keyvault create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$KEYVAULT_NAME" \
  --location "$LOCATION" \
  --sku standard \
  --enable-soft-delete true \
  --enable-purge-protection true \
  --public-network-access Disabled

# Create Application Gateway
echo "Creating Application Gateway..."
az network public-ip create \
  --resource-group "$RESOURCE_GROUP" \
  --name metl-appgw-pip \
  --allocation-method Static \
  --sku Standard

az network application-gateway create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_GW_NAME" \
  --location "$LOCATION" \
  --sku WAF_v2 \
  --capacity 2 \
  --vnet-name metl-vnet \
  --subnet metl-appgw-subnet \
  --public-ip-address metl-appgw-pip \
  --http-settings-port 80 \
  --http-settings-protocol Http \
  --frontend-port 80 \
  --routing-rule-type Basic \
  --priority 1

# Enable WAF on Application Gateway
echo "Enabling WAF..."
az network application-gateway waf-policy create \
  --name metl-waf-policy \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --type OWASP \
  --version 3.2

# Create DNS Zone
echo "Creating DNS Zone..."
az network dns zone create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$DNS_ZONE"

# Save infrastructure values to a file for later use
echo "Saving infrastructure configuration..."
cat > "../.env.infra" <<EOF
AZURE_RESOURCE_GROUP=$RESOURCE_GROUP
AZURE_LOCATION=$LOCATION
AKS_NAME=$AKS_NAME
POSTGRES_NAME=$POSTGRES_NAME
REDIS_NAME=$REDIS_NAME
STORAGE_NAME=$STORAGE_NAME
KEYVAULT_NAME=$KEYVAULT_NAME
ACR_NAME=$ACR_NAME
DNS_ZONE=$DNS_ZONE
APP_GW_NAME=$APP_GW_NAME
EOF

echo "Azure infrastructure provision complete!"
echo "Configuration saved to: metl-platform/.env.infra"
echo ""
echo "Next steps:"
echo "1. Configure private endpoints for PostgreSQL, Redis, and Key Vault"
echo "2. Run: az aks get-credentials --resource-group $RESOURCE_GROUP --name $AKS_NAME"
echo "3. Run: infra/aks-bootstrap.sh"
