import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import dotenv from 'dotenv';
import { bus } from '@metl/bus';
import { prisma } from '@metl/db';
import { logger, initTelemetry } from '@metl/logger';
import {
  generateHelmChart,
  generateDockerCompose,
  dumpDatabaseSchema,
  EjectionConfig,
} from '@metl/ejection-engine';

dotenv.config();
initTelemetry();

async function createZipBundle(sourceDir: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    archive.on('error', (err) => reject(err));

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

async function handleEject(task: any): Promise<void> {
  const { tenantId, payload } = task;
  const { deploymentId } = payload;

  logger.info({ tenantId, deploymentId }, 'Starting ejection process');

  const deployment = await prisma.deployment.findFirst({
    where: { id: deploymentId },
    include: { resources: true },
  });

  const matrix = await prisma.providerMatrix.findUnique({
    where: { tenantId },
  });

  if (!deployment) {
    throw new Error(`Deployment ${deploymentId} not found`);
  }

  const projectName = deployment.slug;
  const imageTag = deployment.imageTag || `metl/${projectName}:latest`;

  // Gather env vars - start with provider matrix derived values
  const envVars: Record<string, string> = {};

  // Database
  if (matrix?.databaseMode === 'byok' && matrix.databaseConfig) {
    const config = matrix.databaseConfig as any;
    envVars['DB_STRATEGY'] = 'BYOK_EXTERNAL_TARGET';
    envVars['DATABASE_URL'] = config.externalUrl || '';
  } else {
    const dbResource = deployment.resources.find((r) => r.type === 'postgres');
    if (dbResource) {
      const creds = dbResource.credentials as any;
      envVars['DB_STRATEGY'] = 'LOCAL_PERSISTENCE';
      envVars['DATABASE_URL'] = `postgres://${creds.user}:${creds.password}@database-core:5432/${creds.database || 'app'}`;
    }
  }

  // Storage
  if (matrix?.storageMode === 'byok' && matrix.storageConfig) {
    const config = matrix.storageConfig as any;
    envVars['STORAGE_PROVIDER'] = 'EXTERNAL_S3';
    envVars['STORAGE_ENDPOINT'] = config.endpoint || `https://s3.${config.region}.amazonaws.com`;
    envVars['STORAGE_BUCKET_NAME'] = config.bucketName || '';
    envVars['STORAGE_ACCESS_KEY'] = config.awsAccessKeyId || '';
    envVars['STORAGE_SECRET_KEY'] = config.awsSecretAccessKey || '';
  } else {
    const storageResource = deployment.resources.find((r) => r.type === 'blob');
    if (storageResource) {
      const creds = storageResource.credentials as any;
      envVars['STORAGE_PROVIDER'] = 'METL_NATIVE_MINIO';
      envVars['STORAGE_ENDPOINT'] = 'http://minio-service:9000';
      envVars['STORAGE_ACCESS_KEY'] = creds?.accessKey || '';
      envVars['STORAGE_SECRET_KEY'] = creds?.secretKey || '';
      envVars['STORAGE_BUCKET_NAME'] = `tenant-${tenantId}`;
    }
  }

  // Mail
  if (matrix?.mailMode === 'byok' && matrix.mailConfig) {
    const config = matrix.mailConfig as any;
    envVars['MAIL_PROVIDER'] = `EXTERNAL_${(config.provider || 'resend').toUpperCase()}`;
    envVars['MAIL_ENDPOINT'] = config.endpoint || '';
    envVars['MAIL_API_KEY'] = config.apiKey || '';
  } else {
    envVars['MAIL_PROVIDER'] = 'LOCAL_LISTMONK';
    envVars['MAIL_ENDPOINT'] = 'http://mailer-service:9000';
  }

  // Monitoring
  if (matrix?.monitoringMode === 'byok' && matrix.monitoringConfig) {
    const config = matrix.monitoringConfig as any;
    envVars['MONITORING_PROVIDER'] = `EXTERNAL_${(config.provider || 'sentry').toUpperCase()}`;
    envVars['SENTRY_DSN'] = config.sentryDsn || '';
    envVars['DATADOG_API_KEY'] = config.datadogApiKey || '';
  } else {
    envVars['MONITORING_PROVIDER'] = 'LOCAL_OTEL_COLLECTOR';
    envVars['OTEL_EXPORTER_OTLP_ENDPOINT'] = 'http://otel-collector:4317';
  }

  // Auth
  if (matrix?.authMode === 'byok' && matrix.authConfig) {
    const config = matrix.authConfig as any;
    envVars['AUTH_PROVIDER'] = `EXTERNAL_${(config.provider || 'clerk').toUpperCase()}`;
    envVars['CLERK_PUBLISHABLE_KEY'] = config.clerkPublishableKey || '';
    envVars['CLERK_SECRET_KEY'] = config.clerkSecretKey || '';
  } else {
    envVars['AUTH_PROVIDER'] = 'LOCAL_KEYCLOAK';
    envVars['AUTH_ISSUER_URL'] = 'http://keycloak-service:8080/realms/metl';
  }

  // Hosting
  if (matrix?.hostingMode === 'byok' && matrix.hostingConfig) {
    const config = matrix.hostingConfig as any;
    envVars['DEPLOYMENT_TARGET_ENGINE'] = (config.provider || 'vercel').toUpperCase();
  } else {
    envVars['DEPLOYMENT_TARGET_ENGINE'] = 'METL_NATIVE_K3S_GRID';
  }

  const ejectConfig: EjectionConfig = {
    tenantId,
    deploymentId,
    projectName,
    imageTag,
    envVars,
    dbHost: deployment.resources.find((r) => r.type === 'postgres')?.endpoint,
    dbName: (deployment.resources.find((r) => r.type === 'postgres')?.credentials as any)?.database || 'app',
    byokConfig: {
      database: matrix?.databaseConfig as any,
      storage: matrix?.storageConfig as any,
      mail: matrix?.mailConfig as any,
      monitoring: matrix?.monitoringConfig as any,
      auth: matrix?.authConfig as any,
      hosting: matrix?.hostingConfig as any,
    },
  };

  const ejectBaseDir = path.join('/tmp', `eject-${tenantId}`);
  fs.mkdirSync(ejectBaseDir, { recursive: true });

  // Generate all export artifacts
  const helmDir = generateHelmChart(ejectConfig);
  const composeDir = generateDockerCompose(ejectConfig);

  // Dump DB schema if Metl DB exists
  const dbResource = deployment.resources.find((r) => r.type === 'postgres');
  if (dbResource && matrix?.databaseMode === 'metl') {
    try {
      const schemaPath = path.join(composeDir, 'migrations', 'schema.sql');
      fs.mkdirSync(path.dirname(schemaPath), { recursive: true });
      const creds = dbResource.credentials as any;
      dumpDatabaseSchema(
        dbResource.endpoint || 'localhost',
        creds.database || 'app',
        creds.user || 'postgres',
        creds.password || '',
        schemaPath,
      );
    } catch (err) {
      logger.warn({ err, tenantId }, 'Failed to dump database schema, continuing without it');
    }
  }

  // Copy source code if available
  const sourcePath = path.join('/tmp/metl-builds', deployment.slug);
  if (fs.existsSync(sourcePath)) {
    const destSource = path.join(ejectBaseDir, 'source');
    fs.cpSync(sourcePath, destSource, { recursive: true });
  }

  // Create README
  const readme = `# ${projectName} - Metl Ejected Package

This package was generated by the Metl OS Independent Ejection Engine.
It contains everything needed to run your application independently.

## Contents

- \`docker-compose.yml\` - Standalone Docker Compose with all services
- \`helm-chart/\` - Kubernetes Helm chart
- \`migrations/schema.sql\` - Database schema (if metl DB was used)
- \`source/\` - Application source code

## Quick Start (Docker Compose)

1. Ensure Docker and Docker Compose are installed.
2. Run: \`docker compose up -d\`
3. Your app will be available at http://localhost:3000

## Provider Configuration

This export includes the following provider selections:

| Service | Mode | Provider |
|---------|------|----------|
| Database | ${matrix?.databaseMode || 'metl'} | ${matrix?.databaseMode === 'byok' ? (matrix.databaseConfig as any)?.provider : 'Supabase Stack'} |
| Storage | ${matrix?.storageMode || 'metl'} | ${matrix?.storageMode === 'byok' ? (matrix.storageConfig as any)?.provider : 'MinIO'} |
| Mail | ${matrix?.mailMode || 'metl'} | ${matrix?.mailMode === 'byok' ? (matrix.mailConfig as any)?.provider : 'Listmonk'} |
| Monitoring | ${matrix?.monitoringMode || 'metl'} | ${matrix?.monitoringMode === 'byok' ? (matrix.monitoringConfig as any)?.provider : 'OpenTelemetry'} |
| Auth | ${matrix?.authMode || 'metl'} | ${matrix?.authMode === 'byok' ? (matrix.authConfig as any)?.provider : 'Keycloak'} |
| Hosting | ${matrix?.hostingMode || 'metl'} | ${matrix?.hostingMode === 'byok' ? (matrix.hostingConfig as any)?.provider : 'Metl K3s'} |

## BYOK Credentials

If any pillar is configured as BYOK, credentials are injected into the
environment variables in docker-compose.yml and Helm values.yaml.
Please review and rotate credentials before distributing this package.

---
Generated by Metl OS Ejection Engine
`;
  fs.writeFileSync(path.join(ejectBaseDir, 'README.md'), readme);

  // Create final ZIP bundle
  const zipPath = path.join('/tmp', `metl-eject-${tenantId}.zip`);
  await createZipBundle(ejectBaseDir, zipPath);

  logger.info({ tenantId, zipPath }, 'Ejection complete');

  // Publish completion event
  await bus.publish('events.eject.complete', {
    tenantId,
    deploymentId,
    downloadPath: zipPath,
    timestamp: new Date().toISOString(),
  });
}

async function main() {
  await bus.connect();
  logger.info('Ejection Agent connected to NATS');

  await bus.subscribe('tasks.eject', 'ejection-agent', handleEject);

  logger.info('Ejection Agent listening');
}

function shutdown(signal: string) {
  logger.info({ signal }, 'Ejection Agent shutting down gracefully');
  bus.close().catch(() => null);
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

main().catch((err) => {
  logger.error({ err }, 'Failed to start Ejection Agent');
  process.exit(1);
});
