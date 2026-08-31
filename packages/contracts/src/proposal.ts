import { z } from 'zod'

import {
  AuthorSchema,
  ContentHashSchema,
  IdSchema,
  IsoDateTimeSchema,
  LocaleSchema,
  PageInfoSchema,
  PaginationInputSchema,
  SlugSchema,
  VaultPathSchema,
} from './common.js'
import { DurableProposalMetadataSchema } from './document.js'

export const ProposalStatusSchema = z.enum([
  'open',
  'changes_requested',
  'approved',
  'merged',
])
export type ProposalStatus = z.infer<typeof ProposalStatusSchema>

/**
 * The only legal proposal transitions.  Keeping this table beside the
 * transport contract gives every adapter the same workflow boundary without
 * importing application or storage code.
 */
export const ProposalTransitions: Readonly<
  Record<ProposalStatus, readonly ProposalStatus[]>
> = {
  open: ['changes_requested', 'approved'],
  changes_requested: ['open', 'approved'],
  approved: ['merged'],
  merged: [],
}

export function canTransitionProposal(
  from: ProposalStatus,
  to: ProposalStatus,
): boolean {
  return ProposalTransitions[from].includes(to)
}

/** Editing/resubmitting is a separate command, not a status-only transition. */
export function canEditProposal(status: ProposalStatus): boolean {
  return status !== 'merged'
}

export const ProposalChangeTypeSchema = z.enum(['added', 'modified', 'deleted'])
export type ProposalChangeType = z.infer<typeof ProposalChangeTypeSchema>

export const ProposalCheckStatusSchema = z.enum(['pending', 'passed', 'failed'])
export type ProposalCheckStatus = z.infer<typeof ProposalCheckStatusSchema>

export const ProposalTargetSchema = z.object({
  documentId: IdSchema.nullable(),
  slug: SlugSchema,
  title: z.string().trim().min(1).max(240),
})
export type ProposalTarget = z.infer<typeof ProposalTargetSchema>

export const ProposalChangeSchema = z.object({
  id: IdSchema,
  target: ProposalTargetSchema,
  path: z.string().trim().min(1).max(1000).optional(),
  changeType: ProposalChangeTypeSchema,
  before: z.string().nullable(),
  after: z.string().nullable(),
  baseVersion: z.number().int().positive().nullable().optional(),
  metadata: DurableProposalMetadataSchema.optional(),
  beforeMetadata: DurableProposalMetadataSchema.nullable().optional(),
  beforeTarget: ProposalTargetSchema.nullable().optional(),
})
export type ProposalChange = z.infer<typeof ProposalChangeSchema>

export const ProposalCheckSchema = z.object({
  name: z.string().trim().min(1).max(100),
  status: ProposalCheckStatusSchema,
})
export type ProposalCheck = z.infer<typeof ProposalCheckSchema>

export const ProposalApprovalSchema = z.object({
  reviewedProposalVersion: z.number().int().positive(),
  contentHash: ContentHashSchema,
  reviewedBy: AuthorSchema,
  reviewedAt: IsoDateTimeSchema,
})
export type ProposalApproval = z.infer<typeof ProposalApprovalSchema>

export const ProposalSummarySchema = z.object({
  id: IdSchema,
  title: z.string().trim().min(1).max(240),
  summary: z.string().trim().min(1).max(1000),
  status: ProposalStatusSchema,
  author: AuthorSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  changeCount: z.number().int().min(0),
  createsDocument: z.boolean(),
  proposalVersion: z.number().int().positive().optional(),
  contentHash: ContentHashSchema.optional(),
})
export type ProposalSummary = z.infer<typeof ProposalSummarySchema>

export const ProposalSchema = ProposalSummarySchema.extend({
  changes: z.array(ProposalChangeSchema).max(200),
  checks: z.array(ProposalCheckSchema).max(50),
  discussionSummary: z.string().max(2000),
  approval: ProposalApprovalSchema.nullable().optional(),
  reason: z.string().max(1000).optional(),
})
export type Proposal = z.infer<typeof ProposalSchema>

export const ListProposalsInputSchema = PaginationInputSchema.extend({
  status: ProposalStatusSchema.optional(),
})
export type ListProposalsInput = z.infer<typeof ListProposalsInputSchema>

export const ProposalListResponseSchema = z.object({
  items: z.array(ProposalSummarySchema),
  pageInfo: PageInfoSchema,
})
export type ProposalListResponse = z.infer<typeof ProposalListResponseSchema>

export const GetProposalInputSchema = z.object({
  proposalId: IdSchema,
})
export type GetProposalInput = z.infer<typeof GetProposalInputSchema>

export const CreateProposalInputSchema = z.object({
  title: z.string().trim().min(1).max(240),
  summary: z.string().trim().min(1).max(1000),
  changes: z.array(ProposalChangeSchema).min(1).max(200),
  locale: LocaleSchema.optional(),
})
export type CreateProposalInput = z.infer<typeof CreateProposalInputSchema>

export const ProposalTransitionInputSchema = z
  .object({
    proposalId: IdSchema,
    status: z.enum(['changes_requested', 'approved', 'merged']),
    reason: z.string().trim().min(1).max(1000).optional(),
  })
  .superRefine((input, context) => {
    if (input.status === 'changes_requested' && !input.reason) {
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'A reason is required when requesting changes.',
      })
    }
  })
export type ProposalTransitionInput = z.infer<typeof ProposalTransitionInputSchema>

// Structural ceilings, not the installation's effective limits. The server also
// checks SessionResponse.limits in bytes before parsing/storing a request body.
export const MAX_CONTRACT_DOCUMENT_BYTES = 1_048_576
export const MAX_CONTRACT_PROPOSAL_BYTES = 4_194_304

