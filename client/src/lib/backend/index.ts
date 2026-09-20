/**
 * Data-source resolver.
 *
 * The client is host-agnostic. On boot it picks one backend and freezes it for
 * the session:
 *
 *   1. an explicit API base — `?api=https://…` in the URL (persisted), the
 *      `musicrate.apiBase` localStorage entry, or the `VITE_API_URL` build var;
 *   2. otherwise a quick probe of same-origin `/api/health` (Docker / Render /
 *      Fly serve the client and the API together, so this is the common case);
 *   3. otherwise the in-browser local engine, which is what a plain GitHub
 *      Pages link ends up on.
 *
 * Switching is a one-tap thing in the profile screen, no rebuild required.
 */

import { ApiError } from '@/lib/api';
import { HttpBackend } from './http';
import { LocalBackend } from './local';
import type { Backend, BackendKind } from './types';

export type { Backend, BackendKind, PublishInput } from './types';

const STORAGE_KEY = 'musicrate.apiBase';

export interface BackendInfo {
  kind: BackendKind;
  apiBase: string | null;
  /** True when an explicit API base was configured but did not answer. */
  unreachable: boolean;
  /** Local mode = the visitor's device is the only place data lives. */
  shared: boolean;
}

let backend: Backend | null = null;
let info: BackendInfo = { kind: 'local', apiBase: null, unreachable: false, shared: false };

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeToBackend(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getBackendInfo(): BackendInfo {
  return info;
}

export function getBackend(): Backend {
  if (!backend) throw new ApiError(0, 'NOT_READY', 'Хранилище ещё не готово');
  return backend;
}

export function getLocalBackend(): LocalBackend | null {
  return backend instanceof LocalBackend ? backend : null;
}

/** `?api=https://host`, `?api=local` — also accepted after the hash. */
function readQueryOverride(): string | null | undefined {
  const searches = [window.location.search, window.location.hash.split('?')[1] ?? ''];
  for (const search of searches) {
    if (!search) continue;
    const value = new URLSearchParams(search).get('api') ?? new URLSearchParams(search).get('backend');
    if (value === null) continue;
    const trimmed = value.trim();
    return trimmed === '' || trimmed.toLowerCase() === 'local' || trimmed.toLowerCase() === 'off'
      ? null
      : trimmed.replace(/\/+$/, '');
  }
  return undefined;
}

function storedBase(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)?.replace(/\/+$/, '') ?? null;
  } catch {
    return null;
  }
}

function persistBase(base: string | null): void {
  try {
    if (base) window.localStorage.setItem(STORAGE_KEY, base);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode: the override simply won't survive a reload */
  }
}

function explicitBase(): string | null {
  const override = readQueryOverride();
  if (override !== undefined) {
    persistBase(override);
    return override;
  }
  const stored = storedBase();
  if (stored !== null) return stored;
  const fromBuild = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '');
  return fromBuild || null;
}

async function probe(url: string, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${url}/api/health`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

let initializing: Promise<Backend> | null = null;

export function initBackend(): Promise<Backend> {
  if (backend) return Promise.resolve(backend);
  if (initializing) return initializing;

  initializing = (async () => {
    const onUnauthorized = () => {
      window.dispatchEvent(new CustomEvent('musicrate:unauthorized'));
    };
    const configured = explicitBase();

    // An explicitly configured API is never silently downgraded — the user
    // should see "offline" rather than publish into a local void.
    if (configured) {
      const http = new HttpBackend(configured, onUnauthorized);
      const ok = await probe(configured, 4000);
      backend = http;
      info = { kind: 'http', apiBase: configured, unreachable: !ok, shared: true };
      emit();
      return backend;
    }

    // API hosted next to the client (Docker, Render, Fly, `npm start`).
    if (await probe('', 2000)) {
      const http = new HttpBackend('', onUnauthorized);
      backend = http;
      info = { kind: 'http', apiBase: null, unreachable: false, shared: true };
      emit();
      return backend;
    }

    backend = new LocalBackend(onUnauthorized);
    info = { kind: 'local', apiBase: null, unreachable: false, shared: false };
    emit();
    return backend;
  })();

  return initializing;
}

/** Reboot into the given data source. `null` forces the local vault. */
export function switchBackend(apiBase: string | null): void {
  persistBase(apiBase);
  window.location.reload();
}
