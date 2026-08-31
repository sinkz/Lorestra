import { randomUUID } from 'node:crypto'

import {
  DurableProposalSchema,
  GraphResponseSchema,
  type DurableProposal,
} from '@lorestra/contracts'
import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { actors, test, type BackendRuntime } from '../../fixtures/backend'
import {
  changeDocument,
  createProposal,
  readDocument,
  readProposal,
  transitionProposal,
} from '../../fixtures/http-workflow'

const { Given, When, Then } = createBdd(test)

function required<T>(value: T | undefined): T {
  if (value === undefined)
    throw new Error('The preceding workflow step did not complete')
  return value
}

async function proposalResponse(
  page: Page,
  action: () => Promise<unknown>,
  method = 'POST',
) {
  const response = page.waitForResponse((response) => {
    const path = new URL(response.url()).pathname
    return (
      response.request().method() === method &&
      (/\/api\/proposals$/.test(path) ||
        /\/api\/proposals\/[^/]+(?:\/status)?$/.test(path))
    )
  })
  await action()
  const result = await response
  expect(result.status()).toBe(200)
  return DurableProposalSchema.parse(await result.json())
}

async function openProposal(
  page: Page,
  backend: BackendRuntime,
  proposal: DurableProposal,
  actor: keyof typeof actors,
) {
  await backend.authenticate(page.context(), actor)
  await page.goto(`/proposals/${proposal.id}`)
  await expect(page.locator('#page-heading')).toHaveText(proposal.title)
}

async function mergeInUi(page: Page, proposal: DurableProposal) {
  await page.getByRole('button', { name: 'Merge into vault', exact: true }).click()
  const confirmation = page.getByRole('dialog', { name: 'Confirm merge', exact: true })
  await expect(confirmation).toContainText(proposal.id)
  await expect(confirmation).toContainText(String(proposal.proposalVersion))
  const response = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      response.url().endsWith(`/api/proposals/${proposal.id}/status`),
  )
  await confirmation.getByRole('button', { name: 'Confirm merge', exact: true }).click()
  return response
}

Given('Casey is using the HTTP application', async ({ backend, context, page }) => {
  await backend.authenticate(context, 'casey')
  await page.goto('/library')
  await expect(
    page.getByRole('button', { name: 'New memory', exact: true }).first(),
  ).toBeEnabled()
})

Given('the browser has no native WebMCP API', async ({ page }) => {
  expect(await page.evaluate(() => 'modelContext' in document)).toBe(false)
})

When(
  'Casey submits a new process with explicit metadata and Markdown',
  async ({ page, world }) => {
    await page.getByRole('button', { name: 'New memory', exact: true }).first().click()
    const editor = page.getByRole('dialog')
    world.draft = '# Durable recovery process\n\nVerify the revision before retrying.\n'
    await editor
      .getByLabel('Proposal title', { exact: true })
      .fill('HTTP recovery memory')
    await editor
      .getByLabel('Proposal summary', { exact: true })
      .fill('A process awaiting human review')
    await editor.getByLabel('Markdown', { exact: true }).fill(world.draft)
    await editor.getByText('Document metadata', { exact: true }).click()
    await editor
      .getByLabel('Document title', { exact: true })
      .fill('HTTP recovery process')
    await editor.getByLabel('Slug', { exact: true }).fill('http-recovery-process')
    await editor.getByRole('combobox', { name: /^Type\b/ }).selectOption('process')
    await editor
      .getByRole('combobox', { name: /^Folders\b/ })
      .fill('folder.demo.orion.en')
    await editor.getByLabel('Tags', { exact: true }).fill('recovery, http')
    world.proposal = await proposalResponse(page, () =>
      editor.getByRole('button', { name: 'New proposal', exact: true }).click(),
    )
  },
)

