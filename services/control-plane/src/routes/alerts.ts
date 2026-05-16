import { Router, Request, Response } from 'express';
import { prisma } from '@metl/db';
import { logger } from '@metl/logger';

const router = Router();

// POST /api/alerts
router.post('/', async (req: Request, res: Response) => {
  try {
    const { alerts } = req.body;
    if (!Array.isArray(alerts)) {
      res.status(400).json({ error: 'alerts must be an array' });
      return;
    }

    for (const alert of alerts) {
      const severity = alert.labels?.severity || 'warning';
      const category = alert.labels?.alertname || 'unknown';
      const message = alert.annotations?.summary || alert.annotations?.description || 'No details';
      const tenantId = alert.labels?.tenant_id || 'unknown';

      await prisma.incident.create({
        data: {
          tenantId,
          severity,
          category,
          message,
          source: 'prometheus',
        },
      });
    }

    res.json({ received: alerts.length });
  } catch (err: any) {
    logger.error({ err }, 'Alert processing error');
    res.status(500).json({ error: { code: 'ERR_ALERT_PROCESS', message: 'Alert processing failed', details: err?.message || null } });
  }
});

// POST /api/alerts/critical
router.post('/critical', async (req: Request, res: Response) => {
  try {
    const { alerts } = req.body;
    if (!Array.isArray(alerts)) {
      res.status(400).json({ error: { code: 'ERR_VALIDATION', message: 'alerts must be an array', details: null } });
      return;
    }

    for (const alert of alerts) {
      const message = alert.annotations?.summary || 'Critical alert';
      const tenantId = alert.labels?.tenant_id || 'unknown';

      await prisma.incident.create({
        data: {
          tenantId,
          severity: 'critical',
          category: alert.labels?.alertname || 'critical',
          message,
          source: 'prometheus-critical',
        },
      });
    }

    res.json({ received: alerts.length });
  } catch (err: any) {
    logger.error({ err }, 'Critical alert processing error');
    res.status(500).json({ error: { code: 'ERR_ALERT_PROCESS', message: 'Critical alert processing failed', details: err?.message || null } });
  }
});

export { router as alertsRouter };
