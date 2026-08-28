import { createRoute } from '@hono/zod-openapi'
import { NavigationInputSchema, NavigationResponseSchema } from '@lorestra/contracts'

import type { ApiDependencies } from '../../adapters/memory.js'
import type { ApiApp } from '../../app/types.js'

const navigationRoute = createRoute({
  method: 'get',
  path: '/navigation',
  tags: ['knowledge'],
  request: { query: NavigationInputSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: NavigationResponseSchema } },
      description: 'Localized public navigation projection.',
    },
  },
})

export function registerReadNavigation(
  app: ApiApp,
  dependencies: ApiDependencies,
): void {
  app.openapi(navigationRoute, async (context) => {
    const input = context.req.valid('query')
    return context.json(await dependencies.knowledge.getNavigation(input), 200)
  })
}
