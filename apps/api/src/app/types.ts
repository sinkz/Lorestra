import type { OpenAPIHono } from '@hono/zod-openapi'

interface WorkerBindings {
  // Durable bindings are intentionally absent until the ports are proven locally.
  LORESTRA_ENV?: string
}

interface AppVariables {
  requestId: string
}

export type AppEnv = {
  Bindings: WorkerBindings
  Variables: AppVariables
}

export type ApiApp = OpenAPIHono<AppEnv>
