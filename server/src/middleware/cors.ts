import type { RequestHandler } from 'express';

const METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
/**
 * `Range` is not a CORS-safelisted header and <audio> always sends it, so a
 * player on another origin (the GitHub Pages build pointing at this API) would
 * fail the preflight and never start playing.
 */
const REQUEST_HEADERS = 'Authorization,Content-Type,Range';
const EXPOSED = 'Content-Length,Content-Range,Accept-Ranges';

/**
 * Minimal CORS for the API. Safe with `*` because authentication is a bearer
 * header, not a cookie — no ambient credentials can be replayed cross-site.
 */
export function cors(allowedOrigins: string[]): RequestHandler {
  const wildcard = allowedOrigins.includes('*');
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (wildcard || allowedOrigins.includes(origin))) {
      res.setHeader('Access-Control-Allow-Origin', wildcard ? '*' : origin);
      res.setHeader('Access-Control-Allow-Methods', METHODS);
      res.setHeader('Access-Control-Allow-Headers', REQUEST_HEADERS);
      res.setHeader('Access-Control-Expose-Headers', EXPOSED);
      res.setHeader('Access-Control-Max-Age', '600');
      if (!wildcard) res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  };
}
