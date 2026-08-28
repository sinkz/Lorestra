import { documents } from './documents'
import type { FixtureGraphEdge, FixtureGraphNode } from './types'

export const graphNodes: readonly FixtureGraphNode[] = documents.map((document) => ({
  id: `node-${document.id}`,
  documentId: document.id,
  label: document.title,
  slug: document.slug,
  folderId: document.folderId,
  kind: 'document',
}))

const knownDocumentIds = new Set(documents.map((document) => document.id))

export const graphEdges: readonly FixtureGraphEdge[] = documents.flatMap((document) =>
  document.relatedDocumentIds
    .filter((relatedId) => knownDocumentIds.has(relatedId) && document.id < relatedId)
    .map((relatedId) => ({
      id: `edge-${document.id}-${relatedId}`,
      source: `node-${document.id}`,
      target: `node-${relatedId}`,
      relation: 'related' as const,
    })),
)
