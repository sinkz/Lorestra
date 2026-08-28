import { createRoute } from '@hono/zod-openapi'
import {
  ApiErrorResponseSchema,
  GetProposalInputSchema,
  ProposalSchema,
} from '@lorestra/contracts'
import { z } from 'zod'

import type { ApiDependencies } from '../../adapters/memory.js'
import { errorBody } from '../../app/errors.js'
import type { ApiApp } from '../../app/types.js'

const params = z.object({ proposalId: GetProposalInputSchema.shape.proposalId })

const readProposalRoute = createRoute({
  method: 'get',
  path: '/proposals/{proposalId}',
  tags: ['proposals'],
  request: { params },
  responses: {
    200: {
      content: { 'application/json': { schema: ProposalSchema } },
      description: 'Proposal detail and review information.',
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Proposal was not found.',
    },
  },
})

export function registerReadProposal(app: ApiApp, dependencies: ApiDependencies): void {
  app.openapi(readProposalRoute, async (context) => {
    const { proposalId } = context.req.valid('param')
    const proposal = await dependencies.proposals.get({ proposalId })
    if (!proposal) {
      return context.json(
        errorBody(context.get('requestId'), 'not_found', 'Proposal not found.'),
        404,
      )
    }
    return context.json(proposal, 200)
  })
}
