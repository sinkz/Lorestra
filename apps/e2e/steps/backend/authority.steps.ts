import { randomUUID } from 'node:crypto'

import { DurableProposalSchema, type DurableProposal } from '@lorestra/contracts'
import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { actors, test, type BackendRuntime } from '../../fixtures/backend'
import {
  createProposal,
  readDocument,
  readProposal,
  transitionProposal,
} from '../../fixtures/http-workflow'

const { When, Then } = createBdd(test)
const jsonHeaders = () => ({
  'content-type': 'application/json',
  'idempotency-key': randomUUID(),
})
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing preceding workflow state')
  return value
}

async function businessState(backend: BackendRuntime) {
  const { DB } = await backend.bindings()
  const tables = [
    'documents',
    'document_paths',
    'revisions',
    'relations',
    'proposals',
    'proposal_versions',
    'history',
    'operations',
  ]
  return JSON.stringify(
    (
      await DB.batch(
        tables.map((table) => DB.prepare(`SELECT * FROM ${table} ORDER BY rowid`)),
      )
    ).map((result) => result.results),
  )
}

function transition(proposal: DurableProposal, status: 'approved' | 'merged') {
  return {
    proposalId: proposal.id,
    expectedProposalVersion: proposal.proposalVersion,
    status,
    ...(status === 'merged'
      ? {
          confirmation: {
            proposalId: proposal.id,
            proposalVersion: proposal.proposalVersion,
            contentHash: proposal.contentHash,
          },
        }
      : {}),
  }
}

When(
  'unauthorized actors, forged metadata and invalid CSRF attempt mutations',
  async ({ backend, world }) => {
    const proposal = required(world.proposal)
    const input = required(world.input)
    const before = await businessState(backend)
    const attempts: [Response, number][] = []
    for (const [actor, status] of [
      [undefined, 401],
      ['riley', 403],
    ] as const)
      attempts.push([
        await backend.request('/proposals', actor, {
          method: 'POST',
          headers: jsonHeaders(),
          body: JSON.stringify(input),
        }),
        status,
      ])
    attempts.push([
      await backend.request(`/proposals/${proposal.id}/status`, 'casey', {
        method: 'PATCH',
        headers: jsonHeaders(),
        body: JSON.stringify(transition(proposal, 'approved')),
      }),
      403,
    ])
    attempts.push([
      await backend.request('/proposals', 'casey', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
          ...input,
          role: 'maintainer',
          author: { id: actors.morgan.id, name: 'Morgan' },
          checks: [{ name: 'Forged passing check', status: 'passed' }],
        }),
      }),
      422,
    ])
    const session = required(backend.sessions.get(actors.casey.id))
    for (const [origin, csrf] of [
      ['https://untrusted.invalid', session.csrfToken],
      ['http://127.0.0.1:4176', ''],
    ] as const)
      attempts.push([
        await fetch('http://127.0.0.1:8795/api/proposals', {
          method: 'POST',
          headers: {
            ...jsonHeaders(),
            origin,
            cookie: `lorestra_session=${session.token}`,
            'x-csrf-token': csrf,
          },
          body: JSON.stringify(input),
        }),
        403,
      ])
    world.responses = []
    for (const [response, expected] of attempts) {
      expect(response.status).toBe(expected)
      const body = await response.json()
      expect(body.error.code).toEqual(expect.any(String))
      expect(body.error.requestId).toEqual(expect.any(String))
      world.responses.push({ status: response.status, body })
    }
    expect(await businessState(backend)).toBe(before)
  },
)

Then(
  'each denial has a typed error and leaves business state unchanged',
  async ({ backend, world }) => {
    expect(world.responses?.map((response) => response.status)).toEqual([
      401, 403, 403, 422, 403, 403,
    ])
    expect((await readProposal(backend, required(world.proposal).id)).status).toBe(
      'open',
    )
    expect((await readDocument(backend)).version).toBe(1)
  },
)

