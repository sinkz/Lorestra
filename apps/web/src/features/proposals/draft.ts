import type {
  DurableProposalChangeInput,
  DurableCreateProposalInput,
} from '@lorestra/contracts'
import type { Document, Locale, Proposal } from '../../shared/model/types'

type DraftFile = {
  id: string
  documentId: string | null
  baseVersion: number | null
  changeType: 'added' | 'modified' | 'deleted'
  title: string
  slug: string
  body: string
  type: 'lesson' | 'decision' | 'incident' | 'note' | 'process' | 'document'
  locale: Locale
  folderId: string
  tags: string
  relations: string
  visibility: 'public' | 'internal'
  status: 'draft' | 'published' | 'archived'
}
export type ProposalDraft = {
  title: string
  summary: string
  reason: string
  files: DraftFile[]
}
function slugify(title: string) {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 180)
}
export function documentDraft(
  document: Document | undefined,
  locale: Locale,
  body?: string,
): ProposalDraft {
  return {
    title: document
      ? `${locale === 'pt-BR' ? 'Atualizar' : 'Update'} ${document.title}`
      : '',
    summary: '',
    reason: '',
    files: [
      {
        id: crypto.randomUUID(),
        documentId: document?.id ?? null,
        baseVersion: document?.version ?? null,
        changeType: document ? 'modified' : 'added',
        title: document?.title ?? '',
        slug: document?.slug ?? '',
        body: body ?? document?.body ?? '',
        type:
          document?.metadata?.type ??
          (document?.kind === 'guide'
            ? 'lesson'
            : document?.kind === 'runbook'
              ? 'process'
              : document?.kind === 'docs'
                ? 'document'
                : document?.kind === 'folder'
                  ? 'note'
                  : (document?.kind ?? 'note')),
        locale: document?.locale ?? locale,
        folderId: document?.folderId === 'unfiled' ? '' : (document?.folderId ?? ''),
        tags: document?.tags.join(', ') ?? '',
        relations:
          (document?.metadata?.relations ?? document?.outgoingLinks)?.join(', ') ?? '',
        visibility: document?.visibility ?? 'public',
        status: document?.status ?? 'published',
      },
    ],
  }
}
export function proposalDraft(proposal: Proposal): ProposalDraft {
  const files = proposal.files.map((file): DraftFile => {
    const change = file.change
    if (!change) throw new Error('Proposal has no editable versioned metadata.')
    return {
      id: change.id,
      documentId: change.target.documentId,
      baseVersion: change.baseVersion,
      changeType: change.changeType,
      title: change.target.title,
      slug: change.target.slug,
      body: change.after ?? '',
      ...change.metadata,
      folderId: change.metadata.folderId ?? '',
      tags: change.metadata.tags.join(', '),
      relations: change.metadata.relations.join(', '),
    }
  })
  return {
    title: proposal.title,
    summary: proposal.summary,
    reason: proposal.reason ?? '',
    files,
  }
}
const split = (text: string) => [
  ...new Set(
    text
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean),
  ),
]
export function toProposalInput(draft: ProposalDraft): DurableCreateProposalInput {
  const changes: DurableProposalChangeInput[] = draft.files.map((file) => ({
    id: file.id,
    target: {
      documentId: file.documentId,
      title: file.title || draft.title,
      slug: file.slug || slugify(file.title || draft.title),
    },
    baseVersion: file.baseVersion,
    changeType: file.changeType,
    after: file.changeType === 'deleted' ? null : file.body,
    metadata: {
      type: file.type,
      locale: file.locale,
      folderId: file.folderId,
      tags: split(file.tags),
      relations: split(file.relations),
      visibility: file.visibility,
      status: file.status,
    },
  }))
  return {
    title: draft.title,
    summary: draft.summary || draft.title,
    reason: draft.reason || undefined,
    changes,
  }
}
