import { createRoute } from '@hono/zod-openapi'
import {
  ApiErrorResponseSchema,
  DocumentResponseSchema,
  LocaleSchema,
  SlugSchema,
} from '@lorestra/contracts'
import { z } from 'zod'

import type { ApiDependencies } from '../../adapters/memory.js'
import { errorBody } from '../../app/errors.js'
import type { ApiApp } from '../../app/types.js'

const params = z.object({ slug: SlugSchema })
const query = z.object({
  locale: LocaleSchema.default('en'),
  version: z.coerce.number().int().positive().optional(),
})

const documentRoute = createRoute({
  method: 'get',
  path: '/documents/{slug}',
  tags: ['knowledge'],
  request: { params, query },
  responses: {
    200: {
      content: { 'application/json': { schema: DocumentResponseSchema } },
      description: 'A published public document and its current revision.',
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Document was not found in the public projection.',
    },
  },
})

export function registerReadDocument(app: ApiApp, dependencies: ApiDependencies): void {
  app.openapi(documentRoute, async (context) => {
    const input = {
      ...context.req.valid('param'),
      ...context.req.valid('query'),
    }
    const response = await dependencies.knowledge.getDocument(input)
    if (!response) {
      return context.json(
        errorBody(context.get('requestId'), 'not_found', 'Document not found.'),
        404,
      )
    }
    return context.json(response, 200)
  })
}
