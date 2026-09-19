import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Role } from '@shared/types';
import type { AppContext } from '../context.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import type { UserRow } from '../repos/users.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: UserRow;
    token?: string;
  }
}

function bearer(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
}

/** Resolves the bearer token into `req.user` when present (never fails). */
export function attachUser(ctx: AppContext): RequestHandler {
  return async (req, _res, next) => {
    try {
      const token = bearer(req);
      if (token) {
        const user = await ctx.sessions.resolve(token);
        if (user) {
          req.user = user;
          req.token = token;
        }
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(unauthorized('UNAUTHORIZED', 'Сессия недействительна. Войдите заново.'));
    return;
  }
  next();
}

export function requireRole(role: Role): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(unauthorized('UNAUTHORIZED', 'Сессия недействительна. Войдите заново.'));
      return;
    }
    if (req.user.role !== role) {
      next(forbidden('FORBIDDEN', role === 'artist' ? 'Только для артистов' : 'Только для гостей'));
      return;
    }
    next();
  };
}
