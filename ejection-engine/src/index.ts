import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export interface EjectionConfig {
  tenantId: string;
  deploymentId: string;
  projectName: string;
  imageTag: string;
  envVars: Record<string, string>;
  dbHost?: string;
  dbName?: string;
  byokConfig?: {
    database?: any;
    storage?: any;
    mail?: any;
    monitoring?: any;
    auth?: any;
    hosting?: any;
  };
}

export function generateHelmChart(config: EjectionConfig): string {
  const chartDir = path.join('/tmp', `eject-${config.tenantId}`, 'helm-chart');
  fs.mkdirSync(chartDir, { recursive: true });

  // Chart.yaml
  const chartYaml = `apiVersion: v2
name: ${config.projectName}
description: Ejected Metl application
version: 1.0.0
appVersion: "1.0"
`;
  fs.writeFileSync(path.join(chartDir, 'Chart.yaml'), chartYaml);

  // values.yaml
  const valuesYaml = `replicaCount: 1

image:
  repository: ${config.imageTag.split(':')[0]}
  tag: ${config.imageTag.split(':')[1] || 'latest'}
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 3000

ingress:
  enabled: true
  hosts:
    - host: ${config.projectName}.metl.run
      paths:
        - path: /
          pathType: Prefix

env:
${Object.entries(config.envVars)
  .map(([k, v]) => `  ${k}: "${v}"`)
  .join('\n')}
`;
  fs.writeFileSync(path.join(chartDir, 'values.yaml'), valuesYaml);

  // templates/deployment.yaml
  const templatesDir = path.join(chartDir, 'templates');
  fs.mkdirSync(templatesDir, { recursive: true });

  const deploymentYaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Chart.Name }}
  labels:
    app: {{ .Chart.Name }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      app: {{ .Chart.Name }}
  template:
    metadata:
      labels:
        app: {{ .Chart.Name }}
    spec:
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          ports:
            - containerPort: 3000
          env:
            {{- range $key, $val := .Values.env }}
            - name: {{ $key }}
              value: {{ quote $val }}
            {{- end }}
          resources:
            limits:
              cpu: 500m
              memory: 512Mi
            requests:
              cpu: 100m
              memory: 128Mi
`;
  fs.writeFileSync(path.join(templatesDir, 'deployment.yaml'), deploymentYaml);

  // templates/service.yaml
  const serviceYaml = `apiVersion: v1
kind: Service
metadata:
  name: {{ .Chart.Name }}
  labels:
    app: {{ .Chart.Name }}
spec:
  type: {{ .Values.service.type }}
  ports:
    - port: {{ .Values.service.port }}
      targetPort: 3000
  selector:
    app: {{ .Chart.Name }}
`;
  fs.writeFileSync(path.join(templatesDir, 'service.yaml'), serviceYaml);

  // templates/ingress.yaml
  const ingressYaml = `{{- if .Values.ingress.enabled }}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ .Chart.Name }}
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: websecure
spec:
  rules:
    {{- range .Values.ingress.hosts }}
    - host: {{ .host }}
      http:
        paths:
          {{- range .paths }}
          - path: {{ .path }}
            pathType: {{ .pathType }}
            backend:
              service:
                name: {{ $.Chart.Name }}
                port:
                  number: {{ $.Values.service.port }}
          {{- end }}
    {{- end }}
{{- end }}
`;
  fs.writeFileSync(path.join(templatesDir, 'ingress.yaml'), ingressYaml);

  return chartDir;
}

export function generateDockerCompose(config: EjectionConfig): string {
  const composeDir = path.join('/tmp', `eject-${config.tenantId}`);
  fs.mkdirSync(composeDir, { recursive: true });

  const dbPassword = generatePassword();
  const minioAccessKey = `MINIO_EJECT_${config.tenantId.slice(0, 8).toUpperCase()}`;
  const minioSecretKey = generatePassword();
  const keycloakAdminPassword = generatePassword();

  // Determine if any pillar is BYOK
  const byokDb = config.byokConfig?.database;
  const byokStorage = config.byokConfig?.storage;
  const byokMail = config.byokConfig?.mail;
  const byokAuth = config.byokConfig?.auth;
  const byokMonitoring = config.byokConfig?.monitoring;

  let servicesYaml = `version: '3.8'

