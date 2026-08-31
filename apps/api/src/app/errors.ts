import type { ApiErrorCode, ApiErrorResponse } from '@lorestra/contracts'
import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

export class ApiError extends Error {
  public constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status: ContentfulStatusCode,
    public readonly details: Record<string, unknown> | null = null,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function errorBody(
  requestId: string,
  code: ApiErrorCode,
  message: string,
  details: Record<string, unknown> | null = null,
): ApiErrorResponse {
  return {
    error: { code, message, requestId, details },
  }
}

export function errorFromUnknown(
  error: unknown,
  requestId: string,
): {
  body: ApiErrorResponse
  status: ContentfulStatusCode
} {
  if (error instanceof ApiError) {
    return {
      body: errorBody(requestId, error.code, error.message, error.details),
      status: error.status,
    }
  }
  if (error instanceof ZodError) {
    return {
      body: errorBody(
        requestId,
        'validation_error',
        'The request does not match the contract.',
        {
          issues: error.issues.map((issue) => ({
            path: issue.path,
            code: issue.code,
            message: issue.message,
          })),
        },
      ),
      status: 422,
    }
  }
  if (error instanceof HTTPException) {
    return {
      body: errorBody(requestId, 'bad_request', error.message),
      status: error.status,
    }
  }
  return {
    body: errorBody(requestId, 'internal_error', 'Unexpected server error.'),
    status: 500,
  }
}