Then(
  'the new-file proposal survives reload with Casey as its author',
  async ({ page, backend, world }) => {
    const proposal = required(world.proposal)
    await expect(page).toHaveURL(new RegExp(`/proposals/${proposal.id}$`))
    await expect(page.locator('.file-badge').first()).toContainText('New file')
    await page.reload()
    await expect(page.locator('#page-heading')).toHaveText(proposal.title)
    const persisted = await readProposal(backend, proposal.id, 'casey')
    expect(persisted.author.id).toBe(actors.casey.id)
    expect(persisted.status).toBe('open')
    expect(persisted.changes[0]).toMatchObject({
      after: world.draft,
      before: null,
      baseVersion: null,
      metadata: {
        type: 'process',
        folderId: 'folder.demo.orion.en',
        tags: ['recovery', 'http'],
        locale: 'en',
      },
    })
  },
)

Then(
  'the draft is absent from published reads, search and graph',
  async ({ backend }) => {
    expect(
      (await backend.request('/documents/http-recovery-process?locale=en')).status,
    ).toBe(404)
    for (const endpoint of [
      '/documents?locale=en&q=HTTP%20recovery',
      '/search?locale=en&q=HTTP%20recovery',
      '/graph?locale=en&scope=entire',
    ]) {
      const response = await backend.request(endpoint)
      expect(response.status).toBe(200)
      expect(await response.text()).not.toContain('http-recovery-process')
    }
  },
)

Given(
  'Casey is editing a persisted document at version one',
  async ({ backend, context, page, world }) => {
    world.original = await readDocument(backend)
    expect(world.original.version).toBe(1)
    await backend.authenticate(context, 'casey')
    await page.goto('/documents/demo-orion-runbook?locale=en')
    await page.getByRole('button', { name: 'Propose changes', exact: true }).click()
    await expect(
      page.getByRole('dialog').getByLabel('Markdown', { exact: true }),
    ).toHaveValue(world.original.body)
    world.draft =
      '# Updated recovery checklist\n\nCompare the exact revision before retrying.\n'
    world.reason =
      'Clarify the repeatable recovery procedure; this is review context only.'
  },
)

When(
  'Casey submits changed Markdown and a separate reason',
  async ({ page, world }) => {
    const editor = page.getByRole('dialog')
    await editor.getByLabel('Markdown', { exact: true }).fill(required(world.draft))
    await editor.getByLabel('Review note', { exact: true }).fill(required(world.reason))
    world.proposal = await proposalResponse(page, () =>
      editor.getByRole('button', { name: 'Propose changes', exact: true }).click(),
    )
  },
)

Then(
  'the proposal preserves the original base and before body',
  async ({ backend, world }) => {
    const proposal = await readProposal(backend, required(world.proposal).id)
    expect(proposal.changes[0]?.baseVersion).toBe(1)
    expect(proposal.changes[0]?.before).toBe(required(world.original).body)
    expect(proposal.reason).toBe(world.reason)
    expect(proposal.changes[0]?.after).toBe(world.draft)
  },
)

When(
  'Morgan approves the proposal through the UI',
  async ({ backend, page, world }) => {
    const proposal = required(world.proposal)
    await openProposal(page, backend, proposal, 'morgan')
    const response = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        response.url().endsWith(`/api/proposals/${proposal.id}/status`),
    )
    await page.getByRole('button', { name: 'Approve', exact: true }).click()
    expect((await response).status()).toBe(200)
    world.proposal = await readProposal(backend, proposal.id)
    expect(world.proposal.approval).toMatchObject({
      reviewedProposalVersion: proposal.proposalVersion,
      contentHash: proposal.contentHash,
    })
    expect(world.proposal.status).toBe('approved')
  },
)

Then(
  'approval alone has not changed the published document',
  async ({ backend, world }) => {
    const original = required(world.original)
    const published = await readDocument(backend, original.slug)
    expect(published.version).toBe(original.version)
    expect(published.body).toBe(original.body)
  },
)

