import http from 'http';
import https from 'https';
import { bus } from '@metl/bus';
import { prisma } from '@metl/db';
import { logger, initTelemetry } from '@metl/logger';
import { k8sApi } from '@metl/k8s';

initTelemetry();

async function probeHttp(url: string): Promise<{ status: string; responseMs: number; statusCode?: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: 5000 }, (res) => {
      res.resume();
      resolve({
        status: res.statusCode! >= 200 && res.statusCode! < 300 ? 'healthy' : 'unhealthy',
        responseMs: Date.now() - start,
        statusCode: res.statusCode!,
      });
    });
    req.on('error', () => resolve({ status: 'unhealthy', responseMs: Date.now() - start }));
    req.on('timeout', () => resolve({ status: 'timeout', responseMs: Date.now() - start }));
  });
}

async function runHealthChecks(): Promise<void> {
  const deployments = await prisma.deployment.findMany({
    where: { status: 'running' },
  });

  for (const deployment of deployments) {
    const url = `https://${deployment.slug}.metl.run/health`;
    const result = await probeHttp(url);

    logger.info({ deployment: deployment.slug, ...result }, 'Health check');

    if (result.status !== 'healthy') {
      // Create incident
      await prisma.incident.create({
        data: {
          tenantId: deployment.tenantId,
          deploymentId: deployment.id,
          severity: result.status === 'timeout' ? 'critical' : 'warning',
          category: 'health_check_failed',
          message: `Health check failed for ${deployment.slug}: ${result.status}`,
          source: 'sre-agent',
        },
      });

      // Publish incident event
      await bus.publish('events.incidents', {
        tenantId: deployment.tenantId,
        deploymentId: deployment.id,
        severity: result.status === 'timeout' ? 'critical' : 'warning',
        message: `Health check failed: ${result.status}`,
      });

      // Visual Twin: pod reconciliation event (white pulse, spawn new pod)
      await bus.publish('events.visual.twin.reconcile_pod', {
        eventType: 'RECONCILE_POD_STATE',
        tenantId: deployment.tenantId,
        deploymentId: deployment.id,
        slug: deployment.slug,
        oldStatus: result.status,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

async function gatherMetrics(): Promise<void> {
  try {
    const pods = await k8sApi.listPodForAllNamespaces();
    const metrics = {
      totalPods: pods.body.items.length,
      runningPods: pods.body.items.filter((p) => p.status?.phase === 'Running').length,
      failedPods: pods.body.items.filter((p) => p.status?.phase === 'Failed').length,
    };

    logger.info(metrics, 'Cluster metrics');

    // Push global cluster metric event to visual twin
    await bus.publish('events.visual.twin.cluster_metrics', {
      eventType: 'GLOBAL',
      totalPods: metrics.totalPods,
      runningPods: metrics.runningPods,
      failedPods: metrics.failedPods,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err }, 'Failed to gather metrics');
  }
}

async function main() {
  await bus.connect();
  logger.info('SRE Agent connected to NATS');

  // Run health checks every 30 seconds
  setInterval(runHealthChecks, 30000);

  // Gather metrics every 60 seconds
  setInterval(gatherMetrics, 60000);

  // Initial runs
  runHealthChecks();
  gatherMetrics();

  logger.info('SRE Agent running');
}

function shutdown(signal: string) {
  logger.info({ signal }, 'SRE Agent shutting down gracefully');
  bus.close().catch(() => null);
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

main().catch((err) => {
  logger.error({ err }, 'Failed to start SRE Agent');
  process.exit(1);
});
