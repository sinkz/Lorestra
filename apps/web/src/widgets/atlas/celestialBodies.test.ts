import { describe, expect, it } from 'vitest'
import type { DocumentKind } from '../../shared/model/types'
import { bodyColor, bodyKind, type CelestialBodyKind } from './celestialBodies'

describe('celestial knowledge semantics', () => {
  it.each<[DocumentKind, CelestialBodyKind]>([
    ['folder', 'star'],
    ['decision', 'ringed'],
    ['incident', 'comet'],
    ['runbook', 'satellite'],
    ['process', 'satellite'],
    ['note', 'moon'],
    ['guide', 'planet'],
    ['docs', 'planet'],
  ])('represents a published %s as a %s', (kind, expected) => {
    const result = bodyKind({
      id: 'memory',
      label: 'Memory',
      kind,
      status: 'published',
    })
    expect(result).toBe(expected)
    expect(bodyColor(result)).toMatch(/^#[a-f0-9]{6}$/)
  })

  it('represents archived knowledge as a black hole without inventing archive status for a folder', () => {
    expect(
      bodyKind({
        id: 'old',
        label: 'Old decision',
        kind: 'decision',
        status: 'archived',
      }),
    ).toBe('blackhole')
    expect(
      bodyKind({ id: 'archive', label: 'Archive', kind: 'folder', status: 'archived' }),
    ).toBe('star')
  })
})
