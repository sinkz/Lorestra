import type { KnowledgeRecord } from './ports.js'
import { normalizeSearchQuery, rankSearchResults, scoreSearchResult } from './search.js'

const document = (
  title: string,
  excerpt: string,
  overrides: Partial<KnowledgeRecord> = {},
): KnowledgeRecord => ({
  id: title.toLowerCase().replaceAll(' ', '-'),
  slug: title.toLowerCase().replaceAll(' ', '-'),
  locale: 'en',
  title,
  type: 'document',
  visibility: 'public',
  status: 'published',
  version: 1,
  author: { id: 'author', name: 'Lorestra' },
  createdAt: '2026-08-28T00:00:00.000Z',
  updatedAt: '2026-08-28T00:00:00.000Z',
  excerpt,
  tags: [],
  nav: { visible: true, parentId: 'folder', order: 1 },
  relationCount: 0,
  body: excerpt,
  relations: [],
  folderId: 'folder',
  ...overrides,
})

describe('knowledge search scoring', () => {
  it('normalizes whitespace and case', () => {
    expect(normalizeSearchQuery('  INCIDENT  ')).toBe('incident')
  })

  it('ranks title matches above body-only matches', () => {
    const titleMatch = document('Incident response', 'Operational guidance.')
    const bodyMatch = document('Operations guide', 'Useful incident guidance.')
    expect(scoreSearchResult(titleMatch, 'incident')).toBeGreaterThan(
      scoreSearchResult(bodyMatch, 'incident'),
    )
    expect(rankSearchResults([bodyMatch, titleMatch], 'incident')[0]?.id).toBe(
      titleMatch.id,
    )
  })

  it('scores each searchable field deliberately and rejects absent terms', () => {
    const exactTitle = document('Incident', 'Nothing relevant.')
    const partialTitle = document('Incident response', 'Nothing relevant.')
    const tagMatch = document('Operations', 'Nothing relevant.', {
      tags: ['Incident-Review', 'reliability'],
    })
    const excerptMatch = document('Operations', 'An INCIDENT was resolved.', {
      body: 'Nothing relevant.',
    })
    const bodyOnly = document('Operations', 'Nothing relevant.', {
      body: 'The incident timeline is preserved here.',
    })

    expect(scoreSearchResult(exactTitle, 'incident')).toBe(101)
    expect(scoreSearchResult(partialTitle, 'incident')).toBe(41)
    expect(scoreSearchResult(tagMatch, 'incident')).toBe(16)
    expect(scoreSearchResult(excerptMatch, 'incident')).toBe(11)
    expect(scoreSearchResult(bodyOnly, 'incident')).toBe(1)
    expect(scoreSearchResult(bodyOnly, 'missing')).toBe(0)
    expect(scoreSearchResult(document('alpha', 'beta'), 'alphabeta')).toBe(0)
  })

  it('drops non-matches and resolves score ties by most recent update', () => {
    const older = document('Older', 'incident', {
      updatedAt: '2026-08-27T00:00:00.000Z',
    })
    const newer = document('Newer', 'incident', {
      updatedAt: '2026-08-28T00:00:00.000Z',
    })
    const absent = document('Absent', 'unrelated')

    expect(
      rankSearchResults([older, absent, newer], 'incident').map(({ id }) => id),
    ).toEqual([newer.id, older.id])
  })
})
