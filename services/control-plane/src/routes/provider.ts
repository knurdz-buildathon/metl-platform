import { Router, Request, Response } from 'express';
import { prisma } from '@metl/db';
import { bus } from '@metl/bus';
import { logger } from '@metl/logger';
import { ProviderMatrixSchema } from '@metl/types';

const router = Router();

// GET /api/provider/:tenantId
router.get('/:tenantId', async (req: Request, res: Response) => {
  try {
    const matrix = await prisma.providerMatrix.findUnique({
      where: { tenantId: req.params.tenantId },
    });
    if (!matrix) {
      res.json({
        database: { mode: 'metl', provider: 'metl_supabase' },
        storage: { mode: 'metl', provider: 'metl_minio' },
        mail: { mode: 'metl', provider: 'metl_listmonk' },
        monitoring: { mode: 'metl', provider: 'metl_signoz_otel' },
        auth: { mode: 'metl', provider: 'metl_keycloak' },
        hosting: { mode: 'metl', provider: 'metl_k3s_traefik' },
      });
      return;
    }
    res.json({
      database: { mode: matrix.databaseMode, provider: matrix.databaseConfig?.provider, ...matrix.databaseConfig },
      storage: { mode: matrix.storageMode, provider: matrix.storageConfig?.provider, ...matrix.storageConfig },
      mail: { mode: matrix.mailMode, provider: matrix.mailConfig?.provider, ...matrix.mailConfig },
      monitoring: { mode: matrix.monitoringMode, provider: matrix.monitoringConfig?.provider, ...matrix.monitoringConfig },
      auth: { mode: matrix.authMode, provider: matrix.authConfig?.provider, ...matrix.authConfig },
      hosting: { mode: matrix.hostingMode, provider: matrix.hostingConfig?.provider, ...matrix.hostingConfig },
    });
  } catch (err: any) {
    logger.error({ err, tenantId: req.params.tenantId }, 'Failed to get provider matrix');
    res.status(500).json({ error: { code: 'ERR_PROVIDER_GET', message: 'Failed to get provider matrix', details: err?.message || null } });
  }
});

// PUT /api/provider/:tenantId
router.put('/:tenantId', async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const validated = ProviderMatrixSchema.partial().parse(data);

    const updateData: any = {};
    if (validated.database) {
      updateData.databaseMode = validated.database.mode;
      updateData.databaseConfig = validated.database;
    }
    if (validated.storage) {
      updateData.storageMode = validated.storage.mode;
      updateData.storageConfig = validated.storage;
    }
    if (validated.mail) {
      updateData.mailMode = validated.mail.mode;
      updateData.mailConfig = validated.mail;
    }
    if (validated.monitoring) {
      updateData.monitoringMode = validated.monitoring.mode;
      updateData.monitoringConfig = validated.monitoring;
    }
    if (validated.auth) {
      updateData.authMode = validated.auth.mode;
      updateData.authConfig = validated.auth;
    }
    if (validated.hosting) {
      updateData.hostingMode = validated.hosting.mode;
      updateData.hostingConfig = validated.hosting;
    }

    const matrix = await prisma.providerMatrix.upsert({
      where: { tenantId: req.params.tenantId },
      create: {
        tenantId: req.params.tenantId,
        databaseMode: 'metl',
        storageMode: 'metl',
        mailMode: 'metl',
        monitoringMode: 'metl',
        authMode: 'metl',
        hostingMode: 'metl',
        ...updateData,
      },
      update: updateData,
    });

    // Publish orchestration task
    await bus.publish('tasks.orchestrate.apply', {
      tenantId: req.params.tenantId,
      payload: { providerMatrix: validated },
    });

    res.json({ matrix });
  } catch (err: any) {
    logger.error({ err, tenantId: req.params.tenantId }, 'Failed to update provider matrix');
    res.status(500).json({ error: { code: 'ERR_PROVIDER_UPDATE', message: 'Failed to update provider matrix', details: err?.message || null } });
  }
});

export { router as providerRouter };
