import crypto from 'node:crypto';
import { bus } from '@metl/bus';
import { prisma } from '@metl/db';
import { logger, initTelemetry } from '@metl/logger';
import {
  ensureNamespace,
  createSecret,
  createConfigMap,
  applyPostgresStack,
  applyMinioStack,
  applyListmonkStack,
  applyKeycloakStack,
  applyOtelCollectorStack,
  waitForStatefulSet,
  waitForDeployment,
} from '@metl/k8s';

initTelemetry();

/* ================================================================
   Self-Hosted Metl Mode: K8s Pod Provisioning
   ================================================================ */

function generatePassword(length = 24): string {
  return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

async function provisionMetlDatabase(
  tenantId: string,
  namespace: string,
  envVars: Record<string, string>,
  secrets: Record<string, string>,
): Promise<void> {
  const password = generatePassword();
  await applyPostgresStack(namespace, password);
  await waitForStatefulSet(namespace, 'supabase-db');

  const dbHost = `supabase-db.${namespace}.svc.cluster.local`;
  const dbUrl = `postgres://postgres:${password}@${dbHost}:5432/postgres`;

  envVars['DB_PROVIDER'] = 'METL_LOCAL_SUPABASE';
  envVars['DB_STRATEGY'] = 'METL_LOCAL_SUPABASE';
  secrets['DATABASE_URL'] = dbUrl;

  // Upsert resource record
  const existing = await prisma.resource.findFirst({
    where: { tenantId, type: 'postgres', mode: 'metl' },
  });
  if (!existing) {
    await prisma.resource.create({
      data: {
        tenantId,
        type: 'postgres',
        mode: 'metl',
        status: 'running',
        endpoint: dbHost,
        credentials: { user: 'postgres', password, database: 'postgres' },
      },
    });
  }
}

async function provisionMetlStorage(
  tenantId: string,
  namespace: string,
  envVars: Record<string, string>,
  secrets: Record<string, string>,
): Promise<void> {
  const accessKey = `MINIO_${tenantId.slice(0, 8).toUpperCase()}`;
  const secretKey = generatePassword();
  await applyMinioStack(namespace, accessKey, secretKey);
  await waitForDeployment(namespace, 'minio-core');

  const endpoint = `http://minio-core.${namespace}.svc.cluster.local:9000`;

  envVars['STORAGE_PROVIDER'] = 'METL_NATIVE_MINIO';
  envVars['STORAGE_ENDPOINT'] = endpoint;
  envVars['STORAGE_BUCKET_NAME'] = `tenant-${tenantId}`;
  secrets['STORAGE_ACCESS_KEY'] = accessKey;
  secrets['STORAGE_SECRET_KEY'] = secretKey;

  const existing = await prisma.resource.findFirst({
    where: { tenantId, type: 'blob', mode: 'metl' },
  });
  if (!existing) {
    await prisma.resource.create({
      data: {
        tenantId,
        type: 'blob',
        mode: 'metl',
        status: 'running',
        endpoint,
        credentials: { accessKey, secretKey },
      },
    });
  }
}

async function provisionMetlMail(
  tenantId: string,
  namespace: string,
  envVars: Record<string, string>,
  secrets: Record<string, string>,
): Promise<void> {
  // Listmonk depends on the tenant's Postgres already being up
  const dbResource = await prisma.resource.findFirst({
    where: { tenantId, type: 'postgres', mode: 'metl' },
  });
  const dbUrl = dbResource
    ? (dbResource.credentials as any)?.password
      ? `postgres://postgres:${(dbResource.credentials as any).password}@supabase-db.${namespace}.svc.cluster.local:5432/postgres`
      : `postgres://postgres@supabase-db.${namespace}.svc.cluster.local:5432/postgres`
    : `postgres://postgres@supabase-db.${namespace}.svc.cluster.local:5432/postgres`;

  await applyListmonkStack(namespace, dbUrl);
  await waitForDeployment(namespace, 'listmonk');

  const endpoint = `http://listmonk.${namespace}.svc.cluster.local:9000`;

  envVars['MAIL_PROVIDER'] = 'METL_NATIVE_LISTMONK';
  envVars['MAIL_ENDPOINT'] = endpoint;

  const existing = await prisma.resource.findFirst({
    where: { tenantId, type: 'mail', mode: 'metl' },
  });
  if (!existing) {
    await prisma.resource.create({
      data: {
        tenantId,
        type: 'mail',
        mode: 'metl',
        status: 'running',
        endpoint,
      },
    });
  }
}

async function provisionMetlAuth(
  tenantId: string,
  namespace: string,
  envVars: Record<string, string>,
  secrets: Record<string, string>,
): Promise<void> {
  const adminUser = 'metl-admin';
  const adminPassword = generatePassword();

  const dbResource = await prisma.resource.findFirst({
    where: { tenantId, type: 'postgres', mode: 'metl' },
  });
  const dbPassword = dbResource ? (dbResource.credentials as any)?.password || '' : '';
  const dbUrl = `postgres://postgres:${dbPassword}@supabase-db.${namespace}.svc.cluster.local:5432/postgres`;

  await applyKeycloakStack(namespace, adminUser, adminPassword, dbUrl);
  await waitForDeployment(namespace, 'keycloak');

  const issuerUrl = `http://keycloak.${namespace}.svc.cluster.local:8080/realms/metl`;

  envVars['AUTH_PROVIDER'] = 'METL_NATIVE_KEYCLOAK';
  envVars['AUTH_ISSUER_URL'] = issuerUrl;
  secrets['KEYCLOAK_ADMIN_PASSWORD'] = adminPassword;

  const existing = await prisma.resource.findFirst({
    where: { tenantId, type: 'auth', mode: 'metl' },
  });
  if (!existing) {
    await prisma.resource.create({
      data: {
        tenantId,
        type: 'auth',
        mode: 'metl',
        status: 'running',
        endpoint: issuerUrl,
        credentials: { adminUser, adminPassword },
      },
    });
  }
}

async function provisionMetlMonitoring(
  tenantId: string,
  namespace: string,
  envVars: Record<string, string>,
): Promise<void> {
  await applyOtelCollectorStack(namespace);
  await waitForDeployment(namespace, 'otel-collector');

  const otelEndpoint = `http://otel-collector.${namespace}.svc.cluster.local:4317`;

  envVars['MONITORING_PROVIDER'] = 'METL_NATIVE_OTEL';
  envVars['OTEL_EXPORTER_OTLP_ENDPOINT'] = otelEndpoint;

  const existing = await prisma.resource.findFirst({
    where: { tenantId, type: 'monitoring', mode: 'metl' },
  });
  if (!existing) {
    await prisma.resource.create({
      data: {
        tenantId,
        type: 'monitoring',
        mode: 'metl',
        status: 'running',
        endpoint: otelEndpoint,
      },
    });
  }
}

/* ================================================================
   BYOK Mode: External Credential Injection
   ================================================================ */

function injectByokDatabase(config: any, envVars: Record<string, string>, secrets: Record<string, string>): void {
  envVars['DB_PROVIDER'] = 'EXTERNAL_PERSISTENCE';
  envVars['DB_STRATEGY'] = 'BYOK_EXTERNAL_TARGET';
  secrets['DATABASE_URL'] = config.externalUrl;
}

function injectByokStorage(config: any, envVars: Record<string, string>, secrets: Record<string, string>): void {
  envVars['STORAGE_PROVIDER'] = 'AWS_S3_CLOUD';
  envVars['STORAGE_BUCKET_NAME'] = config.bucketName || '';
  envVars['STORAGE_ENDPOINT'] = config.endpoint || `https://s3.${config.region}.amazonaws.com`;
  secrets['STORAGE_ACCESS_KEY'] = config.awsAccessKeyId || '';
  secrets['STORAGE_SECRET_KEY'] = config.awsSecretAccessKey || '';
}

function injectByokMail(config: any, envVars: Record<string, string>, secrets: Record<string, string>): void {
  const provider = config.provider || 'resend';
  envVars['MAIL_PROVIDER'] = `EXTERNAL_${provider.toUpperCase()}`;
  envVars['MAIL_ENDPOINT'] = config.endpoint || '';
  if (config.apiKey) secrets['MAIL_API_KEY'] = config.apiKey;
  if (config.smtpHost) envVars['SMTP_HOST'] = config.smtpHost;
  if (config.smtpPort) envVars['SMTP_PORT'] = String(config.smtpPort);
  if (config.smtpUser) secrets['SMTP_USER'] = config.smtpUser;
  if (config.smtpPassword) secrets['SMTP_PASSWORD'] = config.smtpPassword;
}

function injectByokMonitoring(config: any, envVars: Record<string, string>, secrets: Record<string, string>): void {
  const provider = config.provider || 'sentry';
  envVars['MONITORING_PROVIDER'] = `EXTERNAL_${provider.toUpperCase()}`;
  if (config.sentryDsn) secrets['SENTRY_DSN'] = config.sentryDsn;
  if (config.datadogApiKey) secrets['DATADOG_API_KEY'] = config.datadogApiKey;
  if (config.otelEndpoint) envVars['OTEL_EXPORTER_OTLP_ENDPOINT'] = config.otelEndpoint;
}

function injectByokAuth(config: any, envVars: Record<string, string>, secrets: Record<string, string>): void {
  const provider = config.provider || 'clerk';
  envVars['AUTH_PROVIDER'] = `EXTERNAL_${provider.toUpperCase()}`;
  if (config.clerkPublishableKey) envVars['CLERK_PUBLISHABLE_KEY'] = config.clerkPublishableKey;
  if (config.clerkSecretKey) secrets['CLERK_SECRET_KEY'] = config.clerkSecretKey;
  if (config.auth0Domain) envVars['AUTH0_DOMAIN'] = config.auth0Domain;
  if (config.auth0ClientId) envVars['AUTH0_CLIENT_ID'] = config.auth0ClientId;
  if (config.auth0ClientSecret) secrets['AUTH0_CLIENT_SECRET'] = config.auth0ClientSecret;
  if (config.firebaseProjectId) envVars['FIREBASE_PROJECT_ID'] = config.firebaseProjectId;
  if (config.firebaseServiceAccount) secrets['FIREBASE_SERVICE_ACCOUNT'] = config.firebaseServiceAccount;
}

function injectByokHosting(config: any, envVars: Record<string, string>, secrets: Record<string, string>): void {
  const provider = config.provider || 'vercel';
  envVars['DEPLOYMENT_TARGET_ENGINE'] = provider.toUpperCase();
  if (config.vercelToken) secrets['VERCEL_TOKEN'] = config.vercelToken;
  if (config.vercelTeamId) envVars['VERCEL_TEAM_ID'] = config.vercelTeamId;
  if (config.netlifyToken) secrets['NETLIFY_TOKEN'] = config.netlifyToken;
  if (config.netlifySiteId) envVars['NETLIFY_SITE_ID'] = config.netlifySiteId;
  if (config.cloudflareApiToken) secrets['CLOUDFLARE_API_TOKEN'] = config.cloudflareApiToken;
  if (config.cloudflareAccountId) envVars['CLOUDFLARE_ACCOUNT_ID'] = config.cloudflareAccountId;
}

/* ================================================================
   Main Orchestration Handler
   ================================================================ */

async function handleOrchestrate(task: any): Promise<void> {
  const { tenantId, payload } = task;
  const namespace = `metl-${tenantId}`;

  await ensureNamespace(namespace, {
    cpu: '1',
    memory: '2Gi',
    limitsCpu: '4',
    limitsMemory: '8Gi',
  });

  const matrix = await prisma.providerMatrix.findUnique({
    where: { tenantId },
  });

  if (!matrix) {
    logger.warn({ tenantId }, 'No provider matrix found');
    return;
  }

  const envVars: Record<string, string> = {};
  const secrets: Record<string, string> = {};

  // ---- Database ----
  if (matrix.databaseMode === 'byok' && matrix.databaseConfig) {
    injectByokDatabase(matrix.databaseConfig as any, envVars, secrets);
  } else {
    await provisionMetlDatabase(tenantId, namespace, envVars, secrets);
  }

  // ---- Storage ----
  if (matrix.storageMode === 'byok' && matrix.storageConfig) {
    injectByokStorage(matrix.storageConfig as any, envVars, secrets);
  } else {
    await provisionMetlStorage(tenantId, namespace, envVars, secrets);
  }

  // ---- Mail ----
  if (matrix.mailMode === 'byok' && matrix.mailConfig) {
    injectByokMail(matrix.mailConfig as any, envVars, secrets);
  } else {
    await provisionMetlMail(tenantId, namespace, envVars, secrets);
  }

  // ---- Monitoring ----
  if (matrix.monitoringMode === 'byok' && matrix.monitoringConfig) {
    injectByokMonitoring(matrix.monitoringConfig as any, envVars, secrets);
  } else {
    await provisionMetlMonitoring(tenantId, namespace, envVars);
  }

  // ---- Auth ----
  if (matrix.authMode === 'byok' && matrix.authConfig) {
    injectByokAuth(matrix.authConfig as any, envVars, secrets);
  } else {
    await provisionMetlAuth(tenantId, namespace, envVars, secrets);
  }

  // ---- Hosting ----
  if (matrix.hostingMode === 'byok' && matrix.hostingConfig) {
    injectByokHosting(matrix.hostingConfig as any, envVars, secrets);
  } else {
    envVars['DEPLOYMENT_TARGET_ENGINE'] = 'METL_NATIVE_K3S_GRID';
  }

  // Apply ConfigMap and Secret
  await createConfigMap(namespace, `${tenantId}-runtime-env`, envVars);
  if (Object.keys(secrets).length > 0) {
    await createSecret(namespace, `${tenantId}-runtime-secrets`, secrets);
  }

  // Notify visual twin
  if (Object.keys(secrets).length > 0) {
    await bus.publish('events.visual.twin.inject_vault', {
      eventType: 'INJECT_SECURE_VAULT',
      tenantId,
      secretKeys: Object.keys(secrets),
      timestamp: new Date().toISOString(),
    });
  }

  await bus.publish('events.visual.twin.provision_db_stack', {
    eventType: 'PROVISION_DB_STACK',
    tenantId,
    phase: 'orchestration_complete',
    envKeys: Object.keys(envVars),
    timestamp: new Date().toISOString(),
  });

  logger.info({ tenantId }, 'Provider matrix applied');
}

async function main() {
  await bus.connect();
  logger.info('Orchestration Agent connected to NATS');

  await bus.subscribe('tasks.orchestrate.apply', 'orchestration-agent', handleOrchestrate);

  logger.info('Orchestration Agent listening');
}

function shutdown(signal: string) {
  logger.info({ signal }, 'Orchestration Agent shutting down gracefully');
  bus.close().catch(() => null);
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

main().catch((err) => {
  logger.error({ err }, 'Failed to start Orchestration Agent');
  process.exit(1);
});
