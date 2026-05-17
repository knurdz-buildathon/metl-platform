import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { prisma } from '@metl/db';
import { logger } from '@metl/logger';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  requireAuth,
  type AuthenticatedUser,
} from '../middleware/auth';

const router = Router();

const SALT_ROUNDS = 12;

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

function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 15, // 15 minutes
  });
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  });
}

function clearAuthCookies(res: Response) {
  res.clearCookie('access_token');
  res.clearCookie('refresh_token');
}

function buildUserResponse(user: AuthenticatedUser) {
  return {
    accessToken: signAccessToken(user),
    user: {
      id: user.userId,
      email: user.email,
      role: user.role,
      plan: user.plan,
    },
  };
}

// POST /api/auth/register
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Name is optional (max 100 chars)'),
    handleValidation,
  ],
  async (req: Request, res: Response) => {
    try {
      const { email, password, name } = req.body;

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        res.status(409).json({
          error: { code: 'ERR_EMAIL_EXISTS', message: 'An account with this email already exists', details: null },
        });
        return;
      }

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      // Create tenant with free plan defaults
      const tenant = await prisma.tenant.create({
        data: {
          name: name || email.split('@')[0],
          slug: `tenant-${Date.now()}`,
          email,
          plan: 'free',
          maxProjects: 1,
          maxMemoryMb: 512,
          allowEjection: false,
          allowAdvancedGlassBox: false,
          allowMeteredBilling: false,
        },
      });

      const user = await prisma.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          passwordHash,
          tenantId: tenant.id,
          role: 'user',
        },
        include: { tenant: true },
      });

      await prisma.subscription.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          plan: 'free',
          status: 'active',
        },
      });

      const userPayload: AuthenticatedUser = {
        userId: user.id,
        email: user.email,
        tenantId: user.tenantId,
        role: user.role,
        plan: user.tenant.plan,
      };

      const accessToken = signAccessToken(userPayload);
      const refreshToken = signRefreshToken({ userId: user.id });
      setAuthCookies(res, accessToken, refreshToken);

      res.status(201).json(buildUserResponse(userPayload));
    } catch (err: any) {
      logger.error({ err }, 'Registration failed');
      res.status(500).json({
        error: { code: 'ERR_REGISTER_FAILED', message: 'Failed to create account', details: err?.message },
      });
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 1 }).withMessage('Password is required'),
    handleValidation,
  ],
  async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      const user = await prisma.user.findUnique({
        where: { email },
        include: { tenant: true },
      });

      if (!user || !user.passwordHash) {
        res.status(401).json({
          error: { code: 'ERR_INVALID_CREDENTIALS', message: 'Invalid email or password', details: null },
        });
        return;
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        res.status(401).json({
          error: { code: 'ERR_INVALID_CREDENTIALS', message: 'Invalid email or password', details: null },
        });
        return;
      }

      const userPayload: AuthenticatedUser = {
        userId: user.id,
        email: user.email,
        tenantId: user.tenantId,
        role: user.role,
        plan: user.tenant.plan,
      };

      const accessToken = signAccessToken(userPayload);
      const refreshToken = signRefreshToken({ userId: user.id });
      setAuthCookies(res, accessToken, refreshToken);

      res.json(buildUserResponse(userPayload));
    } catch (err: any) {
      logger.error({ err }, 'Login failed');
      res.status(500).json({
        error: { code: 'ERR_LOGIN_FAILED', message: 'Failed to sign in', details: err?.message },
      });
    }
  }
);

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  const refreshToken = req.cookies.refresh_token || req.body?.refreshToken;
  if (!refreshToken) {
    res.status(401).json({ error: { code: 'ERR_NO_REFRESH_TOKEN', message: 'No refresh token provided', details: null } });
    return;
  }

  const decoded = verifyRefreshToken(refreshToken);
  if (!decoded) {
    clearAuthCookies(res);
    res.status(401).json({ error: { code: 'ERR_REFRESH_INVALID', message: 'Refresh token invalid or expired', details: null } });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    include: { tenant: true },
  });

  if (!user) {
    clearAuthCookies(res);
    res.status(401).json({ error: { code: 'ERR_USER_NOT_FOUND', message: 'User no longer exists', details: null } });
    return;
  }

  const userPayload: AuthenticatedUser = {
    userId: user.id,
    email: user.email,
    tenantId: user.tenantId,
    role: user.role,
    plan: user.tenant.plan,
  };

  const newAccessToken = signAccessToken(userPayload);
  const newRefreshToken = signRefreshToken({ userId: user.id });
  setAuthCookies(res, newAccessToken, newRefreshToken);

  res.json(buildUserResponse(userPayload));
});

