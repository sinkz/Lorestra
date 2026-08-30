import { describe, expect, it } from 'vitest'
import type { GraphSnapshot } from '../../shared/model/types'
import { layoutGalaxies } from './galaxyLayout'

const node = (id: string, kind: GraphSnapshot['nodes'][number]['kind'] = 'note') => ({
  id,
  label: id,
  kind,
  status: 'published' as const,
})
const edge = (
  source: string,
  target: string,
  relation: GraphSnapshot['edges'][number]['relation'] = 'references',
) => ({
  id: `${relation}:${source}:${target}`,
  source,
  target,
  relation,
})
const star = (prefix: string): GraphSnapshot => ({
  nodes: [
    node(`${prefix}-hub`),
    ...Array.from({ length: 5 }, (_, index) => node(`${prefix}-${index}`)),
  ],
  edges: Array.from({ length: 5 }, (_, index) =>
    edge(`${prefix}-hub`, `${prefix}-${index}`),
  ),
})
const twoStars = (): GraphSnapshot => ({
  nodes: [...star('a').nodes, ...star('b').nodes],
  edges: [...star('a').edges, ...star('b').edges, edge('a-hub', 'b-hub')],
})

describe('galaxy layout', () => {
  it('has an explicit empty state', () => {
    expect(layoutGalaxies({ nodes: [], edges: [] })).toEqual({
      nodes: [],
      galaxies: [],
      bridges: [],
      edges: [],
      extent: 0,
    })
  })

  it('is deterministic across node and edge permutations without mutating the snapshot', () => {
    const graph = twoStars()
    const original = structuredClone(graph)
    const first = layoutGalaxies(graph)
    expect(
      layoutGalaxies({
        nodes: [...graph.nodes].reverse(),
        edges: [...graph.edges].reverse(),
      }),
    ).toEqual(first)
    expect(
      layoutGalaxies({
        nodes: [...graph.nodes.slice(4), ...graph.nodes.slice(0, 4)],
        edges: [...graph.edges.slice(3), ...graph.edges.slice(0, 3)],
      }),
    ).toEqual(first)
    expect(graph).toEqual(original)
  })

  it('keeps linked hub neighborhoods separate and creates only the real cross-galaxy bridge', () => {
    const layout = layoutGalaxies(twoStars())
    expect(layout.galaxies).toHaveLength(2)
    for (const prefix of ['a', 'b']) {
      const galaxy = layout.galaxies.find((group) =>
        group.nodeIds.includes(`${prefix}-hub`),
      )!
      expect(galaxy.hubId).toBe(`${prefix}-hub`)
      expect(galaxy.nodeIds).toHaveLength(6)
      expect(galaxy.nodeIds.every((id) => id.startsWith(prefix))).toBe(true)
    }
    expect(layout.bridges).toHaveLength(1)
    expect(layout.bridges[0].edgeIds).toEqual(['references:a-hub:b-hub'])
    expect(layout.bridges[0].sourceGalaxy).not.toBe(layout.bridges[0].targetGalaxy)
  })

  it('uses folder membership as affinity without collapsing all document communities into the folder', () => {
    const graph = twoStars()
    graph.nodes.push(node('folder', 'folder'))
    graph.edges.push(
      ...graph.nodes
        .filter((entry) => entry.kind !== 'folder')
        .map((entry) => edge('folder', entry.id, 'contains')),
    )
    const layout = layoutGalaxies(graph)
    const firstHub = layout.nodes.find((entry) => entry.id === 'a-hub')!
    const secondHub = layout.nodes.find((entry) => entry.id === 'b-hub')!
    expect(firstHub.galaxyId).not.toBe(secondHub.galaxyId)
    expect(layout.nodes).toHaveLength(graph.nodes.length)
    for (const prefix of ['a', 'b']) {
      const groupIds = new Set(
        layout.nodes
          .filter((entry) => entry.id.startsWith(`${prefix}-`))
          .map((entry) => entry.galaxyId),
      )
      expect(groupIds.size).toBe(1)
    }
  })

  it('does not invent relations between disconnected components or unfiled singletons', () => {
    const graph: GraphSnapshot = {
      nodes: ['a', 'b', 'c', 'd', 'e', 'alone', 'also-alone'].map((id) => node(id)),
      edges: [edge('a', 'b'), edge('b', 'c'), edge('d', 'e')],
    }
    const layout = layoutGalaxies(graph)
    expect(layout.galaxies).toHaveLength(4)
    expect(layout.bridges).toEqual([])
    expect(
      layout.galaxies.filter((galaxy) => galaxy.nodeIds.length === 1),
    ).toHaveLength(2)
    expect(layout.nodes.find((entry) => entry.id === 'alone')!.galaxyId).not.toBe(
      layout.nodes.find((entry) => entry.id === 'also-alone')!.galaxyId,
    )
  })

  it('ignores dangling, self, duplicate-ID and duplicate-relationship edges safely', () => {
    const valid = edge('a', 'b')
    const graph: GraphSnapshot = {
      nodes: [node('a'), node('b'), node('alone')],
      edges: [
        valid,
        { ...valid },
        { ...valid, id: 'z-duplicate' },
        edge('a', 'missing'),
        edge('a', 'a'),
        { ...edge('a', 'alone'), id: valid.id },
      ],
    }
    const layout = layoutGalaxies(graph)
    expect(layout.edges).toHaveLength(1)
    expect(layout.bridges).toEqual([])
    expect(layout.nodes.find((entry) => entry.id === 'a')!.degree).toBe(1)
    expect(
      layoutGalaxies({ nodes: graph.nodes, edges: [...graph.edges].reverse() }),
    ).toEqual(layout)
  })

  it('does not count returned backlinks as extra gravitational weight', () => {
    const graph = twoStars()
    const baseline = layoutGalaxies(graph)
    graph.edges.push(
      ...graph.edges.map((link) => edge(link.target, link.source, 'backlink')),
    )
    const mirrored = layoutGalaxies(graph)
    expect(mirrored.nodes).toEqual(baseline.nodes)
    expect(mirrored.galaxies).toEqual(baseline.galaxies)
  })

  it('fits bodies inside separated galaxy bounds, with a visibly larger hub', () => {
    const graph = twoStars()
    graph.nodes.push(node('orphan'))
    const layout = layoutGalaxies(graph)
    for (const galaxy of layout.galaxies) {
      const members = layout.nodes.filter((entry) => entry.galaxyId === galaxy.id)
      expect(members.filter((entry) => entry.isHub)).toHaveLength(1)
      const hub = members.find((entry) => entry.isHub)!
      for (const body of members) {
        expect([body.x, body.y, body.z, body.radius].every(Number.isFinite)).toBe(true)
        expect(
          Math.hypot(body.x - galaxy.x, body.y - galaxy.y, body.z - galaxy.z) +
            body.radius,
        ).toBeLessThanOrEqual(galaxy.radius)
        if (!body.isHub) expect(hub.radius).toBeGreaterThan(body.radius)
      }
      for (const other of layout.galaxies) {
        if (other.id === galaxy.id) continue
        expect(Math.hypot(galaxy.x - other.x, galaxy.y - other.y)).toBeGreaterThan(
          galaxy.radius + other.radius + 100,
        )
      }
    }
    for (const body of layout.nodes) {
      expect(Math.hypot(body.x, body.y, body.z) + body.radius).toBeLessThanOrEqual(
        layout.extent,
      )
      for (const other of layout.nodes) {
        if (body.id === other.id) continue
        expect(
          Math.hypot(body.x - other.x, body.y - other.y, body.z - other.z),
        ).toBeGreaterThan(body.radius + other.radius)
      }
    }
  })

  it('preserves all 200 unconnected documents as separate galaxies', () => {
    const graph: GraphSnapshot = {
      nodes: Array.from({ length: 200 }, (_, index) => node(`doc-${index}`)),
      edges: [],
    }
    const layout = layoutGalaxies(graph)
    expect(layout.nodes).toHaveLength(200)
    expect(layout.galaxies).toHaveLength(200)
    expect(layout.bridges).toEqual([])
    expect(Number.isFinite(layout.extent)).toBe(true)
    for (const galaxy of layout.galaxies) {
      for (const other of layout.galaxies) {
        if (galaxy.id === other.id) continue
        expect(Math.hypot(galaxy.x - other.x, galaxy.y - other.y)).toBeGreaterThan(
          galaxy.radius + other.radius,
        )
      }
    }
  })

  it('keeps every body non-overlapping in a dense 200-document system', () => {
    const graph: GraphSnapshot = {
      nodes: Array.from({ length: 200 }, (_, index) => node(`doc-${index}`)),
      edges: Array.from({ length: 199 }, (_, index) =>
        edge('doc-0', `doc-${index + 1}`),
      ),
    }
    const layout = layoutGalaxies(graph)
    expect(layout.galaxies).toHaveLength(1)
    expect(layout.nodes).toHaveLength(200)
    for (let index = 0; index < layout.nodes.length; index += 1) {
      const body = layout.nodes[index]
      for (const other of layout.nodes.slice(index + 1)) {
        expect(
          Math.hypot(body.x - other.x, body.y - other.y, body.z - other.z),
        ).toBeGreaterThan(body.radius + other.radius)
      }
    }
  })
})
