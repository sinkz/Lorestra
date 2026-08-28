import { z } from 'zod'

import {
  AuthorSchema,
  IdSchema,
  IsoDateTimeSchema,
  LocaleSchema,
  PageInfoSchema,
  PaginationInputSchema,
  SlugSchema,
} from './common.js'

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
})
export type ProposalChange = z.infer<typeof ProposalChangeSchema>

export const ProposalCheckSchema = z.object({
  name: z.string().trim().min(1).max(100),
  status: ProposalCheckStatusSchema,
})
export type ProposalCheck = z.infer<typeof ProposalCheckSchema>

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
})
export type ProposalSummary = z.infer<typeof ProposalSummarySchema>

export const ProposalSchema = ProposalSummarySchema.extend({
  changes: z.array(ProposalChangeSchema).max(200),
  checks: z.array(ProposalCheckSchema).max(50),
  discussionSummary: z.string().max(2000),
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
