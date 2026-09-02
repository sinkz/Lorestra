import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockClients } from '@lorestra/mock-vault'
import type { MemberRole, SessionResponse } from '@lorestra/contracts'

import { createKnowledgeAdapter, createProposalAdapter } from '../../shared/api/client'
import { ApiError } from '../../shared/api/errors'
import type { AppClients, FolderNode, Proposal } from '../../shared/model/types'
import { registerLorestraWebMcpTools } from './register'
import { createMergeConfirmationController } from './confirmation'
import { createLorestraWebMcpTools } from './tools'
import type { WebMcpInteraction, WebMcpToolDefinition } from './types'

function confirmedInteraction(): WebMcpInteraction {
  return {
    requestMergeConfirmation: (input) => ({
      status: 'confirmation_confirmed',
      confirmation: {
        proposalId: input.proposalId,
        proposalVersion: input.proposalVersion,
        contentHash: input.contentHash,
      },
    }),
  }
}

function clients(): AppClients {
  const mock = createMockClients()
  return {
    knowledge: createKnowledgeAdapter(mock.knowledgeClient),
    proposals: createProposalAdapter(mock.proposalClient),
  }
}

function createInput(documentId: string | null = null) {
  return {
    title: 'Cache incident handoff',
    summary: 'Preserve the diagnosis',
    reason: 'Evidence',
    changes: [
      {
        id: 'change-webmcp',
        target: {
          documentId,
          slug: 'cache-incident-handoff',
          title: 'Cache incident handoff',
        },
        changeType: documentId ? ('modified' as const) : ('added' as const),
        baseVersion: documentId ? 3 : null,
        after: '# Intent\nPreserve the diagnosis and recovery evidence.',
        metadata: {
          locale: 'en' as const,
          type: 'note' as const,
          folderId: 'folder.docs.en',
          tags: [],
          relations: [],
          status: 'published' as const,
          visibility: 'public' as const,
        },
      },
    ],
    idempotencyKey: 'create-memory',
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
  session?: NonNullable<AppClients['session']>
}): AppClients {
  const base = clients()
  return {
    knowledge: { ...base.knowledge, ...overrides.knowledge },
    proposals: { ...base.proposals, ...overrides.proposals },
    ...(overrides.session ? { session: overrides.session } : {}),
  }
}