When(
  'another session resubmits and a stale reviewer tries approval',
  async ({ backend, world }) => {
    const original = required(world.proposal)
    const input = required(world.input)
    const updated = await backend.request(`/proposals/${original.id}`, 'casey', {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify({
        ...input,
        proposalId: original.id,
        expectedProposalVersion: 1,
        changes: input.changes.map((change) => ({
          ...change,
          after: '# Corrected before review\n',
        })),
      }),
    })
    expect(updated.status).toBe(200)
    world.proposal = DurableProposalSchema.parse(await updated.json())
    const stale = await backend.request(`/proposals/${original.id}/status`, 'morgan', {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify(transition(original, 'approved')),
    })
    expect(stale.status).toBe(409)
    expect((await stale.json()).error.code).toBe('proposal_version_conflict')
    expect((await readProposal(backend, original.id)).status).toBe('open')
  },
)

Then(
  'the stale approval is refused and editing invalidates the later approval',
  async ({ backend, world }) => {
    const approved = await transitionProposal(
      backend,
      required(world.proposal),
      'approved',
    )
    const input = required(world.input)
    const corrected = {
      ...input,
      proposalId: approved.id,
      expectedProposalVersion: approved.proposalVersion,
      changes: input.changes.map((change) => ({
        ...change,
        after: '# Updated reviewed metadata\n',
        metadata: {
          ...change.metadata,
          type: 'note',
          folderId: 'folder.demo.lyra.en',
          tags: ['review-again'],
          relations: ['lorestra.demo.lyra.overview.en'],
        },
      })),
    }
    const response = await backend.request(`/proposals/${approved.id}`, 'casey', {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify(corrected),
    })
    expect(response.status).toBe(200)
    const updated = DurableProposalSchema.parse(await response.json())
    expect(updated.status).toBe('open')
    expect(updated.approval).toBeNull()
    expect(updated.contentHash).not.toBe(approved.contentHash)
    expect(updated.proposalVersion).toBe(approved.proposalVersion + 1)
    const stale = await backend.request(`/proposals/${approved.id}/status`, 'morgan', {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify(transition(approved, 'merged')),
    })
    expect(stale.status).toBe(409)
    world.proposal = await transitionProposal(
      backend,
      await transitionProposal(backend, updated, 'approved'),
      'merged',
    )
    const published = await readDocument(backend)
    expect(published).toMatchObject({
      type: 'note',
      folderId: 'folder.demo.lyra.en',
      tags: ['review-again'],
      relations: ['lorestra.demo.lyra.overview.en'],
      body: '# Updated reviewed metadata\n',
    })
  },
)

Then(
  'a newly reviewed merge cannot be edited or reopened',
  async ({ backend, world }) => {
    const proposal = required(world.proposal)
    const before = await businessState(backend)
    for (const [endpoint, payload] of [
      [
        `/proposals/${proposal.id}`,
        {
          ...required(world.input),
          proposalId: proposal.id,
          expectedProposalVersion: proposal.proposalVersion,
        },
      ],
      [
        `/proposals/${proposal.id}/status`,
        {
          proposalId: proposal.id,
          expectedProposalVersion: proposal.proposalVersion,
          status: 'approved',
        },
      ],
    ] as const) {
      const response = await backend.request(endpoint, 'morgan', {
        method: 'PATCH',
        headers: jsonHeaders(),
        body: JSON.stringify(payload),
      })
      expect(response.status).toBe(409)
    }
    expect(await businessState(backend)).toBe(before)
  },
)

When(
  'Casey retries one creation key and later changes its payload',
  async ({ backend, world }) => {
    const key = randomUUID()
    const input = { ...required(world.input), title: 'A replayable proposal' }
    const one = await createProposal(backend, input, 'casey', key)
    const two = await createProposal(backend, input, 'casey', key)
    expect(two).toEqual(one)
    const conflict = await backend.request('/proposals', 'casey', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': key },
      body: JSON.stringify({ ...input, title: 'Different payload' }),
    })
    expect(conflict.status).toBe(409)
    expect((await conflict.json()).error.code).toBe('idempotency_conflict')
    world.proposal = one
  },
)

Then(
  'replay returns the same proposal and changed payload conflicts',
  async ({ backend, world }) => {
    const proposal = await readProposal(backend, required(world.proposal).id)
    expect(proposal.title).toBe('A replayable proposal')
    const { DB } = await backend.bindings()
    expect(
      (
        await DB.prepare(
          "SELECT COUNT(*) AS count FROM history WHERE proposal_id=? AND type='proposal_created'",
        )
          .bind(proposal.id)
          .first<{ count: number }>()
      )?.count,
    ).toBe(1)
  },
)

