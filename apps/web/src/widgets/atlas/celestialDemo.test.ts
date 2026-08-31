import { describe, expect, it } from 'vitest'
import { createMockClients } from '@lorestra/mock-vault'
import { createKnowledgeAdapter } from '../../shared/api/client'
import { bodyKind } from './celestialBodies'
import { layoutGalaxies } from './galaxyLayout'

describe('bilingual celestial demo through the application client', () => {
  it.each(['en', 'pt-BR'] as const)(
    'keeps three example communities and all body models in %s',
    async (locale) => {
      const client = createKnowledgeAdapter(createMockClients().knowledgeClient)
      const graph = await client.getGraph({ scope: 'entire', locale })
      const nodes = graph.nodes.filter(
        (node) =>
          node.id.startsWith('lorestra.demo.') || node.id.startsWith('folder.demo.'),
      )
      const ids = new Set(nodes.map((node) => node.id))
      const edges = graph.edges.filter(
        (edge) => ids.has(edge.source) && ids.has(edge.target),
      )
      expect(nodes).toHaveLength(21)
      expect([...new Set(nodes.map(bodyKind))].sort()).toEqual(
        ['star', 'planet', 'moon', 'ringed', 'comet', 'satellite', 'blackhole'].sort(),
      )
      const layout = layoutGalaxies({ nodes, edges })
      expect(layout.galaxies).toHaveLength(3)
      expect(layout.bridges).toHaveLength(2)
      for (const galaxy of layout.galaxies) {
        expect(galaxy.nodeIds).toHaveLength(7)
        expect(new Set(galaxy.nodeIds.map((id) => id.split('.')[2])).size).toBe(1)
      }
      for (const name of ['orion', 'lyra', 'cygnus']) {
        const legacy = await client.getDocument({ slug: `demo-${name}-legacy`, locale })
        const runbook = await client.getDocument({
          slug: `demo-${name}-runbook`,
          locale,
        })
        expect(legacy?.status).toBe('archived')
        expect(runbook?.kind).toBe('process')
        expect(runbook?.body.length).toBeGreaterThan(100)
      }
    },
  )
})