When(
  'Morgan confirms the exact proposal merge through the UI',
  async ({ backend, page, world }) => {
    const proposal = required(world.proposal)
    await openProposal(page, backend, proposal, 'morgan')
    const response = await mergeInUi(page, proposal)
    expect(response.status()).toBe(200)
    world.proposal = DurableProposalSchema.parse(await response.json())
    expect(world.proposal.status).toBe('merged')
  },
)

Then(
  'only the submitted Markdown becomes the new revision',
  async ({ backend, world }) => {
    const published = await readDocument(backend, required(world.original).slug)
    expect(published.version).toBe(2)
    expect(published.body).toBe(world.draft)
    expect(published.body).not.toContain(required(world.reason))
    expect((await readDocument(backend, published.slug, undefined, 1)).body).toBe(
      required(world.original).body,
    )
  },
)

Then(
  'the human HTTP workflow publishes without fake native registration',
  async ({ backend, page, world }) => {
    const proposal = required(world.proposal)
    expect(proposal.status).toBe('merged')
    const slug = proposal.changes[0]?.target.slug
    if (!slug) throw new Error('The new proposal did not include a document slug')
    const response = await backend.request(`/documents/${slug}?locale=en`, 'morgan')
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.revision.body).toBe(required(world.draft))
    expect(await page.evaluate(() => 'modelContext' in document)).toBe(false)
  },
)

Given('Casey has a persisted open proposal', async ({ backend, world }) => {
  world.original = await readDocument(backend)
  world.draft = '# First recovery draft\n\nCheck the revision.\n'
  world.input = {
    title: 'Review the recovery process',
    summary: 'Make recovery reproducible',
    changes: [changeDocument(world.original, world.draft)],
  }
  world.proposal = await createProposal(backend, world.input)
})

When('Morgan requests changes through the UI', async ({ backend, page, world }) => {
  const proposal = required(world.proposal)
  await openProposal(page, backend, proposal, 'morgan')
  await page.getByRole('button', { name: 'Request changes', exact: true }).click()
  const dialog = page.getByRole('dialog')
  world.reason = 'Please include the exact retry condition.'
  await dialog.getByLabel('Review note', { exact: true }).fill(world.reason)
  const response = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      response.url().endsWith(`/api/proposals/${proposal.id}/status`),
  )
  await dialog.getByRole('button', { name: 'Request changes', exact: true }).click()
  expect((await response).status()).toBe(200)
  world.proposal = await readProposal(backend, proposal.id)
  expect(world.proposal.status).toBe('changes_requested')
})

When(
  'Casey corrects and resubmits the same proposal through the UI',
  async ({ backend, page, world }) => {
    const prior = required(world.proposal)
    await openProposal(page, backend, prior, 'casey')
    await page.getByRole('button', { name: 'Edit proposal', exact: true }).click()
    world.draft =
      '# Corrected recovery draft\n\nRetry only after the exact revision matches.\n'
    const editor = page.getByRole('dialog')
    await editor.getByLabel('Markdown', { exact: true }).fill(world.draft)
    world.proposal = await proposalResponse(
      page,
      () =>
        editor.getByRole('button', { name: 'Save and resubmit', exact: true }).click(),
      'PATCH',
    )
    expect(world.proposal.id).toBe(prior.id)
    expect(world.proposal.proposalVersion).toBe(prior.proposalVersion + 1)
  },
)

Then(
  'the same proposal is open at a newer version with its review history',
  async ({ backend, page, world }) => {
    const proposal = await readProposal(backend, required(world.proposal).id)
    expect(proposal.status).toBe('open')
    expect(proposal.proposalVersion).toBe(3)
    expect(proposal.changes[0]?.after).toBe(world.draft)
    expect(proposal.checks.every((check) => check.status === 'passed')).toBe(true)
    await expect(page.locator('.diff-file')).toContainText('exact revision matches')
    const { DB } = await backend.bindings()
    const history = await DB.prepare(
      'SELECT * FROM history WHERE proposal_id = ? ORDER BY occurred_at',
    )
      .bind(proposal.id)
      .all()
    expect(JSON.stringify(history.results)).toContain(required(world.reason))
    expect(JSON.stringify(history.results)).toContain(actors.morgan.id)
  },
)

