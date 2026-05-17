import type { Request, Response, NextFunction } from 'express';

const PLAN_TIERS: Record<string, number> = {
  free: 0,
  pro: 1,
  plus: 2,
};

/**
 * Require a minimum subscription plan tier.
 * Must be used AFTER requireAuth middleware.
 */
export function planGate(requiredPlan: 'free' | 'pro' | 'plus') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        error: { code: 'ERR_UNAUTHORIZED', message: 'Authentication required', details: null },
      });
      return;
    }

    const userTier = PLAN_TIERS[req.user.plan] ?? 0;
    const requiredTier = PLAN_TIERS[requiredPlan] ?? 0;

    if (userTier < requiredTier) {
      res.status(403).json({
        error: {
          code: 'ERR_PLAN_UPGRADE_REQUIRED',
          message: `This feature requires the ${requiredPlan} plan. Please upgrade.`,
          details: { currentPlan: req.user.plan, requiredPlan },
        },
      });
      return;
    }

    next();
  };
}
