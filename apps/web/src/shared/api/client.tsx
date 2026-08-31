import { createContext, useContext, type PropsWithChildren } from 'react'
import type {
  Document as ContractDocument,
  DocumentRevision,
  DurableProposalClient,
  RequestOptions,
  DocumentSummary as ContractDocumentSummary,
  GraphResponse,
  HistoryEvent as ContractHistoryEvent,
  KnowledgeClient,
  NavigationItem,
  NavigationResponse,
  Proposal as ContractProposal,
  ProposalChange,
  ProposalClient,
  ProposalStatus as ContractProposalStatus,
  ProposalSummary,
  SearchResult as ContractSearchResult,
} from '@lorestra/contracts'

import type {
  AppClients,
  AppKnowledgeClient,
  AppProposalClient,
  DiffLine,
  Document,
  DocumentKind,
  DocumentListData,
  DocumentSummary,
  FolderNode,
  GraphSnapshot,
  HistoryData,
  HistoryEvent,
  Locale,
  NavigationData,
  PageInfo,
  Proposal,
  ProposalFile,
  ProposalListData,
  ProposalStatus,
  SearchData,
  SearchResult,
} from '../model/types'

const ClientContext = createContext<AppClients | null>(null)

const proposalStatus = (status: ContractProposalStatus): ProposalStatus =>
  status === 'changes_requested' ? 'changes-requested' : status

const documentKind = (
  type: ContractDocumentSummary['type'],
  tags: readonly string[] = [],
): DocumentKind => {
  if (type === 'lesson') return 'guide'
  if (type === 'document') return tags.includes('docs') ? 'docs' : 'note'
  return type
}

const contractDocumentType = (
  kind: Exclude<DocumentKind, 'folder'>,
): ContractDocumentSummary['type'] => {
  if (kind === 'guide') return 'lesson'
  if (kind === 'runbook' || kind === 'process') return 'process'
  if (kind === 'docs') return 'document'
  return kind
}

const mapPageInfo = (pageInfo: PageInfo): PageInfo => ({ ...pageInfo })

function folderPath(
  folderId: string,
  folders: ReadonlyMap<string, NavigationItem>,
): string {
  const parts: string[] = []
  const visited = new Set<string>()
  let current = folders.get(folderId)
  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    parts.unshift(current.title)
    current = current.parentId ? folders.get(current.parentId) : undefined
  }
  return parts.join('/') || 'Unsorted'
}

function mapDocumentSummary(
  document: ContractDocumentSummary,
  folders: ReadonlyMap<string, NavigationItem>,
): DocumentSummary {
  const folderId = document.nav.parentId ?? 'unfiled'
  return {
    id: document.id,
    slug: document.slug,
    title: document.title,
    summary: document.excerpt,
    folderId,
    folderPath: document.folderPath ?? folderPath(folderId, folders),
    kind: documentKind(document.type, document.tags),
    status: document.status,
    locale: document.locale,
    author: document.author.name,
    updatedAt: document.updatedAt,
    version: document.version,
    tags: [...document.tags],
    relationCount: document.relationCount,
    visibility: document.visibility,
  }
}

