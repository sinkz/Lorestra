import { z } from 'zod'

import {
  IdSchema,
  IsoDateTimeSchema,
  LocaleSchema,
  SlugSchema,
  PageInfoSchema,
  PaginationInputSchema,
} from './common.js'
import { DocumentSummarySchema } from './document.js'

export const NavigationItemKindSchema = z.enum(['folder', 'document'])
export type NavigationItemKind = z.infer<typeof NavigationItemKindSchema>

export const NavigationItemSchema = z.object({
  id: IdSchema,
  parentId: IdSchema.nullable(),
  kind: NavigationItemKindSchema,
  documentId: IdSchema.nullable(),
  slug: SlugSchema.nullable(),
  title: z.string().trim().min(1).max(240),
  locale: LocaleSchema,
  order: z.number().int().min(0),
  hasChildren: z.boolean(),
})
export type NavigationItem = z.infer<typeof NavigationItemSchema>

export const NavigationInputSchema = z.object({
  locale: LocaleSchema.default('en'),
  parentId: IdSchema.nullable().optional(),
  documentId: IdSchema.optional(),
  cursor: PaginationInputSchema.shape.cursor,
  limit: PaginationInputSchema.shape.limit.unwrap().optional(),
})
export type NavigationInput = z.infer<typeof NavigationInputSchema>

export const NavigationResponseSchema = z.object({
  vault: z.object({
    id: IdSchema,
    name: z.string().trim().min(1).max(120),
    branch: z.string().trim().min(1).max(120),
  }),
  locale: LocaleSchema,
  items: z.array(NavigationItemSchema),
  documents: z.array(DocumentSummarySchema),
  generatedAt: IsoDateTimeSchema,
  pageInfo: PageInfoSchema.optional(),
  ancestors: z.array(NavigationItemSchema).optional(),
})
export type NavigationResponse = z.infer<typeof NavigationResponseSchema>
