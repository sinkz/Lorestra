import type {
  DurableCreateProposalInput,
  DurableProposalChangeInput,
} from '@lorestra/contracts'
import { describe, expect, it } from 'vitest'

import { mockVaultData } from './fixtures'
import type { FixtureDocument } from './fixtures'
import { createMockClients } from './mock'

const record = (id = 'doc-one'): FixtureDocument => ({
  ...mockVaultData.documents[0],
  id,
  slug: id,
  title: id,
  locale: 'en',
  folderId: 'folder.docs.en',
  folderPath: ['Docs', 'en'],
  type: 'note',
  visibility: 'public',
  status: 'published',
  version: 1,
  content: `# Original ${id}`,
  relatedDocumentIds: [],
  tags: [],
})
const changeFor = (document: FixtureDocument): DurableProposalChangeInput => ({
  id: `change-${document.id}`,
  target: { documentId: document.id, slug: document.slug, title: 'Updated title' },
  changeType: 'modified',
  baseVersion: document.version,
  after: '# Updated content',
  metadata: {
    type: 'process',
    folderId: document.folderId,
    tags: ['procedure'],
    relations: [],
    visibility: document.visibility,
    status: document.status,
    locale: document.locale,
  },
})
const inputFor = (...documents: FixtureDocument[]): DurableCreateProposalInput => ({
  title: 'Update the process',
  summary: 'A reviewed procedure.',
  changes: documents.map(changeFor),
})
const setup = (...documents: FixtureDocument[]) =>
  createMockClients({ ...mockVaultData, documents, proposals: [], history: [] })

