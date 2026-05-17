import { Router, Request, Response } from 'express';
import { prisma } from '@metl/db';
import { logger } from '@metl/logger';
import crypto from 'crypto';

const router = Router();

const DODO_WEBHOOK_KEY = (process.env.DODO_PAYMENTS_WEBHOOK_KEY || '').replace(/^whsec_/, '');

function verifyDodoSignature(payload: string, signature: string): boolean {
  if (!DODO_WEBHOOK_KEY) {
    logger.warn('DODO_PAYMENTS_WEBHOOK_KEY not set — skipping webhook verification');
    return false;
  }
  const expected = crypto.createHmac('sha256', DODO_WEBHOOK_KEY).update(payload).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// POST /api/webhooks/dodo
router.post('/', async (req: Request, res: Response) => {
  const signature = req.headers['x-dodo-signature'] as string | undefined;
  const rawBody = JSON.stringify(req.body);

  if (signature && !verifyDodoSignature(rawBody, signature)) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  const event = req.body as any;
  if (!event || !event.type) {
    res.status(400).json({ error: 'Missing event type' });
    return;
  }

  logger.info({ type: event.type }, 'Received Dodo webhook');

  try {
    switch (event.type) {
      case 'payment.succeeded':
        await handlePaymentSucceeded(event);
        break;
      case 'payment.failed':
        await handlePaymentFailed(event);
        break;
      case 'subscription.active':
        await handleSubscriptionActive(event);
        break;
      case 'subscription.renewed':
        await handleSubscriptionRenewed(event);
        break;
      case 'subscription.canceled':
        await handleSubscriptionCanceled(event);
        break;
      case 'subscription.failed':
        await handleSubscriptionFailed(event);
        break;
      case 'credit.added':
      case 'credit.deducted':
        logger.info({ event }, 'Credit event received');
        break;
      default:
        logger.info({ type: event.type }, 'Unhandled Dodo webhook event');
    }

    res.json({ received: true });
  } catch (err: any) {
    logger.error({ err, eventType: event.type }, 'Webhook handler error');
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

async function getTenantFromMetadata(metadata: any): Promise<{ tenantId: string; userId: string; plan: string } | null> {
  if (metadata?.tenant_id && metadata?.user_id) {
    return { tenantId: metadata.tenant_id, userId: metadata.user_id, plan: metadata.plan || 'pro' };
  }
  return null;
}

async function handlePaymentSucceeded(event: any) {
  const data = event.data;
  const checkoutData = data?.checkout || {};
  const metadata = checkoutData.metadata || {};
  const tenantInfo = await getTenantFromMetadata(metadata);

  if (tenantInfo) {
    logger.info({ tenantId: tenantInfo.tenantId, paymentId: data.id }, 'Payment succeeded');
  }
}

async function handlePaymentFailed(event: any) {
  logger.warn({ paymentId: event.data?.id, reason: event.data?.failure_reason }, 'Payment failed');
}

async function handleSubscriptionActive(event: any) {
  const data = event.data;
  const customer = data.customer || {};
  const productId = data.product_id;

  // Determine plan from product ID mapping
  let plan = 'pro';
  if (productId === process.env.NEXT_PUBLIC_DODO_PLUS_PRODUCT_ID) plan = 'plus';

  const tenantInfo = await getTenantFromMetadata(data.metadata || {});
  if (!tenantInfo) {
    logger.warn('subscription.active: no tenant metadata found');
    return;
  }

  const limitsByPlan: Record<string, any> = {
    pro: { maxProjects: 5, maxMemoryMb: 2048, allowEjection: true, allowAdvancedGlassBox: true, allowMeteredBilling: false },
    plus: { maxProjects: 0, maxMemoryMb: 8192, allowEjection: true, allowAdvancedGlassBox: true, allowMeteredBilling: true },
  };

  const limits = limitsByPlan[plan] || limitsByPlan.pro;

  // Upsert subscription
  const existingSub = await prisma.subscription.findFirst({
    where: { tenantId: tenantInfo.tenantId },
    orderBy: { createdAt: 'desc' },
  });

  if (existingSub) {
    await prisma.subscription.update({
      where: { id: existingSub.id },
      data: {
        dodoSubscriptionId: data.id,
        dodoCustomerId: customer.id,
        plan,
        status: 'active',
        currentPeriodEnd: data.current_period_end ? new Date(data.current_period_end * 1000) : null,
        cancelAtPeriodEnd: false,
      },
    });
  } else {
    await prisma.subscription.create({
      data: {
        userId: tenantInfo.userId,
        tenantId: tenantInfo.tenantId,
        dodoSubscriptionId: data.id,
        dodoCustomerId: customer.id,
        plan,
        status: 'active',
        currentPeriodEnd: data.current_period_end ? new Date(data.current_period_end * 1000) : null,
      },
    });
  }

  // Update tenant limits
  await prisma.tenant.update({
    where: { id: tenantInfo.tenantId },
    data: { plan, ...limits },
  });

  logger.info({ tenantId: tenantInfo.tenantId, plan, subscriptionId: data.id }, 'Subscription activated');
}

async function handleSubscriptionRenewed(event: any) {
  const data = event.data;
  const sub = await prisma.subscription.findUnique({ where: { dodoSubscriptionId: data.id } });
  if (sub) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'active',
        currentPeriodEnd: data.current_period_end ? new Date(data.current_period_end * 1000) : null,
      },
    });
    logger.info({ subscriptionId: data.id }, 'Subscription renewed');
  }
}

async function handleSubscriptionCanceled(event: any) {
  const data = event.data;
  const sub = await prisma.subscription.findUnique({ where: { dodoSubscriptionId: data.id } });
  if (sub) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'canceled', canceledAt: new Date() },
    });
    // Downgrade tenant to free
    await prisma.tenant.update({
      where: { id: sub.tenantId },
      data: { plan: 'free', maxProjects: 1, maxMemoryMb: 512, allowEjection: false, allowAdvancedGlassBox: false, allowMeteredBilling: false },
    });
    logger.info({ subscriptionId: data.id, tenantId: sub.tenantId }, 'Subscription canceled, tenant downgraded');
  }
}

async function handleSubscriptionFailed(event: any) {
  const data = event.data;
  const sub = await prisma.subscription.findUnique({ where: { dodoSubscriptionId: data.id } });
  if (sub) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'past_due' },
    });
    logger.warn({ subscriptionId: data.id }, 'Subscription payment failed');
  }
}

export { router as dodoWebhookRouter };
