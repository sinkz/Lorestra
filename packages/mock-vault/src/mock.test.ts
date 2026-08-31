import { describe, expect, it } from 'vitest'

import { mockVaultData } from './fixtures'
import type { FixtureDocument } from './fixtures'
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
    expect(navigation.documents.every((document) => document.status !== 'draft')).toBe(
      true,
    )
    expect(results.items.some((document) => document.slug === 'internal-draft')).toBe(
      false,
    )
  })

  it('keeps public archives readable while hiding public drafts and internal records', async () => {
    const records: FixtureDocument[] = [
      { slug: 'public-published', visibility: 'public', status: 'published' },
      { slug: 'public-archived', visibility: 'public', status: 'archived' },
      { slug: 'public-draft', visibility: 'public', status: 'draft' },
      { slug: 'internal-published', visibility: 'internal', status: 'published' },
      { slug: 'internal-archived', visibility: 'internal', status: 'archived' },
      { slug: 'internal-draft', visibility: 'internal', status: 'draft' },
    ].map((state) => ({
      ...mockVaultData.documents[0],
      ...state,
      id: `visibility-${state.slug}`,
      title: `Visibility ${state.slug}`,
      content: `# Visibility ${state.slug}`,
      visibility: state.visibility as FixtureDocument['visibility'],
      status: state.status as FixtureDocument['status'],
      locale: 'en',
      relatedDocumentIds:
        state.slug === 'public-published' ? ['visibility-public-archived'] : [],
    }))
    const { knowledgeClient } = createMockClients({
      ...mockVaultData,
      documents: records,
      proposals: [],
      history: records.map((record) => ({
        id: `history-${record.id}`,
        documentId: record.id,
        documentVersion: record.version,
        type: 'updated',
        summary: `Updated ${record.title}`,
        actor: record.author,
        createdAt: record.updatedAt,
      })),
    })
    const expectedIds = ['visibility-public-archived', 'visibility-public-published']
    const [navigation, listing, graph, search, archives, history] = await Promise.all([
      knowledgeClient.getNavigation({ locale: 'en' }),
      knowledgeClient.listDocuments({ locale: 'en', limit: 20, sort: 'title' }),
      knowledgeClient.getGraph({ scope: 'entire', locale: 'en' }),
      knowledgeClient.search({ q: 'Visibility', locale: 'en', limit: 20 }),
      knowledgeClient.listDocuments({
        locale: 'en',
        limit: 20,
        sort: 'title',
        status: 'archived',
      }),
      knowledgeClient.getHistory({ locale: 'en', limit: 20 }),
    ])
    for (const items of [
      navigation.documents,
      listing.items,
      search.items,
      graph.nodes.filter((node) => node.kind === 'document'),
    ]) {
      expect(items.map((document) => document.id).sort()).toEqual(expectedIds)
    }
    expect(
      navigation.items
        .filter((item) => item.kind === 'document')
        .map((item) => item.documentId)
        .sort(),
    ).toEqual(expectedIds)
    expect(archives.items).toMatchObject([
      { id: 'visibility-public-archived', status: 'archived' },
    ])
    expect(history.items.map((event) => event.documentId).sort()).toEqual(expectedIds)
    expect(history.pageInfo.totalCount).toBe(2)
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        source: 'visibility-public-published',
        target: 'visibility-public-archived',
      }),
    )
    for (const record of records) {
      const response = await knowledgeClient.getDocument({
        slug: record.slug,
        locale: 'en',
      })
      if (expectedIds.includes(record.id))
        expect(response?.document).toMatchObject({
          id: record.id,
          status: record.status,
        })
      else expect(response).toBeNull()
    }
  })

  it('keeps explicit process types through metadata changes and historical revisions', async () => {
    const record: FixtureDocument = {
      ...mockVaultData.documents[0],
      id: 'explicit-incident-note',
      slug: 'explicit-process',
      title: 'Incident review decision',
      locale: 'en',
      kind: 'document',
      type: 'process',
      tags: ['incident', 'decision'],
      relatedDocumentIds: [],
    }
    const { knowledgeClient, proposalClient } = createMockClients({
      ...mockVaultData,
      documents: [record],
      proposals: [],
      history: [],
    })
    const before = await knowledgeClient.getDocument({
      slug: record.slug,
      locale: 'en',
    })
    expect(before?.document.type).toBe('process')
    const proposal = await proposalClient.create({
      title: 'Clarify the review procedure',
      summary: 'Update wording while retaining the declared semantic type.',
      locale: 'en',
      changes: [
        {
          id: 'process-change',
          target: {
            documentId: record.id,
            slug: record.slug,
            title: 'Review checklist',
          },
          changeType: 'modified',
          before: record.content,
          after:
            '# Review checklist\n\nReview the evidence before closing the incident.',
        },
      ],
    })
    await proposalClient.transition({ proposalId: proposal.id, status: 'approved' })
    await proposalClient.transition({ proposalId: proposal.id, status: 'merged' })
    const latest = await knowledgeClient.getDocument({
      slug: record.slug,
      locale: 'en',
    })
    const historical = await knowledgeClient.getDocument({
      slug: record.slug,
      locale: 'en',
      version: record.version,
    })
    expect(latest?.document).toMatchObject({
      title: 'Review checklist',
      type: 'process',
      version: record.version + 1,
    })
    expect(historical?.document).toMatchObject({
      title: record.title,
      type: 'process',
      version: record.version,
    })
    const graph = await knowledgeClient.getGraph({ scope: 'entire', locale: 'en' })
    expect(graph.nodes.find((node) => node.id === record.id)?.documentType).toBe(
      'process',
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
