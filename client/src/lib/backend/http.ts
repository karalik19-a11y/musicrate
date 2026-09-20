import type { ArtistOverview, AuthResponse, RatingInput, Track, TrackSort, User } from '@shared/types';
import { ApiError } from '@/lib/api';
import type { Backend, PublishInput } from './types';

/**
 * Talks to the real API (`/server`). This is the production data source:
 * artist codes, ratings and ownership are all enforced by the server.
 */
export class HttpBackend implements Backend {
  readonly kind = 'http' as const;
  private token: string | null = null;

  /**
   * @param base origin of the API, e.g. `https://api.example.com` or `''`
   *             when the API is served from the same origin as the client.
   */
  constructor(
    private readonly base: string,
    private readonly onUnauthorized: () => void,
  ) {}

  private url(path: string): string {
    return `${this.base.replace(/\/+$/, '')}/api${path}`;
  }

  private async request<T>(
    path: string,
    options: { method?: string; body?: unknown; silent401?: boolean; signal?: AbortSignal } = {},
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';

    let res: Response;
    try {
      res = await fetch(this.url(path), {
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
      let body: { error?: string; message?: string } = {};
      try {
        body = (await res.json()) as typeof body;
      } catch {
        /* non-JSON error */
      }
      if (res.status === 401 && !options.silent401) this.onUnauthorized();
      throw new ApiError(res.status, body.error ?? 'HTTP_ERROR', body.message ?? `Ошибка ${res.status}`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  /** Multipart upload — XHR because it is still the only way to get progress. */
  private postForm<T>(path: string, form: FormData, onProgress?: (ratio: number) => void): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', this.url(path));
      xhr.responseType = 'json';
      xhr.setRequestHeader('Accept', 'application/json');
      if (this.token) xhr.setRequestHeader('Authorization', `Bearer ${this.token}`);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress?.(event.loaded / event.total);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.response as T);
          return;
        }
        const body = (xhr.response ?? {}) as { error?: string; message?: string };
        if (xhr.status === 401) this.onUnauthorized();
        reject(new ApiError(xhr.status, body.error ?? 'HTTP_ERROR', body.message ?? `Ошибка ${xhr.status}`));
      };
      xhr.onerror = () => reject(new ApiError(0, 'NETWORK', 'Загрузка прервалась. Проверьте соединение.'));
      xhr.onabort = () => reject(new ApiError(0, 'ABORTED', 'Загрузка отменена'));
      xhr.send(form);
    });
  }

  setToken(token: string | null): void {
    this.token = token;
  }

  async health(): Promise<{ ok: boolean }> {
    const res = await fetch(this.url('/health'), { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new ApiError(res.status, 'UNHEALTHY', 'API недоступен');
    return { ok: true };
  }

  me = (): Promise<{ user: User }> => this.request('/me', { silent401: true });
  rename = (name: string): Promise<{ user: User }> => this.request('/me', { method: 'PATCH', body: { name } });
  loginArtist = (password: string, artistKey?: string): Promise<AuthResponse> =>
    this.request('/auth/artist', { method: 'POST', body: { password, artistKey }, silent401: true });
  createGuest = (name: string): Promise<AuthResponse> => this.request('/auth/guest', { method: 'POST', body: { name } });
  restoreGuest = (code: string): Promise<AuthResponse> =>
    this.request('/auth/guest/restore', { method: 'POST', body: { code } });
  logout = (): Promise<void> => this.request('/auth/logout', { method: 'POST', silent401: true });

  listTracks = ({ sort, query }: { sort: TrackSort; query?: string }): Promise<{ tracks: Track[] }> => {
    const params = new URLSearchParams({ sort });
    if (query) params.set('q', query);
    return this.request(`/tracks?${params}`);
  };
  getTrack = (id: string): Promise<{ track: Track }> => this.request(`/tracks/${id}`);
  myTracks = (): Promise<{ tracks: Track[] }> => this.request('/artist/tracks');
  overview = (): Promise<{ overview: ArtistOverview }> => this.request('/artist/overview');
  rateTrack = (id: string, rating: RatingInput): Promise<{ track: Track }> =>
    this.request(`/tracks/${id}/rating`, { method: 'PUT', body: rating });
  deleteTrack = (id: string): Promise<void> => this.request(`/tracks/${id}`, { method: 'DELETE' });
  recordPlay = (id: string): Promise<{ counted: boolean; plays: number }> =>
    this.request(`/tracks/${id}/play`, { method: 'POST' });

  async publish(input: PublishInput): Promise<{ track: Track }> {
    const form = new FormData();
    form.set('title', input.title);
    form.set('artistName', input.artistName);
    if (input.waveform) form.set('waveform', JSON.stringify(input.waveform));
    if (input.duration) form.set('duration', String(input.duration));
    form.set('audio', input.file, input.file.name);
    return this.postForm('/tracks', form, input.onProgress);
  }

  async resolveAudioUrl(track: Track): Promise<string> {
    return track.audioUrl.startsWith('http') ? track.audioUrl : `${this.base}${track.audioUrl}`;
  }
}
