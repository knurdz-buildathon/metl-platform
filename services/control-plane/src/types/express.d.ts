import { AuthenticatedUser } from '../middleware/auth';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      cookies: Record<string, string>;
    }
  }
}

export {};
