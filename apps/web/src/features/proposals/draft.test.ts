import { describe, expect, it } from 'vitest'
import { createMockClients } from '@lorestra/mock-vault'
import { createKnowledgeAdapter } from '../../shared/api/client'
import { documentDraft, toProposalInput } from './draft'

describe('version-bound proposal drafts', () => {
  it('retains the version actually read and never appends the justification to Markdown', async () => {
    const document = await createKnowledgeAdapter(
      createMockClients().knowledgeClient,
    ).getDocument({ slug: 'using-lorestra', locale: 'en' })
    expect(document).not.toBeNull()
    const draft = documentDraft(document!, 'en')
    draft.reason = 'Why this change is useful'
    draft.files[0].body = '# Improved guide\n\nActual knowledge only.'
    const baseVersion = document!.version
    document!.version += 1
    const input = toProposalInput(draft)
    expect(input.reason).toBe(draft.reason)
    expect(input.changes[0].after).toBe(draft.files[0].body)
    expect(input.changes[0].after).not.toContain(input.reason)
    expect(input.changes[0].baseVersion).toBe(baseVersion)
    expect(input.changes[0].target.documentId).toBe(document!.id)
  })
  it('represents archive and deletion explicitly without pretending to publish', () => {
    const draft = documentDraft(undefined, 'pt-BR')
    draft.title = 'Nota de pesquisa'
    draft.files[0].body = '# Nota'
    draft.files[0].folderId = 'folder.demo.cygnus.pt-br'
    draft.files[0].status = 'archived'
    const added = toProposalInput(draft).changes[0]
    expect(added.baseVersion).toBeNull()
    expect(added.target.documentId).toBeNull()
    expect(added.target.slug).toBe('nota-de-pesquisa')
    expect(added.metadata.status).toBe('archived')
    draft.files[0].changeType = 'deleted'
    draft.files[0].documentId = 'doc-existing'
    draft.files[0].baseVersion = 2
    expect(toProposalInput(draft).changes[0]).toMatchObject({
      after: null,
      baseVersion: 2,
      changeType: 'deleted',
    })
  })
  it('preserves authoritative metadata even when the visual kind and bounded graph differ', async () => {
    const document = await createKnowledgeAdapter(
      createMockClients().knowledgeClient,
    ).getDocument({ slug: 'using-lorestra', locale: 'en' })
    expect(document?.metadata).toBeDefined()
    document!.metadata!.type = 'document'
    document!.metadata!.relations = ['document-outside-bounded-graph']
    document!.kind = 'note'
    document!.outgoingLinks = []
    const input = toProposalInput(documentDraft(document!, 'en'))
    expect(input.changes[0].metadata).toMatchObject({
      type: 'document',
      relations: ['document-outside-bounded-graph'],
    })
    expect(input.changes[0]).not.toHaveProperty('path')
  })
})
