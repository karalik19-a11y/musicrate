/**
 * The single error type every screen uses, independent of which data source is
 * active: `HttpBackend` throws it for HTTP failures, `LocalBackend` for storage
 * and rule violations. UI code never needs to know where the data came from.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** True when the error means "this track does not exist any more". */
export function isGoneError(error: unknown): boolean {
  return isApiError(error) && (error.status === 404 || error.status === 410 || error.code === 'TRACK_DELETED');
}
