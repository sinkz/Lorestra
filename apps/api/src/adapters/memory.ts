import type {
  Author,
  DocumentListResponse,
  DocumentSummary,
  DocumentRevision,
  DocumentResponse,
  GraphInput,
  GraphResponse,
  GetDocumentInput,
  GetProposalInput,
  HistoryEvent,
  HistoryInput,
  HistoryResponse,
  ListDocumentsInput,
  ListProposalsInput,
  NavigationInput,
  NavigationItem,
  NavigationResponse,
  Proposal,
  ProposalListResponse,
  SearchInput,
  SearchResponse,
} from '@lorestra/contracts'

import { page } from '../modules/pagination.js'
import { rankSearchResults, scoreSearchResult } from '../modules/knowledge/search.js'
import type {
  FolderRecord,
  KnowledgeReader,
  KnowledgeRecord,
  KnowledgeStore,
} from '../modules/knowledge/ports.js'
import type { ProposalReader } from '../modules/proposals/ports.js'

const author: Author = { id: 'lorestra', name: 'Lorestra' }
const checkedAt = '2026-08-28T00:00:00.000Z'

const folders: readonly FolderRecord[] = [
  {
    id: 'folder-docs-en',
    slug: 'docs-en',
    title: 'Docs',
    parentId: null,
    order: 10,
    visibility: 'public',
    locale: 'en',
  },
  {
    id: 'folder-docs-pt-br',
    slug: 'docs-pt-br',
    title: 'Docs',
    parentId: null,
    order: 20,
    visibility: 'public',
    locale: 'pt-BR',
  },
  {
    id: 'folder-engineering',
    slug: 'engineering',
    title: 'Engineering',
    parentId: null,
    order: 30,
    visibility: 'public',
    locale: 'all',
  },
]

function makeDocument(input: {
  id: string
  slug: string
  locale: 'en' | 'pt-BR'
  title: string
  type: KnowledgeRecord['type']
  folderId: string
  order: number
  body: string
  excerpt: string
  tags: string[]
  relations?: string[]
  visibility?: KnowledgeRecord['visibility']
  status?: KnowledgeRecord['status']
}): KnowledgeRecord {
  const relations = input.relations ?? []
  return {
    id: input.id,
    slug: input.slug,
    locale: input.locale,
    title: input.title,
    type: input.type,
    visibility: input.visibility ?? 'public',
    status: input.status ?? 'published',
    version: 1,
    author,
    createdAt: checkedAt,
    updatedAt: checkedAt,
    excerpt: input.excerpt,
    tags: input.tags,
    nav: { visible: true, parentId: input.folderId, order: input.order },
    relationCount: relations.length,
    body: input.body,
    relations,
    folderId: input.folderId,
  }
}

const documents: readonly KnowledgeRecord[] = [
  makeDocument({
    id: 'doc-what-is-lorestra-en',
    slug: 'what-is-lorestra',
    locale: 'en',
    title: 'What is Lorestra?',
    type: 'document',
    folderId: 'folder-docs-en',
    order: 10,
    body: '# What is Lorestra?\n\nLorestra keeps durable knowledge portable, reviewable, and useful to people and agents.',
    excerpt: 'Portable, reviewable knowledge for people and agents.',
    tags: ['docs', 'knowledge'],
    relations: ['doc-proposal-workflow-en'],
  }),
  makeDocument({
    id: 'doc-proposal-workflow-en',
    slug: 'proposal-workflow',
    locale: 'en',
    title: 'Proposal workflow',
    type: 'process',
    folderId: 'folder-docs-en',
    order: 20,
    body: '# Proposal workflow\n\nA proposal is reviewed before it can create a published revision.',
    excerpt: 'Review first; merge is the only publishing action.',
    tags: ['proposals', 'governance'],
    relations: ['doc-what-is-lorestra-en'],
  }),
  makeDocument({
    id: 'doc-o-que-e-lorestra-pt-br',
    slug: 'o-que-e-lorestra',
    locale: 'pt-BR',
    title: 'O que é o Lorestra?',
    type: 'document',
    folderId: 'folder-docs-pt-br',
    order: 10,
    body: '# O que é o Lorestra?\n\nLorestra mantém conhecimento durável, portátil e revisável.',
    excerpt: 'Conhecimento portátil e revisável para pessoas e agentes.',
    tags: ['docs', 'conhecimento'],
  }),
  makeDocument({
    id: 'doc-incident-response-en',
    slug: 'incident-response',
    locale: 'en',
    title: 'Incident response',
    type: 'incident',
    folderId: 'folder-engineering',
    order: 10,
    body: '# Incident response\n\nStabilize first, capture evidence, then publish a bounded lesson.',
    excerpt: 'Stabilize, capture evidence, and publish a bounded lesson.',
    tags: ['incident', 'operations'],
    relations: ['doc-proposal-workflow-en'],
  }),
  makeDocument({
    id: 'doc-internal-draft-en',
    slug: 'internal-draft',
    locale: 'en',
    title: 'Internal draft',
    type: 'note',
    folderId: 'folder-engineering',
    order: 99,
    body: 'This is intentionally not part of the public projection.',
    excerpt: 'Internal-only content.',
    tags: ['internal'],
    visibility: 'internal',
    status: 'draft',
  }),
]