When(
  'two maintainers concurrently merge that exact approved proposal',
  async ({ backend, world }) => {
    const approved = await transitionProposal(
      backend,
      required(world.proposal),
      'approved',
    )
    const requests = (['morgan', 'taylor'] as const).map((actor) => ({
      actor,
      key: randomUUID(),
    }))
    const responses = await Promise.all(
      requests.map(({ actor, key }) =>
        backend.request(`/proposals/${approved.id}/status`, actor, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', 'idempotency-key': key },
          body: JSON.stringify(transition(approved, 'merged')),
        }),
      ),
    )
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409])
    const winningIndex = responses.findIndex((response) => response.status === 200)
    // Deliberately discard the successful response body, as though the transport lost it after commit.
    await responses[winningIndex]!.body?.cancel()
    const winner = requests[winningIndex]!
    const replay = await backend.request(
      `/proposals/${approved.id}/status`,
      winner.actor,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'idempotency-key': winner.key },
        body: JSON.stringify(transition(approved, 'merged')),
      },
    )
    expect(replay.status).toBe(200)
    world.proposal = DurableProposalSchema.parse(await replay.json())
  },
)

Then(
  'only one revision and publication commit and a lost-response retry returns the original result',
  async ({ backend, world }) => {
    const proposal = required(world.proposal)
    expect(proposal.status).toBe('merged')
    const { DB } = await backend.bindings()
    expect(
      (
        await DB.prepare(
          "SELECT COUNT(*) AS count FROM history WHERE proposal_id=? AND type='merged'",
        )
          .bind(proposal.id)
          .first<{ count: number }>()
      )?.count,
    ).toBe(1)
    const document = await readDocument(backend)
    expect(document.version).toBe(2)
    expect(
      (
        await DB.prepare('SELECT COUNT(*) AS count FROM revisions WHERE document_id=?')
          .bind(document.id)
          .first<{ count: number }>()
      )?.count,
    ).toBe(2)
  },
)

When(
  'Casey saves a private local draft and signs out through the UI',
  async ({ backend, context, page, world }) => {
    const privateDocument = backend.bundle.seed.documents.find(
      (document) => document.locale === 'en' && document.visibility === 'internal',
    )
    world.original = required(privateDocument)
    await backend.authenticate(context, 'casey')
    await page.goto(`/documents/${world.original.slug}?locale=en`)
    await expect(page.locator('#page-heading')).toHaveText(world.original.title)
    await page.getByRole('button', { name: 'Propose changes', exact: true }).click()
    const editor = page.getByRole('dialog')
    await editor.getByLabel('Markdown', { exact: true }).fill('# Private unsent work\n')
    await editor
      .getByRole('button', { name: 'Save draft on this device', exact: true })
      .click()
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            Object.keys(localStorage).filter((key) => key.startsWith('lorestra-draft:'))
              .length,
        ),
      )
      .toBe(1)
    await editor.getByRole('button', { name: 'Cancel', exact: true }).click()
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  },
)

Then(
  'the visitor cannot see that private document or restore the draft',
  async ({ page, backend, world }) => {
    await expect(
      page.getByRole('button', { name: 'Sign in', exact: true }),
    ).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            Object.keys(localStorage).filter((key) => key.startsWith('lorestra-draft:'))
              .length,
        ),
      )
      .toBe(0)
    await expect(page.locator('.markdown-content')).toHaveCount(0)
    expect(
      (await backend.request(`/documents/${required(world.original).slug}?locale=en`))
        .status,
    ).toBe(404)
  },
)

Then(
  'the old and expired credentials cannot mutate through HTTP',
  async ({ backend, world }) => {
    const init = {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(required(world.input)),
    }
    expect((await backend.request('/proposals', 'casey', init)).status).toBe(401)
    const env = await backend.bindings()
    const expired = await backend.bundle.setup.createLocalSession(
      env,
      actors.casey,
      new Date(Date.now() - 1000).toISOString(),
    )
    backend.sessions.set(actors.casey.id, expired)
    expect(
      (
        await backend.request('/proposals', 'casey', {
          ...init,
          headers: jsonHeaders(),
        })
      ).status,
    ).toBe(401)
  },
)