Given(
  'Morgan has an approved proposal adding one and updating two documents',
  async ({ backend, world }) => {
    const first = await readDocument(backend)
    const second = await readDocument(backend, 'demo-lyra-runbook')
    world.input = {
      title: 'Publish one coherent recovery update',
      summary: 'One added memory and two updated processes',
      changes: [
        changeDocument(first, '# Orion v2\n\nAtomic recovery.\n'),
        changeDocument(second, '# Lyra v2\n\nAtomic teaching.\n'),
        {
          id: randomUUID(),
          target: {
            documentId: null,
            slug: 'atomic-recovery-memory',
            title: 'Atomic recovery memory',
          },
          changeType: 'added',
          baseVersion: null,
          after: '# Atomic recovery memory\n\nAll three files publish together.\n',
          metadata: {
            locale: 'en',
            folderId: 'folder.demo.orion.en',
            type: 'process',
            tags: ['atomic'],
            relations: [first.id, second.id],
            visibility: 'public',
            status: 'published',
          },
        },
      ],
    }
    world.proposal = await transitionProposal(
      backend,
      await createProposal(backend, world.input),
      'approved',
    )
  },
)

Then(
  'all three files have one resulting revision and one publication event',
  async ({ backend, world }) => {
    const proposal = required(world.proposal)
    const { DB } = await backend.bindings()
    for (const change of required(world.input).changes) {
      const document = await readDocument(backend, change.target.slug)
      expect(document.body).toBe(change.after)
      expect(document.version).toBe(change.changeType === 'added' ? 1 : 2)
      const revisions = await DB.prepare(
        'SELECT COUNT(*) AS count FROM revisions WHERE document_id = ?',
      )
        .bind(document.id)
        .first<{ count: number }>()
      expect(revisions?.count).toBe(document.version)
    }
    const publications = await DB.prepare(
      "SELECT COUNT(*) AS count FROM history WHERE proposal_id = ? AND type = 'merged'",
    )
      .bind(proposal.id)
      .first<{ count: number }>()
    expect(publications?.count).toBe(1)
  },
)

When(
  'the isolated Worker restarts without importing the seed again',
  async ({ backend }) => {
    await backend.restart()
  },
)

Then(
  'the publication and its exact document bodies remain available',
  async ({ backend, page, world }) => {
    expect((await readProposal(backend, required(world.proposal).id)).status).toBe(
      'merged',
    )
    for (const change of required(world.input).changes)
      expect((await readDocument(backend, change.target.slug)).body).toBe(change.after)
    await page.reload()
    await expect(page.locator('#page-heading')).toHaveText(
      required(world.proposal).title,
    )
  },
)

Then(
  'a fresh browser context reads the restarted publication',
  async ({ backend, browser, world }) => {
    const freshContext = await browser.newContext({
      baseURL: 'http://127.0.0.1:4176',
    })
    try {
      await backend.authenticate(freshContext, 'morgan')
      const freshPage = await freshContext.newPage()
      for (const change of required(world.input).changes) {
        await freshPage.goto(`/documents/${change.target.slug}?locale=en`)
        await expect(freshPage.locator('#page-heading')).toHaveText(change.target.title)
        const marker =
          typeof change.after === 'string'
            ? change.after
                .split('\n')
                .find((line) => line.trim() && !line.trim().startsWith('#'))
                ?.trim()
            : null
        if (marker)
          await expect(freshPage.locator('.markdown-content')).toContainText(marker)
      }
    } finally {
      await freshContext.close()
    }
  },
)

Given(
  'Morgan publishes a newer version in another session',
  async ({ backend, world }) => {
    const original = required(world.original)
    const other = await createProposal(
      backend,
      {
        title: 'Independent published correction',
        summary: 'Another authenticated session',
        changes: [
          changeDocument(original, '# Revision two\n\nMorgan published this first.\n'),
        ],
      },
      'morgan',
    )
    await transitionProposal(
      backend,
      await transitionProposal(backend, other, 'approved'),
      'merged',
    )
  },
)

