import type { Context } from 'hono'
import type { z } from 'zod'
import type { Identity } from '../adapters/durable/identity.js'
import type { StorageBindings } from '../adapters/durable/primitives.js'
export type DurableEnv = {
  Bindings: StorageBindings & { LORESTRA_ORIGIN?: string }
  Variables: { requestId: string; identity: Identity }
}
export type ApiContext = Context<DurableEnv>
export type Endpoint = {
  method: 'get' | 'post' | 'patch'
  path: string
  input: z.ZodType
  output: z.ZodType
  mutates?: boolean
  handler: (context: ApiContext, input: unknown) => Promise<unknown>
}
