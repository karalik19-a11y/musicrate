import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createContext, type AppContext } from '../src/context.js';

export interface TestEnv {
  app: Express;
  ctx: AppContext;
  dataDir: string;
  cleanup: () => void;
}

export async function createTestEnv(): Promise<TestEnv> {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'musicrate-test-'));
  const config = loadConfig({
    env: 'test',
    dataDir,
    databaseUrl: `file:${path.join(dataDir, 'test.db')}`,
    artistPassword: '00112233',
    clientDist: path.join(dataDir, 'no-client'),
  });
  const ctx = await createContext(config);
  const app = createApp(ctx);
  return {
    app,
    ctx,
    dataDir,
    cleanup: () => {
      ctx.db.close();
      fs.rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

/** Builds a valid 16-bit PCM WAV of a sine tone (seconds long). */
export function makeWav(seconds = 2, sampleRate = 8000): Buffer {
  const frames = Math.floor(seconds * sampleRate);
  const data = Buffer.alloc(frames * 2);
  for (let i = 0; i < frames; i++) {
    const v = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5;
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

export const api = (app: Express) => request(app);
export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
