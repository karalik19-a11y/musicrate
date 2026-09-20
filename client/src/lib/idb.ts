/**
 * Minimal promise wrapper around IndexedDB.
 *
 * This is the storage engine of the *local* backend (the one GitHub Pages
 * serves when no API host is configured). It deliberately mirrors the shape of
 * the server database: users, sessions, tracks, ratings, plays, blobs.
 */

export type StoreName = 'users' | 'sessions' | 'tracks' | 'ratings' | 'plays' | 'audio' | 'meta';

const DB_NAME = 'musicrate';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('users')) {
        const users = db.createObjectStore('users', { keyPath: 'id' });
        users.createIndex('by_recovery', 'recoveryCode', { unique: false });
        users.createIndex('by_artistKey', 'artistKeyHash', { unique: false });
      }
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'token' });
      }
      if (!db.objectStoreNames.contains('tracks')) {
        db.createObjectStore('tracks', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('ratings')) {
        db.createObjectStore('ratings', { keyPath: 'key' }); // `${trackId}\u0000${userId}`
      }
      if (!db.objectStoreNames.contains('plays')) {
        db.createObjectStore('plays', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('audio')) {
        db.createObjectStore('audio', { keyPath: 'trackId' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB unavailable'));
    request.onblocked = () => reject(new Error('IndexedDB blocked — закройте другие вкладки с приложением'));
  });
  return dbPromise;
}

function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const request = fn(tx.objectStore(store));
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error ?? new Error(`IndexedDB ${store} error`));
      }),
  );
}

export const idb = {
  get: <T>(store: StoreName, key: IDBValidKey) => run<T | undefined>(store, 'readonly', (s) => s.get(key)),
  put: <T>(store: StoreName, value: T) => run<IDBValidKey>(store, 'readwrite', (s) => s.put(value as never)),
  del: (store: StoreName, key: IDBValidKey) => run<undefined>(store, 'readwrite', (s) => s.delete(key)),
  clear: (store: StoreName) => run<undefined>(store, 'readwrite', (s) => s.clear()),
  all: <T>(store: StoreName) => run<T[]>(store, 'readonly', (s) => s.getAll()),
  count: (store: StoreName) => run<number>(store, 'readonly', (s) => s.count()),
  byIndex: <T>(store: StoreName, index: string, value: IDBValidKey) =>
    run<T[]>(store, 'readonly', (s) => s.index(index).getAll(value)),
};

/** Wipes every store — used by "reset the local vault" in the UI. */
export async function wipeLocalDatabase(): Promise<void> {
  for (const store of ['users', 'sessions', 'tracks', 'ratings', 'plays', 'audio', 'meta'] as StoreName[]) {
    await idb.clear(store);
  }
}
