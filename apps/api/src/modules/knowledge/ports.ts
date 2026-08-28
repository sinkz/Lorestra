import type {
  Document,
  DocumentRevision,
  DocumentResponse,
  GetDocumentInput,
  GraphInput,
  GraphResponse,
  HistoryInput,
  HistoryEvent,
  HistoryResponse,
  NavigationInput,
  NavigationResponse,
  SearchInput,
  SearchResponse,
} from '@lorestra/contracts'

export interface FolderRecord {
  id: string
  slug: string
  title: string
  parentId: string | null
  order: number
  visibility: 'public' | 'internal'
  locale: 'en' | 'pt-BR' | 'all'
}

export type KnowledgeRecord = Document & {
  folderId: string
}

export interface KnowledgeStore {
  folders: readonly FolderRecord[]
  documents: readonly KnowledgeRecord[]
  /** Optional immutable snapshots used to resolve a requested document version. */
  revisions?: readonly DocumentRevision[]
  history: readonly HistoryEvent[]
}

export interface KnowledgeReader {
  getNavigation(input: NavigationInput): Promise<NavigationResponse>
  getDocument(input: GetDocumentInput): Promise<DocumentResponse | null>
  getGraph(input: GraphInput): Promise<GraphResponse>
  search(input: SearchInput): Promise<SearchResponse>
  getHistory(input: HistoryInput): Promise<HistoryResponse>
}