When('Casey submits the still-open stale editor', async ({ page, world }) => {
  const editor = page.getByRole('dialog')
  await editor.getByLabel('Markdown', { exact: true }).fill(required(world.draft))
  const response = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/api/proposals'),
  )
  await editor.getByRole('button', { name: 'Propose changes', exact: true }).click()
  expect((await response).status()).toBe(409)
})

Then(
  'the UI preserves the Markdown and identifies both conflicting versions',
  async ({ page, backend, world }) => {
    const editor = page.getByRole('dialog')
    await expect(editor.getByLabel('Markdown', { exact: true })).toHaveValue(
      required(world.draft),
    )
    await expect(editor.getByRole('alert')).toContainText('v1')
    await expect(editor.getByRole('alert')).toContainText('v2')
    const { DB } = await backend.bindings()
    expect(
      (
        await DB.prepare('SELECT COUNT(*) AS count FROM proposals').first<{
          count: number
        }>()
      )?.count,
    ).toBe(1)
    expect((await readDocument(backend)).body).toContain('Morgan published this first.')
  },
)

Given(
  'Morgan is editing a persisted document at version one in one browser tab',
  async ({ backend, context, page, world }) => {
    world.original = await readDocument(backend)
    expect(world.original.version).toBe(1)
    await backend.authenticate(context, 'morgan')
    await page.goto('/documents/demo-orion-runbook?locale=en')
    await page.getByRole('button', { name: 'Propose changes', exact: true }).click()
    const editor = page.getByRole('dialog')
    await expect(editor.getByLabel('Markdown', { exact: true })).toHaveValue(
      world.original.body,
    )
    world.draft = '# Draft retained across tabs\n\nKeep this unsent body.\n'
    await editor.getByLabel('Markdown', { exact: true }).fill(world.draft)
  },
)

When(
  'Morgan publishes a newer version in a second browser tab',
  async ({ context, world }) => {
    const original = required(world.original)
    const second = await context.newPage()
    world.auxiliaryPage = second
    await second.goto(`/documents/${original.slug}?locale=en`)
    await expect(second.locator('#page-heading')).toHaveText(original.title)
    await second.getByRole('button', { name: 'Propose changes', exact: true }).click()
    const editor = second.getByRole('dialog')
    await editor
      .getByLabel('Proposal title', { exact: true })
      .fill('Cross-tab published correction')
    await editor
      .getByLabel('Proposal summary', { exact: true })
      .fill('A publication made by the second tab')
    await editor
      .getByLabel('Markdown', { exact: true })
      .fill('# Cross-tab revision\n\nPublished by the second tab.\n')
    const created = await proposalResponse(second, () =>
      editor.getByRole('button', { name: 'Propose changes', exact: true }).click(),
    )
    await expect(second.locator('#page-heading')).toHaveText(created.title)
    const approved = await proposalResponse(
      second,
      () => second.getByRole('button', { name: 'Approve', exact: true }).click(),
      'PATCH',
    )
    const response = await mergeInUi(second, approved)
    expect(response.status()).toBe(200)
  },
)

Then(
  'the first tab shows the published version and preserves its unsent Markdown',
  async ({ page, world }) => {
    await expect(page.locator('.markdown-content')).toContainText(
      'Published by the second tab.',
    )
    await expect(
      page.getByRole('dialog').getByLabel('Markdown', { exact: true }),
    ).toHaveValue(required(world.draft))
  },
)

When('Morgan submits the preserved stale editor', async ({ page }) => {
  const editor = page.getByRole('dialog')
  const response = page.waitForResponse(
    (result) =>
      result.request().method() === 'POST' && result.url().endsWith('/api/proposals'),
  )
  await editor.getByRole('button', { name: 'Propose changes', exact: true }).click()
  expect((await response).status()).toBe(409)
})

