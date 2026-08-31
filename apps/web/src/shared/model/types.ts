import type {
  DurableCreateProposalInput,
  DurableUpdateProposalInput,
  DurableProposalTransitionInput,
  DurableProposalChangeInput,
  DurableProposalMetadata,
  MutationRequestOptions,
  RequestOptions,
  SessionClient,
} from '@lorestra/contracts'

export type Locale = 'en' | 'pt-BR'
export type DocumentKind =
  'incident' | 'decision' | 'runbook' | 'guide' | 'process' | 'note' | 'docs' | 'folder'
export type DocumentStatus = 'draft' | 'published' | 'archived'
export type ProposalStatus = 'open' | 'changes-requested' | 'approved' | 'merged'
export type HistoryEventType =
  'proposal' | 'publish' | 'restore' | 'relation' | 'create'

export interface FolderNode {
  id: string
  name: string
  path: string
  parentId?: string
  documentCount: number
  hasChildren?: boolean
  children: FolderNode[]
}

export interface DocumentSummary {
  id: string
  slug: string
  title: string
  summary: string
  folderId: string
  folderPath: string
  kind: DocumentKind
  status: DocumentStatus
  locale: Locale
  author: string
  updatedAt: string
  version: number
  tags: string[]
  relationCount: number
  visibility?: 'public' | 'internal'
}

export interface Document extends DocumentSummary {
  metadata?: DurableProposalMetadata
  resolvedLinks?: Array<{ href: string; slug: string }>
  relatedDocuments?: Array<
    Pick<DocumentSummary, 'id' | 'slug' | 'title' | 'kind' | 'status' | 'folderPath'>
  >
  body: string
  outgoingLinks: string[]
  inboundLinks: string[]
  relatedDocumentIds: string[]
  revisions: Revision[]
}

interface Revision {
  id: string
  version: number
  createdAt: string
  author: string
  summary: string
  proposalId?: string
}

interface GraphNode {
  id: string
  label: string
  kind: DocumentKind
  status: DocumentStatus
  slug?: string
  x?: number
  y?: number
}

interface GraphEdge {
  id: string
  source: string
  target: string
  relation: 'contains' | 'references' | 'backlink' | 'suggested'
}

export interface GraphSnapshot {
  nodes: GraphNode[]
  edges: GraphEdge[]
  truncated?: boolean
}

export interface SearchResult {
  id: string
  slug: string
  status: DocumentStatus
  locale: Locale
  updatedAt: string
  relationCount: number
  title: string
  excerpt: string
  kind: DocumentKind
  folderPath: string
  score?: number
}

export interface ProposalFile {
  beforeMetadata?: DurableProposalMetadata | null
  change?: DurableProposalChangeInput
  slug?: string
  path?: string
  documentId?: string
  changeType: 'added' | 'modified' | 'deleted'
  additions: number
  deletions: number
  diff: DiffLine[]
}

export interface DiffLine {
  type: 'context' | 'add' | 'remove'
  text: string
  lineNumber?: number
}

interface CheckResult {
  id: string
  label: string
  status: 'passed' | 'failed' | 'pending'
}

export interface Proposal {
  id: string
  number: number
  title: string
  summary: string
  body: string
  status: ProposalStatus
  author: string
  createdAt: string
  updatedAt: string
  changeCount: number
  createsDocument: boolean
  files: ProposalFile[]
  checks: CheckResult[]
  documentIds: string[]
  mergedRevisionId?: string
  authorId?: string
  proposalVersion?: number
  contentHash?: string
  reason?: string
}

export interface HistoryEvent {
  id: string
  type: HistoryEventType
  title: string
  body: string
  createdAt: string
  actor: string
  proposalId?: string
  documentId?: string
  documentSlug?: string
  revisionId?: string
}

export interface NavigationData {
  vault: { id: string; name: string; branch: string }
  folders: FolderNode[]
  documents: DocumentSummary[]
  pageInfo?: PageInfo
  partial?: boolean
}

export interface SearchData {
  results: SearchResult[]
  total: number
  pageInfo?: PageInfo
}

export interface PageInfo {
  nextCursor: string | null
  previousCursor: string | null
  hasNextPage: boolean
  hasPreviousPage: boolean
  totalCount: number
}

export interface DocumentListData {
  items: DocumentSummary[]
  pageInfo: PageInfo
}

export interface HistoryData {
  branch: string
  totalVersions: number
  events: HistoryEvent[]
  pageInfo: PageInfo
}

export interface ProposalListData {
  items: Proposal[]
  pageInfo: PageInfo
}

export interface AppKnowledgeClient {
  getNavigation(
    input?: {
      locale?: Locale
      folderId?: string
      parentId?: string
      cursor?: string
      limit?: number
    },
    options?: RequestOptions,
  ): Promise<NavigationData>
  listDocuments(
    input?: {
      locale?: Locale
      folderId?: string
      query?: string
      kind?: Exclude<DocumentKind, 'folder'>
      status?: DocumentStatus
      sort?: 'updated' | 'title' | 'kind'
      cursor?: string
      limit?: number
    },
    options?: RequestOptions,
  ): Promise<DocumentListData>
  getDocument(
    input: {
      slug: string
      locale?: Locale
      version?: number
    },
    options?: RequestOptions,
  ): Promise<Document | null>
  getDocumentById(
    input: { documentId: string; locale?: Locale; version?: number },
    options?: RequestOptions,
  ): Promise<Document | null>
  getGraph(
    input: {
      scope: 'entire' | 'folder' | 'related'
      documentId?: string
      folderId?: string
      locale?: Locale
    },
    options?: RequestOptions,
  ): Promise<GraphSnapshot>
  search(
    input: { query: string; locale?: Locale; limit?: number; cursor?: string },
    options?: RequestOptions,
  ): Promise<SearchData>
  getHistory(
    input?: {
      documentId?: string
      locale?: Locale
      cursor?: string
      limit?: number
      type?: HistoryEventType
      query?: string
    },
    options?: RequestOptions,
  ): Promise<HistoryData>
  getHistoryEvent(
    input: { eventId: string; locale?: Locale },
    options?: RequestOptions,
  ): Promise<HistoryEvent | null>
}

export interface AppProposalClient {
  list(
    input?: {
      status?: ProposalStatus | 'all'
      locale?: Locale
      cursor?: string
      limit?: number
    },
    options?: RequestOptions,
  ): Promise<ProposalListData>
  get(
    input: { proposalId: string; locale?: Locale },
    options?: RequestOptions,
  ): Promise<Proposal | null>
  create(
    input: DurableCreateProposalInput,
    options?: MutationRequestOptions,
  ): Promise<Proposal>
  update(
    input: DurableUpdateProposalInput,
    options?: MutationRequestOptions,
  ): Promise<Proposal>
  transition(
    input: DurableProposalTransitionInput,
    options?: MutationRequestOptions,
  ): Promise<Proposal>
}

export interface AppClients {
  knowledge: AppKnowledgeClient
  proposals: AppProposalClient
  session?: SessionClient
}
