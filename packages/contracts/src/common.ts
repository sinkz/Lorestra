import { z } from 'zod'

export const LocaleSchema = z.enum(['en', 'pt-BR'])
export type Locale = z.infer<typeof LocaleSchema>

export const IdSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, 'Invalid stable identifier')
export type Id = z.infer<typeof IdSchema>

export const SlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug')
export type Slug = z.infer<typeof SlugSchema>

export const IsoDateTimeSchema = z.string().datetime({ offset: true })
export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>

export const VisibilitySchema = z.enum(['public', 'internal'])
export type Visibility = z.infer<typeof VisibilitySchema>

export const PublicationStatusSchema = z.enum(['draft', 'published', 'archived'])
export type PublicationStatus = z.infer<typeof PublicationStatusSchema>

export const PaginationInputSchema = z.object({
  cursor: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
export type PaginationInput = z.infer<typeof PaginationInputSchema>

export const PageInfoSchema = z.object({
  nextCursor: z.string().nullable(),
  previousCursor: z.string().nullable(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
  totalCount: z.number().int().min(0),
})
export type PageInfo = z.infer<typeof PageInfoSchema>

export const AuthorSchema = z.object({
  id: IdSchema,
  name: z.string().trim().min(1).max(120),
})
export type Author = z.infer<typeof AuthorSchema>
