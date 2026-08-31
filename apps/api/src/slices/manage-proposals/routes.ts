import {
  IdempotencyKeySchema,
  DurableCreateProposalInputSchema,
  DurableProposalSchema,
  DurableUpdateProposalInputSchema,
  DurableProposalTransitionInputSchema,
} from '@lorestra/contracts'
import {
  createProposal,
  updateProposal,
  transitionProposal,
} from '../../adapters/durable/proposals.js'
import type { ApiContext, Endpoint } from '../../app/durable-endpoint.js'
export function proposalEndpoints(): Endpoint[] {
  const key = (c: ApiContext) =>
    IdempotencyKeySchema.parse(c.req.header('idempotency-key'))
  return [
    {
      method: 'post',
      path: '/proposals',
      mutates: true,
      input: DurableCreateProposalInputSchema,
      output: DurableProposalSchema,
      handler: async (c, i) =>
        (
          await createProposal(
            c.env,
            c.get('identity'),
            DurableCreateProposalInputSchema.parse(i),
            key(c),
            c.get('requestId'),
          )
        ).proposal,
    },
    {
      method: 'patch',
      path: '/proposals/:proposalId',
      mutates: true,
      input: DurableUpdateProposalInputSchema,
      output: DurableProposalSchema,
      handler: async (c, i) =>
        (
          await updateProposal(
            c.env,
            c.get('identity'),
            DurableUpdateProposalInputSchema.parse(i),
            key(c),
            c.get('requestId'),
          )
        ).proposal,
    },
    {
      method: 'patch',
      path: '/proposals/:proposalId/status',
      mutates: true,
      input: DurableProposalTransitionInputSchema,
      output: DurableProposalSchema,
      handler: async (c, i) =>
        (
          await transitionProposal(
            c.env,
            c.get('identity'),
            DurableProposalTransitionInputSchema.parse(i),
            key(c),
            c.get('requestId'),
          )
        ).proposal,
    },
  ]
}
