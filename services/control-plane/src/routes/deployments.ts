import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { prisma } from '@metl/db';
import { bus } from '@metl/bus';
import { logger } from '@metl/logger';

const router = Router();

function handleValidation(req: Request, res: Response, next: () => void): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      error: {
        code: 'ERR_VALIDATION',
        message: 'Validation failed',
        details: errors.array(),
      },
    });
    return;
  }
  next();
}

// GET /api/deployments
router.get('/', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.query;
    const deployments = await prisma.deployment.findMany({
      where: tenantId ? { tenantId: String(tenantId) } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    res.json({ deployments });
  } catch (err) {
    logger.error({ err }, 'Failed to list deployments');
    res.status(500).json({ error: 'Failed to list deployments' });
  }
});

// GET /api/deployments/:id
router.get('/:id', param('id').isUUID().withMessage('id must be a valid UUID'), handleValidation, async (req: Request, res: Response) => {
  try {
    const deployment = await prisma.deployment.findUnique({
      where: { id: req.params.id },
      include: { resources: true },
    });
    if (!deployment) {
      res.status(404).json({ error: { code: 'ERR_NOT_FOUND', message: 'Deployment not found', details: null } });
      return;
    }
    res.json({ deployment });
  } catch (err: any) {
    logger.error({ err, id: req.params.id }, 'Failed to get deployment');
    res.status(500).json({
      error: { code: 'ERR_DEPLOY_GET', message: 'Failed to get deployment', details: err?.message || null },
    });
  }
});

// POST /api/deployments
router.post(
  '/',
  [
    body('tenantId').isUUID().withMessage('tenantId must be a valid UUID'),
    body('name').trim().isLength({ min: 1, max: 100 }).withMessage('name is required (1-100 chars)'),
    body('slug').trim().matches(/^[a-z0-9-]+$/).withMessage('slug must be lowercase alphanumeric with hyphens'),
    body('gitUrl').isURL().withMessage('gitUrl must be a valid URL'),
    body('branch').optional().isString().trim(),
    body('scalingTier').optional().isIn(['warm', 'cold']).withMessage('scalingTier must be warm or cold'),
    body('memoryLimitMb').optional().isInt({ min: 128 }).withMessage('memoryLimitMb must be >= 128'),
    handleValidation,
  ],
  async (req: Request, res: Response) => {
    try {
      const { tenantId, name, slug, gitUrl, branch = 'main', scalingTier = 'warm', memoryLimitMb = 512 } = req.body;

      const deployment = await prisma.deployment.create({
        data: {
          tenantId,
          name,
          slug,
          gitUrl,
          branch,
          status: 'pending',
          scalingTier,
          memoryLimitMb,
        },
      });

      // Publish deploy task
      await bus.publish('tasks.deploy.build', {
        id: deployment.id,
        tenantId,
        payload: { gitUrl, branch, slug, deploymentId: deployment.id, scalingTier, memoryLimitMb },
      });

      res.status(201).json({ deployment });
    } catch (err: any) {
      logger.error({ err }, 'Failed to create deployment');
      res.status(500).json({
        error: {
          code: 'ERR_DEPLOY_CREATE',
          message: 'Failed to create deployment',
          details: err?.message || null,
        },
      });
    }
  }
);

// DELETE /api/deployments/:id
router.delete('/:id', param('id').isUUID().withMessage('id must be a valid UUID'), handleValidation, async (req: Request, res: Response) => {
  try {
    const deployment = await prisma.deployment.findUnique({
      where: { id: req.params.id },
    });
    if (!deployment) {
      res.status(404).json({ error: { code: 'ERR_NOT_FOUND', message: 'Deployment not found', details: null } });
      return;
    }

    await prisma.deployment.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    logger.error({ err, id: req.params.id }, 'Failed to delete deployment');
    res.status(500).json({
      error: { code: 'ERR_DEPLOY_DELETE', message: 'Failed to delete deployment', details: err?.message || null },
    });
  }
});

export { router as deploymentsRouter };
