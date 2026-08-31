import {
  NavigationInputSchema,
  NavigationResponseSchema,
  ListDocumentsInputSchema,
  DocumentListResponseSchema,
  GetDocumentByIdInputSchema,
  DocumentResponseSchema,
  GetDocumentInputSchema,
  GraphInputSchema,
  GraphResponseSchema,
  SearchInputSchema,
  SearchResponseSchema,
  HistoryInputSchema,
  HistoryResponseSchema,
  GetHistoryEventInputSchema,
  HistoryEventResponseSchema,
  ListProposalsInputSchema,
  ProposalListResponseSchema,
  GetProposalInputSchema,
  DurableProposalSchema,
} from '@lorestra/contracts'
import { createKnowledgeReader } from '../../adapters/durable/knowledge.js'
import type { ApiContext, Endpoint } from '../../app/durable-endpoint.js'
export function readVaultEndpoints(): Endpoint[] {
  const reader = (c: ApiContext) => createKnowledgeReader(c.env, c.get('identity'))
  return [
    {
      method: 'get',
      path: '/navigation',
      input: NavigationInputSchema,
      output: NavigationResponseSchema,
      handler: (c, i) => reader(c).getNavigation(NavigationInputSchema.parse(i)),
    },
    {
      method: 'get',
      path: '/documents',
      input: ListDocumentsInputSchema,
      output: DocumentListResponseSchema,
      handler: (c, i) => reader(c).listDocuments(ListDocumentsInputSchema.parse(i)),
    },
    {
      method: 'get',
      path: '/documents/by-id/:documentId',
      input: GetDocumentByIdInputSchema,
      output: DocumentResponseSchema,
      handler: (c, i) => reader(c).getDocumentById(GetDocumentByIdInputSchema.parse(i)),
    },
    {
      method: 'get',
      path: '/documents/:slug',
      input: GetDocumentInputSchema,
      output: DocumentResponseSchema,
      handler: (c, i) => reader(c).getDocument(GetDocumentInputSchema.parse(i)),
    },
    {
      method: 'get',
      path: '/graph',
      input: GraphInputSchema,
      output: GraphResponseSchema,
      handler: (c, i) => reader(c).getGraph(GraphInputSchema.parse(i)),
    },
    {
      method: 'get',
      path: '/search',
      input: SearchInputSchema,
      output: SearchResponseSchema,
      handler: (c, i) => reader(c).search(SearchInputSchema.parse(i)),
    },
    {
      method: 'get',
      path: '/history',
      input: HistoryInputSchema,
      output: HistoryResponseSchema,
      handler: (c, i) => reader(c).getHistory(HistoryInputSchema.parse(i)),
    },
    {
      method: 'get',
      path: '/history/:eventId',
      input: GetHistoryEventInputSchema,
      output: HistoryEventResponseSchema,
      handler: (c, i) => reader(c).getHistoryEvent(GetHistoryEventInputSchema.parse(i)),
    },
    {
      method: 'get',
      path: '/proposals',
      input: ListProposalsInputSchema,
      output: ProposalListResponseSchema,
      handler: (c, i) => reader(c).listProposals(ListProposalsInputSchema.parse(i)),
    },
    {
      method: 'get',
      path: '/proposals/:proposalId',
      input: GetProposalInputSchema,
      output: DurableProposalSchema,
      handler: (c, i) => reader(c).getProposal(GetProposalInputSchema.parse(i)),
    },
  ]
}
