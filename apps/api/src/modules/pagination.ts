import type { PageInfo } from '@lorestra/contracts'

export function page<T>(
  items: readonly T[],
  cursor: string | undefined,
  limit: number,
): {
  items: T[]
  pageInfo: PageInfo
} {
  const offset = cursor ? Number.parseInt(cursor, 10) : 0
  const start = Number.isInteger(offset) && offset >= 0 ? offset : 0
  const result = items.slice(start, start + limit)
  const next = start + result.length
  const hasNextPage = next < items.length
  const hasPreviousPage = start > 0

  return {
    items: result,
    pageInfo: {
      hasNextPage,
      nextCursor: hasNextPage ? String(next) : null,
      hasPreviousPage,
      previousCursor: hasPreviousPage ? String(Math.max(0, start - limit)) : null,
      totalCount: items.length,
    },
  }
}
