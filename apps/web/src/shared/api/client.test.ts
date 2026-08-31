import { describe, expect, it } from 'vitest'

import { createMockClients } from '@lorestra/mock-vault'

import { createKnowledgeAdapter, createProposalAdapter, mapNavigation } from './client'

describe('navigation adapter', () => {
  it('builds a navigable folder tree and portable document paths', async () => {
    const { knowledgeClient } = createMockClients()
    const response = await knowledgeClient.getNavigation({ locale: 'en' })
    const navigation = mapNavigation(response)

    expect(navigation.vault.name).toBe('Lorestra Vault')
    expect(navigation.folders.length).toBeGreaterThan(0)
    expect(navigation.documents.length).toBeGreaterThan(0)
    expect(
      navigation.documents.every((document) => document.folderPath !== 'Unsorted'),
    ).toBe(true)
    expect(navigation.documents.every((document) => document.status !== 'draft')).toBe(
      true,
    )
  })
})

describe('application adapters', () => {
  it('keeps locale and real file paths across the proposal seam', async () => {
    const contract = createMockClients()
    const knowledge = createKnowledgeAdapter(contract.knowledgeClient)
    const proposals = createProposalAdapter(contract.proposalClient)

    const fixture = await proposals.get({
      proposalId: 'proposal-launch-cookbook-003',
      locale: 'en',
    })
    expect(fixture?.files[0]?.path).toBe('vault/Docs/en/cookbooks/launch-readiness.md')

    const created = await proposals.create({
      title: 'Memória do adapter',
      summary: 'Memória do adapter',
      changes: [
        {
          id: 'change-adapter',
          target: {
            documentId: null,
            slug: 'memoria-do-adapter',
            title: 'Memória do adapter',
          },
          changeType: 'added',
          baseVersion: null,
          after: '# Memória do adapter',
          metadata: {
            locale: 'pt-BR',
            type: 'note',
            folderId: 'folder.docs.pt-br',
            tags: [],
            relations: [],
            status: 'published',
            visibility: 'public',
          },
        },
      ],
    })
    const approved = await proposals.transition({
      proposalId: created.id,
      expectedProposalVersion: created.proposalVersion!,
      status: 'approved',
    })
    await proposals.transition({
      proposalId: created.id,
      expectedProposalVersion: approved.proposalVersion!,
      status: 'merged',
    })

    const navigation = await knowledge.getNavigation({ locale: 'pt-BR' })
    expect(
      navigation.documents.some((document) => document.slug === 'memoria-do-adapter'),
    ).toBe(true)
  })

  it('reads the immutable version requested after a later merge', async () => {
    const contract = createMockClients()
    const knowledge = createKnowledgeAdapter(contract.knowledgeClient)
    const proposals = createProposalAdapter(contract.proposalClient)
    const before = await knowledge.getDocument({ slug: 'using-lorestra', locale: 'en' })

    await proposals.transition({
      proposalId: 'proposal-docs-reading-loop-002',
      expectedProposalVersion: (await proposals.get({
        proposalId: 'proposal-docs-reading-loop-002',
      }))!.proposalVersion!,
      status: 'merged',
    })
    const current = await knowledge.getDocument({
      slug: 'using-lorestra',
      locale: 'en',
    })
    const historical = await knowledge.getDocument({
      slug: 'using-lorestra',
      locale: 'en',
      version: before?.version,
    })

    expect(current?.version).toBe((before?.version ?? 0) + 1)
    expect(historical?.version).toBe(before?.version)
    expect(historical?.body).toBe(before?.body)
    expect(historical?.body).not.toBe(current?.body)
  })
})
