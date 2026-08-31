/** Operational errors are deliberately safe to show; response bodies are not echoed. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly requestId?: string,
    public readonly retryAfter?: string,
    public readonly versions?: {
      baseVersion?: number
      currentVersion?: number
      currentProposalVersion?: number
    },
  ) {
    super(code)
    this.name = 'ApiError'
  }
}

export function errorMessageKey(error: unknown): string {
  if (!(error instanceof ApiError)) return 'common.errorTitle'
  if (error.code === 'NETWORK_ERROR') return 'apiErrors.offline'
  if (error.status === 401) return 'apiErrors.unauthorized'
  if (error.status === 403) return 'apiErrors.forbidden'
  if (error.status === 404) return 'apiErrors.notFound'
  if (error.status === 409) return 'apiErrors.conflict'
  if (error.status === 413) return 'apiErrors.tooLarge'
  if (error.status === 429) return 'apiErrors.rateLimited'
  if (error.status === 503) return 'apiErrors.unavailable'
  if (error.status === 400 || error.status === 422) return 'apiErrors.invalid'
  return 'common.errorTitle'
}
