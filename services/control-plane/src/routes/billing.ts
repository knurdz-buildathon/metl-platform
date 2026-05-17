import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '@metl/db';
import { logger } from '@metl/logger';
import { requireAuth } from '../middleware/auth';
import { planGate } from '../middleware/plan-gate';

const router = Router();

const DODO_API_BASE =
  process.env.DODO_PAYMENTS_ENVIRONMENT === 'live_mode'
    ? 'https://live.dodopayments.com'
    : 'https://test.dodopayments.com';

const DODO_API_KEY = process.env.DODO_PAYMENTS_API_KEY || '';
const DODO_RETURN_URL = process.env.DODO_RETURN_URL || 'http://localhost:3000/billing/success';
const DODO_CANCEL_URL = process.env.DODO_CANCEL_URL || 'http://localhost:3000/billing/failure';

function handleValidation(req: Request, res: Response, next: () => void): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      error: { code: 'ERR_VALIDATION', message: 'Validation failed', details: errors.array() },
    });
    return;
  }
  next();
}

// GET /api/billing/plans — public
router.get('/plans', (_req: Request, res: Response) => {
  res.json({
    plans: [
      {
        id: 'free',
        name: 'Free',
        price: 0,
        billing: 'monthly',
        features: [
          'Up to 1 project',
          '512 MB memory limit',
          'Community support',
          'Basic Glass Box',
        ],
        limits: {
          maxProjects: 1,
          maxMemoryMb: 512,
          allowEjection: false,
          allowAdvancedGlassBox: false,
          allowMeteredBilling: false,
        },
      },
      {
        id: 'pro',
        name: 'Pro',
        price: 20,
        billing: 'monthly',
        features: [
          'Up to 5 projects',
          '2 GB memory limit',
          'Priority support',
          'Advanced Glass Box',
          'Ejection Engine access',
        ],
        limits: {
          maxProjects: 5,
          maxMemoryMb: 2048,
          allowEjection: true,
          allowAdvancedGlassBox: true,
          allowMeteredBilling: false,
        },
      },
      {
        id: 'plus',
        name: 'Plus',
        price: 'metered',
        billing: 'pay_as_you_go',
        meter_rate_cents: 5, // configurable e.g. per deployment-minute
        meter_unit: 'deployment_minutes',
        features: [
          'Unlimited projects',
          '8 GB memory limit',
          'Dedicated support',
          'All features unlocked',
          'Custom SLAs',
          'Volume billing via Dodo',
        ],
        limits: {
          maxProjects: 0, // unlimited
          maxMemoryMb: 8192,
          allowEjection: true,
          allowAdvancedGlassBox: true,
          allowMeteredBilling: true,
        },
      },
    ],
  });
});

// POST /api/billing/checkout — create a Dodo checkout session
router.post(
  '/checkout',
  requireAuth,
  [body('plan').isIn(['pro', 'plus']).withMessage('plan must be pro or plus'), handleValidation],
  async (req: Request, res: Response) => {
    try {
      const { plan } = req.body;
      const productId =
        plan === 'pro'
          ? process.env.NEXT_PUBLIC_DODO_PRO_PRODUCT_ID
          : process.env.NEXT_PUBLIC_DODO_PLUS_PRODUCT_ID;

      if (!productId) {
        res.status(500).json({
          error: { code: 'ERR_MISSING_PRODUCT', message: 'Product ID not configured', details: null },
        });
        return;
      }

      const checkoutBody: Record<string, unknown> = {
        product_cart: [{ product_id: productId, quantity: 1 }],
        customer: {
          email: req.user!.email,
          name: req.user!.email.split('@')[0],
        },
        return_url: DODO_RETURN_URL,
        cancel_url: DODO_CANCEL_URL,
        metadata: {
          checkout_type: 'subscription',
          plan,
          user_id: req.user!.userId,
          tenant_id: req.user!.tenantId,
        },
      };

      if (plan !== 'plus') {
        (checkoutBody as any).subscription_data = { trial_period_days: 0 };
      }

      const dodoRes = await fetch(`${DODO_API_BASE}/checkout/sessions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${DODO_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(checkoutBody),
      });

      const dodoData = await dodoRes.json() as any;
      if (!dodoRes.ok) {
        logger.error({ dodoData }, 'Dodo checkout session creation failed');
        res.status(500).json({
          error: { code: 'ERR_CHECKOUT_FAILED', message: 'Failed to create checkout session', details: dodoData },
        });
        return;
      }

      res.json({ checkoutUrl: dodoData.checkout_url });
    } catch (err: any) {
      logger.error({ err }, 'Billing checkout failed');
      res.status(500).json({
        error: { code: 'ERR_CHECKOUT_FAILED', message: 'Failed to create checkout session', details: err?.message },
      });
    }
  }
);

// GET /api/billing/subscription
router.get('/subscription', requireAuth, async (req: Request, res: Response) => {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: { tenantId: req.user!.tenantId },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      res.status(404).json({
        error: { code: 'ERR_NO_SUBSCRIPTION', message: 'No subscription found', details: null },
      });
      return;
    }

    res.json({ subscription });
  } catch (err: any) {
    logger.error({ err }, 'Failed to get subscription');
    res.status(500).json({ error: { code: 'ERR_SUB_GET', message: 'Failed to get subscription', details: err?.message } });
  }
});

// POST /api/billing/cancel — cancel at period end
router.post('/cancel', requireAuth, async (req: Request, res: Response) => {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: { tenantId: req.user!.tenantId, status: 'active' },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription || !subscription.dodoSubscriptionId) {
      res.status(404).json({
        error: { code: 'ERR_NO_ACTIVE_SUB', message: 'No active subscription to cancel', details: null },
      });
      return;
    }

    const dodoRes = await fetch(`${DODO_API_BASE}/subscriptions/${subscription.dodoSubscriptionId}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DODO_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!dodoRes.ok) {
      const dodoData = await dodoRes.json().catch(() => ({}));
      res.status(500).json({
        error: { code: 'ERR_CANCEL_FAILED', message: 'Failed to cancel subscription', details: dodoData },
      });
      return;
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { cancelAtPeriodEnd: true },
    });

    res.json({ success: true, message: 'Subscription will be canceled at the end of the billing period.' });
  } catch (err: any) {
    logger.error({ err }, 'Failed to cancel subscription');
    res.status(500).json({ error: { code: 'ERR_CANCEL_FAILED', message: 'Failed to cancel', details: err?.message } });
  }
});