const history: readonly HistoryEvent[] = [
  {
    id: 'history-document-published',
    type: 'document_published',
    occurredAt: checkedAt,
    actor: author,
    proposalId: null,
    documentId: 'doc-what-is-lorestra-en',
    documentSlug: 'what-is-lorestra',
    summary: 'Initial public document published.',
    resultingVersion: 1,
  },
  {
    id: 'history-proposal-created',
    type: 'proposal_created',
    occurredAt: checkedAt,
    actor: author,
    proposalId: 'proposal-clarify-workflow',
    documentId: 'doc-proposal-workflow-en',
    documentSlug: 'proposal-workflow',
    summary: 'Proposal opened to clarify the review workflow.',
    resultingVersion: null,
  },
]

const currentRevision = (document: KnowledgeRecord): DocumentRevision => ({
  id: `${document.id}-revision-${document.version}`,
  documentId: document.id,
  version: document.version,
  body: document.body,
  message:
    document.version === 1 ? 'Initial published revision.' : 'Published revision.',
  createdAt: document.updatedAt,
  createdBy: document.author,
})

const currentRevisions: readonly DocumentRevision[] = documents.map(currentRevision)

const memoryStore: KnowledgeStore = {
  folders,
  documents,
  revisions: currentRevisions,
  history,
}

function isPublic(document: KnowledgeRecord): boolean {
  return (
    document.visibility === 'public' &&
    (document.status === 'published' || document.status === 'archived')
  )
}

function folderVisible(
  folder: FolderRecord,
  locale: NavigationInput['locale'],
): boolean {
  return (
    folder.visibility === 'public' &&
    (folder.locale === 'all' || folder.locale === locale)
  )
}

function toDocumentSummary(document: KnowledgeRecord): DocumentSummary {
  return {
    id: document.id,
    slug: document.slug,
    locale: document.locale,
    title: document.title,
    type: document.type,
    visibility: document.visibility,
    status: document.status,
    version: document.version,
    author: document.author,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    excerpt: document.excerpt,
    tags: [...document.tags],
    nav: { ...document.nav },
    relationCount: document.relationCount,
  }
}

class MemoryKnowledgeReader implements KnowledgeReader {
  public constructor(private readonly store: KnowledgeStore = memoryStore) {}

  public async getNavigation(input: NavigationInput): Promise<NavigationResponse> {
    const folders = this.store.folders.filter((folder) =>
      folderVisible(folder, input.locale),
    )
    const docs = this.store.documents.filter(
      (document) => isPublic(document) && document.locale === input.locale,
    )
    const visibleIds = new Set(folders.map((folder) => folder.id))
    const items: NavigationItem[] = [
      ...folders.map((folder) => ({
        id: folder.id,
        parentId: folder.parentId,
        kind: 'folder' as const,
        documentId: null,
        slug: folder.slug,
        title: folder.title,
        locale: input.locale,
        order: folder.order,
        hasChildren: this.store.documents.some(
          (document) => isPublic(document) && document.folderId === folder.id,
        ),
      })),
      ...docs
        .filter((document) => visibleIds.has(document.nav.parentId ?? ''))
        .map((document) => ({
          id: document.id,
          parentId: document.nav.parentId,
          kind: 'document' as const,
          documentId: document.id,
          slug: document.slug,
          title: document.title,
          locale: document.locale,
          order: document.nav.order,
          hasChildren: false,
        })),
    ].sort(
      (left, right) =>
        left.order - right.order || left.title.localeCompare(right.title),
    )

    return {
      vault: { id: 'lorestra', name: 'Lorestra Vault', branch: 'main' },
      locale: input.locale,
      items,
      documents: docs.map(toDocumentSummary),
      generatedAt: new Date().toISOString(),
    }
  }

