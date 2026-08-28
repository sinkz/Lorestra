import { describe, expect, it } from 'vitest'
import type { GraphSnapshot } from '../../shared/model/types'
import { layoutGraph } from './graphLayout'

const graph: GraphSnapshot = {
  nodes: [
    { id: 'folder-a', label: 'Engineering', kind: 'folder', status: 'published' },
    { id: 'folder-b', label: 'Product', kind: 'folder', status: 'published' },
    ...Array.from({ length: 8 }, (_, index) => ({
      id: `document-${index}`,
      label: `Document ${index}`,
      kind: index % 3 === 0 ? ('decision' as const) : ('note' as const),
      status: 'published' as const,
    })),
  ],
  edges: [
    ...Array.from({ length: 8 }, (_, index) => ({
      id: `contains-${index}`,
      source: index < 4 ? 'folder-a' : 'folder-b',
      target: `document-${index}`,
      relation: 'contains' as const,
    })),
    { id: 'reference-1', source: 'document-0', target: 'document-5', relation: 'references' },
    { id: 'reference-2', source: 'document-2', target: 'document-7', relation: 'references' },
  ],
}

describe('constellation layout', () => {
  it('is deterministic and uses both axes instead of stacking nodes', () => {
    const first = layoutGraph(graph)
    const second = layoutGraph(graph)
    expect(second).toEqual(first)

    const xs = first.map((node) => node.x)
    const ys = first.map((node) => node.y)
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(600)
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(400)
    expect(first.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y))).toBe(true)
  })
})
