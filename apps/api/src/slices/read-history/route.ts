import { createRoute } from '@hono/zod-openapi'
import { HistoryInputSchema, HistoryResponseSchema } from '@lorestra/contracts'

import type { ApiDependencies } from '../../adapters/memory.js'
import type { ApiApp } from '../../app/types.js'

const historyRoute = createRoute({
  method: 'get',
  path: '/history',
  tags: ['history'],
  request: { query: HistoryInputSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: HistoryResponseSchema } },
      description: 'Immutable public history events.',
    },
  },
})

export function registerReadHistory(app: ApiApp, dependencies: ApiDependencies): void {
  app.openapi(historyRoute, async (context) => {
    const input = context.req.valid('query')
    return context.json(await dependencies.knowledge.getHistory(input), 200)
  })
}
