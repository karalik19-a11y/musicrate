import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { Response } from 'express';
import type { AudioStorage } from './index.js';

export class LocalAudioStorage implements AudioStorage {
  constructor(private readonly root: string) {
    fs.mkdirSync(root, { recursive: true });
  }

  private pathFor(key: string): string {
    // keys are generated server-side, but never trust them to escape the root
    const safe = path.basename(key);
    return path.join(this.root, safe);
  }

  async save(key: string, tmpPath: string): Promise<void> {
    const target = this.pathFor(key);
    try {
      await fsp.rename(tmpPath, target);
    } catch (err) {
      // rename fails across devices — fall back to copy + unlink
      if ((err as NodeJS.ErrnoException).code !== 'EXDEV') throw err;
      await fsp.copyFile(tmpPath, target);
      await fsp.unlink(tmpPath);
    }
  }

  async delete(key: string): Promise<void> {
    await fsp.rm(this.pathFor(key), { force: true });
  }

  send(key: string, mimeType: string, res: Response): Promise<void> {
    return new Promise((resolve, reject) => {
      // express handles Range / 206 / ETag / conditional requests for us —
      // byte-range support is required for iOS Safari to play audio.
      res.sendFile(
        this.pathFor(key),
        {
          acceptRanges: true,
          cacheControl: true,
          maxAge: '30d',
          immutable: true,
          headers: { 'Content-Type': mimeType, 'X-Content-Type-Options': 'nosniff' },
        },
        (err) => (err ? reject(err) : resolve()),
      );
    });
  }
}
