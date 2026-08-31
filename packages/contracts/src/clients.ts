import type {
  DocumentListResponse,
  DocumentResponse,
  GetDocumentInput,
  GetDocumentByIdInput,
  ListDocumentsInput,
} from './document.js'
import type { GraphInput, GraphResponse } from './graph.js'
import type {
  GetHistoryEventInput,
  HistoryEventResponse,
  HistoryInput,
  HistoryResponse,
} from './history.js'
import type {
  CreateProposalInput,
  ListProposalsInput,
  GetProposalInput,
  Proposal,
  ProposalListResponse,
  ProposalTransitionInput,
  DurableCreateProposalInput,
  DurableUpdateProposalInput,
  DurableProposalTransitionInput,
  DurableProposal,
} from './proposal.js'
import type { NavigationInput, NavigationResponse } from './navigation.js'
import type { SearchInput, SearchResponse } from './search.js'
import type { MutationRequestOptions, RequestOptions } from './common.js'
import type { LocalSessionInput, SessionResponse } from './session.js'

/** Stable consumer seam. Implementations may be mock, HTTP, or Cloudflare-backed. */
export interface KnowledgeClient {
  getNavigation(
    input?: NavigationInput,
    options?: RequestOptions,
  ): Promise<NavigationResponse>
  listDocuments(
    input?: ListDocumentsInput,
    options?: RequestOptions,
  ): Promise<DocumentListResponse>
  getDocument(
    input: GetDocumentInput,
    options?: RequestOptions,
  ): Promise<DocumentResponse | null>
  getDocumentById?(
    input: GetDocumentByIdInput,
    options?: RequestOptions,
  ): Promise<DocumentResponse | null>
  getGraph(input?: GraphInput, options?: RequestOptions): Promise<GraphResponse>
  search(input: SearchInput, options?: RequestOptions): Promise<SearchResponse>
  getHistory(input?: HistoryInput, options?: RequestOptions): Promise<HistoryResponse>
  getHistoryEvent?(
    input: GetHistoryEventInput,
    options?: RequestOptions,
  ): Promise<HistoryEventResponse | null>
}

export interface DurableKnowledgeClient extends KnowledgeClient {
  getDocumentById(
    input: GetDocumentByIdInput,
    options?: RequestOptions,
  ): Promise<DocumentResponse | null>
  getHistoryEvent(
    input: GetHistoryEventInput,
    options?: RequestOptions,
  ): Promise<HistoryEventResponse | null>
}

/** Compatibility seam for fixture adapters; HTTP routes parse only Durable inputs. */
export interface ProposalClient {
  list(
    input?: ListProposalsInput,
    options?: RequestOptions,
  ): Promise<ProposalListResponse>
  get(input: GetProposalInput, options?: RequestOptions): Promise<Proposal | null>
  create(
    input: CreateProposalInput | DurableCreateProposalInput,
    options?: MutationRequestOptions,
  ): Promise<Proposal>
  update?(
    input: DurableUpdateProposalInput,
    options?: MutationRequestOptions,
  ): Promise<Proposal>
  transition(
    input: ProposalTransitionInput | DurableProposalTransitionInput,
    options?: MutationRequestOptions,
  ): Promise<Proposal>
}

export interface DurableProposalClient {
  list(
    input?: ListProposalsInput,
    options?: RequestOptions,
  ): Promise<ProposalListResponse>
  get(
    input: GetProposalInput,
    options?: RequestOptions,
  ): Promise<DurableProposal | null>
  create(
    input: DurableCreateProposalInput,
    options: MutationRequestOptions,
  ): Promise<DurableProposal>
  update(
    input: DurableUpdateProposalInput,
    options: MutationRequestOptions,
  ): Promise<DurableProposal>
  transition(
    input: DurableProposalTransitionInput,
    options: MutationRequestOptions,
  ): Promise<DurableProposal>
}

export interface SessionClient {
  getSession(options?: RequestOptions): Promise<SessionResponse>
  login?(
    input: LocalSessionInput,
    options: MutationRequestOptions,
  ): Promise<SessionResponse>
  logout(options: MutationRequestOptions): Promise<void>
}