function buildFolderTree(
  items: readonly NavigationItem[],
  documents: readonly DocumentSummary[],
): FolderNode[] {
  const folderItems = items
    .filter((item) => item.kind === 'folder')
    .sort(
      (left, right) =>
        left.order - right.order || left.title.localeCompare(right.title),
    )
  const nodes = new Map<string, FolderNode>()
  for (const item of folderItems) {
    nodes.set(item.id, {
      id: item.id,
      name: item.title,
      path: '',
      parentId: item.parentId ?? undefined,
      documentCount: documents.filter((document) => document.folderId === item.id)
        .length,
      children: [],
      hasChildren: item.hasChildren,
    })
  }
  const folderItemsById = new Map(folderItems.map((item) => [item.id, item]))
  for (const node of nodes.values()) node.path = folderPath(node.id, folderItemsById)
  const roots: FolderNode[] = []
  for (const item of folderItems) {
    const node = nodes.get(item.id)
    if (!node) continue
    const parent = item.parentId ? nodes.get(item.parentId) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  return roots
}

export function mapNavigation(response: NavigationResponse): NavigationData {
  const folders = new Map(
    [...(response.ancestors ?? []), ...response.items]
      .filter((item) => item.kind === 'folder')
      .map((item) => [item.id, item]),
  )
  const documents = response.documents.map((document) =>
    mapDocumentSummary(document, folders),
  )
  return {
    vault: response.vault,
    folders: buildFolderTree(response.items, documents),
    documents,
    pageInfo: response.pageInfo,
    partial: Boolean(response.pageInfo),
  }
}

function mapDocument(
  document: ContractDocument,
  revision: DocumentRevision,
  navigation: NavigationData,
  graph: GraphResponse,
): Document {
  const summary =
    navigation.documents.find((item) => item.id === document.id) ??
    mapDocumentSummary(document, new Map())
  const documentIds = new Set(
    graph.nodes.filter((node) => node.kind === 'document').map((node) => node.id),
  )
  const inboundLinks = graph.edges
    .filter(
      (edge) =>
        edge.target === document.id &&
        edge.kind !== 'contains' &&
        documentIds.has(edge.source),
    )
    .map((edge) => edge.source)
  return {
    ...summary,
    slug: document.slug,
    title: document.title,
    summary: document.excerpt,
    status: document.status,
    author: document.author.name,
    updatedAt: document.updatedAt,
    version: document.version,
    tags: [...document.tags],
    relationCount: document.relationCount,
    body: document.body,
    outgoingLinks: [...document.relations],
    inboundLinks,
    relatedDocumentIds: [...document.relations],
    revisions: [
      {
        id: revision.id,
        version: revision.version,
        createdAt: revision.createdAt,
        author: revision.createdBy.name,
        summary: revision.message,
      },
    ],
  }
}

function mapGraph(response: GraphResponse, navigation?: NavigationData): GraphSnapshot {
  const folders = response.nodes.filter((node) => node.kind === 'folder')
  const folderIndex = new Map(folders.map((node, index) => [node.id, index]))
  const parentByDocument = new Map(
    response.edges
      .filter((edge) => edge.kind === 'contains')
      .map((edge) => [edge.target, edge.source]),
  )
  const childIndex = new Map<string, number>()
  return {
    nodes: response.nodes.map((node) => {
      const document = navigation?.documents.find((item) => item.id === node.id)
      const parentId = parentByDocument.get(node.id)
      const parentPosition = parentId ? (folderIndex.get(parentId) ?? 0) : 0
      const indexWithinParent = parentId ? (childIndex.get(parentId) ?? 0) : 0
      if (parentId) childIndex.set(parentId, indexWithinParent + 1)
      return {
        id: node.id,
        label: node.label,
        kind:
          node.kind === 'folder'
            ? 'folder'
            : (document?.kind ?? documentKind(node.documentType ?? 'note')),
        status: node.status ?? document?.status ?? 'published',
        slug: node.slug ?? undefined,
        x:
          node.kind === 'folder'
            ? 70 + (folderIndex.get(node.id) ?? 0) * 310
            : 50 + parentPosition * 310 + (indexWithinParent % 2) * 148,
        y: node.kind === 'folder' ? 20 : 160 + Math.floor(indexWithinParent / 2) * 132,
      }
    }),
    truncated: response.truncated,
    edges: response.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      relation: edge.kind === 'contains' ? 'contains' : 'references',
    })),
  }
}

function mapSearchResult(
  result: ContractSearchResult,
  navigation: NavigationData,
): SearchResult {
  const document = navigation.documents.find((item) => item.id === result.id)
  return {
    id: result.id,
    slug: result.slug,
    status: result.status,
    locale: result.locale,
    updatedAt: result.updatedAt,
    relationCount: result.relationCount,
    title: result.title,
    excerpt: result.excerpt,
    kind: document?.kind ?? documentKind(result.type),
    folderPath: result.folderPath ?? document?.folderPath ?? 'Unsorted',
    score: result.score,
  }
}

function diffLines(change: ProposalChange): DiffLine[] {
  const before = change.before?.split('\n') ?? []
  const after = change.after?.split('\n') ?? []
  if (change.changeType === 'added') {
    return after.map((text, index) => ({ type: 'add', text, lineNumber: index + 1 }))
  }
  if (change.changeType === 'deleted') {
    return before.map((text, index) => ({
      type: 'remove',
      text,
      lineNumber: index + 1,
    }))
  }
  return [
    ...before.map((text, index) => ({
      type: 'remove' as const,
      text,
      lineNumber: index + 1,
    })),
    ...after.map((text, index) => ({
      type: 'add' as const,
      text,
      lineNumber: index + 1,
    })),
  ]
}

function proposalNumber(id: string): number {
  const numeric = Number.parseInt(id.replace(/\D/g, ''), 10)
  if (Number.isSafeInteger(numeric) && numeric > 0 && numeric <= 999_999) return numeric
  return [...id].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 1000
}

function mapProposalSummary(summary: ProposalSummary): Proposal {
  return {
    id: summary.id,
    number: proposalNumber(summary.id),
    title: summary.title,
    summary: summary.summary,
    body: summary.summary,
    status: proposalStatus(summary.status),
    author: summary.author.name,
    authorId: summary.author.id,
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
    changeCount: summary.changeCount,
    createsDocument: summary.createsDocument,
    files: [],
    checks: [],
    documentIds: [],
  }
}