  public async listDocuments(input: ListDocumentsInput): Promise<DocumentListResponse> {
    const query = input.q?.trim().toLocaleLowerCase(input.locale) ?? ''
    const filtered = this.store.documents
      .filter(
        (document) =>
          isPublic(document) &&
          document.locale === input.locale &&
          (input.folderId === undefined || document.folderId === input.folderId) &&
          (input.type === undefined || document.type === input.type) &&
          (input.status === undefined || document.status === input.status) &&
          (!query ||
            [document.title, document.excerpt, ...document.tags].some((value) =>
              value.toLocaleLowerCase(input.locale).includes(query),
            )),
      )
      .sort((left, right) =>
        input.sort === 'title'
          ? left.title.localeCompare(right.title, input.locale)
          : input.sort === 'type'
            ? left.type.localeCompare(right.type, input.locale)
            : right.updatedAt.localeCompare(left.updatedAt),
      )
    const result = page(filtered, input.cursor, input.limit)
    return {
      items: result.items.map(toDocumentSummary),
      pageInfo: result.pageInfo,
    }
  }

  public async getDocument(input: GetDocumentInput): Promise<DocumentResponse | null> {
    const document = this.store.documents.find(
      (candidate) =>
        isPublic(candidate) &&
        candidate.slug === input.slug &&
        candidate.locale === input.locale,
    )
    if (!document) return null

    const version = input.version ?? document.version
    const revision =
      this.store.revisions?.find(
        (candidate) =>
          candidate.documentId === document.id && candidate.version === version,
      ) ?? (version === document.version ? currentRevision(document) : undefined)
    if (!revision) return null

    return {
      document: {
        ...document,
        version: revision.version,
        body: revision.body,
        updatedAt: revision.createdAt,
        author: revision.createdBy,
      },
      revision,
    }
  }

  public async getGraph(input: GraphInput): Promise<GraphResponse> {
    const publicDocuments = this.store.documents.filter(
      (document) => isPublic(document) && document.locale === input.locale,
    )
    const center = input.documentId
      ? publicDocuments.find((document) => document.id === input.documentId)
      : undefined
    let selectedDocuments = publicDocuments

    if (input.scope === 'folder' && input.folderId) {
      selectedDocuments = publicDocuments.filter(
        (document) => document.folderId === input.folderId,
      )
    }
    if (input.scope === 'related' && center) {
      const relatedIds = new Set([center.id, ...center.relations])
      selectedDocuments = publicDocuments.filter((document) =>
        relatedIds.has(document.id),
      )
    }

    const selectedFolderIds = new Set(
      selectedDocuments.map((document) => document.folderId),
    )
    const selectedFolders = this.store.folders.filter(
      (folder) =>
        folderVisible(folder, input.locale) && selectedFolderIds.has(folder.id),
    )
    const nodes = [
      ...selectedFolders.map((folder) => ({
        id: folder.id,
        kind: 'folder' as const,
        label: folder.title,
        slug: folder.slug,
        documentType: null,
        locale: folder.locale === 'all' ? null : folder.locale,
      })),
      ...selectedDocuments.map((document) => ({
        id: document.id,
        kind: 'document' as const,
        label: document.title,
        slug: document.slug,
        documentType: document.type,
        locale: document.locale,
      })),
    ]
    const edges = selectedDocuments.flatMap((document) => [
      {
        id: `contains-${document.folderId}-${document.id}`,
        source: document.folderId,
        target: document.id,
        kind: 'contains' as const,
      },
      ...document.relations
        .filter((relatedId) =>
          selectedDocuments.some((candidate) => candidate.id === relatedId),
        )
        .map((relatedId) => ({
          id: `related-${document.id}-${relatedId}`,
          source: document.id,
          target: relatedId,
          kind: 'related' as const,
        })),
    ])

    return {
      scope: input.scope,
      locale: input.locale,
      centerId: center?.id ?? null,
      nodes,
      edges,
      generatedAt: new Date().toISOString(),
    }
  }

  public async search(input: SearchInput): Promise<SearchResponse> {
    const candidates = this.store.documents.filter(
      (document) =>
        isPublic(document) &&
        (input.locale === undefined || document.locale === input.locale) &&
        (input.type === undefined || document.type === input.type) &&
        (input.status === undefined || document.status === input.status) &&
        (input.folderId === undefined || document.folderId === input.folderId),
    )
    const ranked = rankSearchResults(candidates, input.q)
    const result = page(ranked, input.cursor, input.limit)
    return {
      query: input.q.trim(),
      items: result.items.map((document) => ({
        id: document.id,
        slug: document.slug,
        locale: document.locale,
        title: document.title,
        type: document.type,
        status: document.status,
        excerpt: document.excerpt,
        score: scoreSearchResult(document, input.q),
        updatedAt: document.updatedAt,
        relationCount: document.relationCount,
      })),
      pageInfo: result.pageInfo,
      generatedAt: new Date().toISOString(),
    }
  }

