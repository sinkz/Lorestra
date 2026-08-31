import {
  DurableCreateProposalInputSchema,
  DurableProposalSchema,
  DurableProposalTransitionInputSchema,
  DurableUpdateProposalInputSchema,
  NavigationInputSchema,
  LocalSessionInputSchema,
  SessionResponseSchema,
  VaultPathSchema,
} from './index.js'

const metadata = {
  type: 'process',
  folderId: 'folder.docs.en',
  tags: [],
  relations: [],
  visibility: 'public',
  status: 'published',
  locale: 'en',
}
const change = {
  id: 'change-1',
  target: { documentId: 'doc-1', slug: 'runbook', title: 'Runbook' },
  changeType: 'modified',
  baseVersion: 3,
  after: '# Runbook',
  metadata,
}
const proposal = {
  title: 'Update runbook',
  summary: 'Keep the procedure current.',
  changes: [change],
}
const hash = 'a'.repeat(64)

describe('durable write contracts', () => {
  it('requires the exact version read and editable metadata without server-owned fields', () => {
    expect(DurableCreateProposalInputSchema.safeParse(proposal).success).toBe(true)
    for (const invalid of [
      { ...change, baseVersion: undefined },
      { ...change, metadata: undefined },
      { ...change, before: '# Forged history' },
      { ...change, metadata: { ...metadata, author: 'forged' } },
    ]) {
      expect(
        DurableCreateProposalInputSchema.safeParse({ ...proposal, changes: [invalid] })
          .success,
      ).toBe(false)
    }
    expect(
      DurableCreateProposalInputSchema.safeParse({ ...proposal, author: 'forged' })
        .success,
    ).toBe(false)
  })

  it('distinguishes creation, update and deletion preconditions', () => {
    const added = {
      ...change,
      changeType: 'added',
      baseVersion: null,
      target: { ...change.target, documentId: null },
    }
    expect(
      DurableCreateProposalInputSchema.safeParse({ ...proposal, changes: [added] })
        .success,
    ).toBe(true)
    for (const invalid of [
      { ...added, baseVersion: 1 },
      { ...added, target: change.target },
      { ...added, after: null },
      { ...change, baseVersion: null },
      { ...change, changeType: 'deleted' },
    ]) {
      expect(
        DurableCreateProposalInputSchema.safeParse({ ...proposal, changes: [invalid] })
          .success,
      ).toBe(false)
    }
    expect(
      DurableCreateProposalInputSchema.safeParse({
        ...proposal,
        changes: [{ ...change, changeType: 'deleted', after: null }],
      }).success,
    ).toBe(true)
  })

  it('rejects repeated targets and traversal paths while allowing independent translated slugs', () => {
    expect(
      DurableCreateProposalInputSchema.safeParse({
        ...proposal,
        changes: [change, { ...change, id: 'change-2' }],
      }).success,
    ).toBe(false)
    const translated = {
      ...change,
      id: 'change-2',
      target: { ...change.target, documentId: 'doc-pt' },
      metadata: { ...metadata, locale: 'pt-BR' },
    }
    expect(
      DurableCreateProposalInputSchema.safeParse({
        ...proposal,
        changes: [change, translated],
      }).success,
    ).toBe(true)
    expect(VaultPathSchema.safeParse('vault/Docs/en/runbook.md').success).toBe(true)
    for (const path of [
      '../secret',
      'vault/%2e%2e/secret',
      '/absolute',
      'C:/secret',
      'vault\\secret',
      'vault/%2fsecret',
      'vault/%00secret',
    ]) {
      expect(VaultPathSchema.safeParse(path).success).toBe(false)
    }
  })

  it('requires expected versions for edits and transitions and binds merge confirmation', () => {
    expect(
      DurableUpdateProposalInputSchema.safeParse({
        ...proposal,
        proposalId: 'proposal-1',
      }).success,
    ).toBe(false)
    expect(
      DurableUpdateProposalInputSchema.safeParse({
        ...proposal,
        proposalId: 'proposal-1',
        expectedProposalVersion: 2,
      }).success,
    ).toBe(true)
    const transition = {
      proposalId: 'proposal-1',
      status: 'merged',
      expectedProposalVersion: 2,
    }
    expect(DurableProposalTransitionInputSchema.safeParse(transition).success).toBe(
      true,
    )
    expect(
      DurableProposalTransitionInputSchema.safeParse({
        ...transition,
        expectedProposalVersion: undefined,
      }).success,
    ).toBe(false)
    expect(
      DurableProposalTransitionInputSchema.safeParse({
        ...transition,
        status: 'changes_requested',
      }).success,
    ).toBe(false)
    const confirmation = {
      proposalId: 'proposal-1',
      proposalVersion: 2,
      contentHash: hash,
    }
    expect(
      DurableProposalTransitionInputSchema.safeParse({ ...transition, confirmation })
        .success,
    ).toBe(true)
    for (const invalid of [
      { ...transition, confirmation: { ...confirmation, proposalId: 'proposal-2' } },
      { ...transition, confirmation: { ...confirmation, proposalVersion: 1 } },
      { ...transition, status: 'approved', confirmation },
    ])
      expect(DurableProposalTransitionInputSchema.safeParse(invalid).success).toBe(
        false,
      )
  })

  it('does not invent durable versions, hashes or approval in legacy responses', () => {
    expect(
      DurableProposalSchema.safeParse({
        ...proposal,
        id: 'proposal-1',
        status: 'open',
        author: { id: 'author-1', name: 'Editor' },
        createdAt: '2026-08-30T12:00:00.000Z',
        updatedAt: '2026-08-30T12:00:00.000Z',
        changeCount: 1,
        createsDocument: false,
        changes: [{ ...change, before: '# Old' }],
        checks: [],
        discussionSummary: '',
      }).success,
    ).toBe(false)
  })
})

