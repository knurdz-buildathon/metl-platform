import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { bus } from '@metl/bus';
import { prisma } from '@metl/db';
import { logger, initTelemetry } from '@metl/logger';
import {
  createSecret,
  applyPostgresStack,
  applyMinioStack,
  applyListmonkStack,
  applyKeycloakStack,
  applyOtelCollectorStack,
  waitForStatefulSet,
  waitForDeployment,
} from '@metl/k8s';
import { Socket } from 'net';

dotenv.config();
initTelemetry();

function generatePassword(length = 24): string {
  return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

async function validateExternalConnection(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new Socket();
    socket.setTimeout(5000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => resolve(false));
    socket.connect(port, host);
  });
}

async function handleProvision(task: any): Promise<void> {
  const { tenantId, payload } = task;
  const { type, mode } = payload;
  const namespace = `metl-${tenantId}`;

  if (mode === 'metl') {
    switch (type) {
      case 'postgres': {
        const password = generatePassword();
        await applyPostgresStack(namespace, password);
        await waitForStatefulSet(namespace, 'supabase-db');

        const endpoint = `supabase-db.${namespace}.svc.cluster.local`;
        const dbUrl = `postgres://postgres:${password}@${endpoint}:5432/postgres`;

        await createSecret(namespace, `${tenantId}-db-secret`, {
          DATABASE_URL: dbUrl,
          DATABASE_PASSWORD: password,
        });

        await prisma.resource.create({
          data: {
            tenantId,
            type: 'postgres',
            mode: 'metl',
            status: 'running',
            endpoint,
            credentials: { user: 'postgres', password, database: 'postgres' },
          },
        });
        break;
      }
      case 'blob': {
        const accessKey = `MINIO_${tenantId.slice(0, 8).toUpperCase()}`;
        const secretKey = generatePassword();
        await applyMinioStack(namespace, accessKey, secretKey);
        await waitForDeployment(namespace, 'minio-core');

        const endpoint = `minio-core.${namespace}.svc.cluster.local:9000`;

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
        break;
      }
      case 'mail': {
        const dbResource = await prisma.resource.findFirst({
          where: { tenantId, type: 'postgres', mode: 'metl' },
        });
        const dbPassword = dbResource ? (dbResource.credentials as any)?.password || '' : '';
        const dbUrl = `postgres://postgres:${dbPassword}@supabase-db.${namespace}.svc.cluster.local:5432/postgres`;

        await applyListmonkStack(namespace, dbUrl);
        await waitForDeployment(namespace, 'listmonk');

        const endpoint = `listmonk.${namespace}.svc.cluster.local:9000`;
        await prisma.resource.create({
          data: {
            tenantId,
            type: 'mail',
            mode: 'metl',
            status: 'running',
            endpoint,
          },
        });
        break;
      }
      case 'auth': {
        const adminUser = 'metl-admin';
        const adminPassword = generatePassword();
        const dbResource = await prisma.resource.findFirst({
          where: { tenantId, type: 'postgres', mode: 'metl' },
        });
        const dbPassword = dbResource ? (dbResource.credentials as any)?.password || '' : '';
        const dbUrl = `postgres://postgres:${dbPassword}@supabase-db.${namespace}.svc.cluster.local:5432/postgres`;

        await applyKeycloakStack(namespace, adminUser, adminPassword, dbUrl);
        await waitForDeployment(namespace, 'keycloak');

        const endpoint = `keycloak.${namespace}.svc.cluster.local:8080`;
        await prisma.resource.create({
          data: {
            tenantId,
            type: 'auth',
            mode: 'metl',
            status: 'running',
            endpoint,
            credentials: { adminUser, adminPassword },
          },
        });
        break;
      }
      case 'monitoring': {
        await applyOtelCollectorStack(namespace);
        await waitForDeployment(namespace, 'otel-collector');

        const endpoint = `otel-collector.${namespace}.svc.cluster.local:4317`;
        await prisma.resource.create({
          data: {
            tenantId,
            type: 'monitoring',
            mode: 'metl',
            status: 'running',
            endpoint,
          },
        });
        break;
      }
      default:
        logger.warn({ type }, 'Unknown resource type for metl provisioning');
    }
  } else if (mode === 'byok') {
    const { endpoint, credentials } = payload;
    const [host, portStr] = endpoint.split(':');
    const isValid = await validateExternalConnection(host, parseInt(portStr || '443'));

    if (!isValid) {
      throw new Error(`Cannot connect to external resource at ${endpoint}`);
    }

    await prisma.resource.create({
      data: {
        tenantId,
        type,
        mode: 'byok',
        status: 'running',
        endpoint,
        credentials,
      },
    });

    // Store BYOK key in K8s secret for the orchestration agent to reference
    if (credentials?.apiKey) {
      await createSecret(namespace, `${tenantId}-byok-${type}`, {
        API_KEY: credentials.apiKey,
      });
    }
  }

  // Emit visual-twin event for provisioning
  await bus.publish('events.visual.twin.provision_db_stack', {
    eventType: 'PROVISION_DB_STACK',
    tenantId,
    resourceType: type,
    mode,
    nodeId: `${type}-${tenantId}`,
    status: 'success',
    timestamp: new Date().toISOString(),
  });

  logger.info({ tenantId, type, mode }, 'Resource provisioned');
}

async function main() {
  await bus.connect();
  logger.info('Resource Allocator connected to NATS');

  await bus.subscribe('tasks.resource.provision', 'resource-allocator', handleProvision);

  logger.info('Resource Allocator listening');
}

function shutdown(signal: string) {
  logger.info({ signal }, 'Resource Allocator shutting down gracefully');
  bus.close().catch(() => null);
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

main().catch((err) => {
  logger.error({ err }, 'Failed to start Resource Allocator');
  process.exit(1);
});
