import { z } from 'zod'

import { IsoDateTimeSchema } from './common.js'

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string().trim().min(1).max(100),
  version: z.string().trim().min(1).max(50),
  checkedAt: IsoDateTimeSchema,
})
export type HealthResponse = z.infer<typeof HealthResponseSchema>