describe('durable read additions', () => {
  it('limits local token exchange to the token, without caller-selected identity', () => {
    expect(LocalSessionInputSchema.safeParse({ token: 'test-token' }).success).toBe(
      true,
    )
    expect(
      LocalSessionInputSchema.safeParse({ token: 'test-token', role: 'maintainer' })
        .success,
    ).toBe(false)
    expect(LocalSessionInputSchema.safeParse({ token: '' }).success).toBe(false)
  })
  it('accepts bounded navigation requests without changing legacy request defaults', () => {
    expect(NavigationInputSchema.parse({})).toEqual({ locale: 'en' })
    expect(
      NavigationInputSchema.parse({ parentId: null, limit: '10', documentId: 'doc-1' }),
    ).toEqual({ locale: 'en', parentId: null, limit: 10, documentId: 'doc-1' })
    expect(NavigationInputSchema.safeParse({ limit: 101 }).success).toBe(false)
  })

  it('makes effective capabilities and limits explicit in an anonymous shared session', () => {
    const response = {
      vaultId: 'lorestra',
      principal: null,
      mode: 'shared',
      csrfToken: null,
      expiresAt: null,
      capabilities: {
        readPublic: true,
        readInternal: false,
        readProposals: false,
        createProposal: false,
        editOwnProposal: false,
        editAnyProposal: false,
        reviewProposal: false,
        mergeProposal: false,
        manageVault: false,
      },
      limits: {
        maxDocumentBytes: 65536,
        maxProposalBytes: 262144,
        maxFilesPerProposal: 20,
        maxOpenProposals: 100,
        maxRequestsPerMinute: 240,
        maxWritesPerMinute: 60,
      },
      readOnly: { enabled: false, reason: null },
    }
    expect(SessionResponseSchema.safeParse(response).success).toBe(true)
    expect(
      SessionResponseSchema.safeParse({ ...response, mode: 'production' }).success,
    ).toBe(false)
    expect(
      SessionResponseSchema.safeParse({ ...response, capabilities: {} }).success,
    ).toBe(false)
  })
})
