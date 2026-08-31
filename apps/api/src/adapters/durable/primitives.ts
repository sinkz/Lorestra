import { ApiError } from '../../app/errors.js'

export type StorageBindings = Pick<Env, 'DB' | 'VAULT'>

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

export function randomToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const record = Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  )
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`
}

export async function putBody(
  env: StorageBindings,
  documentId: string,
  version: number,
  body: string,
) {
  const hash = await sha256(body)
  const key = `revisions/${documentId}/${version}/${hash}.md`
  const stored = await env.VAULT.put(key, body, {
    onlyIf: { etagDoesNotMatch: '*' },
    httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
    customMetadata: { sha256: hash },
  })
  if (!stored) {
    const existing = await env.VAULT.head(key)
    if (existing?.customMetadata?.sha256 !== hash)
      throw new ApiError('conflict', 'Revision object integrity conflict.', 409)
  }
  return { key, hash }
}

export async function readBody(
  env: StorageBindings,
  key: string,
  hash: string,
): Promise<string> {
  const object = await env.VAULT.get(key)
  if (!object || object.size > 65_536)
    throw new ApiError('internal_error', 'Revision storage is unavailable.', 503)
  const body = await object.text()
  if ((await sha256(body)) !== hash)
    throw new ApiError('internal_error', 'Revision integrity verification failed.', 503)
  return body
}

export function guard(
  db: D1Database,
  id: string,
  predicate: string,
  values: (string | number | null)[] = [],
) {
  return db
    .prepare(
      `INSERT INTO commit_guards(id,ok) SELECT ?,CASE WHEN (${predicate}) THEN 1 ELSE 0 END`,
    )
    .bind(id, ...values)
}

export function clearGuards(db: D1Database, prefix: string) {
  return db
    .prepare('DELETE FROM commit_guards WHERE substr(id,1,?) = ?')
    .bind(prefix.length, prefix)
}

export async function pageOffset(
  cursor: string | undefined,
  filters: unknown,
): Promise<number> {
  if (!cursor) return 0
  try {
    const decoded: unknown = JSON.parse(atob(cursor))
    if (
      !decoded ||
      typeof decoded !== 'object' ||
      !('offset' in decoded) ||
      !('scope' in decoded) ||
      typeof decoded.offset !== 'number' ||
      !Number.isSafeInteger(decoded.offset) ||
      decoded.offset < 0 ||
      decoded.scope !== (await sha256(canonicalJson(filters)))
    )
      throw new Error('cursor')
    return decoded.offset
  } catch {
    throw new ApiError('bad_request', 'Cursor does not match the current filters.', 400)
  }
}

export async function pageInfo(
  offset: number,
  limit: number,
  totalCount: number,
  filters: unknown,
) {
  const scope = await sha256(canonicalJson(filters))
  const encode = (value: number) => btoa(JSON.stringify({ offset: value, scope }))
  return {
    nextCursor: offset + limit < totalCount ? encode(offset + limit) : null,
    previousCursor: offset > 0 ? encode(Math.max(0, offset - limit)) : null,
    hasNextPage: offset + limit < totalCount,
    hasPreviousPage: offset > 0,
    totalCount,
  }
}
