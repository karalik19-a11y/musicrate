import type { ApiErrorBody } from '@shared/types';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

/** The auth store registers the current token + a 401 handler here. */
export function configureApi(options: { token: string | null; onUnauthorized: () => void }): void {
  authToken = options.token;
  onUnauthorized = options.onUnauthorized;
}

export function getAuthToken(): string | null {
  return authToken;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** Skip the global 401 handler (used for login attempts). */
  silent401?: boolean;
}

async function parseError(res: Response): Promise<ApiError> {
  let body: Partial<ApiErrorBody> = {};
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    /* non-JSON error */
  }
  return new ApiError(res.status, body.error ?? 'HTTP_ERROR', body.message ?? `Ошибка ${res.status}`);
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK', 'Нет соединения с сервером');
  }

  if (!res.ok) {
    const error = await parseError(res);
    if (res.status === 401 && !options.silent401) onUnauthorized?.();
    throw error;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * Multipart upload with progress. XHR is still the only way to observe
 * upload progress from the browser.
 */
export function upload<T>(
  path: string,
  form: FormData,
  handlers: { onProgress?: (ratio: number) => void; signal?: AbortSignal } = {},
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api${path}`);
    xhr.responseType = 'json';
    xhr.setRequestHeader('Accept', 'application/json');
    if (authToken) xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) handlers.onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response as T);
        return;
      }
      const body = (xhr.response ?? {}) as Partial<ApiErrorBody>;
      if (xhr.status === 401) onUnauthorized?.();
      reject(new ApiError(xhr.status, body.error ?? 'HTTP_ERROR', body.message ?? `Ошибка ${xhr.status}`));
    };
    xhr.onerror = () => reject(new ApiError(0, 'NETWORK', 'Загрузка прервалась. Проверьте соединение.'));
    xhr.onabort = () => reject(new ApiError(0, 'ABORTED', 'Загрузка отменена'));
    handlers.signal?.addEventListener('abort', () => xhr.abort());
    xhr.send(form);
  });
}
