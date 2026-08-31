import type { DocumentType } from '@lorestra/contracts'

/**
 * Data owned by the fixture adapter.  These records deliberately resemble
 * the transport records from @lorestra/contracts, but the mock keeps its
 * editable store private.  mock.ts is the only module that crosses the
 * contract seam.
 */

export type FixtureLocale = 'en' | 'pt-BR'
export type FixtureVisibility = 'public' | 'internal'
export type FixtureStatus = 'published' | 'draft' | 'archived'
export type FixtureDocumentKind = 'document' | 'folder-index'

export interface FixtureFolder {
  readonly id: string
  readonly slug: string
  readonly title: string
  readonly description: string
  readonly parentId: string | null
  readonly order: number
  readonly visibility: FixtureVisibility
  readonly locale: FixtureLocale | 'all'
}

export interface FixtureDocument {
  readonly id: string
  readonly slug: string
  readonly title: string
  readonly description: string
  readonly excerpt: string
  readonly content: string
  readonly locale: FixtureLocale
  readonly folderId: string
  readonly folderPath: readonly string[]
  readonly kind: FixtureDocumentKind
  /** Semantic document type; older fixtures may rely on adapter inference. */
  readonly type?: DocumentType
  readonly visibility: FixtureVisibility
  readonly status: FixtureStatus
  readonly version: number
  readonly author: string
  readonly createdAt: string
  readonly updatedAt: string
  readonly tags: readonly string[]
  readonly relatedDocumentIds: readonly string[]
  readonly path: string
}

export type FixtureProposalStatus = 'open' | 'changes_requested' | 'approved' | 'merged'

export type FixtureProposalCheckStatus = 'pending' | 'passed' | 'failed'

export interface FixtureProposalCheck {
  readonly name: string
  readonly status: FixtureProposalCheckStatus
}

export type FixtureProposalKind = 'create' | 'update' | 'delete'

export interface FixtureProposalFile {
  readonly path: string
  readonly changeType: 'added' | 'modified' | 'deleted'
  readonly additions: number
  readonly deletions: number
}

export interface FixtureProposalRevision {
  readonly title: string
  readonly description: string
  readonly content: string
  readonly slug: string
  readonly locale: FixtureLocale
  readonly folderId: string
  readonly tags: readonly string[]
  readonly relatedDocumentIds: readonly string[]
}

export interface FixtureProposal {
  readonly id: string
  readonly title: string
  readonly summary: string
  readonly targetDocumentId: string | null
  readonly kind: FixtureProposalKind
  readonly status: FixtureProposalStatus
  readonly author: string
  readonly reviewers: readonly string[]
  readonly createdAt: string
  readonly updatedAt: string
  readonly baseVersion: number | null
  readonly proposed: FixtureProposalRevision
  readonly files: readonly FixtureProposalFile[]
  readonly checks: readonly FixtureProposalCheck[]
  readonly comments: readonly string[]
}

export type FixtureHistoryEventType =
  | 'created'
  | 'updated'
  | 'proposal_submitted'
  | 'proposal_approved'
  | 'proposal_rejected'
  | 'merged'

export interface FixtureHistoryEvent {
  readonly id: string
  readonly documentId: string
  readonly documentVersion: number
  readonly type: FixtureHistoryEventType
  readonly summary: string
  readonly actor: string
  readonly createdAt: string
  readonly proposalId?: string
}

export interface FixtureGraphNode {
  readonly id: string
  readonly documentId: string
  readonly label: string
  readonly slug: string
  readonly folderId: string
  readonly kind: 'document'
}

export interface FixtureGraphEdge {
  readonly id: string
  readonly source: string
  readonly target: string
  readonly relation: 'related'
}

export interface FixtureStoreData {
  readonly folders: readonly FixtureFolder[]
  readonly documents: readonly FixtureDocument[]
  readonly proposals: readonly FixtureProposal[]
  readonly history: readonly FixtureHistoryEvent[]
}
