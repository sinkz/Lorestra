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
}

export interface Document extends DocumentSummary {
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
  x?: number
  y?: number
}

interface GraphEdge {
  id: string
  source: string
  target: string
  relation: 'references' | 'backlink' | 'suggested'
}

export interface GraphSnapshot {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface SearchResult {
  id: string
  slug: string
  title: string
  excerpt: string
  kind: DocumentKind
  folderPath: string
  score?: number
}

export interface ProposalFile {
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
  files: ProposalFile[]
  checks: CheckResult[]
  documentIds: string[]
  mergedRevisionId?: string
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
}

export interface SearchData {
  results: SearchResult[]
  total: number
}

export interface HistoryData {
  branch: string
  totalVersions: number
  events: HistoryEvent[]
}

export interface AppKnowledgeClient {
  getNavigation(input?: { locale?: Locale; folderId?: string }): Promise<NavigationData>
  getDocument(input: {
    slug: string
    locale?: Locale
    version?: number
  }): Promise<Document | null>
  getGraph(input: {
    scope: 'entire' | 'folder' | 'related'
    documentId?: string
    folderId?: string
    locale?: Locale
  }): Promise<GraphSnapshot>
  search(input: { query: string; locale?: Locale; limit?: number }): Promise<SearchData>
  getHistory(input?: { documentId?: string; locale?: Locale }): Promise<HistoryData>
}

export interface AppProposalClient {
  list(input?: {
    status?: ProposalStatus | 'all'
    locale?: Locale
  }): Promise<Proposal[]>
  get(input: { proposalId: string; locale?: Locale }): Promise<Proposal | null>
  create(input: {
    title: string
    body: string
    documentId?: string
    locale?: Locale
  }): Promise<Proposal>
  transition(input: {
    proposalId: string
    status: Exclude<ProposalStatus, 'open'>
    reason?: string
    locale?: Locale
  }): Promise<Proposal>
}

export interface AppClients {
  knowledge: AppKnowledgeClient
  proposals: AppProposalClient
}