// POST /api/auth/logout
router.post('/logout', async (_req: Request, res: Response) => {
  clearAuthCookies(res);
  res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { tenant: true, subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    if (!user) {
      res.status(404).json({ error: { code: 'ERR_NOT_FOUND', message: 'User not found', details: null } });
      return;
    }

    const subscription = user.subscriptions[0];

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
        plan: user.tenant.plan,
        tenantId: user.tenantId,
      },
      subscription: subscription
        ? {
            id: subscription.id,
            plan: subscription.plan,
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          }
        : null,
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to get /me');
    res.status(500).json({ error: { code: 'ERR_ME_FAILED', message: 'Failed to get user', details: err?.message } });
  }
});

// --- Google OAuth ---
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://metl.run/api/auth/google/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

router.get('/google', (_req: Request, res: Response) => {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  res.redirect(url.toString());
});

router.get('/google/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string | undefined;
  if (!code) {
    res.redirect(`${FRONTEND_URL}/signin?error=oauth_denied`);
    return;
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      res.redirect(`${FRONTEND_URL}/signin?error=oauth_failed`);
      return;
    }

    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const googleUser = await userRes.json() as { id: string; email: string; name?: string; picture?: string };

    let user = await prisma.user.findUnique({ where: { googleId: googleUser.id }, include: { tenant: true } });
    if (!user) {
      user = await prisma.user.findUnique({ where: { email: googleUser.email }, include: { tenant: true } });
      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId: googleUser.id, emailVerified: true },
          include: { tenant: true },
        });
      }
    }

    let isNewUser = false;
    if (!user) {
      isNewUser = true;
      const tenant = await prisma.tenant.create({
        data: {
          name: googleUser.name || googleUser.email.split('@')[0],
          slug: `tenant-${Date.now()}`,
          email: googleUser.email,
          plan: 'free',
          maxProjects: 1,
          maxMemoryMb: 512,
        },
      });
      user = await prisma.user.create({
        data: {
          email: googleUser.email,
          name: googleUser.name,
          avatarUrl: googleUser.picture,
          googleId: googleUser.id,
          emailVerified: true,
          tenantId: tenant.id,
          role: 'user',
        },
        include: { tenant: true },
      });
      await prisma.subscription.create({
        data: { userId: user.id, tenantId: tenant.id, plan: 'free', status: 'active' },
      });
    }

    const userPayload: AuthenticatedUser = {
      userId: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
      plan: user.tenant.plan,
    };

    const accessToken = signAccessToken(userPayload);
    const refreshToken = signRefreshToken({ userId: user.id });
    setAuthCookies(res, accessToken, refreshToken);

    res.redirect(`${FRONTEND_URL}/dashboard${isNewUser ? '?welcome=true' : ''}`);
  } catch (err: any) {
    logger.error({ err }, 'Google OAuth callback failed');
    res.redirect(`${FRONTEND_URL}/signin?error=oauth_failed`);
  }
});

// --- GitHub OAuth ---
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || 'https://metl.run/api/auth/github/callback';

router.get('/github', (_req: Request, res: Response) => {
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', GITHUB_CLIENT_ID);
  url.searchParams.set('redirect_uri', GITHUB_REDIRECT_URI);
  url.searchParams.set('scope', 'read:user user:email');
  res.redirect(url.toString());
});

