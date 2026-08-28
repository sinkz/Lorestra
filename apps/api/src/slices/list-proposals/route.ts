import { createRoute } from '@hono/zod-openapi'
import {
  ListProposalsInputSchema,
  ProposalListResponseSchema,
} from '@lorestra/contracts'

import type { ApiDependencies } from '../../adapters/memory.js'
import type { ApiApp } from '../../app/types.js'

const listProposalsRoute = createRoute({
  method: 'get',
  path: '/proposals',
  tags: ['proposals'],
  request: { query: ListProposalsInputSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: ProposalListResponseSchema } },
      description: 'Proposal summaries for review.',
    },
  },
})

export function registerListProposals(
  app: ApiApp,
  dependencies: ApiDependencies,
): void {
  app.openapi(listProposalsRoute, async (context) => {
    const input = context.req.valid('query')
    return context.json(await dependencies.proposals.list(input), 200)
  })
}
