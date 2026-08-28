import { describe, expect, it } from 'vitest'

import { mockVaultData } from './fixtures'
import { createMockClients } from './mock'

describe('mock vault publication boundary', () => {
  it('keeps approved content unpublished until merge', async () => {
    const { knowledgeClient, proposalClient } = createMockClients()
    const before = await knowledgeClient.getDocument({
      slug: 'using-lorestra',
      locale: 'en',
    })

    const approved = await proposalClient.get({
      proposalId: 'proposal-docs-reading-loop-002',
    })
    expect(approved?.status).toBe('approved')
    expect(before?.document.body).not.toContain('Reader checklist')

    await proposalClient.transition({
      proposalId: 'proposal-docs-reading-loop-002',
      status: 'merged',
    })

    const after = await knowledgeClient.getDocument({
      slug: 'using-lorestra',
      locale: 'en',
    })
    expect(after?.document.version).toBe((before?.document.version ?? 0) + 1)
    expect(after?.document.body).toContain('Reader checklist')
  })

  it('does not expose internal drafts through navigation or search', async () => {
    const { knowledgeClient } = createMockClients()
    const navigation = await knowledgeClient.getNavigation({ locale: 'en' })
    const results = await knowledgeClient.search({
      q: 'internal',
      locale: 'en',
      limit: 20,
    })

    expect(
      navigation.documents.every((document) => document.visibility === 'public'),
    ).toBe(true)
    expect(
      navigation.documents.every((document) => document.status === 'published'),
    ).toBe(true)
    expect(results.items.some((document) => document.slug === 'internal-draft')).toBe(
      false,
    )
  })

  it('uses the shared transition policy and requires a reason for changes', async () => {
    const { proposalClient } = createMockClients()

    await expect(
      proposalClient.transition({
        proposalId: 'proposal-incident-runbook-001',
        status: 'changes_requested',
      }),
    ).rejects.toThrow('reason')

    await expect(
      proposalClient.transition({
        proposalId: 'proposal-docs-reading-loop-002',
        status: 'changes_requested',
        reason: 'Please add the source link.',
      }),
    ).rejects.toThrow('Cannot transition')
  })

  it('does not turn non-passing checks into passing checks during approval or merge', async () => {
    const approvedWithPendingCheck = {
      ...mockVaultData.proposals[0],
      status: 'approved' as const,
      checks: [{ name: 'Human review', status: 'pending' as const }],
    }
    const { proposalClient } = createMockClients({
      ...mockVaultData,
      proposals: [approvedWithPendingCheck],
    })

    const proposal = await proposalClient.get({
      proposalId: approvedWithPendingCheck.id,
    })
    expect(proposal?.checks).toEqual([{ name: 'Human review', status: 'pending' }])
    await expect(
      proposalClient.transition({
        proposalId: approvedWithPendingCheck.id,
        status: 'merged',
      }),
    ).rejects.toThrow('checks')
  })

  it('keeps the requested locale when creating a new document proposal', async () => {
    const { knowledgeClient, proposalClient } = createMockClients()
    const proposal = await proposalClient.create({
      title: 'Memória em português',
      summary: 'Registrar uma memória localizada.',
      locale: 'pt-BR',
      changes: [
        {
          id: 'change-localized-memory',
          target: {
            documentId: null,
            slug: 'memoria-em-portugues',
            title: 'Memória em português',
          },
          changeType: 'added',
          before: null,
          after: '# Memória em português',
        },
      ],
    })

    await proposalClient.transition({ proposalId: proposal.id, status: 'approved' })
    await proposalClient.transition({ proposalId: proposal.id, status: 'merged' })

    const portuguese = await knowledgeClient.getNavigation({ locale: 'pt-BR' })
    const english = await knowledgeClient.getNavigation({ locale: 'en' })
    expect(
      portuguese.documents.some((document) => document.slug === 'memoria-em-portugues'),
    ).toBe(true)
    expect(
      english.documents.some((document) => document.slug === 'memoria-em-portugues'),
    ).toBe(false)
  })
})
