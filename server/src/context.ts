import path from 'node:path';
import type { Config } from './config.js';
import { Database } from './db/index.js';
import { SessionsRepo } from './repos/sessions.js';
import { TracksRepo } from './repos/tracks.js';
import { UsersRepo } from './repos/users.js';
import { createStorage, type AudioStorage } from './storage/index.js';

export interface AppContext {
  config: Config;
  db: Database;
  users: UsersRepo;
  sessions: SessionsRepo;
  tracks: TracksRepo;
  storage: AudioStorage;
  uploadTmpDir: string;
}

export async function createContext(config: Config): Promise<AppContext> {
  const db = await Database.open(config.databaseUrl, config.databaseAuthToken);
  return {
    config,
    db,
    users: new UsersRepo(db),
    sessions: new SessionsRepo(db, config.sessionTtlMs),
    tracks: new TracksRepo(db),
    storage: createStorage(path.join(config.dataDir, 'uploads')),
    uploadTmpDir: path.join(config.dataDir, 'tmp'),
  };
}
