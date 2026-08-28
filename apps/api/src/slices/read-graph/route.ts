import { createRoute } from '@hono/zod-openapi'
import { GraphInputSchema, GraphResponseSchema } from '@lorestra/contracts'

import type { ApiDependencies } from '../../adapters/memory.js'
import type { ApiApp } from '../../app/types.js'

const graphRoute = createRoute({
  method: 'get',
  path: '/graph',
  tags: ['knowledge'],
  request: { query: GraphInputSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: GraphResponseSchema } },
      description: 'Bounded graph projection for the requested scope.',
    },
  },
})

export function registerReadGraph(app: ApiApp, dependencies: ApiDependencies): void {
  app.openapi(graphRoute, async (context) => {
    const input = context.req.valid('query')
    return context.json(await dependencies.knowledge.getGraph(input), 200)
  })
}