services:
  ${config.projectName}:
    image: ${config.imageTag}
    ports:
      - "3000:3000"
    environment:
      - DB_STRATEGY=LOCAL_PERSISTENCE
      - DATABASE_URL=postgres://postgres:${dbPassword}@database-core:5432/${config.dbName || 'app'}
      - STORAGE_ENDPOINT=http://minio-service:9000
      - STORAGE_ACCESS_KEY=${minioAccessKey}
      - STORAGE_SECRET_KEY=${minioSecretKey}
      - STORAGE_BUCKET_NAME=application-media-vault
      - MAIL_PROVIDER=LOCAL_LISTMONK
      - MAIL_ENDPOINT=http://mailer-service:9000
      - MONITORING_PROVIDER=LOCAL_OTEL_COLLECTOR
      - OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
      - AUTH_PROVIDER=LOCAL_KEYCLOAK
      - AUTH_ISSUER_URL=http://keycloak-service:8080/realms/metl
      - FRONTEND_ENGINE_PROVIDER=DECOUPLED_LOCAL_BUILD
      - DATA_STORAGE_STRATEGY=LOCAL_POSTGRES_CONTAINER
      - DEPLOYMENT_TARGET_ENGINE=METL_NATIVE_K3S_GRID
      - APPLICATION_MODE=PRODUCTION
`;

  // Override with BYOK values if present
  if (byokDb) {
    servicesYaml = servicesYaml.replace(
      `- DATABASE_URL=postgres://postgres:${dbPassword}@database-core:5432/${config.dbName || 'app'}`,
      `- DATABASE_URL=${byokDb.externalUrl || byokDb.connectionString || ''}`,
    );
    servicesYaml = servicesYaml.replace(`- DB_STRATEGY=LOCAL_PERSISTENCE`, `- DB_STRATEGY=BYOK_EXTERNAL_TARGET`);
  }
  if (byokStorage) {
    servicesYaml = servicesYaml.replace(
      `- STORAGE_ENDPOINT=http://minio-service:9000`,
      `- STORAGE_ENDPOINT=${byokStorage.endpoint || `https://s3.${byokStorage.region}.amazonaws.com`}`,
    );
    servicesYaml = servicesYaml.replace(`- STORAGE_ACCESS_KEY=${minioAccessKey}`, `- STORAGE_ACCESS_KEY=${byokStorage.awsAccessKeyId || ''}`);
    servicesYaml = servicesYaml.replace(`- STORAGE_SECRET_KEY=${minioSecretKey}`, `- STORAGE_SECRET_KEY=${byokStorage.awsSecretAccessKey || ''}`);
  }
  if (byokMail) {
    servicesYaml = servicesYaml.replace(`- MAIL_PROVIDER=LOCAL_LISTMONK`, `- MAIL_PROVIDER=EXTERNAL_${(byokMail.provider || 'resend').toUpperCase()}`);
    servicesYaml = servicesYaml.replace(`- MAIL_ENDPOINT=http://mailer-service:9000`, `- MAIL_ENDPOINT=${byokMail.endpoint || ''}`);
    if (byokMail.apiKey) {
      servicesYaml += `      - MAIL_API_KEY=${byokMail.apiKey}\n`;
    }
  }
  if (byokAuth) {
    servicesYaml = servicesYaml.replace(`- AUTH_PROVIDER=LOCAL_KEYCLOAK`, `- AUTH_PROVIDER=EXTERNAL_${(byokAuth.provider || 'clerk').toUpperCase()}`);
    if (byokAuth.clerkPublishableKey) servicesYaml += `      - CLERK_PUBLISHABLE_KEY=${byokAuth.clerkPublishableKey}\n`;
    if (byokAuth.clerkSecretKey) servicesYaml += `      - CLERK_SECRET_KEY=${byokAuth.clerkSecretKey}\n`;
    if (byokAuth.auth0Domain) servicesYaml += `      - AUTH0_DOMAIN=${byokAuth.auth0Domain}\n`;
  }
  if (byokMonitoring) {
    servicesYaml = servicesYaml.replace(`- MONITORING_PROVIDER=LOCAL_OTEL_COLLECTOR`, `- MONITORING_PROVIDER=EXTERNAL_${(byokMonitoring.provider || 'sentry').toUpperCase()}`);
    if (byokMonitoring.sentryDsn) servicesYaml += `      - SENTRY_DSN=${byokMonitoring.sentryDsn}\n`;
  }

  servicesYaml += `    depends_on:
      database-core:
        condition: service_healthy
`;

  if (!byokStorage) {
    servicesYaml += `      minio-service:
        condition: service_healthy
`;
  }

  servicesYaml += `    restart: unless-stopped
    networks:
      - metl-network

  database-core:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: ${config.dbName || 'app'}
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${dbPassword}
    volumes:
      - database-storage-block:/var/lib/postgresql/data
      - ./migrations/schema.sql:/docker-entrypoint-initdb.d/schema.sql
    ports:
      - "5432:5432"
    restart: unless-stopped
    networks:
      - metl-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
`;

  if (!byokStorage) {
    servicesYaml += `
  minio-service:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: ${minioAccessKey}
      MINIO_ROOT_PASSWORD: ${minioSecretKey}
    volumes:
      - block-media-volume:/data
    restart: unless-stopped
    networks:
      - metl-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 5s
      timeout: 5s
      retries: 5
`;
  }

  if (!byokMail) {
    servicesYaml += `
  mailer-service:
    image: listmonk/listmonk:latest
    ports:
      - "9002:9000"
    environment:
      - LISTMONK_db__host=postgres://postgres:${dbPassword}@database-core:5432/postgres
    restart: unless-stopped
    networks:
      - metl-network
`;
  }

  if (!byokAuth) {
    servicesYaml += `
  keycloak-service:
    image: quay.io/keycloak/keycloak:latest
    command: start-dev
    ports:
      - "8080:8080"
    environment:
      KEYCLOAK_ADMIN: metl-admin
      KEYCLOAK_ADMIN_PASSWORD: ${keycloakAdminPassword}
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://database-core:5432/${config.dbName || 'app'}
      KC_DB_USERNAME: postgres
      KC_DB_PASSWORD: ${dbPassword}
    restart: unless-stopped
    networks:
      - metl-network
`;
  }

  if (!byokMonitoring) {
    servicesYaml += `
  otel-collector:
    image: otel/opentelemetry-collector-contrib:latest
    command: ["--config=/conf/otel-collector-config.yaml"]
    ports:
      - "4317:4317"
      - "4318:4318"
    restart: unless-stopped
    networks:
      - metl-network
`;
  }

  servicesYaml += `
volumes:
  database-storage-block:
`;

  if (!byokStorage) {
    servicesYaml += `  block-media-volume:
`;
  }

  servicesYaml += `
networks:
  metl-network:
    driver: bridge
`;

  fs.writeFileSync(path.join(composeDir, 'docker-compose.yml'), servicesYaml);
  return composeDir;
}

