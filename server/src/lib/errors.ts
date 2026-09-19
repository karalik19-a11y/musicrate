import type { ErrorRequestHandler } from 'express';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export const badRequest = (code: string, message?: string) => new HttpError(400, code, message);
export const unauthorized = (code = 'UNAUTHORIZED', message = 'Authentication required') =>
  new HttpError(401, code, message);
export const forbidden = (code = 'FORBIDDEN', message = 'Not allowed') => new HttpError(403, code, message);
export const notFound = (code = 'NOT_FOUND', message = 'Not found') => new HttpError(404, code, message);
export const gone = (code = 'GONE', message = 'No longer available') => new HttpError(410, code, message);
export const tooMany = (message = 'Too many attempts. Try again later.') =>
  new HttpError(429, 'RATE_LIMITED', message);

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.code, message: err.message });
    return;
  }
  // multer size limit
  if (err && typeof err === 'object' && (err as { code?: string }).code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: 'FILE_TOO_LARGE', message: 'Файл слишком большой' });
    return;
  }
  if (err && typeof err === 'object' && (err as { type?: string }).type === 'entity.parse.failed') {
    res.status(400).json({ error: 'INVALID_JSON', message: 'Malformed JSON body' });
    return;
  }
  console.error('[api] unhandled error', err);
  res.status(500).json({ error: 'INTERNAL', message: 'Something went wrong' });
};
