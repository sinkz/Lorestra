import { createRoute } from '@hono/zod-openapi'
import { SearchInputSchema, SearchResponseSchema } from '@lorestra/contracts'

import type { ApiDependencies } from '../../adapters/memory.js'
import type { ApiApp } from '../../app/types.js'

const searchRoute = createRoute({
  method: 'get',
  path: '/search',
  tags: ['knowledge'],
  request: { query: SearchInputSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: SearchResponseSchema } },
      description: 'Public knowledge search results.',
    },
  },
})

export function registerSearchKnowledge(
  app: ApiApp,
  dependencies: ApiDependencies,
): void {
  app.openapi(searchRoute, async (context) => {
    const input = context.req.valid('query')
    return context.json(await dependencies.knowledge.search(input), 200)
  })
}
