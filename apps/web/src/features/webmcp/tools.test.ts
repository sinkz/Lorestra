import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockClients } from '@lorestra/mock-vault'

import { createKnowledgeAdapter, createProposalAdapter } from '../../shared/api/client'
import type { AppClients, FolderNode, Proposal } from '../../shared/model/types'
import { registerLorestraWebMcpTools } from './register'
import { createLorestraWebMcpTools } from './tools'
import type { WebMcpToolDefinition } from './types'

function clients(): AppClients {
  const mock = createMockClients()
  return {
    knowledge: createKnowledgeAdapter(mock.knowledgeClient),
    proposals: createProposalAdapter(mock.proposalClient),
  }
}

function structured(result: Awaited<ReturnType<WebMcpToolDefinition['execute']>>) {
  return result.structuredContent as Record<string, unknown>
}

function toolNamed(tools: WebMcpToolDefinition[], name: string) {
  const tool = tools.find((item) => item.name === name)
  expect(tool).toBeDefined()
  return tool!
}

function errorMessage(
  result: Awaited<ReturnType<WebMcpToolDefinition['execute']>>,
): string {
  return (structured(result).error as string) ?? ''
}

function withClients(overrides: {
  knowledge?: Partial<AppClients['knowledge']>
  proposals?: Partial<AppClients['proposals']>
}): AppClients {
  const base = clients()
  return {
    knowledge: { ...base.knowledge, ...overrides.knowledge },
    proposals: { ...base.proposals, ...overrides.proposals },
  }
}

function proposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    id: 'proposal-test',
    number: 1,
    title: 'Test proposal',
    summary: 'A test proposal.',
    body: 'A test proposal body.',
    status: 'open',
    author: 'test-author',
    createdAt: '2026-08-28T12:00:00.000Z',
    updatedAt: '2026-08-28T12:00:00.000Z',
    changeCount: 1,
    createsDocument: false,
    files: [
      {
        path: 'vault/Docs/en/test.md',
        changeType: 'modified',
        additions: 1,
        deletions: 0,
        diff: [{ type: 'add', text: 'new line' }],
      },
    ],
    checks: [{ id: 'check-1', label: 'Format', status: 'passed' }],
    documentIds: [],
    ...overrides,
  }
}

