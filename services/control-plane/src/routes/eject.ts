import { Router, Request, Response } from 'express';
import { prisma } from '@metl/db';
import { bus } from '@metl/bus';
import { logger } from '@metl/logger';
import fs from 'fs';
import path from 'path';

const router = Router();

// POST /api/eject/:tenantId
router.post('/:tenantId', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    const deployment = await prisma.deployment.findFirst({
      where: { tenantId },
      include: { resources: true },
    });

    if (!deployment) {
      res.status(404).json({ error: 'No deployment found for tenant' });
      return;
    }

    // Check if a completed ejection already exists
    const zipPath = path.join('/tmp', `metl-eject-${tenantId}.zip`);
    if (fs.existsSync(zipPath)) {
      // Remove old zip to force regeneration
      fs.unlinkSync(zipPath);
    }

    // Publish ejection task
    await bus.publish('tasks.eject', {
      tenantId,
      payload: { deploymentId: deployment.id },
    });

    res.json({ status: 'started', message: 'Ejection process started. Poll GET /api/eject/:tenantId/status for progress.' });
  } catch (err: any) {
    logger.error({ err, tenantId: req.params.tenantId }, 'Ejection error');
    res.status(500).json({ error: { code: 'ERR_EJECT', message: 'Ejection failed', details: err?.message || null } });
  }
});

// GET /api/eject/:tenantId/status
router.get('/:tenantId/status', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const zipPath = path.join('/tmp', `metl-eject-${tenantId}.zip`);

    if (fs.existsSync(zipPath)) {
      const stats = fs.statSync(zipPath);
      res.json({
        status: 'complete',
        downloadUrl: `/api/eject/${tenantId}/download`,
        sizeBytes: stats.size,
        generatedAt: stats.mtime.toISOString(),
      });
      return;
    }

    res.json({ status: 'processing', message: 'Ejection is still in progress' });
  } catch (err: any) {
    logger.error({ err, tenantId: req.params.tenantId }, 'Ejection status error');
    res.status(500).json({ error: { code: 'ERR_EJECT_STATUS', message: 'Failed to get ejection status', details: err?.message || null } });
  }
});

// GET /api/eject/:tenantId/download
router.get('/:tenantId/download', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const zipPath = path.join('/tmp', `metl-eject-${tenantId}.zip`);

    if (!fs.existsSync(zipPath)) {
      res.status(404).json({ error: 'Ejection package not found' });
      return;
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="metl-eject-${tenantId}.zip"`);
    const stream = fs.createReadStream(zipPath);
    stream.pipe(res);
  } catch (err: any) {
    logger.error({ err, tenantId: req.params.tenantId }, 'Ejection download error');
    res.status(500).json({ error: { code: 'ERR_EJECT_DOWNLOAD', message: 'Failed to download ejection package', details: err?.message || null } });
  }
});

export { router as ejectRouter };
