import { Router, Request, Response } from 'express';
import { prisma } from '@metl/db';
import { logger } from '@metl/logger';

const router = Router();

// GET /api/incidents
router.get('/', async (req: Request, res: Response) => {
  try {
    const { tenantId, severity, resolved } = req.query;
    const incidents = await prisma.incident.findMany({
      where: {
        tenantId: tenantId ? String(tenantId) : undefined,
        severity: severity ? String(severity) : undefined,
        resolvedAt: resolved === 'true' ? { not: null } : resolved === 'false' ? null : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ incidents });
  } catch (err: any) {
    logger.error({ err }, 'Failed to list incidents');
    res.status(500).json({ error: { code: 'ERR_INCIDENT_LIST', message: 'Failed to list incidents', details: err?.message || null } });
  }
});

// POST /api/incidents/:id/resolve
router.post('/:id/resolve', async (req: Request, res: Response) => {
  try {
    const incident = await prisma.incident.update({
      where: { id: req.params.id },
      data: { resolvedAt: new Date() },
    });
    res.json({ incident });
  } catch (err: any) {
    logger.error({ err, id: req.params.id }, 'Failed to resolve incident');
    res.status(500).json({ error: { code: 'ERR_INCIDENT_RESOLVE', message: 'Failed to resolve incident', details: err?.message || null } });
  }
});

export { router as incidentsRouter };