// POST /api/billing/usage — INTERNAL ONLY: track a usage event for metered billing
router.post(
  '/usage',
  requireAuth,
  planGate('plus'),
  [
    body('eventName').isString().trim().isLength({ min: 1 }).withMessage('eventName is required'),
    body('quantity').optional().isInt({ min: 1 }).withMessage('quantity must be a positive integer'),
    handleValidation,
  ],
  async (req: Request, res: Response) => {
    try {
      const { eventName, quantity = 1, metadata } = req.body;

      const event = await prisma.usageEvent.create({
        data: {
          tenantId: req.user!.tenantId,
          eventType: 'metered',
          eventName,
          quantity,
          metadata: metadata || {},
        },
      });

      // Async fire-and-forget to Dodo meter events
      syncUsageToDodo(event.id).catch((err) => logger.error({ err }, 'Background Dodo sync failed'));

      res.status(201).json({ event });
    } catch (err: any) {
      logger.error({ err }, 'Failed to track usage event');
      res.status(500).json({
        error: { code: 'ERR_USAGE_TRACK', message: 'Failed to track usage', details: err?.message },
      });
    }
  }
);

// GET /api/billing/usage — get usage events for the current tenant
router.get('/usage', requireAuth, async (req: Request, res: Response) => {
  try {
    const events = await prisma.usageEvent.findMany({
      where: { tenantId: req.user!.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ events });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'ERR_USAGE_GET', message: 'Failed to get usage', details: err?.message },
    });
  }
});

// --- Internal: sync local usage event to Dodo meter events endpoint ---
async function syncUsageToDodo(eventId: string) {
  const event = await prisma.usageEvent.findUnique({ where: { id: eventId } });
  if (!event || event.syncedToDodo) return;

  const tenant = await prisma.tenant.findUnique({ where: { id: event.tenantId } });
  if (!tenant || !tenant.allowMeteredBilling) return;

  const sub = await prisma.subscription.findFirst({
    where: { tenantId: event.tenantId, status: 'active', plan: 'plus' },
    orderBy: { createdAt: 'desc' },
  });
  if (!sub || !sub.dodoSubscriptionId) return;

  const payload = {
    subscription_id: sub.dodoSubscriptionId,
    event_name: event.eventName,
    quantity: event.quantity,
    metadata: event.metadata || {},
  };

  const res = await fetch(`${DODO_API_BASE}/events/ingest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${DODO_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (res.ok) {
    const data = await res.json() as any;
    await prisma.usageEvent.update({
      where: { id: event.id },
      data: {
        syncedToDodo: true,
        dodoEventId: data?.event_id || data?.id,
      },
    });
  } else {
    const errBody = await res.text();
    logger.error({ status: res.status, body: errBody }, 'Dodo meter event ingestion failed');
  }
}

export { router as billingRouter, syncUsageToDodo };
