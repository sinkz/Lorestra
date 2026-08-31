import type { Miniflare } from 'miniflare'
import type { Principal } from '../packages/contracts/src/session.js'
import type { VaultSeed } from './backend-seed.mjs'

export const repositoryRoot: string
export type LocalBindings = {
  DB: Awaited<ReturnType<Miniflare['getD1Database']>>
  VAULT: Awaited<ReturnType<Miniflare['getR2Bucket']>>
}
export type LocalSession = { token: string; csrfToken: string; expiresAt: string }
export type LocalBackend = {
  worker: string
  setup: {
    importVault(
      env: LocalBindings,
      manifest: VaultSeed,
    ): Promise<{ imported: number; unchanged: number; seedId: string }>
    createLocalSession(
      env: LocalBindings,
      principal: Principal,
      expiresAt?: string,
    ): Promise<LocalSession>
  }
}
export function compileLocalBackend(): Promise<LocalBackend>
export function createLocalRuntime(options: {
  worker: string
  storagePath: string
  origin: string
  port: number
}): Miniflare
export function localBindings(runtime: Miniflare): Promise<LocalBindings>
export function applyLocalMigrations(DB: LocalBindings['DB']): Promise<void>
