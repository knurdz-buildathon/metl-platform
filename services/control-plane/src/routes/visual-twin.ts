import { Router, Request, Response } from 'express';
import { prisma } from '@metl/db';
import { logger } from '@metl/logger';
import { getTopology } from '@metl/k8s';
import { getActiveClientCount } from './ws';

const router = Router();

interface VisualTwinEvent {
  id: string;
  type: string;
  tenantId: string;
  eventType: string;
  phase?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// In-memory buffer for recent events per tenant
const eventBuffers = new Map<string, VisualTwinEvent[]>();
const BUFFER_MAX = 100;

export function pushEvent(event: VisualTwinEvent): void {
  const list = eventBuffers.get(event.tenantId) || [];
  list.unshift(event);
  if (list.length > BUFFER_MAX) list.pop();
  eventBuffers.set(event.tenantId, list);
}

// GET /api/visual-twin/state/:tenantId
router.get('/state/:tenantId', async (req: Request, res: Response) => {
  try {
    const tenantId = req.params.tenantId;
    const namespace = `metl-${tenantId}`;

    const [deployment, resources, incidents, tasks, topology] = await Promise.all([
      prisma.deployment.findFirst({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.resource.findMany({ where: { tenantId } }),
      prisma.incident.findMany({
        where: { tenantId, resolvedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.task.findMany({
        where: { tenantId, status: { in: ['pending', 'running'] } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      getTopology(namespace).catch(() => ({ pods: [], services: [], ingresses: [], deployments: [] })),
    ]);

    const events = eventBuffers.get(tenantId) || [];

    res.json({
      tenantId,
      namespace,
      deployment: deployment
        ? {
            id: deployment.id,
            name: deployment.name,
            slug: deployment.slug,
            status: deployment.status,
            scalingTier: deployment.scalingTier,
            memoryLimitMb: deployment.memoryLimitMb,
            imageTag: deployment.imageTag,
          }
        : null,
      resources: resources.map((r) => ({
        id: r.id,
        type: r.type,
        mode: r.mode,
        status: r.status,
        endpoint: r.endpoint,
      })),
      activeIncidents: incidents.length,
      incidents,
      pendingTasks: tasks,
      topology: {
        pods: topology.pods.map((p: any) => ({
          name: p.metadata?.name,
          phase: p.status?.phase,
          restarts: p.status?.containerStatuses?.[0]?.restartCount || 0,
        })),
        services: topology.services.map((s: any) => ({
          name: s.metadata?.name,
          clusterIP: s.spec?.clusterIP,
        })),
        ingresses: topology.ingresses.map((i: any) => ({
          name: i.metadata?.name,
          host: i.spec?.rules?.[0]?.host,
        })),
      },
      recentEvents: events,
      activeWebSocketClients: getActiveClientCount(),
    });
  } catch (err) {
    logger.error({ err, tenantId: req.params.tenantId }, 'Failed to get visual twin state');
    res.status(500).json({ error: { code: 'VISUAL_TWIN_FAILED', message: 'Failed to get visual twin state', details: null } });
  }
});

// GET /api/visual-twin/events/:tenantId
router.get('/events/:tenantId', (req: Request, res: Response) => {
  const tenantId = req.params.tenantId;
  const events = eventBuffers.get(tenantId) || [];
  res.json({ events });
});

export { router as visualTwinRouter, pushEvent };