type ProposalFileMetadata = {
  path: string
  changeType: 'added' | 'modified' | 'deleted'
}

function mapProposal(
  proposal: ContractProposal,
  fileMetadata?: readonly ProposalFileMetadata[],
): Proposal {
  const files: ProposalFile[] = proposal.changes.map((change, index) => {
    const diff = diffLines(change)
    const metadata = fileMetadata?.[index]
    return {
      path: metadata?.path ?? change.path,
      documentId: change.target.documentId ?? undefined,
      slug: change.target.slug,
      beforeMetadata: change.beforeMetadata,
      change:
        change.metadata && change.baseVersion !== undefined
          ? {
              id: change.id,
              target: change.target,
              changeType: change.changeType,
              baseVersion: change.baseVersion,
              after: change.after,
              metadata: change.metadata,
              ...(change.path ? { path: change.path } : {}),
            }
          : undefined,
      changeType: change.changeType,
      additions: diff.filter((line) => line.type === 'add').length,
      deletions: diff.filter((line) => line.type === 'remove').length,
      diff,
    }
  })
  return {
    ...mapProposalSummary(proposal),
    body: proposal.discussionSummary,
    reason: proposal.discussionSummary,
    proposalVersion: proposal.proposalVersion,
    contentHash: proposal.contentHash,
    files,
    checks: proposal.checks.map((check, index) => ({
      id: `${proposal.id}-check-${index + 1}`,
      label: check.name,
      status: check.status,
    })),
    documentIds: proposal.changes
      .map((change) => change.target.documentId)
      .filter((id): id is string => id !== null),
  }
}

function mapHistoryEvent(event: ContractHistoryEvent): HistoryEvent {
  const type: HistoryEvent['type'] =
    event.type === 'proposal_created' ||
    event.type === 'proposal_updated' ||
    event.type === 'changes_requested' ||
    event.type === 'approved' ||
    event.type === 'merged'
      ? 'proposal'
      : event.type === 'document_published'
        ? 'create'
        : 'publish'
  return {
    id: event.id,
    type,
    title: event.summary,
    body: event.resultingVersion
      ? `Published as revision ${event.resultingVersion}.`
      : event.summary,
    createdAt: event.occurredAt,
    actor: event.actor.name,
    proposalId: event.proposalId ?? undefined,
    documentId: event.documentId ?? undefined,
    documentSlug: event.documentSlug ?? undefined,
    revisionId: event.resultingVersion ? `v${event.resultingVersion}` : undefined,
  }
}