Then(
  'the stale editor still contains its Markdown and identifies both conflicting versions',
  async ({ page, world }) => {
    await expect(
      page.getByRole('dialog').getByLabel('Markdown', { exact: true }),
    ).toHaveValue(required(world.draft))
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('v1')
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('v2')
    await world.auxiliaryPage?.close()
  },
)

When(
  'the API becomes unreachable and Casey submits the unsent editor',
  async ({ backend, page, world }) => {
    const editor = page.getByRole('dialog')
    world.draft = '# Offline recovery draft\n\nRetry this exact body later.\n'
    await editor.getByLabel('Markdown', { exact: true }).fill(world.draft)
    const { DB } = await backend.bindings()
    world.proposalCountBefore =
      (
        await DB.prepare('SELECT COUNT(*) AS count FROM proposals').first<{
          count: number
        }>()
      )?.count ?? 0
    world.offlineAttempts = []
    await page.route('**/api/proposals', async (route) => {
      const request = route.request()
      if (request.method() === 'POST') {
        world.offlineAttempts?.push({
          method: request.method(),
          idempotencyKey: request.headers()['idempotency-key'],
        })
      }
      await route.abort('failed')
    })
    await editor.getByRole('button', { name: 'Propose changes', exact: true }).click()
  },
)

Then(
  "the connection error preserves Casey's Markdown draft",
  async ({ page, world }) => {
    const editor = page.getByRole('dialog')
    await expect(editor.getByRole('alert')).toContainText('Connection lost')
    await expect(editor.getByLabel('Markdown', { exact: true })).toHaveValue(
      required(world.draft),
    )
    expect(world.offlineAttempts).toHaveLength(1)
    expect(world.offlineAttempts?.[0]?.method).toBe('POST')
    expect(world.offlineAttempts?.[0]?.idempotencyKey).toBeTruthy()
  },
)

When(
  'connectivity returns and Casey deliberately retries the same editor',
  async ({ page, world }) => {
    await page.unroute('**/api/proposals')
    const editor = page.getByRole('dialog')
    const request = page.waitForRequest(
      (result) =>
        result.method() === 'POST' &&
        new URL(result.url()).pathname === '/api/proposals',
    )
    world.proposal = await proposalResponse(page, () =>
      editor.getByRole('button', { name: 'Propose changes', exact: true }).click(),
    )
    const retry = await request
    world.offlineAttempts?.push({
      method: retry.method(),
      idempotencyKey: retry.headers()['idempotency-key'],
    })
  },
)

Then(
  'one open proposal is created from the retained draft',
  async ({ backend, page, world }) => {
    const proposal = required(world.proposal)
    await expect(page).toHaveURL(new RegExp(`/proposals/${proposal.id}$`))
    const persisted = await readProposal(backend, proposal.id, 'casey')
    expect(persisted.status).toBe('open')
    expect(persisted.changes[0]?.after).toBe(required(world.draft))
    const attempts = required(world.offlineAttempts)
    expect(attempts).toHaveLength(2)
    expect(attempts[0]?.idempotencyKey).toBe(attempts[1]?.idempotencyKey)
    const { DB } = await backend.bindings()
    const total =
      (
        await DB.prepare('SELECT COUNT(*) AS count FROM proposals').first<{
          count: number
        }>()
      )?.count ?? 0
    expect(total).toBe(required(world.proposalCountBefore) + 1)
    const open =
      (
        await DB.prepare(
          "SELECT COUNT(*) AS count FROM proposals WHERE status = 'open'",
        ).first<{ count: number }>()
      )?.count ?? 0
    expect(open).toBe(1)
  },
)

