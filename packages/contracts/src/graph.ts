import { z } from 'zod'

import { IdSchema, IsoDateTimeSchema, LocaleSchema } from './common.js'
import { DocumentTypeSchema } from './document.js'

export const GraphScopeSchema = z.enum(['entire', 'folder', 'related'])
export type GraphScope = z.infer<typeof GraphScopeSchema>

export const GraphInputSchema = z.object({
  scope: GraphScopeSchema.default('entire'),
  documentId: IdSchema.optional(),
  folderId: IdSchema.optional(),
  locale: LocaleSchema.default('en'),
})
export type GraphInput = z.infer<typeof GraphInputSchema>

export const GraphNodeKindSchema = z.enum(['document', 'folder'])
export type GraphNodeKind = z.infer<typeof GraphNodeKindSchema>

export const GraphNodeSchema = z.object({
  id: IdSchema,
  kind: GraphNodeKindSchema,
  label: z.string().trim().min(1).max(240),
  slug: z.string().nullable(),
  documentType: DocumentTypeSchema.nullable(),
  locale: LocaleSchema.nullable(),
})
export type GraphNode = z.infer<typeof GraphNodeSchema>

export const GraphEdgeKindSchema = z.enum(['contains', 'links_to', 'related'])
export type GraphEdgeKind = z.infer<typeof GraphEdgeKindSchema>

export const GraphEdgeSchema = z.object({
  id: IdSchema,
  source: IdSchema,
  target: IdSchema,
  kind: GraphEdgeKindSchema,
})
export type GraphEdge = z.infer<typeof GraphEdgeSchema>

export const GraphResponseSchema = z.object({
  scope: GraphScopeSchema,
  locale: LocaleSchema,
  centerId: IdSchema.nullable(),
  nodes: z.array(GraphNodeSchema).max(200),
  edges: z.array(GraphEdgeSchema).max(500),
  generatedAt: IsoDateTimeSchema,
})
export type GraphResponse = z.infer<typeof GraphResponseSchema>
