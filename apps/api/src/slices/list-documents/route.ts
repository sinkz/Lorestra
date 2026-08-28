import { createRoute } from '@hono/zod-openapi'
import {
  DocumentListResponseSchema,
  ListDocumentsInputSchema,
} from '@lorestra/contracts'

import type { ApiDependencies } from '../../adapters/memory.js'
import type { ApiApp } from '../../app/types.js'

const listDocumentsRoute = createRoute({
  method: 'get',
  path: '/documents',
  tags: ['knowledge'],
  request: { query: ListDocumentsInputSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: DocumentListResponseSchema } },
      description: 'Cursor-paginated public Markdown documents.',
    },
  },
})

export function registerListDocuments(
  app: ApiApp,
  dependencies: ApiDependencies,
): void {
  app.openapi(listDocumentsRoute, async (context) => {
    const input = context.req.valid('query')
    return context.json(await dependencies.knowledge.listDocuments(input), 200)
  })
}
