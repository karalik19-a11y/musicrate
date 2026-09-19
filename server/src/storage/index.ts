import type { Response } from 'express';
import { LocalAudioStorage } from './local.js';

/**
 * Object storage abstraction for uploaded audio.
 * The default implementation keeps files on a local disk/volume; the interface
 * is intentionally tiny so an S3/R2 adapter can be dropped in (save → upload,
 * send → redirect to a signed URL) without touching routes.
 */
export interface AudioStorage {
  /** Atomically moves an uploaded temp file into storage under `key`. */
  save(key: string, tmpPath: string): Promise<void>;
  /** Removes the object. Must not throw if it is already gone. */
  delete(key: string): Promise<void>;
  /** Streams the object to the client with HTTP Range support. */
  send(key: string, mimeType: string, res: Response): Promise<void>;
}

export function createStorage(uploadsDir: string): AudioStorage {
  return new LocalAudioStorage(uploadsDir);
}
