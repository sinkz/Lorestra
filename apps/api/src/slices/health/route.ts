import { createRoute } from '@hono/zod-openapi'
import { HealthResponseSchema } from '@lorestra/contracts'

import type { ApiDependencies } from '../../adapters/memory.js'
import type { ApiApp } from '../../app/types.js'

const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['system'],
  responses: {
    200: {
      content: { 'application/json': { schema: HealthResponseSchema } },
      description: 'Worker health status.',
    },
  },
})

export function registerHealth(app: ApiApp, dependencies: ApiDependencies): void {
  app.openapi(healthRoute, (context) =>
    context.json(
      {
        status: 'ok' as const,
        service: 'lorestra-api',
        version: dependencies.version,
        checkedAt: new Date().toISOString(),
      },
      200,
    ),
  )
}
