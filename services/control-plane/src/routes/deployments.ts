import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { prisma } from '@metl/db';
import { bus } from '@metl/bus';
import { logger } from '@metl/logger';
import { requireAuth } from '../middleware/auth';

const router = Router();

// All deployment routes require authentication
router.use(requireAuth);

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
    const tenantId = req.user!.tenantId;
    const deployments = await prisma.deployment.findMany({
      where: { tenantId },
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
    if (!deployment || deployment.tenantId !== req.user!.tenantId) {
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
      const tenantId = req.user!.tenantId;
      const { name, slug, gitUrl, branch = 'main', scalingTier = 'warm', memoryLimitMb = 512 } = req.body;

      // Enforce plan limits: max projects
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) {
        res.status(404).json({ error: { code: 'ERR_TENANT_NOT_FOUND', message: 'Tenant not found', details: null } });
        return;
      }
      if (tenant.maxProjects > 0) {
        const existingCount = await prisma.deployment.count({ where: { tenantId } });
        if (existingCount >= tenant.maxProjects) {
          res.status(403).json({
            error: { code: 'ERR_PROJECT_LIMIT', message: `Project limit reached (${tenant.maxProjects}). Upgrade your plan for more.`, details: null },
          });
          return;
        }
      }

      // Enforce plan limits: max memory
      if (tenant.maxMemoryMb > 0 && memoryLimitMb > tenant.maxMemoryMb) {
        res.status(403).json({
          error: { code: 'ERR_MEMORY_LIMIT', message: `Memory limit exceeded. Max allowed: ${tenant.maxMemoryMb} MB.`, details: null },
        });
        return;
      }

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

      // Track usage for metered billing (Plus plan only)
      if (tenant.allowMeteredBilling) {
        await prisma.usageEvent.create({
          data: {
            tenantId,
            eventType: 'deployment',
            eventName: 'deployment.created',
            quantity: 1,
            metadata: { deploymentId: deployment.id, memoryLimitMb },
          },
        });
      }

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
    if (!deployment || deployment.tenantId !== req.user!.tenantId) {
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