router.get('/github/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string | undefined;
  if (!code) {
    res.redirect(`${FRONTEND_URL}/signin?error=oauth_denied`);
    return;
  }

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: GITHUB_REDIRECT_URI,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      res.redirect(`${FRONTEND_URL}/signin?error=oauth_failed`);
      return;
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    const githubUser = await userRes.json() as any;

    let primaryEmail = githubUser.email;
    if (!primaryEmail) {
      const emailRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });
      const emails = await emailRes.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
      primaryEmail = emails.find((e) => e.primary && e.verified)?.email || emails[0]?.email;
    }

    if (!primaryEmail) {
      res.redirect(`${FRONTEND_URL}/signin?error=oauth_no_email`);
      return;
    }

    let user = await prisma.user.findUnique({ where: { githubId: String(githubUser.id) }, include: { tenant: true } });
    if (!user) {
      user = await prisma.user.findUnique({ where: { email: primaryEmail }, include: { tenant: true } });
      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { githubId: String(githubUser.id), emailVerified: true },
          include: { tenant: true },
        });
      }
    }

    let isNewUser = false;
    if (!user) {
      isNewUser = true;
      const tenant = await prisma.tenant.create({
        data: {
          name: githubUser.name || githubUser.login || primaryEmail.split('@')[0],
          slug: `tenant-${Date.now()}`,
          email: primaryEmail,
          plan: 'free',
          maxProjects: 1,
          maxMemoryMb: 512,
        },
      });
      user = await prisma.user.create({
        data: {
          email: primaryEmail,
          name: githubUser.name || githubUser.login,
          avatarUrl: githubUser.avatar_url,
          githubId: String(githubUser.id),
          emailVerified: true,
          tenantId: tenant.id,
          role: 'user',
        },
        include: { tenant: true },
      });
      await prisma.subscription.create({
        data: { userId: user.id, tenantId: tenant.id, plan: 'free', status: 'active' },
      });
    }

    const userPayload: AuthenticatedUser = {
      userId: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
      plan: user.tenant.plan,
    };

    const accessToken = signAccessToken(userPayload);
    const refreshToken = signRefreshToken({ userId: user.id });
    setAuthCookies(res, accessToken, refreshToken);

    res.redirect(`${FRONTEND_URL}/dashboard${isNewUser ? '?welcome=true' : ''}`);
  } catch (err: any) {
    logger.error({ err }, 'GitHub OAuth callback failed');
    res.redirect(`${FRONTEND_URL}/signin?error=oauth_failed`);
  }
});

// --- Forgot Password ---
router.post(
  '/forgot-password',
  [body('email').isEmail().normalizeEmail().withMessage('Valid email is required'), handleValidation],
  async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      const user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        // Always return success to prevent user enumeration
        res.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
        return;
      }

      const rawToken = `${user.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const tokenHash = await bcrypt.hash(rawToken, SALT_ROUNDS);

      await prisma.passwordResetToken.create({
        data: {
          email,
          tokenHash,
          expiresAt: new Date(Date.now() + 1000 * 60 * 30), // 30 minutes
          userId: user.id,
        },
      });

      // In production, send email here. For now, return the token in dev mode for testing
      if (process.env.NODE_ENV !== 'production') {
        res.json({
          success: true,
          message: 'If an account exists, a reset link has been sent.',
          devToken: rawToken, // Only exposed in dev
        });
        return;
      }

      res.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
    } catch (err: any) {
      logger.error({ err }, 'Forgot password failed');
      res.status(500).json({ error: { code: 'ERR_FORGOT_FAILED', message: 'Failed to process request', details: err?.message } });
    }
  }
);

// --- Reset Password ---
router.post(
  '/reset-password',
  [
    body('token').isLength({ min: 1 }).withMessage('Token is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    handleValidation,
  ],
  async (req: Request, res: Response) => {
    try {
      const { token, password } = req.body;

      const tokens = await prisma.passwordResetToken.findMany({
        where: { usedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      });

      let matched = null;
      for (const t of tokens) {
        if (await bcrypt.compare(token, t.tokenHash)) {
          matched = t;
          break;
        }
      }

      if (!matched) {
        res.status(400).json({ error: { code: 'ERR_INVALID_TOKEN', message: 'Invalid or expired token', details: null } });
        return;
      }

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      await prisma.user.update({
        where: { email: matched.email },
        data: { passwordHash },
      });

      await prisma.passwordResetToken.update({
        where: { id: matched.id },
        data: { usedAt: new Date() },
      });

      res.json({ success: true, message: 'Password reset successfully. Please sign in.' });
    } catch (err: any) {
      logger.error({ err }, 'Reset password failed');
      res.status(500).json({ error: { code: 'ERR_RESET_FAILED', message: 'Failed to reset password', details: err?.message } });
    }
  }
);

export { router as authRouter };