describe('durable mock proposal compatibility', () => {
  it('captures server-owned before content and rejects missing or stale bases on creation', async () => {
    const document = record()
    const { proposalClient } = setup(document)
    const created = await proposalClient.create(inputFor(document))
    expect(created).toMatchObject({
      proposalVersion: 1,
      approval: null,
      changes: [
        { baseVersion: 1, before: document.content, metadata: { type: 'process' } },
      ],
    })
    expect(created.contentHash).toMatch(/^[a-f0-9]{64}$/)
    await expect(
      proposalClient.transition({ proposalId: created.id, status: 'approved' }),
    ).rejects.toThrow()
    await expect(
      proposalClient.create({
        ...inputFor(document),
        changes: [{ ...changeFor(document), baseVersion: 2 }],
      }),
    ).rejects.toMatchObject({ code: 'version_conflict' })
    const malformed = { ...changeFor(document), baseVersion: undefined }
    await expect(
      proposalClient.create({
        ...inputFor(document),
        changes: [malformed],
      } as unknown as DurableCreateProposalInput),
    ).rejects.toThrow()
    expect((await proposalClient.list()).pageInfo.totalCount).toBe(1)
  })

  it('reopens edited approvals and binds review and merge to exact proposal versions', async () => {
    const document = record()
    const { proposalClient, knowledgeClient } = setup(document)
    const input = inputFor(document)
    const created = await proposalClient.create({ ...input, reason: 'Initial reason' })
    const approved = await proposalClient.transition({
      proposalId: created.id,
      expectedProposalVersion: 1,
      status: 'approved',
    })
    expect(approved).toMatchObject({
      proposalVersion: 2,
      approval: { reviewedProposalVersion: 1, contentHash: created.contentHash },
    })
    const edited = await proposalClient.update({
      ...input,
      proposalId: created.id,
      expectedProposalVersion: 2,
      changes: [{ ...input.changes[0]!, after: '# Revised procedure' }],
    })
    expect(edited).toMatchObject({ status: 'open', proposalVersion: 3, approval: null })
    expect(edited.reason).toBeUndefined()
    expect(edited.contentHash).not.toBe(created.contentHash)
    await expect(
      proposalClient.transition({
        proposalId: created.id,
        expectedProposalVersion: 2,
        status: 'merged',
      }),
    ).rejects.toMatchObject({ code: 'proposal_version_conflict' })
    expect(
      (await knowledgeClient.getDocumentById({ documentId: document.id }))?.document
        .body,
    ).toBe(document.content)
    const rereviewed = await proposalClient.transition({
      proposalId: created.id,
      expectedProposalVersion: 3,
      status: 'approved',
    })
    expect(rereviewed).toMatchObject({
      proposalVersion: 4,
      approval: { reviewedProposalVersion: 3 },
    })
    await expect(
      proposalClient.transition({
        proposalId: created.id,
        expectedProposalVersion: 4,
        status: 'merged',
        confirmation: {
          proposalId: created.id,
          proposalVersion: 4,
          contentHash: created.contentHash,
        },
      }),
    ).rejects.toMatchObject({ code: 'proposal_version_conflict' })
    const merged = await proposalClient.transition({
      proposalId: created.id,
      expectedProposalVersion: 4,
      status: 'merged',
      confirmation: {
        proposalId: created.id,
        proposalVersion: 4,
        contentHash: rereviewed.contentHash,
      },
    })
    expect(merged.proposalVersion).toBe(5)
    expect(
      (await knowledgeClient.getDocumentById({ documentId: document.id }))?.document,
    ).toMatchObject({
      version: 2,
      type: 'process',
      title: 'Updated title',
      tags: ['procedure'],
      body: '# Revised procedure',
    })
    expect(
      (await knowledgeClient.getDocumentById({ documentId: document.id, version: 1 }))
        ?.document,
    ).toMatchObject({ version: 1, type: 'note', body: document.content })
  })

  it('rejects a stale multi-file merge without publishing any other file', async () => {
    const first = record('doc-one')
    const second = record('doc-two')
    const { proposalClient, knowledgeClient } = setup(first, second)
    const combined = await proposalClient.create(inputFor(first, second))
    const concurrent = await proposalClient.create(inputFor(second))
    for (const proposal of [combined, concurrent])
      await proposalClient.transition({
        proposalId: proposal.id,
        expectedProposalVersion: 1,
        status: 'approved',
      })
    await proposalClient.transition({
      proposalId: concurrent.id,
      expectedProposalVersion: 2,
      status: 'merged',
    })
    const beforeHistory = await knowledgeClient.getHistory()
    await expect(
      proposalClient.transition({
        proposalId: combined.id,
        expectedProposalVersion: 2,
        status: 'merged',
      }),
    ).rejects.toMatchObject({ code: 'version_conflict' })
    expect(
      (await knowledgeClient.getDocumentById({ documentId: first.id }))?.document,
    ).toMatchObject({ version: 1, body: first.content })
    expect((await proposalClient.get({ proposalId: combined.id }))?.status).toBe(
      'approved',
    )
    expect((await knowledgeClient.getHistory()).pageInfo.totalCount).toBe(
      beforeHistory.pageInfo.totalCount,
    )
  })

  it('serializes concurrent reviews so the same expected version wins once', async () => {
    const { proposalClient } = setup(record())
    const created = await proposalClient.create(inputFor(record()))
    const results = await Promise.allSettled([
      proposalClient.transition({
        proposalId: created.id,
        expectedProposalVersion: 1,
        status: 'approved',
      }),
      proposalClient.transition({
        proposalId: created.id,
        expectedProposalVersion: 1,
        status: 'changes_requested',
        reason: 'Add evidence.',
      }),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({
      reason: { code: 'proposal_version_conflict' },
    })
  })

  it('keeps private snapshots private after later publication and pages folder children', async () => {
    const internal = { ...record(), visibility: 'internal' as const }
    const { proposalClient, knowledgeClient } = setup(internal, record('doc-two'))
    const input = inputFor(internal)
    const created = await proposalClient.create({
      ...input,
      changes: [
        {
          ...input.changes[0]!,
          metadata: { ...input.changes[0]!.metadata, visibility: 'public' },
        },
      ],
    })
    await proposalClient.transition({
      proposalId: created.id,
      expectedProposalVersion: 1,
      status: 'approved',
    })
    await proposalClient.transition({
      proposalId: created.id,
      expectedProposalVersion: 2,
      status: 'merged',
    })
    expect(
      await knowledgeClient.getDocumentById({ documentId: internal.id, version: 1 }),
    ).toBeNull()
    expect(
      (await knowledgeClient.getDocumentById({ documentId: internal.id }))?.document
        .visibility,
    ).toBe('public')
    const page = await knowledgeClient.getNavigation({
      locale: 'en',
      parentId: 'folder.docs.en',
      documentId: internal.id,
      limit: 1,
    })
    expect(page.items).toHaveLength(1)
    expect(page.pageInfo).toMatchObject({ hasNextPage: true, totalCount: 2 })
    expect(page.ancestors?.map((item) => item.id)).toContain('folder.docs.en')
  })
})
