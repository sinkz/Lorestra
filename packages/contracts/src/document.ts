import { z } from 'zod'

import {
  AuthorSchema,
  ContentHashSchema,
  IdSchema,
  IsoDateTimeSchema,
  LocaleSchema,
  PageInfoSchema,
  PaginationInputSchema,
  PublicationStatusSchema,
  SlugSchema,
  VisibilitySchema,
} from './common.js'

export const DocumentTypeSchema = z.enum([
  'lesson',
  'decision',
  'incident',
  'note',
  'process',
  'document',
])
export type DocumentType = z.infer<typeof DocumentTypeSchema>

/** Editable fields only: identity, authorship and revision fields are server-owned. */
export const DurableProposalMetadataSchema = z
  .object({
    type: DocumentTypeSchema,
    folderId: IdSchema,
    tags: z
      .array(z.string().trim().min(1).max(80))
      .max(30)
      .refine((tags) => new Set(tags).size === tags.length, 'Tags must be unique'),
    relations: z
      .array(IdSchema)
      .max(200)
      .refine((ids) => new Set(ids).size === ids.length, 'Relations must be unique'),
    visibility: VisibilitySchema,
    status: PublicationStatusSchema,
    locale: LocaleSchema,
  })
  .strict()
export type DurableProposalMetadata = z.infer<typeof DurableProposalMetadataSchema>

export const NavigationMetadataSchema = z.object({
  visible: z.boolean(),
  parentId: IdSchema.nullable(),
  order: z.number().int().min(0),
})
export type NavigationMetadata = z.infer<typeof NavigationMetadataSchema>

export const DocumentSummarySchema = z.object({
  id: IdSchema,
  slug: SlugSchema,
  locale: LocaleSchema,
  title: z.string().trim().min(1).max(240),
  type: DocumentTypeSchema,
  visibility: VisibilitySchema,
  status: PublicationStatusSchema,
  version: z.number().int().positive(),
  author: AuthorSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  excerpt: z.string().max(500),
  tags: z.array(z.string().trim().min(1).max(80)).max(30),
  nav: NavigationMetadataSchema,
  relationCount: z.number().int().min(0),
  folderId: IdSchema.optional(),
  folderPath: z.string().max(1000).optional(),
  deleted: z.boolean().optional(),
})
export type DocumentSummary = z.infer<typeof DocumentSummarySchema>

export const DocumentSortSchema = z.enum(['updated', 'title', 'type'])
export type DocumentSort = z.infer<typeof DocumentSortSchema>

export const ListDocumentsInputSchema = PaginationInputSchema.extend({
  locale: LocaleSchema.default('en'),
  folderId: IdSchema.optional(),
  q: z.string().trim().max(200).optional(),
  type: DocumentTypeSchema.optional(),
  status: PublicationStatusSchema.optional(),
  sort: DocumentSortSchema.default('updated'),
})
export type ListDocumentsInput = z.infer<typeof ListDocumentsInputSchema>

export const DocumentListResponseSchema = z.object({
  items: z.array(DocumentSummarySchema),
  pageInfo: PageInfoSchema,
})
export type DocumentListResponse = z.infer<typeof DocumentListResponseSchema>

export const DocumentRevisionSchema = z.object({
  id: IdSchema,
  documentId: IdSchema,
  version: z.number().int().positive(),
  body: z.string(),
  message: z.string().trim().min(1).max(500),
  createdAt: IsoDateTimeSchema,
  createdBy: AuthorSchema,
  contentHash: ContentHashSchema.optional(),
  proposalId: IdSchema.nullable().optional(),
  metadata: DocumentSummarySchema.optional(),
})
export type DocumentRevision = z.infer<typeof DocumentRevisionSchema>

export const DocumentSchema = DocumentSummarySchema.extend({
  body: z.string(),
  relations: z.array(IdSchema).max(200),
})
export type Document = z.infer<typeof DocumentSchema>

export const DocumentResponseSchema = z.object({
  document: DocumentSchema,
  revision: DocumentRevisionSchema,
  resolvedLinks: z
    .array(z.object({ href: z.string().max(2000), slug: SlugSchema }))
    .max(500)
    .optional(),
})
export type DocumentResponse = z.infer<typeof DocumentResponseSchema>

export const GetDocumentInputSchema = z.object({
  slug: SlugSchema,
  locale: LocaleSchema.default('en'),
  version: z.coerce.number().int().positive().optional(),
})
export type GetDocumentInput = z.infer<typeof GetDocumentInputSchema>

export const GetDocumentByIdInputSchema = z.object({
  documentId: IdSchema,
  version: z.coerce.number().int().positive().optional(),
})
export type GetDocumentByIdInput = z.infer<typeof GetDocumentByIdInputSchema>
