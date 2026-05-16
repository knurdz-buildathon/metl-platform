import { bus } from '@metl/bus';
import { prisma } from '@metl/db';
import { logger, initTelemetry } from '@metl/logger';
import { k8sAppsApi } from '@metl/k8s';

initTelemetry();

const IDLE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

interface LastRequestMap {
  [deploymentId: string]: number;
}

const lastRequests: LastRequestMap = {};

async function checkIdleDeployments(): Promise<void> {
  const now = Date.now();
  const deployments = await prisma.deployment.findMany({
    where: { status: 'running' },
  });

  for (const deployment of deployments) {
    const lastRequest = lastRequests[deployment.id] || 0;
    const idleTime = now - lastRequest;

    if (idleTime > IDLE_THRESHOLD_MS) {
      // Scale to zero
      const namespace = `metl-${deployment.tenantId}`;
      try {
        await k8sAppsApi.readNamespacedDeployment(deployment.slug, namespace);
        await k8sAppsApi.patchNamespacedDeploymentScale(
          deployment.slug,
          namespace,
          { spec: { replicas: 0 } },
          undefined,
          undefined,
          undefined,
          undefined,
          { headers: { 'Content-Type': 'application/merge-patch+json' } }
        );

        await prisma.deployment.update({
          where: { id: deployment.id },
          data: { status: 'scaled_zero' },
        });

        // Visual Twin: suspend pod allocation (fade node to 30%)
        await bus.publish('events.visual.twin.suspend_pod', {
          eventType: 'SUSPEND_POD_ALLOCATION',
          tenantId: deployment.tenantId,
          deploymentId: deployment.id,
          slug: deployment.slug,
          reason: 'idle_timeout',
          timestamp: new Date().toISOString(),
        });

        logger.info({ deployment: deployment.slug }, 'Scaled to zero');
      } catch (err) {
        logger.error({ err, deployment: deployment.slug }, 'Failed to scale to zero');
      }
    }
  }
}

async function handleWakeUp(task: any): Promise<void> {
  const { deploymentId } = task.payload;
  const deployment = await prisma.deployment.findUnique({
    where: { id: deploymentId },
  });

  if (!deployment || deployment.status !== 'scaled_zero') return;

  const namespace = `metl-${deployment.tenantId}`;
  try {
    await k8sAppsApi.patchNamespacedDeploymentScale(
      deployment.slug,
      namespace,
      { spec: { replicas: 1 } },
      undefined,
      undefined,
      undefined,
      undefined,
      { headers: { 'Content-Type': 'application/merge-patch+json' } }
    );

    await prisma.deployment.update({
      where: { id: deployment.id },
      data: { status: 'running' },
    });

    lastRequests[deployment.id] = Date.now();
    logger.info({ deployment: deployment.slug }, 'Woke up deployment');
  } catch (err) {
    logger.error({ err, deployment: deployment.slug }, 'Failed to wake up');
  }
}

async function main() {
  await bus.connect();
  logger.info('Eco-Mode Tracker connected to NATS');

  // Check idle deployments every minute
  setInterval(checkIdleDeployments, 60000);

  // Listen for wake-up requests
  await bus.subscribe('tasks.eco.scale.up', 'eco-mode', handleWakeUp);

  logger.info('Eco-Mode Tracker running');
}

function shutdown(signal: string) {
  logger.info({ signal }, 'Eco-Mode Tracker shutting down gracefully');
  bus.close().catch(() => null);
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

main().catch((err) => {
  logger.error({ err }, 'Failed to start Eco-Mode Tracker');
  process.exit(1);
});
