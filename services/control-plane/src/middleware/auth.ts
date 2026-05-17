import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '@metl/db';
import { logger } from '@metl/logger';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  tenantId: string;
  role: string;
  plan: string;
}

// Request.user and cookies are declared in services/control-plane/src/types/express.d.ts

const JWT_SECRET = (process.env.JWT_SECRET || 'metl-dev-secret-change-in-production') as jwt.Secret;

export function signAccessToken(payload: { userId: string; email: string; tenantId: string; role: string; plan: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: (process.env.JWT_ACCESS_EXPIRY || '15m') as jwt.SignOptions['expiresIn'] });
}

export function signRefreshToken(payload: { userId: string }): string {
  return jwt.sign({ userId: payload.userId, type: 'refresh' }, JWT_SECRET, {
    expiresIn: (process.env.JWT_REFRESH_EXPIRY || '7d') as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): { userId: string; email: string; tenantId: string; role: string; plan: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.type === 'refresh') return null;
    return decoded;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): { userId: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.type !== 'refresh') return null;
    return { userId: decoded.userId };
  } catch {
    return null;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies.access_token;

  if (!token) {
    res.status(401).json({
      error: { code: 'ERR_UNAUTHORIZED', message: 'Authentication required', details: null },
    });
    return;
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    res.status(401).json({
      error: { code: 'ERR_TOKEN_INVALID', message: 'Token is invalid or expired', details: null },
    });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    include: { tenant: true },
  });

  if (!user) {
    res.status(401).json({
      error: { code: 'ERR_USER_NOT_FOUND', message: 'User no longer exists', details: null },
    });
    return;
  }

  req.user = {
    userId: user.id,
    email: user.email,
    tenantId: user.tenantId,
    role: user.role,
    plan: user.tenant.plan,
  };

  next();
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies.access_token;

  if (!token) {
    next();
    return;
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    next();
    return;
  }

  prisma.user
    .findUnique({
      where: { id: decoded.userId },
      include: { tenant: true },
    })
    .then((user) => {
      if (user) {
        req.user = {
          userId: user.id,
          email: user.email,
          tenantId: user.tenantId,
          role: user.role,
          plan: user.tenant.plan,
        };
      }
      next();
    })
    .catch((err) => {
      logger.error({ err }, 'optionalAuth: failed to load user');
      next();
    });
}