describe('Lorestra WebMCP tools', () => {
  let appClients: AppClients
  let tools: WebMcpToolDefinition[]

  beforeEach(() => {
    appClients = clients()
    tools = createLorestraWebMcpTools(appClients, () => 'en')
  })

  it('registers a unique, governed tool surface and unregisters it with one signal', async () => {
    const registrations: Array<{
      tool: WebMcpToolDefinition
      signal?: AbortSignal
    }> = []
    const element = { dataset: {} as DOMStringMap }
    const target = {
      documentElement: element,
      modelContext: {
        async registerTool(
          tool: WebMcpToolDefinition,
          options?: { signal?: AbortSignal },
        ) {
          registrations.push({ tool, signal: options?.signal })
        },
      },
    } as unknown as Document

    const registration = await registerLorestraWebMcpTools(
      target,
      appClients,
      () => 'en',
    )

    expect(registration.status).toBe('registered')
    expect(registration.registeredToolCount).toBe(10)
    expect(new Set(registrations.map(({ tool }) => tool.name)).size).toBe(10)
    expect(
      registrations.filter(({ tool }) => tool.annotations?.readOnlyHint).length,
    ).toBe(8)

    registration.dispose()
    expect(registrations.every(({ signal }) => signal?.aborted)).toBe(true)
  })

  it('cleans the unsupported marker when registration is disposed', async () => {
    const element = { dataset: {} as DOMStringMap }
    const target = { documentElement: element } as unknown as Document

    const registration = await registerLorestraWebMcpTools(
      target,
      appClients,
      () => 'en',
    )

    expect(registration.status).toBe('unsupported')
    expect(element.dataset.webmcp).toBe('unsupported')
    registration.dispose()
    expect(element.dataset.webmcp).toBeUndefined()
    expect(element.dataset.webmcpTools).toBeUndefined()
  })

  it('searches existing knowledge and returns bounded structured results', async () => {
    const search = toolNamed(tools, 'lorestra_search')

    const response = structured(
      await search.execute({ query: 'architecture', locale: 'en', limit: 3 }),
    )
    const results = response.results as Array<Record<string, unknown>>

    expect(results.length).toBeGreaterThan(0)
    expect(results.length).toBeLessThanOrEqual(3)
    expect(results[0]).toHaveProperty('slug')
  })

  it('rejects invalid, missing, and unknown execution arguments', async () => {
    const search = toolNamed(tools, 'lorestra_search')
    const graph = toolNamed(tools, 'lorestra_read_graph')
    const proposals = toolNamed(tools, 'lorestra_list_proposals')
    const history = toolNamed(tools, 'lorestra_read_history')
    const transition = toolNamed(tools, 'lorestra_transition_proposal')

    const invalidCases: Array<[WebMcpToolDefinition, Record<string, unknown>, string]> =
      [
        [search, { query: 'architecture', limit: 0 }, '"limit" must be between'],
        [search, { query: 'architecture', limit: 1.5 }, '"limit" must be an integer'],
        [search, { query: 'architecture', locale: 'fr' }, '"locale" must be one of'],
        [search, { query: 'architecture', extra: true }, 'Unknown input field(s)'],
        [graph, { scope: 'surprise' }, '"scope" must be one of'],
        [proposals, { status: 'pending' }, '"status" must be one of'],
        [history, { limit: 51 }, '"limit" must be between'],
        [transition, { proposalId: 'proposal-test' }, '"status" is required'],
        [
          transition,
          { proposalId: 'proposal-test', status: 'changes-requested' },
          '"reason" must be a non-empty string',
        ],
      ]

    for (const [tool, input, expected] of invalidCases) {
      const result = await tool.execute(input)
      expect(result.isError).toBe(true)
      expect(errorMessage(result)).toContain(expected)
    }

    const nonObject = await search.execute(null as unknown as Record<string, unknown>)
    expect(nonObject.isError).toBe(true)
    expect(errorMessage(nonObject)).toContain('Tool input must be a JSON object')
  })

  it('bounds folders, protects cyclic trees, and bounds proposal listings', async () => {
    const cyclicRoot: FolderNode = {
      id: 'folder.cycle',
      name: 'Cycle',
      path: 'Cycle',
      documentCount: 0,
      children: [],
    }
    cyclicRoot.children.push(cyclicRoot)
    const manyProposals = Array.from({ length: 150 }, (_, index) =>
      proposal({ id: `proposal-${index + 1}` }),
    )
    const boundedTools = createLorestraWebMcpTools(
      withClients({
        knowledge: {
          getNavigation: vi.fn(async () => ({
            vault: { id: 'lorestra', name: 'Lorestra', branch: 'main' },
            folders: [cyclicRoot],
            documents: [],
          })),
        },
        proposals: {
          list: vi.fn(async () => ({
            items: manyProposals.slice(0, 100),
            pageInfo: {
              nextCursor: '100',
              previousCursor: null,
              hasNextPage: true,
              hasPreviousPage: false,
              totalCount: manyProposals.length,
            },
          })),
        },
      }),
      () => 'en',
    )

    const folders = structured(
      await toolNamed(boundedTools, 'lorestra_list_documents').execute({}),
    )
    expect(folders.folders).toHaveLength(1)
    expect(folders.foldersTruncated).toBe(false)

    const listed = structured(
      await toolNamed(boundedTools, 'lorestra_list_proposals').execute({ limit: 3 }),
    )
    expect(listed.proposals).toHaveLength(3)
    expect(listed.total).toBe(150)
    expect(listed.returned).toBe(3)
    expect(listed.truncated).toBe(true)
  })

  it('bounds the aggregate proposal body and diff output', async () => {
    const largeProposal = proposal({
      body: 'x'.repeat(40_000),
      files: Array.from({ length: 10 }, (_, index) => ({
        path: `vault/Docs/en/file-${index}.md`,
        changeType: 'modified' as const,
        additions: 1,
        deletions: 0,
        diff: [{ type: 'add' as const, text: 'x'.repeat(30_000) }],
      })),
    })
    const boundedTools = createLorestraWebMcpTools(
      withClients({
        proposals: {
          get: vi.fn(async () => largeProposal),
        },
      }),
      () => 'en',
    )

    const result = structured(
      await toolNamed(boundedTools, 'lorestra_read_proposal').execute({
        proposalId: largeProposal.id,
      }),
    )
    const files = result.files as Array<{ diff: string }>
    const aggregateDiff = files.reduce((total, file) => total + file.diff.length, 0)
    expect((result.body as string).length).toBeLessThanOrEqual(32_000)
    expect(files.length).toBeLessThanOrEqual(50)
    expect(aggregateDiff).toBeLessThanOrEqual(128_000)
    expect(result.filesTruncated).toBe(true)
    expect(result.bodyTruncated).toBe(true)
  })

  it('blocks merge when the current proposal has a failed check', async () => {
    const transition = vi.fn(async () => proposal({ status: 'merged' }))
    const guardedTools = createLorestraWebMcpTools(
      withClients({
        proposals: {
          get: vi.fn(async () =>
            proposal({
              status: 'approved',
              checks: [{ id: 'check-1', label: 'Security review', status: 'failed' }],
            }),
          ),
          transition,
        },
      }),
      () => 'en',
    )

    const result = await toolNamed(
      guardedTools,
      'lorestra_transition_proposal',
    ).execute({
      proposalId: 'proposal-test',
      status: 'merged',
    })
    expect(result.isError).toBe(true)
    expect(errorMessage(result)).toContain('all checks must pass')
    expect(transition).not.toHaveBeenCalled()
  })

  it('passes an existing document identifier through update proposals', async () => {
    const create = vi.fn(async () => proposal({ id: 'proposal-update' }))
    const updateTools = createLorestraWebMcpTools(
      withClients({ proposals: { create } }),
      () => 'en',
    )

    await toolNamed(updateTools, 'lorestra_create_proposal').execute({
      title: 'Improve the existing guide',
      body: 'Keep the existing document identity stable.',
      documentId: 'lorestra.docs.existing.en',
    })

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: 'lorestra.docs.existing.en' }),
    )
  })

  it('creates a proposal without publishing and requires approval before merge', async () => {
    const create = toolNamed(tools, 'lorestra_create_proposal')
    const transition = toolNamed(tools, 'lorestra_transition_proposal')

    const created = structured(
      await create.execute({
        title: 'Cache incident handoff',
        body: '# Intent\nPreserve the diagnosis and the recovery evidence.',
        locale: 'en',
      }),
    )
    const proposalId = created.proposalId as string
    expect(created.status).toBe('open')

    const prematureMerge = await transition.execute({
      proposalId,
      status: 'merged',
      reason: 'Attempted without review',
    })
    expect(prematureMerge.isError).toBe(true)

    const approved = structured(
      await transition.execute({
        proposalId,
        status: 'approved',
        reason: 'Evidence and scope reviewed',
      }),
    )
    expect(approved.status).toBe('approved')

    const merged = structured(
      await transition.execute({
        proposalId,
        status: 'merged',
        reason: 'Publishing the accepted memory',
      }),
    )
    expect(merged.publishedKnowledgeChanged).toBe(true)
  })
})