  public async getHistory(input: HistoryInput): Promise<HistoryResponse> {
    const publicDocumentIds = new Set(
      this.store.documents
        .filter(
          (document) =>
            isPublic(document) &&
            (input.locale === undefined || document.locale === input.locale),
        )
        .map((document) => document.id),
    )
    const normalizedQuery = input.q?.toLocaleLowerCase()
    const filtered = this.store.history.filter(
      (event) =>
        (event.documentId === null || publicDocumentIds.has(event.documentId)) &&
        (input.documentId === undefined || event.documentId === input.documentId) &&
        (input.proposalId === undefined || event.proposalId === input.proposalId) &&
        (input.type === undefined || event.type === input.type) &&
        (input.category === undefined ||
          historyCategory(event.type) === input.category) &&
        (normalizedQuery === undefined ||
          `${event.summary} ${event.actor.name}`
            .toLocaleLowerCase()
            .includes(normalizedQuery)),
    )
    return page(filtered, input.cursor, input.limit)
  }
}

function historyCategory(
  type: HistoryEvent['type'],
): 'proposal' | 'publish' | 'create' {
  if (type === 'document_published') return 'create'
  if (type === 'document_updated') return 'publish'
  return 'proposal'
}

const proposals: readonly Proposal[] = [
  {
    id: 'proposal-clarify-workflow',
    title: 'Clarify the proposal workflow',
    summary: 'Make review and merge semantics explicit for new contributors.',
    status: 'open',
    author,
    createdAt: checkedAt,
    updatedAt: checkedAt,
    changeCount: 1,
    createsDocument: false,
    changes: [
      {
        id: 'change-workflow',
        target: {
          documentId: 'doc-proposal-workflow-en',
          slug: 'proposal-workflow',
          title: 'Proposal workflow',
        },
        changeType: 'modified',
        before: 'A proposal is reviewed.',
        after: 'A proposal is reviewed before merge creates a published revision.',
      },
    ],
    checks: [
      { name: 'Contract validation', status: 'passed' },
      { name: 'Human review', status: 'pending' },
    ],
    discussionSummary: 'Waiting for a reviewer to confirm the wording.',
  },
  {
    id: 'proposal-published-incident',
    title: 'Publish incident response lesson',
    summary: 'Add the reviewed incident response lesson to Engineering.',
    status: 'merged',
    author,
    createdAt: checkedAt,
    updatedAt: checkedAt,
    changeCount: 1,
    createsDocument: false,
    changes: [
      {
        id: 'change-incident',
        target: {
          documentId: 'doc-incident-response-en',
          slug: 'incident-response',
          title: 'Incident response',
        },
        changeType: 'modified',
        before: null,
        after: 'Stabilize first, capture evidence, then publish a bounded lesson.',
      },
    ],
    checks: [{ name: 'Contract validation', status: 'passed' }],
    discussionSummary: 'Merged after the reliability review.',
  },
]

class MemoryProposalReader implements ProposalReader {
  public constructor(private readonly records: readonly Proposal[] = proposals) {}

  public async list(input: ListProposalsInput): Promise<ProposalListResponse> {
    const filtered = input.status
      ? this.records.filter((proposal) => proposal.status === input.status)
      : this.records
    const result = page(filtered, input.cursor, input.limit)
    return {
      items: result.items.map((proposal) => ({
        id: proposal.id,
        title: proposal.title,
        summary: proposal.summary,
        status: proposal.status,
        author: proposal.author,
        createdAt: proposal.createdAt,
        updatedAt: proposal.updatedAt,
        changeCount: proposal.changeCount,
        createsDocument: proposal.changes.some(
          (change) =>
            change.changeType === 'added' && change.target.documentId === null,
        ),
      })),
      pageInfo: result.pageInfo,
    }
  }

  public async get(input: GetProposalInput): Promise<Proposal | null> {
    return this.records.find((proposal) => proposal.id === input.proposalId) ?? null
  }
}

export interface ApiDependencies {
  knowledge: KnowledgeReader
  proposals: ProposalReader
  version: string
}

export function createMemoryDependencies(
  store: KnowledgeStore = memoryStore,
): ApiDependencies {
  return {
    knowledge: new MemoryKnowledgeReader(store),
    proposals: new MemoryProposalReader(),
    version: '0.1.0',
  }
}
