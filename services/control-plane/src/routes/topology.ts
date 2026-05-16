import { Router, Request, Response } from 'express';
import { getTopology } from '@metl/k8s';
import { logger } from '@metl/logger';

const router = Router();

// GET /api/topology/:tenantId
router.get('/:tenantId', async (req: Request, res: Response) => {
  try {
    const namespace = `metl-${req.params.tenantId}`;
    const topology = await getTopology(namespace);

    // Transform K8s resources to React Flow format
    const nodes = [];
    const edges = [];

    for (const pod of topology.pods) {
      const podId = `pod-${pod.metadata?.name}`;
      nodes.push({
        id: podId,
        type: 'pod',
        label: pod.metadata?.name || 'Pod',
        status: pod.status?.phase?.toLowerCase() || 'pending',
        metadata: {
          image: pod.spec?.containers?.[0]?.image,
          restarts: pod.status?.containerStatuses?.[0]?.restartCount || 0,
        },
      });
    }

    for (const service of topology.services) {
      const svcId = `svc-${service.metadata?.name}`;
      nodes.push({
        id: svcId,
        type: 'service',
        label: service.metadata?.name || 'Service',
        status: 'running',
        metadata: {
          clusterIP: service.spec?.clusterIP,
          ports: service.spec?.ports,
        },
      });
    }

    for (const ingress of topology.ingresses) {
      const ingId = `ing-${ingress.metadata?.name}`;
      nodes.push({
        id: ingId,
        type: 'ingress',
        label: ingress.metadata?.name || 'Ingress',
        status: 'running',
        metadata: {
          hosts: ingress.spec?.rules?.map((r: any) => r.host),
        },
      });
    }

    for (const deploy of topology.deployments) {
      const depId = `deploy-${deploy.metadata?.name}`;
      nodes.push({
        id: depId,
        type: 'deployment',
        label: deploy.metadata?.name || 'Deployment',
        status: deploy.status?.readyReplicas === deploy.spec?.replicas ? 'running' : 'pending',
        metadata: {
          replicas: deploy.spec?.replicas,
          ready: deploy.status?.readyReplicas,
        },
      });
    }

    res.json({ nodes, edges });
  } catch (err: any) {
    logger.error({ err, tenantId: req.params.tenantId }, 'Failed to get topology');
    res.status(500).json({ error: { code: 'ERR_TOPOLOGY_GET', message: 'Failed to get topology', details: err?.message || null } });
  }
});

export { router as topologyRouter };
