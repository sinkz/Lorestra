import type { DocumentResponse, GetDocumentInput } from './document.js'
import type { GraphInput, GraphResponse } from './graph.js'
import type { HistoryInput, HistoryResponse } from './history.js'
import type {
  CreateProposalInput,
  ListProposalsInput,
  GetProposalInput,
  Proposal,
  ProposalListResponse,
  ProposalTransitionInput,
} from './proposal.js'
import type { NavigationInput, NavigationResponse } from './navigation.js'
import type { SearchInput, SearchResponse } from './search.js'

/** Stable consumer seam. Implementations may be mock, HTTP, or Cloudflare-backed. */
export interface KnowledgeClient {
  getNavigation(input?: NavigationInput): Promise<NavigationResponse>
  getDocument(input: GetDocumentInput): Promise<DocumentResponse | null>
  getGraph(input?: GraphInput): Promise<GraphResponse>
  search(input: SearchInput): Promise<SearchResponse>
  getHistory(input?: HistoryInput): Promise<HistoryResponse>
}

/** Proposal seam; write methods remain disabled in the public Worker for now. */
export interface ProposalClient {
  list(input?: ListProposalsInput): Promise<ProposalListResponse>
  get(input: GetProposalInput): Promise<Proposal | null>
  create(input: CreateProposalInput): Promise<Proposal>
  transition(input: ProposalTransitionInput): Promise<Proposal>
}
