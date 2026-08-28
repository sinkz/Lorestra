import { createContext, useContext, type PropsWithChildren } from 'react'
import type {
  Document as ContractDocument,
  DocumentRevision,
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
    folderPath: folderPath(folderId, folders),
    kind: documentKind(document.type, document.tags),
    status: document.status,
    locale: document.locale,
    author: document.author.name,
    updatedAt: document.updatedAt,
    version: document.version,
    tags: [...document.tags],
    relationCount: document.relationCount,
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
    response.items
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

function mapGraph(response: GraphResponse, navigation: NavigationData): GraphSnapshot {
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
      const document = navigation.documents.find((item) => item.id === node.id)
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
        status: document?.status ?? 'published',
        x:
          node.kind === 'folder'
            ? 70 + (folderIndex.get(node.id) ?? 0) * 310
            : 50 + parentPosition * 310 + (indexWithinParent % 2) * 148,
        y: node.kind === 'folder' ? 20 : 160 + Math.floor(indexWithinParent / 2) * 132,
      }
    }),
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
    title: result.title,
    excerpt: result.excerpt,
    kind: document?.kind ?? documentKind(result.type),
    folderPath: document?.folderPath ?? 'Unsorted',
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
  if (Number.isFinite(numeric) && numeric > 0) return numeric
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
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
    changeCount: summary.changeCount,
    createsDocument: summary.createsDocument,
    files: [],
    checks: [],
    documentIds: [],
  }
}

export type ProposalFileMetadata = {
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
      changeType: change.changeType,
      additions: diff.filter((line) => line.type === 'add').length,
      deletions: diff.filter((line) => line.type === 'remove').length,
      diff,
    }
  })
  return {
    ...mapProposalSummary(proposal),
    body: proposal.discussionSummary,
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
  const getNavigation = (locale: Locale): Promise<NavigationData> => {
    return client.getNavigation({ locale }).then(mapNavigation)
  }
  return {
    getNavigation(input) {
      return getNavigation(input?.locale ?? 'en')
    },
    async listDocuments(input) {
      const locale = input?.locale ?? 'en'
      const [response, navigation] = await Promise.all([
        client.listDocuments({
          locale,
          folderId: input?.folderId,
          q: input?.query || undefined,
          type: input?.kind ? contractDocumentType(input.kind) : undefined,
          status: input?.status,
          sort: input?.sort === 'kind' ? 'type' : (input?.sort ?? 'updated'),
          cursor: input?.cursor,
          limit: input?.limit ?? 50,
        }),
        getNavigation(locale),
      ])
      const folders = new Map(
        navigation.folders.flatMap(function collect(folder): Array<[
          string,
          NavigationItem,
        ]> {
          const item: NavigationItem = {
            id: folder.id,
            parentId: folder.parentId ?? null,
            kind: 'folder',
            documentId: null,
            slug: folder.id,
            title: folder.name,
            locale,
            order: 0,
            hasChildren: folder.children.length > 0 || folder.documentCount > 0,
          }
          return [
            [folder.id, item],
            ...folder.children.flatMap(collect),
          ]
        }),
      )
      return {
        items: response.items.map((document) => mapDocumentSummary(document, folders)),
        pageInfo: mapPageInfo(response.pageInfo),
      } satisfies DocumentListData
    },
    async getDocument(input) {
      const locale = input.locale ?? 'en'
      const response = await client.getDocument({
        slug: input.slug,
        locale,
        version: input.version,
      })
      if (!response) return null
      const [navigation, graph] = await Promise.all([
        getNavigation(locale),
        client.getGraph({ scope: 'entire', locale }),
      ])
      return mapDocument(response.document, response.revision, navigation, graph)
    },
    async getGraph(input) {
      const locale = input.locale ?? 'en'
      const [response, navigation] = await Promise.all([
        client.getGraph({ ...input, locale }),
        getNavigation(locale),
      ])
      return mapGraph(response, navigation)
    },
    async search(input) {
      const locale = input.locale ?? 'en'
      const [response, navigation] = await Promise.all([
        client.search({ q: input.query, locale, limit: input.limit ?? 8 }),
        getNavigation(locale),
      ])
      return {
        results: response.items.map((result) => mapSearchResult(result, navigation)),
        total: response.items.length,
      } satisfies SearchData
    },
    async getHistory(input) {
      const locale = input?.locale ?? 'en'
      const [response, navigation] = await Promise.all([
        client.getHistory({
          documentId: input?.documentId,
          cursor: input?.cursor,
          limit: input?.limit ?? 30,
          locale,
          q: input?.query || undefined,
          category:
            input?.type === 'proposal' ||
            input?.type === 'publish' ||
            input?.type === 'create'
              ? input.type
              : undefined,
        }),
        getNavigation(locale),
      ])
      const documentIds = new Set(navigation.documents.map((document) => document.id))
      const events = response.items
        .map(mapHistoryEvent)
        .filter(
          (event) =>
            !event.documentId ||
            !event.documentSlug ||
            documentIds.has(event.documentId),
        )
      return {
        branch: 'main',
        totalVersions: response.pageInfo.totalCount,
        events,
        pageInfo: mapPageInfo(response.pageInfo),
      } satisfies HistoryData
    },
  }
}

type ProposalAdapterOptions = {
  resolveFiles?: (proposalId: string) => readonly ProposalFileMetadata[] | undefined
  resolveDocument?: (
    documentId: string,
    locale?: Locale,
  ) =>
    | { slug: string; title: string }
    | undefined
    | Promise<{ slug: string; title: string } | undefined>
}

export function createProposalAdapter(
  client: ProposalClient,
  options: ProposalAdapterOptions = {},
): AppProposalClient {
  return {
    async list(input) {
      const status =
        input?.status && input.status !== 'all'
          ? input.status === 'changes-requested'
            ? 'changes_requested'
            : input.status
          : undefined
      const response = await client.list({
        status,
        cursor: input?.cursor,
        limit: input?.limit ?? 30,
      })
      return {
        items: response.items.map(mapProposalSummary),
        pageInfo: mapPageInfo(response.pageInfo),
      } satisfies ProposalListData
    },
    async get(input) {
      const proposal = await client.get({ proposalId: input.proposalId })
      return proposal
        ? mapProposal(proposal, options.resolveFiles?.(proposal.id))
        : null
    },
    async create(input) {
      const targetDocument = input.documentId
        ? await options.resolveDocument?.(input.documentId, input.locale)
        : undefined
      const targetTitle = targetDocument?.title ?? input.title
      const proposal = await client.create({
        title: input.title,
        summary: input.body.slice(0, 500) || input.title,
        locale: input.locale,
        changes: [
          {
            id: `change-${Date.now()}`,
            target: {
              documentId: input.documentId ?? null,
              slug: (targetDocument?.slug ?? input.title)
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, ''),
              title: targetTitle,
            },
            changeType: input.documentId ? 'modified' : 'added',
            before: null,
            after: input.body,
          },
        ],
      })
      return mapProposal(proposal, options.resolveFiles?.(proposal.id))
    },
    async transition(input) {
      const proposal = await client.transition({
        proposalId: input.proposalId,
        status:
          input.status === 'changes-requested' ? 'changes_requested' : input.status,
        reason: input.reason,
      })
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
