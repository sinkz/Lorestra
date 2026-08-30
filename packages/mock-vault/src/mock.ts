import {
  canTransitionProposal,
  CreateProposalInputSchema,
  ProposalSchema,
  ProposalTransitionInputSchema,
} from '@lorestra/contracts'
import type {
  Author,
  CreateProposalInput,
  Document,
  DocumentListResponse,
  DocumentResponse,
  DocumentRevision,
  DocumentType,
  GetDocumentInput,
  GetProposalInput,
  GraphInput,
  GraphResponse,
  HistoryEvent,
  HistoryInput,
  HistoryResponse,
  KnowledgeClient,
  ListDocumentsInput,
  ListProposalsInput,
  NavigationInput,
  NavigationResponse,
  Proposal,
  ProposalChange,
  ProposalClient,
  ProposalListResponse,
  ProposalStatus,
  ProposalTransitionInput,
  PageInfo,
  SearchInput,
  SearchResponse,
} from '@lorestra/contracts'

import { documents, folders, history, mockVaultData, proposals } from './fixtures'
import type {
  FixtureDocument,
  FixtureFolder,
  FixtureHistoryEvent,
  FixtureProposal,
  FixtureProposalRevision,
  FixtureProposalStatus,
  FixtureStoreData,
} from './fixtures'

type Mutable<T> = { -readonly [Key in keyof T]: T[Key] }

type MutableDocument = Mutable<Omit<FixtureDocument, 'tags' | 'relatedDocumentIds'>> & {
  tags: string[]
  relatedDocumentIds: string[]
}

type MutableProposal = Mutable<
  Omit<FixtureProposal, 'reviewers' | 'proposed' | 'files' | 'checks' | 'comments'>
> & {
  reviewers: string[]
  proposed: Mutable<FixtureProposalRevision> & {
    tags: string[]
    relatedDocumentIds: string[]
  }
  files: FixtureProposal['files'][number][]
  checks: FixtureProposal['checks'][number][]
  comments: string[]
}

type MutableHistoryEvent = FixtureHistoryEvent

interface StoredRevision {
  readonly id: string
  readonly documentId: string
  readonly version: number
  readonly title: string
  readonly description: string
  readonly excerpt: string
  readonly body: string
  readonly slug: string
  readonly locale: FixtureDocument['locale']
  readonly folderId: string
  readonly kind: FixtureDocument['kind']
  readonly visibility: FixtureDocument['visibility']
  readonly status: FixtureDocument['status']
  readonly author: string
  readonly createdAt: string
  readonly updatedAt: string
  readonly tags: readonly string[]
  readonly relatedDocumentIds: readonly string[]
  readonly path: string
  readonly proposalId?: string
}

export class MockVaultError extends Error {
  public readonly code:
    | 'not_found'
    | 'invalid_input'
    | 'invalid_transition'
    | 'version_conflict'
    | 'duplicate_slug'
  public readonly status: number

