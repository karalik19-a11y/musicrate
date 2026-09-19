import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { customAlphabet } from 'nanoid';

/** URL-safe opaque secret (session tokens, artist device keys). */
export function generateSecret(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** We never store raw secrets — only their SHA-256 digest. */
export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

/** Constant-time string comparison that does not leak length via early exit. */
export function safeEqual(a: string, b: string): boolean {
  const left = createHash('sha256').update(a).digest();
  const right = createHash('sha256').update(b).digest();
  return timingSafeEqual(left, right);
}

/** Short ids for public entities (tracks, users). 16 chars, ~95 bits. */
export const publicId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 16);

/** Human-friendly recovery code, unambiguous alphabet: e.g. "K7QD-3MPX". */
const codeChunk = customAlphabet('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 4);
export function generateRecoveryCode(): string {
  return `${codeChunk()}-${codeChunk()}`;
}

export function normalizeRecoveryCode(input: string): string {
  const clean = input.toUpperCase().replace(/[^0-9A-Z]/g, '');
  return clean.length === 8 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : input.trim().toUpperCase();
}
