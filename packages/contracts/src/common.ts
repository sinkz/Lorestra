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

export const ContentHashSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/, 'Expected a SHA-256 hash')
export type ContentHash = z.infer<typeof ContentHashSchema>

export const IdempotencyKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9._:-]+$/)
export type IdempotencyKey = z.infer<typeof IdempotencyKeySchema>

/** Transport options are not part of the serialized business payload. */
export interface RequestOptions {
  signal?: AbortSignal
}

export interface MutationRequestOptions extends RequestOptions {
  idempotencyKey: string
  csrfToken?: string
}

export const VaultPathSchema = z
  .string()
  .trim()
  .min(1)
  .max(1000)
  .refine((path) => {
    if (/^[\\/]|^[a-z][a-z\d+.-]*:/i.test(path) || path.includes('\\')) return false
    try {
      return path.split('/').every((part) => {
        const decoded = decodeURIComponent(part)
        return (
          decoded.length > 0 &&
          decoded !== '.' &&
          decoded !== '..' &&
          !/[\\/]/.test(decoded) &&
          !decoded.includes('\0')
        )
      })
    } catch {
      return false
    }
  }, 'Expected a normalized relative vault path')
