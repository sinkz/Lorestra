import { describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { createMockClients } from '@lorestra/mock-vault'
import type {
  DurableCreateProposalInput,
  MutationRequestOptions,
  SessionResponse,
} from '@lorestra/contracts'
import { createKnowledgeAdapter, createProposalAdapter } from './client'
import { coordinateClients } from './coordinator'
import { ApiError } from './errors'
import { sessionScope } from './session'

const session: SessionResponse = {
  vaultId: 'vault-test',
  principal: { id: 'member-a', name: 'A', role: 'maintainer' },
  mode: 'local',
  csrfToken: 'synthetic-csrf',
  expiresAt: null,
  readOnly: { enabled: false, reason: null },
  capabilities: {
    readPublic: true,
    readInternal: true,
    readProposals: true,
    createProposal: true,
    editOwnProposal: true,
    editAnyProposal: true,
    reviewProposal: true,
    mergeProposal: true,
    manageVault: true,
  },
  limits: {
    maxDocumentBytes: 65536,
    maxProposalBytes: 262144,
    maxFilesPerProposal: 20,
    maxOpenProposals: 100,
    maxRequestsPerMinute: 240,
    maxWritesPerMinute: 60,
  },
}
const input: DurableCreateProposalInput = {
  title: 'Shared mutation',
  summary: 'Summary',
  changes: [
    {
      id: 'change-coordinator',
      target: { documentId: null, title: 'Shared mutation', slug: 'shared-mutation' },
      changeType: 'added',
      baseVersion: null,
      after: '# Durable',
      metadata: {
        type: 'note',
        folderId: 'folder.docs.en',
        tags: [],
        relations: [],
        locale: 'en',
        visibility: 'public',
        status: 'published',
      },
    },
  ],
}
function baseClients() {
  const mock = createMockClients()
  return {
    knowledge: createKnowledgeAdapter(mock.knowledgeClient),
    proposals: createProposalAdapter(mock.proposalClient),
  }
}

describe('shared UI and WebMCP mutation coordinator', () => {
  it('reuses the same operation key after uncertain failure; carries the current CSRF token', async () => {
    const base = baseClients()
    const original = base.proposals.create
    const options: MutationRequestOptions[] = []
    let failed = false
    base.proposals.create = async (payload, request) => {
      options.push(request!)
      if (!failed) {
        failed = true
        throw new ApiError(0, 'NETWORK_ERROR')
      }
      return original(payload, request)
    }
    const queryClient = new QueryClient()
    const coordinated = coordinateClients(base, queryClient, session, () => {})
    await expect(coordinated.proposals.create(input)).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    })
    await coordinated.proposals.create(input)
    expect(options[0].idempotencyKey).toBe(options[1].idempotencyKey)
    expect(options[0].csrfToken).toBe(session.csrfToken)
    queryClient.clear()
  })
  it('invalidates published collections after merge but leaves immutable revisions untouched', async () => {
    const queryClient = new QueryClient()
    const keys = [
      ['scope', 'documents'],
      ['scope', 'document', 'slug', 'en', 'current'],
      ['scope', 'document', 'slug', 'en', 1],
      ['scope', 'navigation'],
      ['scope', 'graph'],
      ['scope', 'search'],
      ['scope', 'proposals'],
      ['scope', 'history'],
    ]
    keys.forEach((key) => queryClient.setQueryData(key, { visible: true }))
    const clients = coordinateClients(baseClients(), queryClient, session, () => {})
    const created = await clients.proposals.create(input)
    expect(queryClient.getQueryState(keys[0])?.isInvalidated).toBe(false)
    const approved = await clients.proposals.transition({
      proposalId: created.id,
      status: 'approved',
      expectedProposalVersion: created.proposalVersion!,
    })
    await clients.proposals.transition({
      proposalId: created.id,
      status: 'merged',
      expectedProposalVersion: approved.proposalVersion!,
    })
    expect(queryClient.getQueryState(keys[0])?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(keys[1])?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(keys[2])?.isInvalidated).toBe(false)
    for (const key of keys.slice(3))
      expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true)
    queryClient.clear()
  })
  it('removes cached private content when write authority expires', async () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(['scope', 'document', 'internal'], { body: 'private' })
    const base = baseClients()
    base.proposals.create = vi.fn(async () => {
      throw new ApiError(401, 'unauthorized')
    })
    const refresh = vi.fn()
    await expect(
      coordinateClients(base, queryClient, session, refresh).proposals.create(input),
    ).rejects.toMatchObject({ status: 401 })
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(refresh).toHaveBeenCalledOnce()
  })
  it('isolates principals and policy in query scopes without putting CSRF tokens in keys', () => {
    expect(sessionScope(session)).not.toBe(
      sessionScope({
        ...session,
        principal: { ...session.principal!, id: 'member-b' },
      }),
    )
    expect(sessionScope(session)).not.toBe(
      sessionScope({ ...session, principal: null }),
    )
    expect(sessionScope(session)).not.toContain(session.csrfToken)
  })
})
