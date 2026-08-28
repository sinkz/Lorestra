import { z } from 'zod'

import {
  AuthorSchema,
  IdSchema,
  IsoDateTimeSchema,
  PageInfoSchema,
  PaginationInputSchema,
  SlugSchema,
} from './common.js'

export const HistoryEventTypeSchema = z.enum([
  'proposal_created',
  'changes_requested',
  'approved',
  'merged',
  'document_published',
  'document_updated',
])
export type HistoryEventType = z.infer<typeof HistoryEventTypeSchema>

export const HistoryEventSchema = z.object({
  id: IdSchema,
  type: HistoryEventTypeSchema,
  occurredAt: IsoDateTimeSchema,
  actor: AuthorSchema,
  proposalId: IdSchema.nullable(),
  documentId: IdSchema.nullable(),
  documentSlug: SlugSchema.nullable(),
  summary: z.string().trim().min(1).max(500),
  resultingVersion: z.number().int().positive().nullable(),
})
export type HistoryEvent = z.infer<typeof HistoryEventSchema>

export const HistoryInputSchema = PaginationInputSchema.extend({
  documentId: IdSchema.optional(),
  proposalId: IdSchema.optional(),
  type: HistoryEventTypeSchema.optional(),
})
export type HistoryInput = z.infer<typeof HistoryInputSchema>

export const HistoryResponseSchema = z.object({
  items: z.array(HistoryEventSchema),
  pageInfo: PageInfoSchema,
})
export type HistoryResponse = z.infer<typeof HistoryResponseSchema>