  public constructor(
    code: MockVaultError['code'],
    message: string,
    status = code === 'not_found' ? 404 : code === 'version_conflict' ? 409 : 400,
  ) {
    super(message)
    this.name = 'MockVaultError'
    this.code = code
    this.status = status
  }
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const author = (value: string): Author => ({
  id:
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'lorestra',
  name: value,
})

const documentType = (document: FixtureDocument): DocumentType => {
  const values =
    `${document.id} ${document.title} ${document.tags.join(' ')}`.toLowerCase()
  if (values.includes('incident')) return 'incident'
  if (values.includes('decision') || values.includes('adr')) return 'decision'
  if (values.includes('process') || values.includes('runbook')) return 'process'
  if (values.includes('lesson')) return 'lesson'
  if (document.kind === 'folder-index') return 'document'
  return 'note'
}

const visible = (document: FixtureDocument): boolean =>
  document.visibility === 'public' && document.status === 'published'

const documentOrder = (
  document: FixtureDocument,
  all: readonly FixtureDocument[],
): number => {
  const siblingIndex = all
    .filter(
      (candidate) =>
        candidate.folderId === document.folderId &&
        candidate.locale === document.locale,
    )
    .findIndex((candidate) => candidate.id === document.id)
  return document.kind === 'folder-index' ? 0 : Math.max(1, siblingIndex + 1) * 10
}

const excerptFromContent = (content: string): string => {
  const plain = content
    .replace(/[#*_`>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length <= 500 ? plain : `${plain.slice(0, 497)}...`
}

const makeMutableDocument = (document: FixtureDocument): MutableDocument => ({
  ...clone(document),
  tags: [...document.tags],
  relatedDocumentIds: [...document.relatedDocumentIds],
})

const makeMutableProposal = (proposal: FixtureProposal): MutableProposal => ({
  ...clone(proposal),
  reviewers: [...proposal.reviewers],
  proposed: {
    ...clone(proposal.proposed),
    tags: [...proposal.proposed.tags],
    relatedDocumentIds: [...proposal.proposed.relatedDocumentIds],
  },
  files: proposal.files.map((file) => ({ ...file })),
  checks: proposal.checks.map((check) => ({ ...check })),
  comments: [...proposal.comments],
})

const revisionFromDocument = (
  document: MutableDocument,
  proposalId?: string,
): StoredRevision => ({
  id: `${document.id}:v${String(document.version).padStart(4, '0')}`,
  documentId: document.id,
  version: document.version,
  title: document.title,
  description: document.description,
  excerpt: document.excerpt,
  body: document.content,
  slug: document.slug,
  locale: document.locale,
  folderId: document.folderId,
  kind: document.kind,
  visibility: document.visibility,
  status: document.status,
  author: document.author,
  createdAt: document.createdAt,
  updatedAt: document.updatedAt,
  tags: [...document.tags],
  relatedDocumentIds: [...document.relatedDocumentIds],
  path: document.path,
  ...(proposalId ? { proposalId } : {}),
})

const toProposalStatus = (status: FixtureProposalStatus): ProposalStatus => status

const fromProposalStatus = (status: ProposalStatus): FixtureProposalStatus => status

const toHistoryType = (type: FixtureHistoryEvent['type']): HistoryEvent['type'] => {
  if (type === 'created') return 'document_published'
  if (type === 'updated') return 'document_updated'
  if (type === 'proposal_submitted') return 'proposal_created'
  if (type === 'proposal_approved') return 'approved'
  if (type === 'proposal_rejected') return 'changes_requested'
  return 'merged'
}

const toChangeType = (
  value: FixtureProposal['files'][number]['changeType'],
): ProposalChange['changeType'] => value

const page = <T>(
  items: readonly T[],
  cursor: string | undefined,
  limit: number,
): { items: T[]; pageInfo: PageInfo } => {
  const parsedCursor = cursor ? Number.parseInt(cursor, 10) : 0
  const start = Number.isFinite(parsedCursor) && parsedCursor >= 0 ? parsedCursor : 0
  const selected = items.slice(start, start + limit)
  const nextCursor =
    start + selected.length < items.length ? String(start + selected.length) : null
  const hasPreviousPage = start > 0
  return {
    items: selected,
    pageInfo: {
      nextCursor,
      hasNextPage: nextCursor !== null,
      previousCursor: hasPreviousPage ? String(Math.max(0, start - limit)) : null,
      hasPreviousPage,
      totalCount: items.length,
    },
  }
}

/**
 * In-memory implementation of the vault seam. It has no React, Hono,
 * filesystem, or Cloudflare dependency. The public client interfaces remain
 * the only surface consumers need to learn.
 */
export class MockVaultStore {
  private readonly folders: FixtureFolder[]
  private readonly documents: MutableDocument[]
  private readonly proposals: MutableProposal[]
  private readonly history: MutableHistoryEvent[]
  private readonly revisions: StoredRevision[]
  private mutationSequence = 0

  public constructor(data: FixtureStoreData = mockVaultData) {
    this.folders = data.folders.map((folder) => clone(folder))
    this.documents = data.documents.map(makeMutableDocument)
    this.proposals = data.proposals.map(makeMutableProposal)
    this.history = data.history.map((event) => clone(event))
    this.revisions = this.documents.map((document) => revisionFromDocument(document))
  }

  public listFolders(): readonly FixtureFolder[] {
    return clone(this.folders)
  }

  public listDocuments(): readonly FixtureDocument[] {
    return clone(this.documents)
  }

  public listProposals(): readonly FixtureProposal[] {
    return clone(this.proposals)
  }

  public listHistory(): readonly FixtureHistoryEvent[] {
    return clone(this.history)
  }

  public findDocument(ref: string): FixtureDocument | undefined {
    const document = this.documents.find((item) => item.id === ref || item.slug === ref)
    return document ? clone(document) : undefined
  }

  public findDocumentById(id: string): MutableDocument | undefined {
    return this.documents.find((item) => item.id === id)
  }

  public findProposal(id: string): FixtureProposal | undefined {
    const proposal = this.proposals.find((item) => item.id === id)
    return proposal ? clone(proposal) : undefined
  }

  public findProposalMutable(id: string): MutableProposal | undefined {
    return this.proposals.find((item) => item.id === id)
  }

  public findRevision(documentId: string, version: number): StoredRevision | undefined {
    const revision = this.revisions.find(
      (item) => item.documentId === documentId && item.version === version,
    )
    return revision ? clone(revision) : undefined
  }

  public listRevisions(documentId: string): readonly StoredRevision[] {
    return clone(
      this.revisions
        .filter((item) => item.documentId === documentId)
        .sort((left, right) => right.version - left.version),
    )
  }

  public updateProposalStatus(
    proposalId: string,
    status: FixtureProposalStatus,
    reason?: string,
  ): FixtureProposal {
    const proposal = this.findProposalMutable(proposalId)
    if (!proposal)
      throw new MockVaultError('not_found', `Proposal not found: ${proposalId}`)
    if (!canTransitionProposal(proposal.status, status)) {
      throw new MockVaultError(
        'invalid_transition',
        `Cannot transition proposal ${proposalId} from ${proposal.status} to ${status}.`,
      )
    }
    if (status === 'changes_requested' && !reason?.trim()) {
      throw new MockVaultError(
        'invalid_input',
        'A reason is required when requesting changes.',
      )
    }
    proposal.status = status
    proposal.updatedAt = this.nextTimestamp()
    if (reason?.trim()) proposal.comments.push(reason.trim())
    return clone(proposal)
  }

  public mergeProposal(proposalId: string): FixtureProposal {
    const proposal = this.findProposalMutable(proposalId)
    if (!proposal)
      throw new MockVaultError('not_found', `Proposal not found: ${proposalId}`)
    if (proposal.status !== 'approved') {
      throw new MockVaultError(
        'invalid_transition',
        'Only an approved proposal can be merged.',
      )
    }
    if (proposal.checks.some((check) => check.status !== 'passed')) {
      throw new MockVaultError(
        'invalid_transition',
        'All proposal checks must pass before merge.',
      )
    }
    if (proposal.kind === 'create') this.mergeCreateProposal(proposal)
    else if (proposal.kind === 'update') this.mergeUpdateProposal(proposal)
    else this.mergeDeleteProposal(proposal)
    proposal.status = 'merged'
    proposal.updatedAt = this.nextTimestamp()
    return clone(proposal)
  }

  public addProposal(proposal: FixtureProposal): FixtureProposal {
    if (this.proposals.some((item) => item.id === proposal.id)) {
      throw new MockVaultError(
        'invalid_input',
        `Proposal already exists: ${proposal.id}`,
      )
    }
    if (
      proposal.kind !== 'create' &&
      proposal.targetDocumentId &&
      !this.documents.some((item) => item.id === proposal.targetDocumentId)
    ) {
      throw new MockVaultError(
        'not_found',
        `Target document not found: ${proposal.targetDocumentId}`,
      )
    }
    const mutable = makeMutableProposal(proposal)
    this.proposals.push(mutable)
    return clone(mutable)
  }

  private mergeCreateProposal(proposal: MutableProposal): void {
    const proposed = proposal.proposed
    const slug = proposed.slug
    if (this.documents.some((document) => document.slug === slug)) {
      throw new MockVaultError(
        'duplicate_slug',
        `Document slug already exists: ${slug}`,
      )
    }
    const documentId = proposal.targetDocumentId ?? `lorestra.proposal.${proposal.id}`
    const now = this.nextTimestamp()
    const created: MutableDocument = {
      id: documentId,
      slug,
      title: proposed.title,
      description: proposed.description,
      excerpt: excerptFromContent(proposed.content),
      content: proposed.content,
      locale: proposed.locale,
      folderId: proposed.folderId,
      folderPath: this.folderPathFor(proposed.folderId),
      kind: 'document',
      visibility: 'public',
      status: 'published',
      version: 1,
      author: proposal.author,
      createdAt: now,
      updatedAt: now,
      tags: [...proposed.tags],
      relatedDocumentIds: [...proposed.relatedDocumentIds],
      path: `vault/${this.folderPathFor(proposed.folderId).join('/')}/${slug}.md`,
    }
    this.documents.push(created)
    this.revisions.push(revisionFromDocument(created, proposal.id))
    this.history.push({
      id: `history-${proposal.id}-merged`,
      documentId: created.id,
      documentVersion: 1,
      type: 'merged',
      summary: `Created ${created.title} from an approved proposal.`,
      actor: proposal.author,
      createdAt: now,
      proposalId: proposal.id,
    })
  }

  private mergeUpdateProposal(proposal: MutableProposal): void {
    if (!proposal.targetDocumentId) {
      throw new MockVaultError(
        'invalid_input',
        'An update proposal must target a document.',
      )
    }
    const document = this.findDocumentById(proposal.targetDocumentId)
    if (!document)
      throw new MockVaultError(
        'not_found',
        `Target document not found: ${proposal.targetDocumentId}`,
      )
    if (proposal.baseVersion !== document.version) {
      throw new MockVaultError(
        'version_conflict',
        `Proposal is based on v${proposal.baseVersion ?? 'unknown'}; current document is v${document.version}.`,
        409,
      )
    }
    const proposed = proposal.proposed
    const nextSlug = proposed.slug || document.slug
    const duplicate = this.documents.find(
      (candidate) => candidate.id !== document.id && candidate.slug === nextSlug,
    )
    if (duplicate)
      throw new MockVaultError(
        'duplicate_slug',
        `Document slug already exists: ${nextSlug}`,
      )
    const now = this.nextTimestamp()
    document.slug = nextSlug
    document.title = proposed.title
    document.description = proposed.description
    document.excerpt = excerptFromContent(proposed.content)
    document.content = proposed.content
    document.locale = proposed.locale
    document.folderId = proposed.folderId
    document.folderPath = this.folderPathFor(proposed.folderId)
    document.status = 'published'
    document.version += 1
    document.updatedAt = now
    document.tags = [...proposed.tags]
    document.relatedDocumentIds = [...proposed.relatedDocumentIds]
    document.path = `vault/${document.folderPath.join('/')}/${nextSlug}.md`
    this.revisions.push(revisionFromDocument(document, proposal.id))
    this.history.push({
      id: `history-${proposal.id}-merged`,
      documentId: document.id,
      documentVersion: document.version,
      type: 'merged',
      summary: `Merged proposal into ${document.title}, creating v${document.version}.`,
      actor: proposal.author,
      createdAt: now,
      proposalId: proposal.id,
    })
  }

  private mergeDeleteProposal(proposal: MutableProposal): void {
    if (!proposal.targetDocumentId) {
      throw new MockVaultError(
        'invalid_input',
        'A delete proposal must target a document.',
      )
    }
    const document = this.findDocumentById(proposal.targetDocumentId)
    if (!document)
      throw new MockVaultError(
        'not_found',
        `Target document not found: ${proposal.targetDocumentId}`,
      )
    if (proposal.baseVersion !== document.version) {
      throw new MockVaultError(
        'version_conflict',
        `Proposal is based on v${proposal.baseVersion ?? 'unknown'}; current document is v${document.version}.`,
        409,
      )
    }
    const now = this.nextTimestamp()
    document.status = 'archived'
    document.version += 1
    document.updatedAt = now
    this.revisions.push(revisionFromDocument(document, proposal.id))
    this.history.push({
      id: `history-${proposal.id}-merged`,
      documentId: document.id,
      documentVersion: document.version,
      type: 'merged',
      summary: `Archived ${document.title} through an approved proposal.`,
      actor: proposal.author,
      createdAt: now,
      proposalId: proposal.id,
    })
  }

  private folderPathFor(folderId: string): string[] {
    const folder = this.folders.find((item) => item.id === folderId)
    if (!folder) return ['Docs']
    return folder.locale === 'all' ? [folder.title] : [folder.title, folder.locale]
  }

  private nextTimestamp(): string {
    this.mutationSequence += 1
    const seconds = String(30 + this.mutationSequence).padStart(2, '0')
    return `2026-08-28T12:${seconds}:00.000Z`
  }
}

const contractSummary = (
  document: FixtureDocument,
  all: readonly FixtureDocument[],
) => ({
  id: document.id,
  slug: document.slug,
  locale: document.locale,
  title: document.title,
  type: documentType(document),
  visibility: document.visibility,
  status: document.status,
  version: document.version,
  author: author(document.author),
  createdAt: document.createdAt,
  updatedAt: document.updatedAt,
  excerpt: document.excerpt,
  tags: [...document.tags],
  nav: {
    visible: true,
    parentId: document.folderId,
    order: documentOrder(document, all),
  },
  relationCount: document.relatedDocumentIds.length,
})

const toDocumentRevision = (revision: StoredRevision): DocumentRevision => ({
  id: revision.id,
  documentId: revision.documentId,
  version: revision.version,
  body: revision.body,
  message: revision.proposalId
    ? `Merged proposal ${revision.proposalId}.`
    : 'Initial published revision.',
  createdAt: revision.updatedAt,
  createdBy: author(revision.author),
})

const toDocument = (
  revision: StoredRevision,
  all: readonly FixtureDocument[],
): Document => ({
  ...contractSummary(
    {
      id: revision.documentId,
      slug: revision.slug,
      title: revision.title,
      description: revision.description,
      excerpt: revision.excerpt,
      content: revision.body,
      locale: revision.locale,
      folderId: revision.folderId,
      folderPath: [],
      kind: revision.kind,
      visibility: revision.visibility,
      status: revision.status,
      version: revision.version,
      author: revision.author,
      createdAt: revision.createdAt,
      updatedAt: revision.updatedAt,
      tags: revision.tags,
      relatedDocumentIds: revision.relatedDocumentIds,
      path: revision.path,
    },
    all,
  ),
  body: revision.body,
  relations: [...revision.relatedDocumentIds],
})

const proposalChange = (
  proposal: FixtureProposal,
  file: FixtureProposal['files'][number],
): ProposalChange => {
  const target = proposal.targetDocumentId
    ? documents.find((document) => document.id === proposal.targetDocumentId)
    : undefined
  return {
    id: `${proposal.id}:${file.path}`.replace(/[^A-Za-z0-9._:-]+/g, '-'),
    path: file.path,
    target: {
      documentId: proposal.targetDocumentId,
      slug: proposal.proposed.slug,
      title: proposal.proposed.title,
    },
    changeType: toChangeType(file.changeType),
    before: target?.content ?? null,
    after: file.changeType === 'deleted' ? null : proposal.proposed.content,
  }
}

const toProposal = (proposal: FixtureProposal): Proposal =>
  ProposalSchema.parse({
    id: proposal.id,
    title: proposal.title,
    summary: proposal.summary,
    status: toProposalStatus(proposal.status),
    author: author(proposal.author),
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt,
    changeCount: proposal.files.length,
    createsDocument:
      proposal.kind === 'create' ||
      proposal.files.some((file) => file.changeType === 'added'),
    changes: proposal.files.map((file) => proposalChange(proposal, file)),
    checks: proposal.checks.map((check) => ({
      name: check.name,
      status: check.status,
    })),
    discussionSummary: proposal.comments.join(' ') || proposal.summary,
  })

export interface MockClients {
  readonly knowledgeClient: KnowledgeClient
  readonly proposalClient: ProposalClient
  readonly store: MockVaultStore
}

export class MockKnowledgeClient implements KnowledgeClient {
  public constructor(public readonly store: MockVaultStore = new MockVaultStore()) {}

  public async getNavigation(input?: NavigationInput): Promise<NavigationResponse> {
    const locale = input?.locale ?? 'en'
    const allDocuments = this.store.listDocuments()
    const visibleFolders = this.store
      .listFolders()
      .filter(
        (folder) =>
          folder.visibility === 'public' &&
          (folder.locale === 'all' || folder.locale === locale),
      )
    const visibleFolderIds = new Set(visibleFolders.map((folder) => folder.id))
    const visibleDocuments = allDocuments.filter(
      (document) =>
        visible(document) &&
        document.locale === locale &&
        visibleFolderIds.has(document.folderId),
    )
    const items = [
      ...visibleFolders.map((folder) => ({
        id: folder.id,
        parentId: folder.parentId,
        kind: 'folder' as const,
        documentId: null,
        slug: folder.slug,
        title: folder.title,
        locale,
        order: folder.order,
        hasChildren: visibleDocuments.some(
          (document) => document.folderId === folder.id,
        ),
      })),
      ...visibleDocuments.map((document) => ({
        id: document.id,
        parentId: document.folderId,
        kind: 'document' as const,
        documentId: document.id,
        slug: document.slug,
        title: document.title,
        locale: document.locale,
        order: documentOrder(document, allDocuments),
        hasChildren: false,
      })),
    ].sort(
      (left, right) =>
        left.order - right.order || left.title.localeCompare(right.title),
    )
    return {
      vault: { id: 'lorestra', name: 'Lorestra Vault', branch: 'main' },
      locale,
      items,
      documents: visibleDocuments.map((document) =>
        contractSummary(document, allDocuments),
      ),
      generatedAt: '2026-08-28T12:00:00.000Z',
    }
  }

  public async listDocuments(
    input?: ListDocumentsInput,
  ): Promise<DocumentListResponse> {
    const request = input ?? { locale: 'en', limit: 20, sort: 'updated' }
    const allDocuments = this.store.listDocuments()
    const query = request.q?.trim().toLocaleLowerCase(request.locale) ?? ''
    const filtered = allDocuments
      .filter(
        (document) =>
          visible(document) &&
          document.locale === request.locale &&
          (!request.folderId || document.folderId === request.folderId) &&
          (!request.type || documentType(document) === request.type) &&
          (!request.status || document.status === request.status) &&
          (!query ||
            [
              document.title,
              document.description,
              document.excerpt,
              document.folderPath.join('/'),
              ...document.tags,
            ].some((value) => value.toLocaleLowerCase(request.locale).includes(query))),
      )
      .sort((left, right) =>
        request.sort === 'title'
          ? left.title.localeCompare(right.title, request.locale)
          : request.sort === 'type'
            ? documentType(left).localeCompare(documentType(right), request.locale)
            : right.updatedAt.localeCompare(left.updatedAt),
      )
    const result = page(filtered, request.cursor, request.limit)
    return {
      items: result.items.map((document) => contractSummary(document, allDocuments)),
      pageInfo: result.pageInfo,
    }
  }

  public async getDocument(input: GetDocumentInput): Promise<DocumentResponse | null> {
    const current = this.store
      .listDocuments()
      .find(
        (document) =>
          visible(document) &&
          document.slug === input.slug &&
          document.locale === input.locale,
      )
    if (!current) return null
    const revision = input.version
      ? this.store.findRevision(current.id, input.version)
      : this.store.findRevision(current.id, current.version)
    if (!revision) return null
    return {
      document: toDocument(revision, this.store.listDocuments()),
      revision: toDocumentRevision(revision),
    }
  }

  public async getGraph(input?: GraphInput): Promise<GraphResponse> {
    const request = input ?? { scope: 'entire' as const, locale: 'en' as const }
    const allDocuments = this.store.listDocuments()
    const publicDocuments = allDocuments.filter(
      (document) => visible(document) && document.locale === request.locale,
    )
    const center = request.documentId
      ? publicDocuments.find((document) => document.id === request.documentId)
      : undefined
    let selected = publicDocuments
    if (request.scope === 'folder' && request.folderId)
      selected = publicDocuments.filter(
        (document) => document.folderId === request.folderId,
      )
    if (request.scope === 'related' && center) {
      const related = new Set([center.id, ...center.relatedDocumentIds])
      selected = publicDocuments.filter((document) => related.has(document.id))
    }
    const selectedFolderIds = new Set(selected.map((document) => document.folderId))
    const selectedFolders = this.store
      .listFolders()
      .filter(
        (folder) =>
          folder.visibility === 'public' &&
          (folder.locale === 'all' || folder.locale === request.locale) &&
          selectedFolderIds.has(folder.id),
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
      ...selected.map((document) => ({
        id: document.id,
        kind: 'document' as const,
        label: document.title,
        slug: document.slug,
        documentType: documentType(document),
        locale: document.locale,
      })),
    ]
    const selectedIds = new Set(selected.map((document) => document.id))
    const edges = selected.flatMap((document) => [
      {
        id: `contains-${document.folderId}-${document.id}`,
        source: document.folderId,
        target: document.id,
        kind: 'contains' as const,
      },
      ...document.relatedDocumentIds
        .filter((relatedId) => selectedIds.has(relatedId))
        .map((relatedId) => ({
          id: `related-${document.id}-${relatedId}`,
          source: document.id,
          target: relatedId,
          kind: 'related' as const,
        })),
    ])
    return {
      scope: request.scope,
      locale: request.locale,
      centerId: center?.id ?? null,
      nodes,
      edges,
      generatedAt: '2026-08-28T12:00:00.000Z',
    }
  }

  public async search(input: SearchInput): Promise<SearchResponse> {
    const allDocuments = this.store.listDocuments()
    const query = input.q.trim().toLowerCase()
    const candidates = allDocuments.filter(
      (document) =>
        visible(document) &&
        (!input.locale || document.locale === input.locale) &&
        (!input.type || documentType(document) === input.type) &&
        (!input.status || document.status === input.status) &&
        (!input.folderId || document.folderId === input.folderId),
    )
    const ranked = candidates
      .map((document) => {
        const title = document.title.toLowerCase()
        const tags = document.tags.map((tag) => tag.toLowerCase())
        const body =
          `${document.description} ${document.excerpt} ${document.content}`.toLowerCase()
        let score = 0
        if (title === query) score += 100
        if (title.includes(query)) score += 50
        if (tags.some((tag) => tag === query)) score += 30
        if (tags.some((tag) => tag.includes(query))) score += 15
        if (body.includes(query)) score += 5
        return { document, score }
      })
      .filter((item) => item.score > 0)
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.document.title.localeCompare(right.document.title),
      )
    const result = page(ranked, input.cursor, input.limit)
    return {
      query: input.q.trim(),
      items: result.items.map(({ document, score }) => ({
        id: document.id,
        slug: document.slug,
        locale: document.locale,
        title: document.title,
        type: documentType(document),
        status: document.status,
        excerpt: document.excerpt,
        score,
        updatedAt: document.updatedAt,
        relationCount: document.relatedDocumentIds.length,
      })),
      pageInfo: result.pageInfo,
      generatedAt: '2026-08-28T12:00:00.000Z',
    }
  }

  public async getHistory(input?: HistoryInput): Promise<HistoryResponse> {
    const request = input ?? { limit: 20 }
    const documentsById = new Map(
      this.store.listDocuments().map((document) => [document.id, document]),
    )
    const filtered = this.store
      .listHistory()
      .filter(
        (event) =>
          !event.documentId ||
          (documentsById.get(event.documentId)?.visibility === 'public' &&
            (!request.locale ||
              documentsById.get(event.documentId)?.locale === request.locale)),
      )
      .filter((event) => !request.documentId || event.documentId === request.documentId)
      .filter((event) => !request.proposalId || event.proposalId === request.proposalId)
      .filter((event) => !request.type || toHistoryType(event.type) === request.type)
      .filter(
        (event) =>
          !request.category ||
          historyCategory(toHistoryType(event.type)) === request.category,
      )
      .filter((event) => {
        if (!request.q) return true
        return `${event.summary} ${event.actor}`
          .toLocaleLowerCase()
          .includes(request.q.toLocaleLowerCase())
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    const result = page(filtered, request.cursor, request.limit)
    return {
      items: result.items.map((event) => ({
        id: event.id,
        type: toHistoryType(event.type),
        occurredAt: event.createdAt,
        actor: author(event.actor),
        proposalId: event.proposalId ?? null,
        documentId:
          event.documentId && documentsById.has(event.documentId)
            ? event.documentId
            : null,
        documentSlug: event.documentId
          ? (documentsById.get(event.documentId)?.slug ?? null)
          : null,
        summary: event.summary,
        resultingVersion:
          ['merged', 'document_published', 'document_updated'].includes(
            toHistoryType(event.type),
          ) && event.documentVersion > 0
            ? event.documentVersion
            : null,
      })),
      pageInfo: result.pageInfo,
    }
  }
}

function historyCategory(
  type: HistoryEvent['type'],
): 'proposal' | 'publish' | 'create' {
  if (type === 'document_published') return 'create'
  if (type === 'document_updated') return 'publish'
  return 'proposal'
}

export class MockProposalClient implements ProposalClient {
  public constructor(public readonly store: MockVaultStore = new MockVaultStore()) {}

  public async list(input?: ListProposalsInput): Promise<ProposalListResponse> {
    const records = this.store
      .listProposals()
      .filter(
        (proposal) =>
          !input?.status || toProposalStatus(proposal.status) === input.status,
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    const result = page(records, input?.cursor, input?.limit ?? 20)
    return {
      items: result.items.map((proposal) => {
        const full = toProposal(proposal)
        return {
          id: full.id,
          title: full.title,
          summary: full.summary,
          status: full.status,
          author: full.author,
          createdAt: full.createdAt,
          updatedAt: full.updatedAt,
          changeCount: full.changeCount,
          createsDocument: full.createsDocument,
        }
      }),
      pageInfo: result.pageInfo,
    }
  }

  public async get(input: GetProposalInput): Promise<Proposal | null> {
    const proposal = this.store.findProposal(input.proposalId)
    return proposal ? toProposal(proposal) : null
  }

  /** Creates a proposal only; the published document changes on merge. */
  public async create(input: CreateProposalInput): Promise<Proposal> {
    return this.createForTests(input)
  }

  public async createForTests(input: CreateProposalInput): Promise<Proposal> {
    const parsed = CreateProposalInputSchema.parse(input)
    const target = parsed.changes[0]?.target
    const targetDocument = target?.documentId
      ? this.store.findDocument(target.documentId)
      : undefined
    const firstAfter =
      parsed.changes.find((change) => change.after !== null)?.after ??
      targetDocument?.content ??
      ''
    const kind: FixtureProposal['kind'] = target?.documentId ? 'update' : 'create'
    const locale = parsed.locale ?? targetDocument?.locale ?? 'en'
    const folderId =
      targetDocument?.folderId ??
      (locale === 'pt-BR' ? 'folder.docs.pt-br' : 'folder.docs.en')
    const now = '2026-08-28T12:10:00.000Z'
    const proposal: FixtureProposal = {
      id: `proposal-local-${this.store.listProposals().length + 1}`,
      title: parsed.title,
      summary: parsed.summary,
      targetDocumentId: target?.documentId ?? null,
      kind,
      status: 'open',
      author: 'local-contributor',
      reviewers: [],
      createdAt: now,
      updatedAt: now,
      baseVersion: targetDocument?.version ?? null,
      proposed: {
        title: target?.title ?? parsed.title,
        description: targetDocument?.description ?? parsed.summary,
        content: firstAfter,
        slug:
          target?.slug ??
          parsed.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, ''),
        locale,
        folderId,
        tags: targetDocument?.tags ? [...targetDocument.tags] : ['proposal'],
        relatedDocumentIds: targetDocument?.relatedDocumentIds
          ? [...targetDocument.relatedDocumentIds]
          : [],
      },
      files: parsed.changes.map((change) => ({
        path:
          targetDocument?.path ??
          `vault/Docs/${locale === 'pt-BR' ? 'pt-BR' : 'en'}/${change.target.slug}.md`,
        changeType: change.changeType,
        additions: change.after?.split('\n').length ?? 0,
        deletions: change.before?.split('\n').length ?? 0,
      })),
      checks: parsed.changes.map((change) => ({
        name: `Validate ${change.target.slug}`,
        status: 'passed' as const,
      })),
      comments: [],
    }
    return toProposal(this.store.addProposal(proposal))
  }

  public async transition(input: ProposalTransitionInput): Promise<Proposal> {
    const parsed = ProposalTransitionInputSchema.parse(input)
    const target = fromProposalStatus(parsed.status)
    const proposal =
      target === 'merged'
        ? this.store.mergeProposal(parsed.proposalId)
        : this.store.updateProposalStatus(parsed.proposalId, target, parsed.reason)
    return toProposal(proposal)
  }
}

export const createMockClients = (
  data: FixtureStoreData = mockVaultData,
): MockClients => {
  const store = new MockVaultStore(data)
  return {
    store,
    knowledgeClient: new MockKnowledgeClient(store),
    proposalClient: new MockProposalClient(store),
  }
}

export const createMockKnowledgeClient = (data?: FixtureStoreData): KnowledgeClient =>
  createMockClients(data).knowledgeClient

export const createMockProposalClient = (data?: FixtureStoreData): ProposalClient =>
  createMockClients(data).proposalClient

export const defaultMockData: FixtureStoreData = {
  folders,
  documents,
  proposals,
  history,
}