const DurableMarkdownSchema = z
  .string()
  .max(MAX_CONTRACT_DOCUMENT_BYTES)
  .refine(
    (body) => new TextEncoder().encode(body).byteLength <= MAX_CONTRACT_DOCUMENT_BYTES,
    'Markdown exceeds the contract byte limit',
  )

/** Real HTTP writes must use this schema; legacy mock input is not a safe fallback. */
export const DurableProposalChangeInputSchema = z
  .object({
    id: IdSchema,
    target: ProposalTargetSchema.strict(),
    path: VaultPathSchema.optional(),
    changeType: ProposalChangeTypeSchema,
    baseVersion: z.number().int().positive().nullable(),
    after: DurableMarkdownSchema.nullable(),
    metadata: DurableProposalMetadataSchema,
  })
  .strict()
  .superRefine((change, context) => {
    if (change.changeType === 'added') {
      if (change.target.documentId !== null) {
        context.addIssue({
          code: 'custom',
          path: ['target', 'documentId'],
          message: 'Added documents must not claim an existing identity.',
        })
      }
      if (change.baseVersion !== null) {
        context.addIssue({
          code: 'custom',
          path: ['baseVersion'],
          message: 'Added documents require an explicit null base version.',
        })
      }
    } else {
      if (change.target.documentId === null) {
        context.addIssue({
          code: 'custom',
          path: ['target', 'documentId'],
          message: 'Existing document identity is required.',
        })
      }
      if (change.baseVersion === null) {
        context.addIssue({
          code: 'custom',
          path: ['baseVersion'],
          message: 'The version read by the editor is required.',
        })
      }
    }
    if (
      change.changeType === 'deleted' ? change.after !== null : change.after === null
    ) {
      context.addIssue({
        code: 'custom',
        path: ['after'],
        message:
          'Deleted changes require null; added/modified changes require Markdown.',
      })
    }
  })
export type DurableProposalChangeInput = z.infer<
  typeof DurableProposalChangeInputSchema
>

const DurableChangesSchema = z
  .array(DurableProposalChangeInputSchema)
  .min(1)
  .max(200)
  .superRefine((changes, context) => {
    const ids = new Set<string>()
    const documents = new Set<string>()
    const slugs = new Set<string>()
    const paths = new Set<string>()
    changes.forEach((change, index) => {
      const slug = `${change.metadata.locale}:${change.target.slug}`
      if (
        ids.has(change.id) ||
        (change.target.documentId !== null &&
          documents.has(change.target.documentId)) ||
        slugs.has(slug) ||
        (change.path !== undefined && paths.has(change.path))
      ) {
        context.addIssue({
          code: 'custom',
          path: [index],
          message:
            'Changes must have unique identities, targets, locale slugs and paths.',
        })
      }
      ids.add(change.id)
      if (change.target.documentId !== null) documents.add(change.target.documentId)
      slugs.add(slug)
      if (change.path !== undefined) paths.add(change.path)
    })
    if (
      new TextEncoder().encode(JSON.stringify(changes)).byteLength >
      MAX_CONTRACT_PROPOSAL_BYTES
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Proposal exceeds the contract byte limit.',
      })
    }
  })

const durableProposalFields = {
  title: z.string().trim().min(1).max(240),
  summary: z.string().trim().min(1).max(1000),
  reason: z.string().trim().min(1).max(1000).optional(),
  changes: DurableChangesSchema,
}

export const DurableCreateProposalInputSchema = z.object(durableProposalFields).strict()
export type DurableCreateProposalInput = z.infer<
  typeof DurableCreateProposalInputSchema
>

export const DurableUpdateProposalInputSchema = z
  .object({
    ...durableProposalFields,
    proposalId: IdSchema,
    expectedProposalVersion: z.number().int().positive(),
  })
  .strict()
export type DurableUpdateProposalInput = z.infer<
  typeof DurableUpdateProposalInputSchema
>

export const MergeConfirmationSchema = z
  .object({
    proposalId: IdSchema,
    proposalVersion: z.number().int().positive(),
    contentHash: ContentHashSchema,
  })
  .strict()
export type MergeConfirmation = z.infer<typeof MergeConfirmationSchema>

export const DurableProposalTransitionInputSchema = z
  .object({
    proposalId: IdSchema,
    expectedProposalVersion: z.number().int().positive(),
    status: z.enum(['changes_requested', 'approved', 'merged']),
    reason: z.string().trim().min(1).max(1000).optional(),
    confirmation: MergeConfirmationSchema.optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.status === 'changes_requested' && !input.reason) {
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'A reason is required when requesting changes.',
      })
    }
    if (
      input.confirmation &&
      (input.status !== 'merged' ||
        input.confirmation.proposalId !== input.proposalId ||
        input.confirmation.proposalVersion !== input.expectedProposalVersion)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['confirmation'],
        message: 'Confirmation must identify this exact merge and proposal version.',
      })
    }
  })
export type DurableProposalTransitionInput = z.infer<
  typeof DurableProposalTransitionInputSchema
>

export const DurableProposalSchema = ProposalSchema.extend({
  proposalVersion: z.number().int().positive(),
  contentHash: ContentHashSchema,
  approval: ProposalApprovalSchema.nullable(),
  changes: z
    .array(
      ProposalChangeSchema.extend({
        baseVersion: z.number().int().positive().nullable(),
        metadata: DurableProposalMetadataSchema,
      }),
    )
    .max(200),
})
export type DurableProposal = z.infer<typeof DurableProposalSchema>
