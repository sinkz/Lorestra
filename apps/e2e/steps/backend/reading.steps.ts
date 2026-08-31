import {
  DocumentResponseSchema,
  GraphResponseSchema,
  SessionResponseSchema,
} from '@lorestra/contracts'
import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { test } from '../../fixtures/backend'

const { Given, When, Then } = createBdd(test)

Given(
  'the isolated HTTP environment is ready with the bilingual vault fixture',
  async ({ backend }) => {
    const { DB } = await backend.bindings()
    const row = await DB.prepare('SELECT COUNT(*) AS count FROM documents').first<{
      count: number
    }>()
    expect(row?.count).toBe(backend.bundle.seed.documents.length)
    expect(
      backend.bundle.seed.documents.filter((document) =>
        document.path.startsWith('vault/Examples/'),
      ),
    ).toHaveLength(36)
  },
)

Given('business reads use the Worker with local D1 and R2', async ({ backend }) => {
  const response = await backend.request('/session')
  expect(response.status).toBe(200)
  const session = SessionResponseSchema.parse(await response.json())
  expect(session.mode).toBe('local')
  expect(session.principal).toBeNull()
  expect(session.capabilities.createProposal).toBe(false)
})

Given('I browse as a visitor', async ({ context }) => {
  await context.clearCookies()
})

When('I open the entire persisted Atlas', async ({ page, traffic }) => {
  await page.goto('/atlas?scope=entire')
  await expect(page.getByLabel('Knowledge graph', { exact: true })).toBeVisible()
  expect(traffic.apiPaths.has('/api/graph')).toBe(true)
})

Then(
  'Orion, Lyra and Cygnus are represented in the persisted graph',
  async ({ page, backend }) => {
    const response = await backend.request('/graph?scope=entire&locale=en')
    expect(response.status).toBe(200)
    const graph = GraphResponseSchema.parse(await response.json())
    for (const galaxy of ['orion', 'lyra', 'cygnus']) {
      const id = `lorestra.demo.${galaxy}.overview.en`
      expect(graph.nodes.some((node) => node.id === id)).toBe(true)
      await expect(
        page.locator(`button.celestial-node[data-node-id="${id}"]`),
      ).toBeVisible()
    }
    const galaxyCount = Number(
      await page.locator('.galaxy-canvas').getAttribute('data-galaxy-count'),
    )
    expect(galaxyCount).toBeGreaterThanOrEqual(3)
  },
)

Then(
  'only real fixture references form cross-community bridges',
  async ({ backend }) => {
    const response = await backend.request('/graph?scope=entire&locale=en')
    const graph = GraphResponseSchema.parse(await response.json())
    const documents = new Map(
      backend.bundle.seed.documents.map((document) => [document.id, document]),
    )
    const nodeIds = new Set(graph.nodes.map((node) => node.id))
    let bridgeCount = 0
    for (const edge of graph.edges) {
      expect(nodeIds.has(edge.source) && nodeIds.has(edge.target)).toBe(true)
      if (edge.kind === 'contains') continue
      const source = documents.get(edge.source)
      const target = documents.get(edge.target)
      expect(
        source?.relations.includes(edge.target) ||
          target?.relations.includes(edge.source),
      ).toBe(true)
      if (source?.folderId !== target?.folderId) bridgeCount += 1
    }
    expect(bridgeCount).toBeGreaterThan(0)
  },
)

When('I open the persisted Orion recovery process from the graph', async ({ page }) => {
  const node = page.getByRole('button', {
    name: 'Select Orion: recovery checklist',
    exact: true,
  })
  await node.focus()
  await node.press('Enter')
  await page
    .getByRole('button', { name: 'Open Orion: recovery checklist', exact: true })
    .click()
})

