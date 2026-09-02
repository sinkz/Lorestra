import { cp, mkdir, mkdtemp, realpath, rm } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'

import type {
  Document,
  DurableCreateProposalInput,
  DurableProposal,
  Principal,
} from '@lorestra/contracts'
import type { BrowserContext, Page } from '@playwright/test'
import type { Miniflare } from 'miniflare'
import { test as base } from 'playwright-bdd'

import { buildVaultSeed, type VaultSeed } from '../../../scripts/backend-seed.mjs'
import {
  applyLocalMigrations,
  compileLocalBackend,
  createLocalRuntime,
  localBindings,
  type LocalBackend,
  type LocalBindings,
  type LocalSession,
} from '../../../scripts/backend-runtime.mjs'

const browserOrigin = 'http://127.0.0.1:4176'
const apiOrigin = 'http://127.0.0.1:8795'

type BackendBundle = LocalBackend & { seed: VaultSeed }
type SeededBackend = BackendBundle & {
  templatePath: string
  sessions: [string, LocalSession][]
}

export type WorkflowWorld = {
  proposal?: DurableProposal
  original?: Document
  input?: DurableCreateProposalInput
  draft?: string
  reason?: string
  proposals?: DurableProposal[]
  responses?: { status: number; body: unknown }[]
  mutationRequests?: number
  offlineAttempts?: { method: string; idempotencyKey?: string }[]
  proposalCountBefore?: number
  incomingReferenceSourceId?: string
  priorRevisionObjectKey?: string
  libraryTotal?: number
  auxiliaryPage?: Page
}

export const actors = {
  riley: { id: 'local.reader', name: 'Riley', role: 'reader' },
  casey: { id: 'local.contributor', name: 'Casey', role: 'contributor' },
  morgan: { id: 'local.maintainer', name: 'Morgan', role: 'maintainer' },
  taylor: { id: 'local.maintainer.second', name: 'Taylor', role: 'maintainer' },
} as const satisfies Record<string, Principal>

export class BackendRuntime {
  private runtime: Miniflare | undefined
  readonly sessions = new Map<string, LocalSession>()

  constructor(
    readonly bundle: BackendBundle,
    readonly storagePath: string,
  ) {}

  async start(seed = true, port = 8795) {
    this.runtime = createLocalRuntime({
      worker: this.bundle.worker,
      storagePath: this.storagePath,
      origin: browserOrigin,
      port,
    })
    await this.runtime.ready
    if (seed) {
      const env = await this.bindings()
      await applyLocalMigrations(env.DB)
      await this.bundle.setup.importVault(env, this.bundle.seed)
      for (const principal of Object.values(actors)) {
        this.sessions.set(
          principal.id,
          await this.bundle.setup.createLocalSession(env, principal),
        )
      }
    }
  }

  async bindings(): Promise<LocalBindings> {
    if (!this.runtime) throw new Error('The isolated Worker is not running')
    return localBindings(this.runtime)
  }

  async restart() {
    await this.stop()
    await this.start(false)
  }

  async stop() {
    await this.runtime?.dispose()
    this.runtime = undefined
  }

  async authenticate(context: BrowserContext, actor: keyof typeof actors) {
    const session = this.sessions.get(actors[actor].id)
    if (!session) throw new Error('The synthetic actor has not been provisioned')
    await context.clearCookies()
    await context.addCookies([
      {
        name: 'lorestra_session',
        value: session.token,
        url: browserOrigin,
        httpOnly: true,
        sameSite: 'Strict',
        secure: false,
        expires: Date.parse(session.expiresAt) / 1000,
      },
    ])
  }

  async request(endpoint: string, actor?: keyof typeof actors, init: RequestInit = {}) {
    const headers = new Headers(init.headers)
    headers.set('Origin', browserOrigin)
    if (actor) {
      const session = this.sessions.get(actors[actor].id)
      if (!session) throw new Error('The synthetic actor has not been provisioned')
      headers.set('Cookie', `lorestra_session=${session.token}`)
      headers.set('X-CSRF-Token', session.csrfToken)
    }
    return fetch(`${apiOrigin}/api${endpoint}`, { ...init, headers })
  }
}

async function removeIsolatedRuntime(scratchRoot: string, scratch: string) {
  const root = await realpath(scratchRoot)
  const target = await realpath(scratch)
  if (
    path.dirname(target) !== root ||
    !path.basename(target).startsWith('lorestra-http-')
  ) {
    throw new Error(
      'Refusing to remove a directory outside the isolated HTTP test root',
    )
  }
  await rm(target, { recursive: true, force: false })
}

export const test = base.extend<
  {
    backend: BackendRuntime
    traffic: { apiPaths: Set<string>; mockRequests: string[] }
    world: WorkflowWorld
  },
  { backendBundle: SeededBackend }
>({
  world: async ({ backend }, use) => {
    if (!backend.bundle.seed.documents.length)
      throw new Error('The workflow requires a seeded vault')
    await use({})
  },
  traffic: async ({ page }, use) => {
    const traffic = { apiPaths: new Set<string>(), mockRequests: [] as string[] }
    const record = (request: { url(): string }) => {
      const url = new URL(request.url())
      if (url.pathname.startsWith('/api/')) traffic.apiPaths.add(url.pathname)
      if (url.pathname.includes('/mock-vault/')) traffic.mockRequests.push(url.pathname)
    }
    page.on('request', record)
    await use(traffic)
    page.off('request', record)
  },
  backendBundle: [
    async ({ browserName }, use) => {
      if (browserName !== 'chromium')
        throw new Error('The local HTTP harness currently validates Chromium only')
      const [bundle, seed] = await Promise.all([
        compileLocalBackend(),
        buildVaultSeed(),
      ])
      const templatePath = await mkdtemp(path.join(tmpdir(), 'lorestra-http-template-'))
      const template = new BackendRuntime({ ...bundle, seed }, templatePath)
      try {
        await template.start(true, 0)
        await template.stop()
        await use({ ...bundle, seed, templatePath, sessions: [...template.sessions] })
      } finally {
        await template.stop()
        await removeIsolatedRuntime(tmpdir(), templatePath)
      }
    },
    { scope: 'worker' },
  ],
  backend: async ({ backendBundle }, use) => {
    // Keep workerd's SQLite filenames below Windows MAX_PATH in long workspaces.
    const scratchRoot = tmpdir()
    await mkdir(scratchRoot, { recursive: true })
    const scratch = await mkdtemp(path.join(scratchRoot, 'lorestra-http-'))
    const storagePath = path.join(scratch, 'state')
    const backend = new BackendRuntime(backendBundle, storagePath)
    try {
      // Copy into a nonexistent child so errorOnExist behaves consistently on every OS.
      // The source is a closed, internally created fixture store, never a live database.
      await cp(backendBundle.templatePath, storagePath, {
        recursive: true,
        errorOnExist: true,
        force: false,
      })
      for (const [id, session] of backendBundle.sessions)
        backend.sessions.set(id, session)
      await backend.start(false)
      await use(backend)
    } finally {
      await backend.stop()
      // Delete only the freshly created private test directory, never a user store.
      await removeIsolatedRuntime(scratchRoot, scratch)
    }
  },
})
