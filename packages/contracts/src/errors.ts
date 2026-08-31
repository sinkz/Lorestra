import { z } from 'zod'

export const ApiErrorCodeSchema = z.enum([
  'bad_request',
  'conflict',
  'forbidden',
  'internal_error',
  'not_found',
  'unauthorized',
  'validation_error',
  'payload_too_large',
  'rate_limited',
  'service_unavailable',
  'maintenance',
  'version_conflict',
  'proposal_version_conflict',
  'idempotency_conflict',
  'invalid_transition',
])
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>

export const ApiErrorSchema = z.object({
  code: ApiErrorCodeSchema,
  message: z.string().trim().min(1).max(500),
  requestId: z.string().trim().min(1).max(200),
  details: z.record(z.string(), z.unknown()).nullable(),
  retryAfterSeconds: z.number().int().nonnegative().optional(),
})
export type ApiError = z.infer<typeof ApiErrorSchema>

export const ApiErrorResponseSchema = z.object({
  error: ApiErrorSchema,
})
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>
