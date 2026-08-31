import { documents } from './documents'
import type { FixtureGraphEdge, FixtureGraphNode } from './types'

const publicDocuments = documents.filter(
  (document) =>
    document.visibility === 'public' &&
    (document.status === 'published' || document.status === 'archived'),
)

export const graphNodes: readonly FixtureGraphNode[] = publicDocuments.map(
  (document) => ({
    id: `node-${document.id}`,
    documentId: document.id,
    label: document.title,
    slug: document.slug,
    folderId: document.folderId,
    kind: 'document',
  }),
)

const knownDocumentIds = new Set(publicDocuments.map((document) => document.id))

export const graphEdges: readonly FixtureGraphEdge[] = publicDocuments.flatMap(
  (document) =>
    document.relatedDocumentIds
      .filter((relatedId) => knownDocumentIds.has(relatedId) && document.id < relatedId)
      .map((relatedId) => ({
        id: `edge-${document.id}-${relatedId}`,
        source: `node-${document.id}`,
        target: `node-${relatedId}`,
        relation: 'related' as const,
      })),
)
