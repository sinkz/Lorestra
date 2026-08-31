import type { Document } from '../packages/contracts/src/document.js'

export type SeedDocument = Document & {
  folderId: string
  path: string
  sourceHash: string
}

export interface SeedFolder {
  id: string
  slug: string
  title: string
  description: string
  parentId: string | null
  order: number
  visibility: 'public' | 'internal'
  locale: 'en' | 'pt-BR' | 'all'
}

export interface VaultSeed {
  schemaVersion: 1
  seedId: string
  vault: { id: string; name: string; branch: string }
  folders: SeedFolder[]
  documents: SeedDocument[]
}

export function assertVaultPath(value: unknown): string
export function parseVaultMarkdown(
  source: string,
  documentPath: string,
): {
  metadata: Record<string, unknown>
  body: string
  sourceHash: string
}
export function validateSeedReferences(manifest: VaultSeed): VaultSeed
export function buildVaultSeed(options?: { root?: string }): Promise<VaultSeed>
