import type { Request } from 'express';
import type { ZodType } from 'zod';
import { badRequest } from './errors.js';

export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue?.path?.length ? `${issue.path.join('.')}: ` : '';
    throw badRequest('VALIDATION', `${where}${issue?.message ?? 'Invalid request'}`);
  }
  return result.data;
}

/** Reads a route parameter as a plain string (Express types allow arrays). */
export function param(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}
