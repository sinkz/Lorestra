import { z } from 'zod'

export const ApiErrorCodeSchema = z.enum([
  'bad_request',
  'conflict',
  'forbidden',
  'internal_error',
  'not_found',
  'unauthorized',
  'validation_error',
])
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>

export const ApiErrorSchema = z.object({
  code: ApiErrorCodeSchema,
  message: z.string().trim().min(1).max(500),
  requestId: z.string().trim().min(1).max(200),
  details: z.record(z.string(), z.unknown()).nullable(),
})
export type ApiError = z.infer<typeof ApiErrorSchema>

export const ApiErrorResponseSchema = z.object({
  error: ApiErrorSchema,
})
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>