Given(
  'Morgan has a reviewed archive proposal for the Orion process',
  async ({ backend, world }) => {
    const original = await readDocument(backend)
    world.original = original
    const { DB } = await backend.bindings()
    const incoming = await DB.prepare(
      'SELECT source_id FROM relations WHERE target_id = ? ORDER BY source_id LIMIT 1',
    )
      .bind(original.id)
      .first<{ source_id: string }>()
    expect(incoming?.source_id).toBeTruthy()
    world.incomingReferenceSourceId = incoming?.source_id
    const priorRevision = await DB.prepare(
      'SELECT object_key FROM revisions WHERE document_id = ? AND version = ?',
    )
      .bind(original.id, original.version)
      .first<{ object_key: string }>()
    expect(priorRevision?.object_key).toBeTruthy()
    world.priorRevisionObjectKey = priorRevision?.object_key
    const change = changeDocument(original, original.body)
    change.metadata = { ...change.metadata, status: 'archived' }
    world.input = {
      title: 'Archive the Orion recovery process',
      summary: 'Retain the process as historical guidance',
      changes: [change],
    }
    world.proposal = await transitionProposal(
      backend,
      await createProposal(backend, world.input, 'morgan'),
      'approved',
      'morgan',
    )
  },
)

When(
  'Morgan merges the archive proposal through the UI',
  async ({ backend, page, world }) => {
    const proposal = required(world.proposal)
    await openProposal(page, backend, proposal, 'morgan')
    const response = await mergeInUi(page, proposal)
    expect(response.status()).toBe(200)
    world.proposal = DurableProposalSchema.parse(await response.json())
    expect(world.proposal.status).toBe('merged')
  },
)

Then(
  'the document is archived in Library and its prior revision remains readable',
  async ({ backend, page, world }) => {
    const original = required(world.original)
    const current = await readDocument(backend, original.slug, 'morgan')
    expect(current.status).toBe('archived')
    expect(current.version).toBe(original.version + 1)
    expect(current.body).toBe(original.body)
    const prior = await readDocument(backend, original.slug, 'morgan', original.version)
    expect(prior.body).toBe(original.body)
    const { DB } = await backend.bindings()
    expect(
      (
        await DB.prepare(
          'SELECT COUNT(*) AS count FROM revisions WHERE document_id = ?',
        )
          .bind(original.id)
          .first<{ count: number }>()
      )?.count,
    ).toBe(original.version + 1)
    const oldObject = await (
      await backend.bindings()
    ).VAULT.get(required(world.priorRevisionObjectKey))
    expect(oldObject).not.toBeNull()
    expect(await oldObject!.text()).toBe(original.body)
    const graph = GraphResponseSchema.parse(
      await (await backend.request('/graph?scope=entire&locale=en', 'morgan')).json(),
    )
    expect(graph.nodes.some((node) => node.id === original.id)).toBe(true)
    expect(
      graph.edges.some(
        (edge) =>
          edge.source === required(world.incomingReferenceSourceId) &&
          edge.target === original.id,
      ),
    ).toBe(true)

    await page.goto('/library?status=archived')
    const archivedRow = page
      .locator('.library-row')
      .filter({ hasText: original.title })
      .first()
    await expect(archivedRow).toBeVisible()
    await expect(archivedRow.locator('.library-title')).toHaveText(original.title)
    await expect(archivedRow).toContainText('Archived')
  },
)

Given(
  'Morgan has a reviewed delete proposal for the Orion process',
  async ({ backend, world }) => {
    const original = await readDocument(backend, 'demo-orion-runbook', 'morgan')
    world.original = original
    const { DB } = await backend.bindings()
    const incoming = await DB.prepare(
      'SELECT source_id FROM relations WHERE target_id = ? ORDER BY source_id LIMIT 1',
    )
      .bind(original.id)
      .first<{ source_id: string }>()
    expect(incoming?.source_id).toBeTruthy()
    world.incomingReferenceSourceId = incoming?.source_id
    const priorRevision = await DB.prepare(
      'SELECT object_key FROM revisions WHERE document_id = ? AND version = ?',
    )
      .bind(original.id, original.version)
      .first<{ object_key: string }>()
    expect(priorRevision?.object_key).toBeTruthy()
    world.priorRevisionObjectKey = priorRevision?.object_key
    const change = changeDocument(original, original.body)
    change.changeType = 'deleted'
    change.after = null
    world.input = {
      title: 'Delete the Orion recovery process',
      summary: 'Remove the current process while retaining its evidence',
      changes: [change],
    }
    world.proposal = await transitionProposal(
      backend,
      await createProposal(backend, world.input, 'morgan'),
      'approved',
      'morgan',
    )
  },
)

