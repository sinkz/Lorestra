import { z } from 'zod'

import {
  IdSchema,
  IsoDateTimeSchema,
  LocaleSchema,
  PageInfoSchema,
  PaginationInputSchema,
  PublicationStatusSchema,
  SlugSchema,
} from './common.js'
import { DocumentTypeSchema } from './document.js'

export const SearchInputSchema = PaginationInputSchema.extend({
  q: z.string().trim().min(1).max(200),
  locale: LocaleSchema.optional(),
  type: DocumentTypeSchema.optional(),
  status: PublicationStatusSchema.optional(),
  folderId: IdSchema.optional(),
})
export type SearchInput = z.infer<typeof SearchInputSchema>

export const SearchResultSchema = z.object({
  id: IdSchema,
  slug: SlugSchema,
  locale: LocaleSchema,
  title: z.string().trim().min(1).max(240),
  type: DocumentTypeSchema,
  status: PublicationStatusSchema,
  excerpt: z.string().max(500),
  score: z.number().min(0),
  updatedAt: IsoDateTimeSchema,
  relationCount: z.number().int().min(0),
})
export type SearchResult = z.infer<typeof SearchResultSchema>

export const SearchResponseSchema = z.object({
  query: z.string().trim().min(1).max(200),
  items: z.array(SearchResultSchema),
  pageInfo: PageInfoSchema,
  generatedAt: IsoDateTimeSchema,
})
export type SearchResponse = z.infer<typeof SearchResponseSchema>