Then(
  'its persisted Markdown and process metadata are displayed',
  async ({ page, backend, traffic }) => {
    await expect(page.locator('#page-heading')).toHaveText('Orion: recovery checklist')
    await expect(page.locator('.markdown-content')).toContainText(
      'Use this example checklist when the returned revision disagrees with the requested revision.',
    )
    await expect(page.locator('.document-status .document-kind').first()).toHaveText(
      'Process',
    )
    const response = await backend.request('/documents/demo-orion-runbook?locale=en')
    expect(response.status).toBe(200)
    const { document } = DocumentResponseSchema.parse(await response.json())
    expect(document.body).toBe(
      backend.bundle.seed.documents.find((item) => item.id === document.id)?.body,
    )
    expect(document.type).toBe('process')
    expect(traffic.apiPaths.has('/api/documents/demo-orion-runbook')).toBe(true)
  },
)

Then(
  'the related graph and list alternative can open the same document',
  async ({ page }) => {
    await page.getByRole('link', { name: 'Graph', exact: true }).click()
    await expect(page).toHaveURL(/scope=related/)
    await expect(page.getByLabel('Knowledge graph', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'List view', exact: true }).click()
    await page
      .locator('.atlas-list')
      .getByRole('link')
      .filter({ hasText: 'Orion: recovery checklist' })
      .click()
    await expect(page.locator('#page-heading')).toHaveText('Orion: recovery checklist')
    await expect(page).toHaveURL(/\/documents\/demo-orion-runbook/)
  },
)

Then('no successful read was supplied by the browser mock', async ({ traffic }) => {
  expect(traffic.mockRequests).toEqual([])
  expect(traffic.apiPaths.size).toBeGreaterThan(1)
})

When(
  'I open English Docs and follow a cookbook reference',
  async ({ page, traffic }) => {
    await page.goto('/docs/en')
    await page
      .getByRole('link')
      .filter({
        has: page.getByRole('heading', { name: 'Using Lorestra', exact: true }),
      })
      .click()
    await page
      .locator('.markdown-content')
      .getByRole('link', { name: 'Incident to reusable knowledge', exact: true })
      .click()
    expect(traffic.apiPaths.has('/api/documents/using-lorestra')).toBe(true)
  },
)

Then('the English cookbook is loaded through HTTP', async ({ page, traffic }) => {
  await expect(page.locator('#page-heading')).toHaveText(
    'Cookbook: incident to reusable knowledge',
  )
  expect(traffic.apiPaths.has('/api/documents/cookbook-incident-to-knowledge')).toBe(
    true,
  )
})

When('I choose Portuguese and open its introductory Docs page', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Language' }).selectOption('pt-BR')
  const docs = page.getByRole('link', { name: 'Docs', exact: true }).first()
  await expect(docs).toHaveAttribute('href', '/docs/pt-BR')
  await docs.click()
  await page
    .getByRole('link')
    .filter({
      has: page.getByRole('heading', { name: 'O que é o Lorestra?', exact: true }),
    })
    .click()
})

Then(
  'the Portuguese document and URL reflect the chosen language',
  async ({ page, traffic }) => {
    await expect(page).toHaveURL(/\/docs\/pt-BR\/o-que-e-lorestra/)
    await expect(page.locator('#page-heading')).toHaveText('O que é o Lorestra?')
    await expect(page.getByRole('combobox', { name: 'Idioma' })).toHaveValue('pt-BR')
    expect(traffic.apiPaths.has('/api/documents/o-que-e-lorestra')).toBe(true)
  },
)

When('I reload the persisted document', async ({ page }) => {
  await page.reload()
})

Then(
  'Portuguese remains selected and both translation IDs are preserved',
  async ({ page, backend }) => {
    await expect(page.getByRole('combobox', { name: 'Idioma' })).toHaveValue('pt-BR')
    const english = DocumentResponseSchema.parse(
      await (await backend.request('/documents/what-is-lorestra?locale=en')).json(),
    ).document
    const portuguese = DocumentResponseSchema.parse(
      await (await backend.request('/documents/o-que-e-lorestra?locale=pt-BR')).json(),
    ).document
    expect(english.id).toBe('lorestra.docs.what-is-lorestra.en')
    expect(portuguese.id).toBe('lorestra.docs.what-is-lorestra.pt-br')
    expect(english.locale).toBe('en')
    expect(portuguese.locale).toBe('pt-BR')
    expect(english.body).not.toBe(portuguese.body)
  },
)
