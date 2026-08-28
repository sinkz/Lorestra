import { z } from 'zod'

import {
  AuthorSchema,
  IdSchema,
  IsoDateTimeSchema,
  LocaleSchema,
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
})
export type DocumentSummary = z.infer<typeof DocumentSummarySchema>

export const DocumentRevisionSchema = z.object({
  id: IdSchema,
  documentId: IdSchema,
  version: z.number().int().positive(),
  body: z.string(),
  message: z.string().trim().min(1).max(500),
  createdAt: IsoDateTimeSchema,
  createdBy: AuthorSchema,
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
})
export type DocumentResponse = z.infer<typeof DocumentResponseSchema>

export const GetDocumentInputSchema = z.object({
  slug: SlugSchema,
  locale: LocaleSchema.default('en'),
  version: z.coerce.number().int().positive().optional(),
})
export type GetDocumentInput = z.infer<typeof GetDocumentInputSchema>
