/* global document, window */

import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'

const baseUrl = (process.env.LORESTRA_PUBLIC_URL ?? 'http://127.0.0.1:4180').replace(
  /\/$/,
  '',
)

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true })
  } catch (cause) {
    if (
      !(cause instanceof Error) ||
      !cause.message.includes("Executable doesn't exist")
    ) {
      throw cause
    }

    for (const channel of ['chrome', 'msedge']) {
      try {
        return await chromium.launch({ channel, headless: true })
      } catch {
        // Try the next installed stable browser before preserving the original error.
      }
    }
    throw cause
  }
}

const browser = await launchBrowser()

try {
  const context = await browser.newContext({ locale: 'en-US' })
  await context.addInitScript(() => {
    const tools = new Map()
    Object.defineProperty(window, '__lorestraWebMcpTools', { value: tools })
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: {
        async registerTool(tool, options) {
          tools.set(tool.name, tool)
          options?.signal?.addEventListener(
            'abort',
            () => {
              if (tools.get(tool.name) === tool) tools.delete(tool.name)
            },
            { once: true },
          )
        },
      },
    })
  })
  const page = await context.newPage()
  const response = await page.goto(`${baseUrl}/library`, {
    waitUntil: 'networkidle',
  })

  assert.equal(response?.ok(), true, 'The nested Library route must load directly.')
  assert.equal(
    await page.evaluate(() => window.originAgentCluster),
    true,
    'A fresh public browsing context must actually be origin-keyed for WebMCP.',
  )
  assert.equal(
    response?.headers()['origin-agent-cluster'],
    '?1',
    'The public document must opt into an origin-keyed agent cluster for WebMCP.',
  )
  assert.match(
    response?.headers()['permissions-policy'] ?? '',
    /(?:^|[,\s])tools=\(self\)(?:$|[,\s])/,
    'The public document must explicitly allow same-origin WebMCP tools.',
  )
  await page.getByRole('heading', { name: 'All knowledge', level: 1 }).waitFor()
  await page.getByText('Vault is read-only', { exact: true }).waitFor()
  assert.equal(
    await page
      .getByRole('button', { name: 'New memory', exact: true })
      .and(page.locator(':enabled'))
      .count(),
    0,
    'The public showcase must not enable proposal creation.',
  )

  const filter = page.getByRole('textbox', { name: 'Filter documents' })
  await filter.fill('architecture')
  assert.ok(
    (await page.locator('.library-row').count()) > 0,
    'Client-side search must return bundled knowledge.',
  )

  await page.waitForFunction(
    () => document.documentElement.dataset.webmcp === 'registered',
  )
  const webMcpEvidence = await page.evaluate(async () => {
    const registry = window.__lorestraWebMcpTools
    const expectedNames = [
      'lorestra_get_agent_guide',
      'lorestra_list_documents',
      'lorestra_list_proposals',
      'lorestra_read_document',
      'lorestra_read_graph',
      'lorestra_read_history',
      'lorestra_read_proposal',
      'lorestra_search',
    ].sort()
    const registeredNames = [...registry.keys()].sort()

    const invoke = async (name, input) => {
      const tool = registry.get(name)
      if (!tool) throw new Error(`WebMCP tool is not registered: ${name}`)
      const result = await tool.execute(input)
      if (result.isError) {
        throw new Error(`${name} returned an error: ${result.content[0]?.text ?? ''}`)
      }
      return result.structuredContent
    }

    const guide = await invoke('lorestra_get_agent_guide', {})
    const documents = await invoke('lorestra_list_documents', {
      locale: 'en',
      limit: 5,
    })
    const firstDocument = documents.documents[0]
    const search = await invoke('lorestra_search', {
      query: 'architecture',
      locale: 'en',
      limit: 3,
    })
    const document = await invoke('lorestra_read_document', {
      slug: firstDocument.slug,
      locale: 'en',
    })
    const graph = await invoke('lorestra_read_graph', {
      scope: 'entire',
      locale: 'en',
    })
    const proposals = await invoke('lorestra_list_proposals', {
      status: 'all',
      locale: 'en',
      limit: 5,
    })
    const proposal = await invoke('lorestra_read_proposal', {
      proposalId: proposals.proposals[0].id,
      locale: 'en',
    })
    const history = await invoke('lorestra_read_history', {
      locale: 'en',
      limit: 5,
    })

    return {
      expectedNames,
      registeredNames,
      allReadOnly: [...registry.values()].every(
        (tool) => tool.annotations?.readOnlyHint === true,
      ),
      guideMode: guide.session.mode,
      guideCapabilities: guide.session.capabilities,
      documentCount: documents.returned,
      searchCount: search.returned,
      documentSlug: document.slug,
      graphNodes: graph.nodes.length,
      proposalCount: proposals.returned,
      proposalId: proposal.id,
      historyCount: history.returned,
    }
  })

  assert.deepEqual(
    webMcpEvidence.registeredNames,
    webMcpEvidence.expectedNames,
    'The public WebMCP host must receive exactly the eight read-only tools.',
  )
  assert.equal(webMcpEvidence.allReadOnly, true)
  assert.equal(webMcpEvidence.guideMode, 'mock')
  assert.equal(
    webMcpEvidence.guideCapabilities.readProposals,
    true,
    'The public guide must advertise the proposal reads exposed by the host.',
  )
  for (const mutation of [
    'createProposal',
    'editOwnProposal',
    'editAnyProposal',
    'reviewProposal',
    'mergeProposal',
    'manageVault',
  ]) {
    assert.equal(
      webMcpEvidence.guideCapabilities[mutation],
      false,
      `The public guide must keep ${mutation} disabled.`,
    )
  }
  assert.ok(webMcpEvidence.documentCount > 0)
  assert.ok(webMcpEvidence.searchCount > 0)
  assert.ok(webMcpEvidence.documentSlug)
  assert.ok(webMcpEvidence.graphNodes > 0)
  assert.ok(webMcpEvidence.proposalCount > 0)
  assert.ok(webMcpEvidence.proposalId)
  assert.ok(webMcpEvidence.historyCount > 0)

  await page.goto(`${baseUrl}/atlas?scope=entire`, { waitUntil: 'networkidle' })
  await page.getByLabel('Knowledge graph', { exact: true }).waitFor()

  await page.goto(`${baseUrl}/proposals`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Proposals', level: 1 }).waitFor()

  await page.goto(`${baseUrl}/proposals/proposal-docs-reading-loop-002`, {
    waitUntil: 'networkidle',
  })
  for (const action of ['Approve', 'Request changes', 'Merge into vault']) {
    assert.equal(
      await page
        .getByRole('button', { name: action, exact: true })
        .and(page.locator(':enabled'))
        .count(),
      0,
      `The public showcase must not enable the ${action} transition.`,
    )
  }

  process.stdout.write(
    `Public showcase smoke passed: ${baseUrl}\nWebMCP host-contract tools passed: ${webMcpEvidence.registeredNames.join(', ')}\n`,
  )
} finally {
  await browser.close()
}