export function createKnowledgeAdapter(client: KnowledgeClient): AppKnowledgeClient {
  const getNavigation = (
    locale: Locale,
    options?: RequestOptions,
  ): Promise<NavigationData> =>
    client.getNavigation({ locale }, options).then(mapNavigation)
  const readDocument = async (
    response: {
      document: ContractDocument
      revision: DocumentRevision
      resolvedLinks?: Array<{ href: string; slug: string }>
    } | null,
    options?: RequestOptions,
  ) => {
    if (!response) return null
    // Only the bounded neighborhood is needed for backlinks, never the whole vault.
    const graph = await client.getGraph(
      {
        scope: 'related',
        documentId: response.document.id,
        locale: response.document.locale,
      },
      options,
    )
    return {
      ...mapDocument(
        response.document,
        response.revision,
        { vault: { id: '', name: '', branch: '' }, folders: [], documents: [] },
        graph,
      ),
      resolvedLinks: response.resolvedLinks,
      metadata: response.document.nav.parentId
        ? {
            type: response.document.type,
            locale: response.document.locale,
            folderId: response.document.nav.parentId,
            tags: response.document.tags,
            relations: response.document.relations,
            status: response.document.status,
            visibility: response.document.visibility,
          }
        : undefined,
      relatedDocuments: graph.nodes
        .filter(
          (node) =>
            node.kind === 'document' && node.id !== response.document.id && node.slug,
        )
        .map((node) => ({
          id: node.id,
          slug: node.slug!,
          title: node.label,
          kind: documentKind(node.documentType ?? 'note'),
          status: node.status ?? 'published',
          folderPath: '',
        })),
    }
  }
  return {
    getNavigation(input, options) {
      return client
        .getNavigation(
          {
            locale: input?.locale ?? 'en',
            parentId: input?.parentId ?? input?.folderId,
            cursor: input?.cursor,
            limit: input?.limit,
          },
          options,
        )
        .then(mapNavigation)
    },
    async listDocuments(input, options) {
      const response = await client.listDocuments(
        {
          locale: input?.locale ?? 'en',
          folderId: input?.folderId,
          q: input?.query || undefined,
          type: input?.kind ? contractDocumentType(input.kind) : undefined,
          status: input?.status,
          sort: input?.sort === 'kind' ? 'type' : (input?.sort ?? 'updated'),
          cursor: input?.cursor,
          limit: input?.limit ?? 50,
        },
        options,
      )
      return {
        items: response.items.map((document) =>
          mapDocumentSummary(document, new Map()),
        ),
        pageInfo: mapPageInfo(response.pageInfo),
      } satisfies DocumentListData
    },
    async getDocument(input, options) {
      return readDocument(
        await client.getDocument({ ...input, locale: input.locale ?? 'en' }, options),
        options,
      )
    },
    async getDocumentById(input, options) {
      if (client.getDocumentById)
        return readDocument(
          await client.getDocumentById(
            { documentId: input.documentId, version: input.version },
            options,
          ),
          options,
        )
      // Compatibility only for the explicitly selected legacy mock adapter.
      const navigation = await getNavigation(input.locale ?? 'en', options)
      const document = navigation.documents.find((item) => item.id === input.documentId)
      return document
        ? this.getDocument(
            { slug: document.slug, locale: input.locale, version: input.version },
            options,
          )
        : null
    },
    async getGraph(input, options) {
      return mapGraph(
        await client.getGraph({ ...input, locale: input.locale ?? 'en' }, options),
      )
    },
    async search(input, options) {
      const response = await client.search(
        {
          q: input.query,
          locale: input.locale ?? 'en',
          limit: input.limit ?? 8,
          cursor: input.cursor,
        },
        options,
      )
      return {
        results: response.items.map((result) =>
          mapSearchResult(result, {
            vault: { id: '', name: '', branch: '' },
            folders: [],
            documents: [],
          }),
        ),
        total: response.pageInfo.totalCount,
        pageInfo: response.pageInfo,
      } satisfies SearchData
    },
    async getHistory(input, options) {
      const response = await client.getHistory(
        {
          documentId: input?.documentId,
          cursor: input?.cursor,
          limit: input?.limit ?? 30,
          locale: input?.locale ?? 'en',
          q: input?.query || undefined,
          category:
            input?.type === 'proposal' ||
            input?.type === 'publish' ||
            input?.type === 'create'
              ? input.type
              : undefined,
        },
        options,
      )
      return {
        branch: 'main',
        totalVersions: response.pageInfo.totalCount,
        events: response.items.map(mapHistoryEvent),
        pageInfo: response.pageInfo,
      } satisfies HistoryData
    },
    async getHistoryEvent(input, options) {
      if (client.getHistoryEvent) {
        const event = await client.getHistoryEvent(input, options)
        return event ? mapHistoryEvent(event.event) : null
      }
      const history = await this.getHistory(
        { locale: input.locale, limit: 100 },
        options,
      )
      return history.events.find((event) => event.id === input.eventId) ?? null
    },
  }
}

type ProposalAdapterOptions = {
  resolveFiles?: (proposalId: string) => readonly ProposalFileMetadata[] | undefined
}

export function createProposalAdapter(
  client: ProposalClient | DurableProposalClient,
  options: ProposalAdapterOptions = {},
): AppProposalClient {
  return {
    async list(input, requestOptions) {
      const status =
        input?.status && input.status !== 'all'
          ? input.status === 'changes-requested'
            ? 'changes_requested'
            : input.status
          : undefined
      const response = await client.list(
        { status, cursor: input?.cursor, limit: input?.limit ?? 30 },
        requestOptions,
      )
      return {
        items: response.items.map(mapProposalSummary),
        pageInfo: mapPageInfo(response.pageInfo),
      } satisfies ProposalListData
    },
    async get(input, requestOptions) {
      const proposal = await client.get(
        { proposalId: input.proposalId },
        requestOptions,
      )
      return proposal
        ? mapProposal(proposal, options.resolveFiles?.(proposal.id))
        : null
    },
    async create(input, requestOptions) {
      const proposal = await client.create(input, requestOptions!)
      return mapProposal(proposal, options.resolveFiles?.(proposal.id))
    },
    async update(input, requestOptions) {
      if (!client.update)
        throw new Error('Proposal update is not available in this adapter.')
      const proposal = await client.update(input, requestOptions!)
      return mapProposal(proposal, options.resolveFiles?.(proposal.id))
    },
    async transition(input, requestOptions) {
      const proposal = await client.transition(input, requestOptions!)
      return mapProposal(proposal, options.resolveFiles?.(proposal.id))
    },
  }
}

export function ClientProvider({
  clients,
  children,
}: PropsWithChildren<{ clients: AppClients }>) {
  return <ClientContext.Provider value={clients}>{children}</ClientContext.Provider>
}

export function useAppClients(): AppClients {
  const clients = useContext(ClientContext)
  if (!clients) throw new Error('useAppClients must be used inside ClientProvider')
  return clients
}