When(
  'Morgan merges the delete proposal through the UI',
  async ({ backend, page, world }) => {
    const proposal = required(world.proposal)
    await openProposal(page, backend, proposal, 'morgan')
    const response = await mergeInUi(page, proposal)
    expect(response.status()).toBe(200)
    world.proposal = DurableProposalSchema.parse(await response.json())
    expect(world.proposal.status).toBe('merged')
  },
)

Then(
  'the document is absent from current Library and its prior revision remains readable',
  async ({ backend, page, world }) => {
    const original = required(world.original)
    const currentResponse = await backend.request(
      `/documents/${original.slug}?locale=en`,
      'morgan',
    )
    expect(currentResponse.status).toBe(404)
    const prior = await readDocument(backend, original.slug, 'morgan', original.version)
    expect(prior.body).toBe(original.body)
    const { DB, VAULT } = await backend.bindings()
    expect(
      (
        await DB.prepare(
          'SELECT COUNT(*) AS count FROM revisions WHERE document_id = ?',
        )
          .bind(original.id)
          .first<{ count: number }>()
      )?.count,
    ).toBe(original.version + 1)
    const oldObject = await VAULT.get(required(world.priorRevisionObjectKey))
    expect(oldObject).not.toBeNull()
    expect(await oldObject!.text()).toBe(original.body)
    const graph = GraphResponseSchema.parse(
      await (await backend.request('/graph?scope=entire&locale=en', 'morgan')).json(),
    )
    expect(graph.nodes.some((node) => node.id === original.id)).toBe(false)
    expect(
      graph.edges.some(
        (edge) => edge.source === original.id || edge.target === original.id,
      ),
    ).toBe(false)

    await page.goto(`/library?q=${encodeURIComponent(original.title)}`)
    await expect(page.locator('.toolbar')).toBeVisible()
    await expect(
      page.locator(
        `a[href="/documents/${encodeURIComponent(original.slug)}?tab=preview"]`,
      ),
    ).toHaveCount(0)
  },
)

Given(
  'two approved proposals target the same original document',
  async ({ backend, world }) => {
    world.original = await readDocument(backend)
    world.proposals = []
    for (const label of ['first', 'second']) {
      const proposal = await createProposal(backend, {
        title: `The ${label} independent proposal`,
        summary: 'Two reviewers share the same original base',
        changes: [changeDocument(world.original, `# The ${label} body\n`)],
      })
      world.proposals.push(await transitionProposal(backend, proposal, 'approved'))
    }
  },
)

When(
  'Morgan publishes the first and Taylor tries to merge the second through the UI',
  async ({ backend, page, world }) => {
    const [first, second] = required(world.proposals)
    await transitionProposal(backend, first!, 'merged')
    await openProposal(page, backend, second!, 'taylor')
    expect((await mergeInUi(page, second!)).status()).toBe(409)
  },
)

Then(
  'the newer revision remains unchanged and the second proposal remains reviewable',
  async ({ backend, page, world }) => {
    const second = required(world.proposals)[1]!
    const document = await readDocument(backend)
    expect(document.version).toBe(2)
    expect(document.body).toBe('# The first body\n')
    const persisted = await readProposal(backend, second.id, 'taylor')
    expect(persisted.status).toBe('approved')
    expect(persisted.changes[0]?.after).toBe('# The second body\n')
    await expect(
      page
        .getByRole('dialog', { name: 'Confirm merge', exact: true })
        .getByRole('alert'),
    ).toBeVisible()
    await expect(page.locator('.diff-file')).toContainText('The second body')
  },
)
