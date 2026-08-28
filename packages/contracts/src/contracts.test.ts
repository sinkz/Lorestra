import {
  ApiErrorResponseSchema,
  CreateProposalInputSchema,
  DocumentResponseSchema,
  LocaleSchema,
  ProposalTransitionInputSchema,
  SearchInputSchema,
} from './index.js'

describe('runtime contracts', () => {
  it('accepts the supported locales only', () => {
    expect(LocaleSchema.parse('pt-BR')).toBe('pt-BR')
    expect(LocaleSchema.safeParse('fr').success).toBe(false)
  })

  it('coerces bounded pagination input and rejects empty queries', () => {
    expect(SearchInputSchema.parse({ q: 'incident', limit: '10' }).limit).toBe(10)
    expect(SearchInputSchema.safeParse({ q: '   ' }).success).toBe(false)
    expect(SearchInputSchema.safeParse({ q: 'incident', limit: '101' }).success).toBe(
      false,
    )
  })

  it('requires the final document response shape', () => {
    const response = DocumentResponseSchema.safeParse({
      document: {
        id: 'doc-1',
        slug: 'what-is-lorestra',
        locale: 'en',
        title: 'What is Lorestra?',
        type: 'document',
        visibility: 'public',
        status: 'published',
        version: 1,
        author: { id: 'author-1', name: 'Lorestra' },
        createdAt: '2026-08-28T00:00:00.000Z',
        updatedAt: '2026-08-28T00:00:00.000Z',
        excerpt: 'Portable knowledge.',
        tags: ['docs'],
        nav: { visible: true, parentId: null, order: 10 },
        relationCount: 0,
        body: '# Lorestra',
        relations: [],
      },
      revision: {
        id: 'revision-1',
        documentId: 'doc-1',
        version: 1,
        body: '# Lorestra',
        message: 'Initial revision',
        createdAt: '2026-08-28T00:00:00.000Z',
        createdBy: { id: 'author-1', name: 'Lorestra' },
      },
    })

    expect(response.success).toBe(true)
    expect(
      DocumentResponseSchema.safeParse({
        ...response,
        document: { id: 'doc-1' },
      }).success,
    ).toBe(false)
  })

  it('keeps errors normalized and transitions explicit', () => {
    expect(
      ApiErrorResponseSchema.safeParse({
        error: {
          code: 'not_found',
          message: 'Document not found',
          requestId: 'request-1',
          details: null,
        },
      }).success,
    ).toBe(true)
    expect(
      ProposalTransitionInputSchema.safeParse({
        proposalId: 'proposal-1',
        status: 'approved',
      }).success,
    ).toBe(true)
    expect(
      ProposalTransitionInputSchema.safeParse({
        proposalId: 'proposal-1',
        status: 'changes_requested',
      }).success,
    ).toBe(false)
    expect(
      ProposalTransitionInputSchema.safeParse({
        proposalId: 'proposal-1',
        status: 'changes_requested',
        reason: 'Add the missing source link.',
      }).success,
    ).toBe(true)
    expect(
      ProposalTransitionInputSchema.safeParse({
        proposalId: 'proposal-1',
        status: 'open',
      }).success,
    ).toBe(false)
  })

  it('accepts an optional creation locale and keeps the default-compatible input', () => {
    const result = CreateProposalInputSchema.safeParse({
      title: 'Localized proposal',
      summary: 'A proposal with an explicit locale.',
      locale: 'pt-BR',
      changes: [
        {
          id: 'change-1',
          target: {
            documentId: null,
            slug: 'localized-proposal',
            title: 'Localized proposal',
          },
          changeType: 'added',
          before: null,
          after: '# Localized proposal',
        },
      ],
    })

    expect(result.success).toBe(true)
  })
})
