import { env } from 'cloudflare:workers'
import { applyD1Migrations, reset } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  DocumentListResponseSchema,
  DocumentResponseSchema,
  GraphResponseSchema,
  HistoryResponseSchema,
  NavigationResponseSchema,
  SearchResponseSchema,
  DurableProposalSchema,
  type Document,
  type DurableCreateProposalInput,
} from '@lorestra/contracts'
import { createDurableApp } from './create-durable-app.js'
import { importVault } from '../adapters/durable/import-vault.js'
import { createLocalSession } from '../adapters/durable/identity.js'

const origin = 'http://127.0.0.1:5173'
const app = createDurableApp({ mode: 'local' })
const bindings = () => ({ ...env, LORESTRA_ORIGIN: origin })
let credentials: Awaited<ReturnType<typeof createLocalSession>>
const doc = (id: string, visibility: Document['visibility'] = 'public'): Document => ({
  id,
  slug: id,
  title: `Memory ${id}`,
  locale: 'en',
  type: 'note',
  visibility,
  status: 'published',
  version: 1,
  author: { id: 'seed-author', name: 'Example author' },
  createdAt: '2026-08-30T00:00:00.000Z',
  updatedAt: '2026-08-30T00:00:00.000Z',
  excerpt: 'Stable memory',
  tags: ['memory'],
  nav: { visible: true, parentId: 'docs', order: 1 },
  relationCount: 0,
  relations: [],
  body: `# ${id}`,
  folderId: 'docs',
})
const change = (id = 'first'): DurableCreateProposalInput => ({
  title: 'Record a solution',
  summary: 'Durable learning',
  reason: 'Verified in the example environment',
  changes: [
    {
      id: 'change',
      changeType: 'modified',
      target: { documentId: id, slug: id, title: 'Improved memory' },
      baseVersion: 1,
      after: '# Improved memory',
      metadata: {
        folderId: 'docs',
        type: 'process',
        locale: 'en',
        visibility: 'public',
        status: 'published',
        tags: ['verified'],
        relations: [],
      },
    },
  ],
})
async function request(
  path: string,
  options: {
    method?: string
    body?: unknown
    member?: boolean
    headers?: Record<string, string>
  } = {},
) {
  return app.request(
    `${origin}/api${path}`,
    {
      method: options.method ?? 'GET',
      headers: {
        ...(options.member
          ? {
              cookie: `lorestra_session=${credentials.token}`,
              'x-csrf-token': credentials.csrfToken,
            }
          : {}),
        ...(options.body !== undefined
          ? {
              'content-type': 'application/json',
              origin,
              'idempotency-key': crypto.randomUUID(),
            }
          : {}),
        ...options.headers,
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    },
    bindings(),
  )
}
beforeEach(async () => {
  await reset()
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
  const first = {
    ...doc('first'),
    body: '# Decision\n\n[Second](different-filename.md)\n[Hidden](hidden.md)',
    relations: ['second', 'hidden'],
    relationCount: 2,
  }
  await importVault(env, {
    schemaVersion: 1,
    seedId: 'http-tests',
    vault: { id: 'lorestra', name: 'Lorestra', branch: 'main' },
    folders: [
      {
        id: 'docs',
        slug: 'docs',
        title: 'Docs',
        parentId: null,
        order: 1,
        locale: 'all',
        visibility: 'public',
      },
    ],
    documents: [
      { ...first, path: 'vault/docs/first.md' },
      {
        ...doc('second'),
        body: '# Ciência e memória',
        path: 'vault/docs/different-filename.md',
      },
      {
        ...doc('hidden', 'internal'),
        body: '# Confidential example',
        path: 'vault/docs/hidden.md',
      },
    ],
  })
  credentials = await createLocalSession(env, {
    id: 'maintainer',
    name: 'Local maintainer',
    role: 'maintainer',
  })
})

describe('durable HTTP boundary with actual D1 and R2', () => {
  it('allows review but refuses publication while a stored blocking check has failed', async () => {
    const created = DurableProposalSchema.parse(
      await (
        await request('/proposals', {
          method: 'POST',
          member: true,
          body: change('second'),
        })
      ).json(),
    )
    // Trusted test-only fault injection, never an HTTP flag or client-owned check.
    await env.DB.prepare('UPDATE proposals SET payload_json=? WHERE id=?')
      .bind(
        JSON.stringify({
          ...created,
          checks: [{ name: 'Injected review gate', status: 'failed' }],
        }),
        created.id,
      )
      .run()
    const approved = DurableProposalSchema.parse(
      await (
        await request(`/proposals/${created.id}/status`, {
          method: 'PATCH',
          member: true,
          body: {
            proposalId: created.id,
            expectedProposalVersion: 1,
            status: 'approved',
          },
        })
      ).json(),
    )
    expect(approved.status).toBe('approved')
    expect(approved.checks[0]?.status).toBe('failed')
    const failed = await request(`/proposals/${created.id}/status`, {
      method: 'PATCH',
      member: true,
      body: {
        proposalId: created.id,
        expectedProposalVersion: approved.proposalVersion,
        status: 'merged',
      },
    })
    expect(failed.status).toBe(409)
    expect(await failed.json()).toMatchObject({ error: { code: 'invalid_transition' } })
    const unchanged = DocumentResponseSchema.parse(
      await (await request('/documents/second')).json(),
    )
    expect(unchanged.document.version).toBe(1)
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM history WHERE type IN ('merged','document_updated')",
      ).first<number>('count'),
    ).toBe(0)
  })
  it('rejects duplicate and cross-language portable aliases before preparing objects', async () => {
    const candidate = {
      schemaVersion: 1,
      seedId: 'invalid-alias',
      vault: { id: 'lorestra', name: 'Lorestra', branch: 'main' },
      folders: [
        {
          id: 'docs',
          slug: 'docs',
          title: 'Docs',
          parentId: null,
          order: 1,
          locale: 'all',
          visibility: 'public',
        },
      ],
      documents: [{ ...doc('imported'), path: 'vault/docs/imported.md' }],
    }
    const alias = { locale: 'en', slug: 'old-imported', documentId: 'imported' }
    const pathAlias = { path: 'vault/docs/old-imported.md', documentId: 'imported' }
    const initialObjects = (await env.VAULT.list()).objects.map((object) => object.key)
    for (const extra of [
      { aliases: [{ ...alias, locale: 'pt-BR' }] },
      { aliases: [alias, alias] },
      { pathAliases: [pathAlias, pathAlias] },
    ]) {
      await expect(importVault(env, { ...candidate, ...extra })).rejects.toMatchObject({
        code: 'validation_error',
        status: 422,
      })
      expect((await env.VAULT.list()).objects.map((object) => object.key)).toEqual(
        initialObjects,
      )
      expect((await request('/documents/imported')).status).toBe(404)
    }
  })
  it('projects public metadata, relative links and graph without private identities or counts', async () => {
    const response = await request('/documents/first')
    expect(response.status).toBe(200)
    const result = DocumentResponseSchema.parse(await response.json())
    expect(result.document.relations).toEqual(['second'])
    expect(result.document.relationCount).toBe(1)
    expect(result.revision.metadata?.relationCount).toBe(1)
    expect(result.resolvedLinks).toEqual([
      { href: 'different-filename.md', slug: 'second' },
    ])
    expect((await request('/documents/hidden')).status).toBe(404)
    const graph = GraphResponseSchema.parse(
      await (await request('/graph?locale=en&scope=entire')).json(),
    )
    expect(graph.nodes.map((node) => node.id)).not.toContain('hidden')
    expect(
      graph.edges.every(
        (edge) =>
          graph.nodes.some((node) => node.id === edge.source) &&
          graph.nodes.some((node) => node.id === edge.target),
      ),
    ).toBe(true)
    const privateDocument = DocumentResponseSchema.parse(
      await (await request('/documents/hidden', { member: true })).json(),
    )
    expect(privateDocument.document.visibility).toBe('internal')
  })
  it('paginates directory and library with filter-bound cursors, and searches accented content', async () => {
    const roots = NavigationResponseSchema.parse(
      await (await request('/navigation?locale=en&limit=1')).json(),
    )
    expect(roots.items.map((item) => item.id)).toEqual(['docs'])
    expect(roots.documents).toHaveLength(0)
    const children = NavigationResponseSchema.parse(
      await (
        await request('/navigation?locale=en&parentId=docs&limit=1&documentId=second')
      ).json(),
    )
    expect(children.items).toHaveLength(1)
    expect(children.pageInfo?.totalCount).toBe(2)
    expect(children.ancestors?.map((item) => item.id)).toEqual(['docs'])
    const first = DocumentListResponseSchema.parse(
      await (await request('/documents?limit=1&sort=title')).json(),
    )
    const second = DocumentListResponseSchema.parse(
      await (
        await request(
          `/documents?limit=1&sort=title&cursor=${encodeURIComponent(first.pageInfo.nextCursor!)}`,
        )
      ).json(),
    )
    expect(first.items[0]?.id).not.toBe(second.items[0]?.id)
    expect(
      (
        await request(
          `/documents?limit=1&sort=updated&cursor=${encodeURIComponent(first.pageInfo.nextCursor!)}`,
        )
      ).status,
    ).toBe(400)
    const found = SearchResponseSchema.parse(
      await (await request('/search?q=ciencia')).json(),
    )
    expect(found.items.map((item) => item.id)).toEqual(['second'])
    const literal = SearchResponseSchema.parse(
      await (await request('/search?q=%25')).json(),
    )
    expect(literal.items).toHaveLength(0)
  })
  it('rejects impersonation, forbidden origins, CSRF, unknown fields, and missing idempotency', async () => {
    expect(
      (await request('/proposals', { method: 'POST', body: change() })).status,
    ).toBe(401)
    expect(
      (
        await request('/proposals', {
          method: 'POST',
          body: change(),
          member: true,
          headers: { origin: 'https://attacker.invalid' },
        })
      ).status,
    ).toBe(403)
    expect(
      (
        await request('/proposals', {
          method: 'POST',
          body: change(),
          member: true,
          headers: { 'x-csrf-token': 'wrong' },
        })
      ).status,
    ).toBe(403)
    expect(
      (
        await request('/proposals', {
          method: 'POST',
          body: { ...change(), role: 'maintainer' },
          member: true,
        })
      ).status,
    ).toBe(422)
    expect(
      (
        await request('/proposals', {
          method: 'POST',
          body: change(),
          member: true,
          headers: { 'idempotency-key': '' },
        })
      ).status,
    ).toBe(422)
    const login = await request('/session', {
      method: 'POST',
      body: { token: credentials.token },
    })
    expect(login.status).toBe(200)
    expect(login.headers.get('set-cookie')).toContain('HttpOnly')
    const shared = createDurableApp({ mode: 'shared' })
    expect(
      (
        await shared.request(
          `${origin}/api/session`,
          {
            method: 'POST',
            headers: { origin, 'content-type': 'application/json' },
            body: JSON.stringify({ token: credentials.token }),
          },
          bindings(),
        )
      ).status,
    ).toBe(404)
  })
  it('publishes only on merge and serves immutable version metadata and history by identity', async () => {
    const createdResponse = await request('/proposals', {
      method: 'POST',
      body: change(),
      member: true,
    })
    expect(createdResponse.status).toBe(200)
    const created = DurableProposalSchema.parse(await createdResponse.json())
    const audit = await env.DB.prepare(
      "SELECT payload_json FROM history WHERE proposal_id=? AND type='proposal_created'",
    )
      .bind(created.id)
      .first<string>('payload_json')
    expect(JSON.parse(audit!).requestId).toBe(
      createdResponse.headers.get('x-request-id'),
    )
    expect((await request(`/proposals/${created.id}`)).status).toBe(404)
    let published = DocumentResponseSchema.parse(
      await (await request('/documents/first')).json(),
    )
    expect(published.document.version).toBe(1)
    const approved = DurableProposalSchema.parse(
      await (
        await request(`/proposals/${created.id}/status`, {
          method: 'PATCH',
          body: {
            proposalId: created.id,
            expectedProposalVersion: 1,
            status: 'approved',
          },
          member: true,
        })
      ).json(),
    )
    const mergeInput = {
      proposalId: created.id,
      expectedProposalVersion: approved.proposalVersion,
      status: 'merged',
      confirmation: {
        proposalId: approved.id,
        proposalVersion: approved.proposalVersion,
        contentHash: approved.contentHash,
      },
    }
    const merged = await request(`/proposals/${created.id}/status`, {
      method: 'PATCH',
      body: mergeInput,
      member: true,
      headers: { 'idempotency-key': 'merge' },
    })
    expect(merged.status).toBe(200)
    const replay = await request(`/proposals/${created.id}/status`, {
      method: 'PATCH',
      body: mergeInput,
      member: true,
      headers: { 'idempotency-key': 'merge' },
    })
    expect(await replay.json()).toEqual(await merged.json())
    published = DocumentResponseSchema.parse(
      await (await request('/documents/by-id/first')).json(),
    )
    expect(published.document.version).toBe(2)
    expect(published.document.type).toBe('process')
    const historical = DocumentResponseSchema.parse(
      await (await request('/documents/by-id/first?version=1')).json(),
    )
    expect(historical.document.type).toBe('note')
    expect(historical.document.body).toContain('[Second]')
    const history = HistoryResponseSchema.parse(
      await (await request('/history?documentId=first', { member: true })).json(),
    )
    expect(history.items).toHaveLength(1)
    expect(
      (await request(`/history/${history.items[0]!.id}`, { member: true })).status,
    ).toBe(200)
    // The old body referenced an internal document: keep its proposal trail private.
    expect((await request(`/history/${history.items[0]!.id}`)).status).toBe(404)
  })
  it('keeps proposals with removed private changes out of public history and totals', async () => {
    const privateInput = change('hidden')
    privateInput.changes[0]!.metadata.visibility = 'internal'
    const proposal = DurableProposalSchema.parse(
      await (
        await request('/proposals', {
          method: 'POST',
          body: privateInput,
          member: true,
        })
      ).json(),
    )
    const updated = DurableProposalSchema.parse(
      await (
        await request(`/proposals/${proposal.id}`, {
          method: 'PATCH',
          body: { ...change(), proposalId: proposal.id, expectedProposalVersion: 1 },
          member: true,
        })
      ).json(),
    )
    const approved = DurableProposalSchema.parse(
      await (
        await request(`/proposals/${proposal.id}/status`, {
          method: 'PATCH',
          body: {
            proposalId: proposal.id,
            expectedProposalVersion: updated.proposalVersion,
            status: 'approved',
          },
          member: true,
        })
      ).json(),
    )
    expect(
      (
        await request(`/proposals/${proposal.id}/status`, {
          method: 'PATCH',
          body: {
            proposalId: proposal.id,
            expectedProposalVersion: approved.proposalVersion,
            status: 'merged',
          },
          member: true,
        })
      ).status,
    ).toBe(200)
    expect((await request(`/proposals/${proposal.id}`)).status).toBe(404)
    const proposals: { pageInfo: { totalCount: number } } = await (
      await request('/proposals')
    ).json()
    expect(proposals.pageInfo.totalCount).toBe(0)
    const history = HistoryResponseSchema.parse(
      await (await request('/history')).json(),
    )
    expect(history.items).toHaveLength(0)
    expect(history.pageInfo.totalCount).toBe(0)
  })
  it('enforces revocation, read-only state, bounded JSON, and advertised retry windows', async () => {
    await env.DB.prepare(
      "UPDATE vault_settings SET value='true' WHERE key='read_only'",
    ).run()
    expect(
      (await request('/proposals', { method: 'POST', body: change(), member: true }))
        .status,
    ).toBe(503)
    const logout = await request('/session/logout', {
      method: 'POST',
      body: {},
      member: true,
    })
    expect(logout.status).toBe(200)
    expect((await request('/documents/hidden', { member: true })).status).toBe(404)
    const oversized = await request('/session', {
      method: 'POST',
      body: { token: 'a'.repeat(3000) },
    })
    expect(oversized.status).toBe(413)
    await env.DB.prepare("INSERT INTO vault_settings(key,value) VALUES('limits',?)")
      .bind(JSON.stringify({ maxRequestsPerMinute: 1 }))
      .run()
    const limited = await request('/documents')
    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).toBe('60')
  })
  it('generates its OpenAPI schemas without mock imports or a local session route in shared mode', async () => {
    const response = await request('/openapi.json')
    expect(response.status).toBe(200)
    const description: { paths: Record<string, unknown> } = await response.json()
    expect(description.paths['/api/proposals/{proposalId}/status']).toBeTruthy()
  })
  it('keeps old Markdown paths and slugs resolving after rename and rejects path stealing on import', async () => {
    const input = change('second')
    input.changes[0]!.target.slug = 'renamed-second'
    const proposal = DurableProposalSchema.parse(
      await (
        await request('/proposals', { method: 'POST', member: true, body: input })
      ).json(),
    )
    const approved = DurableProposalSchema.parse(
      await (
        await request(`/proposals/${proposal.id}/status`, {
          method: 'PATCH',
          member: true,
          body: {
            proposalId: proposal.id,
            expectedProposalVersion: 1,
            status: 'approved',
          },
        })
      ).json(),
    )
    expect(
      (
        await request(`/proposals/${proposal.id}/status`, {
          method: 'PATCH',
          member: true,
          body: {
            proposalId: proposal.id,
            expectedProposalVersion: approved.proposalVersion,
            status: 'merged',
          },
        })
      ).status,
    ).toBe(200)
    const first = DocumentResponseSchema.parse(
      await (await request('/documents/first')).json(),
    )
    expect(first.resolvedLinks).toContainEqual({
      href: 'different-filename.md',
      slug: 'renamed-second',
    })
    const oldAlias = DocumentResponseSchema.parse(
      await (await request('/documents/second')).json(),
    )
    expect(oldAlias.document.id).toBe('second')
    expect(oldAlias.document.slug).toBe('renamed-second')
    await expect(
      importVault(env, {
        schemaVersion: 1,
        seedId: 'path-conflict',
        vault: { id: 'lorestra', name: 'Lorestra', branch: 'main' },
        folders: [
          {
            id: 'docs',
            slug: 'docs',
            title: 'Docs',
            parentId: null,
            order: 1,
            locale: 'all',
            visibility: 'public',
          },
        ],
        documents: [{ ...doc('unrelated'), path: 'vault/docs/different-filename.md' }],
      }),
    ).rejects.toMatchObject({ code: 'conflict', status: 409 })
    expect((await request('/documents/unrelated')).status).toBe(404)
  })
})
