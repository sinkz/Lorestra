import { readdirSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { documents } from './documents'
import { intentionallyUnrepresentedVaultPaths } from './coverage'

const normalize = (value: string): string => value.replaceAll('\\', '/')

function markdownPaths(directory: string, root: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = resolve(directory, entry.name)
    if (entry.isDirectory()) return markdownPaths(absolute, root)
    return entry.isFile() && entry.name.endsWith('.md')
      ? [normalize(relative(root, absolute))]
      : []
  })
}

describe('vault fixture coverage', () => {
  it('keeps vault and curated fixture paths in an explicit state', () => {
    const repositoryRoot = resolve(import.meta.dirname, '../../../..')
    const vaultRoot = resolve(repositoryRoot, 'vault')
    const vaultPaths = new Set(markdownPaths(vaultRoot, repositoryRoot))
    const fixturePaths = new Set(documents.map((document) => normalize(document.path)))
    const intentionallyUnrepresented = new Set(
      intentionallyUnrepresentedVaultPaths.map(normalize),
    )

    const missingFixtures = [...vaultPaths]
      .filter(
        (path) => !fixturePaths.has(path) && !intentionallyUnrepresented.has(path),
      )
      .sort()
    const staleFixtures = [...fixturePaths]
      .filter((path) => !vaultPaths.has(path))
      .sort()

    expect({ missingFixtures, staleFixtures }).toEqual({
      missingFixtures: [],
      staleFixtures: [],
    })
  })
})