When(
  "a small write budget rejects Casey's UI submission",
  async ({ backend, context, page, world }) => {
    const { DB } = await backend.bindings()
    await DB.prepare(
      "INSERT INTO vault_settings(key,value) VALUES('limits',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    )
      .bind(JSON.stringify({ maxWritesPerMinute: 1 }))
      .run()
    await backend.authenticate(context, 'casey')
    await page.goto('/documents/demo-orion-runbook?locale=en')
    await page.getByRole('button', { name: 'Propose changes', exact: true }).click()
    const editor = page.getByRole('dialog')
    world.draft = '# Keep this draft during quota exhaustion\n'
    await editor.getByLabel('Markdown', { exact: true }).fill(world.draft)
    // A minute rollover must not turn this deterministic quota fixture into a successful write.
    const minute = Math.floor(Date.now() / 60_000)
    await DB.batch(
      [minute, minute + 1].flatMap((window) =>
        [
          `writes:actor:${actors.casey.id}:${window}`,
          `writes:vault:lorestra:${window}`,
        ].map((key) =>
          DB.prepare(
            'INSERT INTO rate_windows(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=1',
          ).bind(key, (window + 2) * 60_000),
        ),
      ),
    )
    world.mutationRequests = 0
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/api/proposals'))
        world.mutationRequests = (world.mutationRequests ?? 0) + 1
    })
    const response = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().endsWith('/api/proposals'),
    )
    await editor.getByRole('button', { name: 'Propose changes', exact: true }).click()
    const limited = await response
    expect(limited.status()).toBe(429)
    expect(limited.headers()['retry-after']).toBe('60')
    expect((await limited.json()).error.code).toBe('rate_limited')
  },
)

Then(
  'the typed rate limit preserves the draft without repeated retries',
  async ({ page, backend, world }) => {
    const editor = page.getByRole('dialog')
    await expect(editor.getByLabel('Markdown', { exact: true })).toHaveValue(
      required(world.draft),
    )
    await expect(editor.getByRole('alert')).toContainText(
      'temporarily limiting requests',
    )
    const { DB } = await backend.bindings()
    expect(
      (
        await DB.prepare('SELECT COUNT(*) AS count FROM proposals').first<{
          count: number
        }>()
      )?.count,
    ).toBe(1)
    expect(world.mutationRequests).toBe(1)
  },
)

When('the operator enables read-only maintenance', async ({ backend }) => {
  const { DB } = await backend.bindings()
  await DB.batch([
    DB.prepare("UPDATE vault_settings SET value='true' WHERE key='read_only'"),
    DB.prepare(
      "INSERT INTO vault_settings(key,value) VALUES('read_only_reason','Scheduled backup verification')",
    ),
  ])
})

Then(
  'public reading still works and all mutation roles are denied until maintenance ends',
  async ({ backend, page, world }) => {
    const before = await businessState(backend)
    const editor = page.getByRole('dialog')
    page.once('dialog', (dialog) => dialog.accept())
    await editor.getByRole('button', { name: 'Cancel', exact: true }).click()
    await page.goto('/library')
    await expect(
      page.getByRole('status').filter({ hasText: 'Scheduled backup verification' }),
    ).toBeVisible()
    expect(
      (await backend.request('/documents/demo-orion-runbook?locale=en')).status,
    ).toBe(200)
    for (const actor of ['casey', 'morgan'] as const)
      expect(
        (
          await backend.request('/proposals', actor, {
            method: 'POST',
            headers: jsonHeaders(),
            body: JSON.stringify(required(world.input)),
          })
        ).status,
      ).toBe(503)
    expect(await businessState(backend)).toBe(before)
    const { DB } = await backend.bindings()
    await DB.batch([
      DB.prepare("UPDATE vault_settings SET value='false' WHERE key='read_only'"),
      DB.prepare("DELETE FROM vault_settings WHERE key='limits'"),
      DB.prepare('DELETE FROM rate_windows'),
    ])
    expect(
      (
        await createProposal(
          backend,
          { ...required(world.input), title: 'Writes resume after maintenance' },
          'morgan',
        )
      ).status,
    ).toBe('open')
  },
)

Then('the HTTP proposal view fits the narrow viewport', async ({ page }) => {
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }))
  expect(widths.scroll).toBeLessThanOrEqual(widths.viewport + 1)
  await expect(page.locator('.diff-file')).toBeVisible()
})