function sessionFor(role: MemberRole, mergeProposal: boolean): SessionResponse {
  return {
    vaultId: 'lorestra-vault',
    principal: { id: `local-${role}`, name: `Local ${role}`, role },
    capabilities: {
      readPublic: true,
      readInternal: true,
      readProposals: true,
      createProposal: role !== 'reader',
      editOwnProposal: role !== 'reader',
      editAnyProposal: role === 'maintainer',
      reviewProposal: role === 'maintainer',
      mergeProposal,
      manageVault: role === 'maintainer',
    },
    mode: 'local',
    csrfToken: 'csrf-token',
    expiresAt: '2026-09-01T00:00:00.000Z',
    readOnly: { enabled: false, reason: null },
    limits: {
      maxDocumentBytes: 65536,
      maxProposalBytes: 262144,
      maxFilesPerProposal: 20,
      maxOpenProposals: 100,
      maxRequestsPerMinute: 240,
      maxWritesPerMinute: 60,
    },
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
    proposalVersion: 1,
    contentHash: 'a'.repeat(64),
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
    tools = createLorestraWebMcpTools(appClients, () => 'en', confirmedInteraction())
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
    expect(registration.registeredToolCount).toBe(11)
    expect(new Set(registrations.map(({ tool }) => tool.name)).size).toBe(11)
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

  it('registers only read tools for a public read-only session', async () => {
    const registrations: WebMcpToolDefinition[] = []
    const target = {
      documentElement: { dataset: {} as DOMStringMap },
      modelContext: {
        async registerTool(tool: WebMcpToolDefinition) {
          registrations.push(tool)
        },
      },
    } as unknown as Document

    const registration = await registerLorestraWebMcpTools(
      target,
      appClients,
      () => 'en',
      undefined,
      undefined,
      { readOnly: true },
    )

    expect(registration.status).toBe('registered')
    expect(registration.registeredToolCount).toBe(8)
    expect(registrations).toHaveLength(8)
    expect(
      registrations.every(({ annotations }) => annotations?.readOnlyHint === true),
    ).toBe(true)
    expect(registrations.map(({ name }) => name)).not.toEqual(
      expect.arrayContaining([
        'lorestra_create_proposal',
        'lorestra_update_proposal',
        'lorestra_transition_proposal',
      ]),
    )
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
        [transition, { proposalId: 'proposal-test' }, 'expectedProposalVersion'],
        [
          transition,
          {
            proposalId: 'proposal-test',
            status: 'changes_requested',
            expectedProposalVersion: 1,
          },
          'reason',
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
      expectedProposalVersion: 1,
      idempotencyKey: 'merge-failed-check',
    })
    expect(result.isError).toBe(true)
    expect(errorMessage(result)).toContain('All checks must pass')
    expect(transition).not.toHaveBeenCalled()
  })

  it('passes an existing document identifier through update proposals', async () => {
    const create = vi.fn(async () => proposal({ id: 'proposal-update' }))
    const updateTools = createLorestraWebMcpTools(
      withClients({ proposals: { create } }),
      () => 'en',
    )

    await toolNamed(updateTools, 'lorestra_create_proposal').execute({
      ...createInput('lorestra.docs.existing.en'),
    })

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: expect.arrayContaining([
          expect.objectContaining({
            target: expect.objectContaining({
              documentId: 'lorestra.docs.existing.en',
            }),
            baseVersion: 3,
          }),
        ]),
      }),
      expect.objectContaining({ idempotencyKey: 'create-memory' }),
    )
  })

  it('creates a proposal without publishing and requires approval before merge', async () => {
    const create = toolNamed(tools, 'lorestra_create_proposal')
    const transition = toolNamed(tools, 'lorestra_transition_proposal')

    const created = structured(
      await create.execute({
        ...createInput(),
      }),
    )
    const proposalId = created.proposalId as string
    expect(created.status).toBe('open')

    const prematureMerge = await transition.execute({
      proposalId,
      status: 'merged',
      reason: 'Attempted without review',
      expectedProposalVersion: created.proposalVersion,
      idempotencyKey: 'premature',
    })
    expect(prematureMerge.isError).toBe(true)

    const approved = structured(
      await transition.execute({
        proposalId,
        status: 'approved',
        reason: 'Evidence and scope reviewed',
        expectedProposalVersion: created.proposalVersion,
        idempotencyKey: 'approve',
      }),
    )
    expect(approved.status).toBe('approved')

    const merged = structured(
      await transition.execute({
        proposalId,
        status: 'merged',
        reason: 'Publishing the accepted memory',
        expectedProposalVersion: approved.proposalVersion,
        idempotencyKey: 'merge',
      }),
    )
    expect(merged.publishedKnowledgeChanged).toBe(true)
  })
  it('requires human confirmation and rejects a stale reviewed version', async () => {
    const transition = vi.fn(async () => proposal({ status: 'merged' }))
    const requestMergeConfirmation = vi.fn(() => ({
      status: 'confirmation_declined' as const,
    }))
    const tools = createLorestraWebMcpTools(
      withClients({
        proposals: {
          get: vi.fn(async () => proposal({ status: 'approved', proposalVersion: 2 })),
          transition,
        },
      }),
      () => 'en',
      { requestMergeConfirmation },
    )
    const merge = toolNamed(tools, 'lorestra_transition_proposal')
    const stale = await merge.execute({
      proposalId: 'proposal-test',
      status: 'merged',
      expectedProposalVersion: 1,
      idempotencyKey: 'stale',
    })
    expect(stale.isError).toBe(true)
    expect(structured(stale)).toMatchObject({
      code: 'proposal_version_conflict',
      status: 409,
      versions: { currentProposalVersion: 2 },
    })
    expect(requestMergeConfirmation).not.toHaveBeenCalled()
    const denied = await merge.execute({
      proposalId: 'proposal-test',
      status: 'merged',
      expectedProposalVersion: 2,
      idempotencyKey: 'declined',
    })
    expect(denied.isError).toBe(true)
    expect(requestMergeConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        proposalId: 'proposal-test',
        proposalVersion: 2,
        contentHash: 'a'.repeat(64),
      }),
      expect.objectContaining({
        binding: expect.objectContaining({
          idempotencyKey: 'declined',
        }),
        signal: undefined,
      }),
    )
    expect(structured(denied).code).toBe('confirmation_declined')
    expect(transition).not.toHaveBeenCalled()
  })

  it('preflights merge authority and never opens a prompt for a contributor', async () => {
    const requestMergeConfirmation = vi.fn(() => ({
      status: 'confirmation_required' as const,
      request: {
        proposalId: 'proposal-test',
        proposalVersion: 1,
        contentHash: 'a'.repeat(64),
        title: 'Test proposal',
        expiresAt: '2026-08-31T00:00:00.000Z',
      },
    }))
    const get = vi.fn(async () => proposal({ status: 'approved' }))
    const transition = vi.fn(async () => proposal({ status: 'merged' }))
    const tools = createLorestraWebMcpTools(
      withClients({
        session: {
          getSession: vi.fn(async () => sessionFor('contributor', false)),
          logout: vi.fn(async () => undefined),
        },
        proposals: { get, transition },
      }),
      () => 'en',
      { requestMergeConfirmation },
    )
    const result = await toolNamed(tools, 'lorestra_transition_proposal').execute({
      proposalId: 'proposal-test',
      status: 'merged',
      expectedProposalVersion: 1,
      idempotencyKey: 'contributor-merge',
    })
    expect(result.isError).toBe(true)
    expect(structured(result)).toMatchObject({ status: 403, code: 'forbidden' })
    expect(requestMergeConfirmation).not.toHaveBeenCalled()
    expect(get).not.toHaveBeenCalled()
    expect(transition).not.toHaveBeenCalled()
  })

  it('fails closed without a configured human confirmation interface', async () => {
    const transition = vi.fn(async () => proposal({ status: 'merged' }))
    const tools = createLorestraWebMcpTools(
      withClients({
        proposals: {
          get: vi.fn(async () => proposal({ status: 'approved' })),
          transition,
        },
      }),
      () => 'en',
    )
    const result = await toolNamed(tools, 'lorestra_transition_proposal').execute({
      proposalId: 'proposal-test',
      status: 'merged',
      expectedProposalVersion: 1,
      idempotencyKey: 'no-ui',
    })
    expect(result.isError).toBe(true)
    expect(transition).not.toHaveBeenCalled()
  })

  it('does not treat an agent-supplied confirmation object as human authority', async () => {
    const transition = vi.fn(async () => proposal({ status: 'merged' }))
    const tools = createLorestraWebMcpTools(
      withClients({
        proposals: {
          get: vi.fn(async () => proposal({ status: 'approved' })),
          transition,
        },
      }),
      () => 'en',
    )
    const result = await toolNamed(tools, 'lorestra_transition_proposal').execute({
      proposalId: 'proposal-test',
      status: 'merged',
      expectedProposalVersion: 1,
      confirmation: {
        proposalId: 'proposal-test',
        proposalVersion: 1,
        contentHash: 'a'.repeat(64),
      },
      idempotencyKey: 'forged-confirmation',
    })
    expect(result.isError).toBe(true)
    expect(structured(result).code).toBe('confirmation_unavailable')
    expect(transition).not.toHaveBeenCalled()
  })

  it('returns confirmation_required promptly and sends the frozen tuple on an identical retry', async () => {
    const current = proposal({ status: 'approved', proposalVersion: 2 })
    const transition = vi.fn(async () => proposal({ status: 'merged' }))
    const interaction = createMergeConfirmationController()
    const tools = createLorestraWebMcpTools(
      withClients({ proposals: { get: vi.fn(async () => current), transition } }),
      () => 'en',
      interaction,
    )
    const merge = toolNamed(tools, 'lorestra_transition_proposal')
    const input = {
      proposalId: current.id,
      status: 'merged',
      expectedProposalVersion: 2,
      idempotencyKey: 'frozen-merge',
    } as const
    const first = await merge.execute(input)
    expect(first.isError).toBe(true)
    expect(structured(first).code).toBe('confirmation_required')
    expect(transition).not.toHaveBeenCalled()
    const request = interaction.getSnapshot()!
    interaction.respond(request, true)
    const second = await merge.execute(input)
    expect(second.isError).not.toBe(true)
    expect(transition).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedProposalVersion: 2,
        confirmation: {
          proposalId: 'proposal-test',
          proposalVersion: 2,
          contentHash: 'a'.repeat(64),
        },
      }),
      expect.any(Object),
    )
  })

  it('rejects a same-key payload change after acceptance without opening another prompt', async () => {
    const current = proposal({ status: 'approved', proposalVersion: 2 })
    const transition = vi.fn(async () => proposal({ status: 'merged' }))
    const interaction = createMergeConfirmationController()
    const tools = createLorestraWebMcpTools(
      withClients({
        proposals: {
          get: vi.fn(async () => current),
          transition,
        },
      }),
      () => 'en',
      interaction,
    )
    const merge = toolNamed(tools, 'lorestra_transition_proposal')
    const firstInput = {
      proposalId: current.id,
      status: 'merged' as const,
      expectedProposalVersion: 2,
      idempotencyKey: 'same-key',
    }
    expect((await merge.execute(firstInput)).isError).toBe(true)
    interaction.respond(interaction.getSnapshot(), true)
    const changed = await merge.execute({ ...firstInput, reason: 'Changed payload' })
    expect(changed.isError).toBe(true)
    expect(structured(changed).code).toBe('confirmation_mismatch')
    expect(transition).not.toHaveBeenCalled()
    interaction.dispose()
  })

  it('retains accepted consent for same-key recovery after an uncertain server response', async () => {
    const current = proposal({ status: 'approved', proposalVersion: 2 })
    let attempts = 0
    const transition = vi.fn(async () => {
      attempts += 1
      if (attempts === 1) throw new ApiError(503, 'service_unavailable')
      return proposal({ status: 'merged', proposalVersion: 3 })
    })
    const interaction = createMergeConfirmationController()
    const tools = createLorestraWebMcpTools(
      withClients({
        proposals: {
          get: vi.fn(async () => current),
          transition,
        },
      }),
      () => 'en',
      interaction,
    )
    const merge = toolNamed(tools, 'lorestra_transition_proposal')
    const input = {
      proposalId: current.id,
      status: 'merged' as const,
      expectedProposalVersion: 2,
      idempotencyKey: 'recover-key',
    }
    expect((await merge.execute(input)).isError).toBe(true)
    interaction.respond(interaction.getSnapshot(), true)
    const uncertain = await merge.execute(input)
    expect(uncertain.isError).toBe(true)
    expect(structured(uncertain)).toMatchObject({
      code: 'service_unavailable',
      status: 503,
    })
    const recovered = await merge.execute(input)
    expect(recovered.isError).not.toBe(true)
    expect(transition).toHaveBeenCalledTimes(2)
    interaction.dispose()
  })

  it('keeps a guarded document-base conflict visible after human authorization', async () => {
    const transition = vi.fn(async () =>
      Promise.reject(
        new ApiError(409, 'document_version_conflict', undefined, undefined, {
          baseVersion: 1,
          currentVersion: 2,
        }),
      ),
    )
    const interaction = createMergeConfirmationController()
    const tools = createLorestraWebMcpTools(
      withClients({
        proposals: {
          get: vi.fn(async () => proposal({ status: 'approved', proposalVersion: 2 })),
          transition,
        },
      }),
      () => 'en',
      interaction,
    )
    const merge = toolNamed(tools, 'lorestra_transition_proposal')
    const input = {
      proposalId: 'proposal-test',
      status: 'merged' as const,
      expectedProposalVersion: 2,
      idempotencyKey: 'base-conflict',
    }
    expect((await merge.execute(input)).isError).toBe(true)
    interaction.respond(interaction.getSnapshot(), true)
    const result = await merge.execute(input)
    expect(result.isError).toBe(true)
    expect(structured(result)).toMatchObject({
      code: 'document_version_conflict',
      status: 409,
      versions: { baseVersion: 1, currentVersion: 2 },
    })
    interaction.dispose()
  })

  it('cancels pending native confirmation on registration disposal before any write', async () => {
    const transition = vi.fn(async () => proposal({ status: 'merged' }))
    const registered: WebMcpToolDefinition[] = []
    const target = {
      documentElement: { dataset: {} },
      modelContext: {
        registerTool: async (tool: WebMcpToolDefinition) => {
          registered.push(tool)
        },
      },
    } as unknown as Document
    const interaction = createMergeConfirmationController()
    const registration = await registerLorestraWebMcpTools(
      target,
      withClients({
        proposals: {
          get: vi.fn(async () => proposal({ status: 'approved' })),
          transition,
        },
      }),
      () => 'en',
      undefined,
      interaction,
    )
    const first = await toolNamed(registered, 'lorestra_transition_proposal').execute({
      proposalId: 'proposal-test',
      status: 'merged',
      expectedProposalVersion: 1,
      idempotencyKey: 'cancelled-native-merge',
    })
    expect(first.isError).toBe(true)
    expect(structured(first).code).toBe('confirmation_required')
    expect(interaction.getSnapshot()).not.toBeNull()
    registration.dispose()
    expect(interaction.getSnapshot()).toBeNull()
    expect(transition).not.toHaveBeenCalled()
  })

  it('resubmits the same proposal with its explicit version and unchanged Markdown', async () => {
    const update = vi.fn(async () => proposal({ proposalVersion: 3 }))
    const tools = createLorestraWebMcpTools(
      withClients({ proposals: { update } }),
      () => 'en',
    )
    await toolNamed(tools, 'lorestra_update_proposal').execute({
      ...createInput(),
      proposalId: 'proposal-test',
      expectedProposalVersion: 2,
    })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        proposalId: 'proposal-test',
        expectedProposalVersion: 2,
        reason: 'Evidence',
        changes: expect.arrayContaining([
          expect.objectContaining({ after: createInput().changes[0].after }),
        ]),
      }),
      expect.objectContaining({ idempotencyKey: 'create-memory' }),
    )
  })

  it('recovers an uncertain completed merge with the original version and idempotency key', async () => {
    const transition = vi.fn(async () =>
      proposal({ status: 'merged', proposalVersion: 3 }),
    )
    const retryTools = createLorestraWebMcpTools(
      withClients({
        proposals: {
          get: vi.fn(async () => proposal({ status: 'merged', proposalVersion: 3 })),
          transition,
        },
      }),
      () => 'en',
    )
    const result = await toolNamed(retryTools, 'lorestra_transition_proposal').execute({
      proposalId: 'proposal-test',
      status: 'merged',
      expectedProposalVersion: 2,
      idempotencyKey: 'original-merge-key',
    })
    expect(result.isError).not.toBe(true)
    expect(transition).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedProposalVersion: 2,
        confirmation: {
          proposalId: 'proposal-test',
          proposalVersion: 2,
          contentHash: 'a'.repeat(64),
        },
      }),
      expect.objectContaining({ idempotencyKey: 'original-merge-key' }),
    )
  })
  it('returns editorial status and locale with search discoveries, including archived knowledge', async () => {
    const result = structured(
      await toolNamed(tools, 'lorestra_search').execute({
        query: 'Lyra',
        locale: 'en',
        limit: 20,
      }),
    )
    const results = result.results as Array<{
      status: string
      locale: string
      slug: string
    }>
    expect(results.length).toBeGreaterThan(0)
    expect(
      results.every(
        (item) =>
          item.locale === 'en' && ['published', 'archived'].includes(item.status),
      ),
    ).toBe(true)
    expect(results.find((item) => item.slug === 'demo-lyra-legacy')?.status).toBe(
      'archived',
    )
  })
})
