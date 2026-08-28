import type { KnowledgeRecord } from './ports.js'

export function normalizeSearchQuery(query: string): string {
  return query.trim().toLocaleLowerCase('en-US')
}

export function scoreSearchResult(document: KnowledgeRecord, query: string): number {
  const normalized = normalizeSearchQuery(query)
  const title = document.title.toLocaleLowerCase('en-US')
  const haystack = [title, document.excerpt, document.body, ...document.tags]
    .join(' ')
    .toLocaleLowerCase('en-US')

  if (!haystack.includes(normalized)) return 0

  let score = 1
  if (title === normalized) score += 100
  else if (title.includes(normalized)) score += 40
  if (
    document.tags.some((tag) => tag.toLocaleLowerCase('en-US').includes(normalized))
  ) {
    score += 15
  }
  if (document.excerpt.toLocaleLowerCase('en-US').includes(normalized)) score += 10
  return score
}

export function rankSearchResults(
  documents: readonly KnowledgeRecord[],
  query: string,
): KnowledgeRecord[] {
  return documents
    .map((document) => ({ document, score: scoreSearchResult(document, query) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      return right.document.updatedAt.localeCompare(left.document.updatedAt)
    })
    .map(({ document }) => document)
}