export function generateTerraform(config: EjectionConfig): string {
  const tfDir = path.join('/tmp', `eject-${config.tenantId}`, 'terraform');
  fs.mkdirSync(tfDir, { recursive: true });

  const mainTf = `# Metl Ejected Infrastructure - Terraform
terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

# Replace with your preferred cloud provider (AWS, GCP, Hetzner, DigitalOcean)
# This template uses Azure as an example. For fully vendor-neutral deployment,
# use the generated docker-compose.yml on any VPS with Docker installed.

resource "azurerm_resource_group" "main" {
  name     = "${config.projectName}-rg"
  location = "East US"
}

resource "azurerm_container_registry" "main" {
  name                = "${config.projectName.replace(/-/g, '')}acr"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Standard"
  admin_enabled       = true
}

resource "azurerm_kubernetes_cluster" "main" {
  name                = "${config.projectName}-aks"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  dns_prefix          = "${config.projectName}"

  default_node_pool {
    name       = "default"
    node_count = 2
    vm_size    = "Standard_D4s_v3"
  }

  identity {
    type = "SystemAssigned"
  }
}

output "kube_config" {
  value     = azurerm_kubernetes_cluster.main.kube_config_raw
  sensitive = true
}
`;

  fs.writeFileSync(path.join(tfDir, 'main.tf'), mainTf);
  return tfDir;
}

export function dumpDatabaseSchema(
  host: string,
  database: string,
  user: string,
  password: string,
  outputPath: string,
): void {
  const env = { ...process.env, PGPASSWORD: password };
  const command = `pg_dump -h ${host} -U ${user} -d ${database} --schema-only > ${outputPath}`;
  execSync(command, { env, stdio: 'pipe' });
}

function generatePassword(length = 24): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
