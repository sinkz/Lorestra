import { z } from 'zod'
import {
  DocumentSchema,
  DurableProposalSchema,
  IdempotencyKeySchema,
  PrincipalSchema,
  VaultPathSchema,
  type DurableCreateProposalInput,
  type DurableProposal,
  type DurableProposalChangeInput,
  type DurableProposalMetadata,
  type Principal,
} from '@lorestra/contracts'

import { ApiError } from '../../app/errors.js'
import { DEFAULT_LIMITS, runtimeSettings, type Identity } from './identity.js'
import {
  canonicalJson,
  clearGuards,
  guard,
  readBody,
  sha256,
  type StorageBindings,
} from './primitives.js'

export type ProposalResult = { proposal: DurableProposal }
export type Permission = 'contribute' | 'review'
export type Operation = {
  id: string
  requestId: string
  payloadHash: string
  principal: Principal
  identity: Identity
  permission: Permission
  settings: Awaited<ReturnType<typeof runtimeSettings>>
}
const SnapshotSchema = DocumentSchema.omit({ body: true }).extend({
  path: VaultPathSchema.optional(),
})
type Snapshot = z.infer<typeof SnapshotSchema>
type StoredDocument = {
  snapshot: Snapshot
  body: string
  version: number
  folderId: string
  path: string
}
type Folder = {
  id: string
  slug: string
  parent_id: string | null
  visibility: string
  locale: string
}
export type PreparedChanges = {
  changes: DurableProposal['changes']
  before: Map<string, StoredDocument>
  folders: Folder[]
  paths: Map<string, string>
  relationIds: string[]
}

const mutationTimeSql = "CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)"

async function activePrincipal(
  env: StorageBindings,
  identity: Identity,
  permission: Permission,
): Promise<Principal> {
  if (!identity.principal || !identity.tokenHash)
    throw new ApiError('unauthorized', 'Sign in before changing the vault.', 401)
  const row = await env.DB.prepare(
    `SELECT m.id,m.name,m.role FROM members m JOIN sessions s ON s.principal_id=m.id
    WHERE m.id=? AND s.token_hash=? AND m.active=1 AND s.expires_at>?`,
  )
    .bind(identity.principal.id, identity.tokenHash, Date.now())
    .first()
  if (!row) throw new ApiError('unauthorized', 'This session is no longer active.', 401)
  const principal = PrincipalSchema.parse(row)
  if (
    principal.role === 'reader' ||
    (permission === 'review' && principal.role !== 'maintainer')
  )
    throw new ApiError('forbidden', 'Your role cannot perform this operation.', 403)
  return principal
}

export async function beginOperation(
  env: StorageBindings,
  identity: Identity,
  input: unknown,
  action: string,
  key: string,
  permission: Permission,
  requestId: string = crypto.randomUUID(),
): Promise<Operation> {
  const principal = await activePrincipal(env, identity, permission)
  const parsedKey = IdempotencyKeySchema.safeParse(key)
  if (!parsedKey.success)
    throw new ApiError('bad_request', 'A valid Idempotency-Key is required.', 400)
  const settings = await runtimeSettings(env)
  if (settings.readOnly.enabled)
    throw new ApiError(
      'service_unavailable',
      'The vault is temporarily read-only.',
      503,
    )
  return {
    requestId,
    id: await sha256(
      canonicalJson({
        vault: settings.vault.id,
        actor: principal.id,
        action,
        key: parsedKey.data,
      }),
    ),
    payloadHash: await sha256(canonicalJson(input)),
    principal,
    identity,
    permission,
    settings,
  }
}

export async function replayOperation(
  env: StorageBindings,
  operation: Operation,
): Promise<ProposalResult | null> {
  const row = await env.DB.prepare(
    'SELECT payload_hash,result_json FROM operations WHERE id=? AND principal_id=?',
  )
    .bind(operation.id, operation.principal.id)
    .first<{ payload_hash: string; result_json: string }>()
  if (!row) return null
  if (row.payload_hash !== operation.payloadHash)
    throw new ApiError(
      'idempotency_conflict',
      'This idempotency key belongs to another payload.',
      409,
    )
  return z
    .object({ proposal: DurableProposalSchema })
    .parse(JSON.parse(row.result_json))
}

export async function readStoredProposal(
  env: StorageBindings,
  proposalId: string,
): Promise<DurableProposal | null> {
  const row = await env.DB.prepare('SELECT payload_json FROM proposals WHERE id=?')
    .bind(proposalId)
    .first<{ payload_json: string }>()
  return row ? DurableProposalSchema.parse(JSON.parse(row.payload_json)) : null
}

export function expectProposalVersion(
  proposal: DurableProposal,
  expected: number,
): void {
  if (proposal.proposalVersion !== expected)
    throw new ApiError(
      'proposal_version_conflict',
      'The proposal changed. Reload it before retrying.',
      409,
      {
        expectedProposalVersion: expected,
        currentProposalVersion: proposal.proposalVersion,
      },
    )
}

export function editableBy(proposal: DurableProposal, principal: Principal): void {
  if (principal.role !== 'maintainer' && proposal.author.id !== principal.id)
    throw new ApiError(
      'forbidden',
      'Only the author or a maintainer can edit this proposal.',
      403,
    )
}

function metadataOf(document: Snapshot): DurableProposalMetadata {
  return {
    type: document.type,
    folderId: document.folderId ?? document.nav.parentId ?? '',
    tags: document.tags,
    relations: document.relations,
    visibility: document.visibility,
    status: document.status,
    locale: document.locale,
  }
}

export function enforcePayloadLimits(
  input: DurableCreateProposalInput,
  limits: Operation['settings']['limits'],
): void {
  if (
    input.changes.length > limits.maxFilesPerProposal ||
    new TextEncoder().encode(canonicalJson(input)).byteLength >
      limits.maxProposalBytes ||
    input.changes.some(
      (change) =>
        new TextEncoder().encode(change.after ?? '').byteLength >
        limits.maxDocumentBytes,
    )
  )
    throw new ApiError(
      'payload_too_large',
      'The proposal exceeds the effective file or byte limits.',
      413,
    )
}

function folderHierarchy(folderId: string, folders: Map<string, Folder>): Folder[] {
  const hierarchy: Folder[] = []
  const seen = new Set<string>()
  let current: Folder | undefined = folders.get(folderId)
  while (current) {
    if (seen.has(current.id))
      throw new ApiError('validation_error', 'The folder hierarchy is invalid.', 422)
    seen.add(current.id)
    hierarchy.unshift(current)
    const parentId: string | null = current.parent_id
    if (parentId && !folders.has(parentId))
      throw new ApiError('validation_error', 'The folder hierarchy is incomplete.', 422)
    current = parentId ? folders.get(parentId) : undefined
  }
  return hierarchy
}

/** Read bounded indexed records; bodies are verified against their committed hashes. */
export async function prepareChanges(
  env: StorageBindings,
  changes: readonly DurableProposalChangeInput[],
): Promise<PreparedChanges> {
  const ids = changes.flatMap((change) =>
    change.target.documentId ? [change.target.documentId] : [],
  )
  const rows = await env.DB.prepare(
    `SELECT d.id,d.version,d.folder_id,d.deleted,r.snapshot_json,r.object_key,r.body_hash
    FROM documents d JOIN revisions r ON r.id=d.current_revision_id WHERE d.id IN (SELECT value FROM json_each(?))`,
  )
    .bind(JSON.stringify(ids))
    .all<{
      id: string
      version: number
      folder_id: string
      deleted: number
      snapshot_json: string
      object_key: string
      body_hash: string
    }>()
  const before = new Map<string, StoredDocument>()
  for (const row of rows.results) {
    if (row.deleted) continue
    const snapshot = SnapshotSchema.parse(JSON.parse(row.snapshot_json))
    before.set(row.id, {
      snapshot,
      body: await readBody(env, row.object_key, row.body_hash),
      version: row.version,
      folderId: row.folder_id,
      path:
        snapshot.path ??
        `${snapshot.folderPath ?? `vault/${row.folder_id}`}/${snapshot.slug}.md`,
    })
  }
  const folderIds = [...new Set(changes.map((change) => change.metadata.folderId))]
  const folderRows = await env.DB.prepare(
    `WITH RECURSIVE tree(id,slug,parent_id,visibility,locale,depth) AS (
    SELECT id,slug,parent_id,visibility,locale,0 FROM folders WHERE id IN (SELECT value FROM json_each(?)) UNION ALL
    SELECT f.id,f.slug,f.parent_id,f.visibility,f.locale,t.depth+1 FROM folders f JOIN tree t ON t.parent_id=f.id WHERE t.depth<64
  ) SELECT id,slug,parent_id,visibility,locale FROM tree`,
  )
    .bind(JSON.stringify(folderIds))
    .all<Folder>()
  const folders = new Map(folderRows.results.map((folder) => [folder.id, folder]))
  const deletedIds = new Set(
    changes
      .filter((change) => change.changeType === 'deleted')
      .map((change) => change.target.documentId),
  )
  const relationIds = [
    ...new Set(changes.flatMap((change) => change.metadata.relations)),
  ]
  const relations = await env.DB.prepare(
    'SELECT id FROM documents WHERE deleted=0 AND id IN (SELECT value FROM json_each(?))',
  )
    .bind(JSON.stringify(relationIds))
    .all<{ id: string }>()
  const knownRelations = new Set(relations.results.map((row) => row.id))
  if (relationIds.some((id) => !knownRelations.has(id) || deletedIds.has(id)))
    throw new ApiError(
      'validation_error',
      'A relation references an unavailable document.',
      422,
    )
  const aliases = await env.DB.prepare(
    'SELECT locale,slug,document_id FROM aliases WHERE slug IN (SELECT value FROM json_each(?))',
  )
    .bind(JSON.stringify(changes.map((change) => change.target.slug)))
    .all<{ locale: string; slug: string; document_id: string }>()
  const paths = new Map<string, string>()
  const prepared = changes.map((change) => {
    const current = change.target.documentId
      ? before.get(change.target.documentId)
      : undefined
    if (change.changeType !== 'added' && !current)
      throw new ApiError('not_found', 'The target document is unavailable.', 404)
    if (current && current.version !== change.baseVersion)
      throw new ApiError(
        'version_conflict',
        'The document changed after the editor read it.',
        409,
        {
          documentId: change.target.documentId,
          baseVersion: change.baseVersion,
          currentVersion: current.version,
        },
      )
    if (current && current.snapshot.locale !== change.metadata.locale)
      throw new ApiError(
        'validation_error',
        'Create a separate document to add a translation; an existing identity keeps its locale.',
        422,
      )
    const folder = folders.get(change.metadata.folderId)
    if (
      !folder ||
      (folder.locale !== 'all' && folder.locale !== change.metadata.locale)
    )
      throw new ApiError(
        'validation_error',
        'Choose an existing folder for this document locale.',
        422,
      )
    const hierarchy = folderHierarchy(folder.id, folders)
    if (
      change.metadata.visibility === 'public' &&
      hierarchy.some((candidate) => candidate.visibility !== 'public')
    )
      throw new ApiError(
        'validation_error',
        'A public document requires a public folder.',
        422,
      )
    if (
      aliases.results.some(
        (alias) =>
          alias.locale === change.metadata.locale &&
          alias.slug === change.target.slug &&
          alias.document_id !== change.target.documentId,
      )
    )
      throw new ApiError(
        'conflict',
        'This locale already reserves that slug or alias.',
        409,
      )
    const beforeMetadata = current
      ? { ...metadataOf(current.snapshot), folderId: current.folderId }
      : null
    if (
      change.changeType === 'deleted' &&
      current &&
      (canonicalJson(change.metadata) !== canonicalJson(beforeMetadata) ||
        change.target.slug !== current.snapshot.slug ||
        change.target.title !== current.snapshot.title)
    )
      throw new ApiError(
        'validation_error',
        'Deletion must identify the current document and metadata without editing them.',
        422,
      )
    const path =
      current &&
      current.folderId === change.metadata.folderId &&
      current.snapshot.slug === change.target.slug
        ? current.path
        : `vault/${hierarchy.map((part) => part.slug).join('/')}/${change.metadata.locale}/${change.target.slug}.md`
    if (
      !VaultPathSchema.safeParse(path).success ||
      (change.path && change.path !== path)
    )
      throw new ApiError(
        'validation_error',
        'The logical path does not match the document folder and slug.',
        422,
      )
    paths.set(change.id, path)
    return {
      ...change,
      path,
      before: current?.body ?? null,
      beforeMetadata,
      beforeTarget: current
        ? {
            documentId: current.snapshot.id,
            slug: current.snapshot.slug,
            title: current.snapshot.title,
          }
        : null,
    }
  })
  if (new Set(paths.values()).size !== paths.size)
    throw new ApiError(
      'validation_error',
      'Changes must resolve to distinct canonical paths.',
      422,
    )
  const reservedPaths = await env.DB.prepare(
    'SELECT path,document_id FROM document_paths WHERE path IN(SELECT value FROM json_each(?))',
  )
    .bind(JSON.stringify([...paths.values()]))
    .all<{ path: string; document_id: string }>()
  for (const change of prepared) {
    const reserved = reservedPaths.results.find((row) => row.path === change.path)
    if (reserved && reserved.document_id !== change.target.documentId)
      throw new ApiError(
        'conflict',
        'This Markdown path belongs to another document.',
        409,
      )
  }
  return {
    changes: prepared,
    before,
    folders: [...folders.values()],
    paths,
    relationIds,
  }
}

export async function contentHash(
  input: Pick<DurableProposal, 'title' | 'summary' | 'reason' | 'changes'>,
): Promise<string> {
  return sha256(
    canonicalJson({
      title: input.title,
      summary: input.summary,
      reason: input.reason ?? null,
      changes: input.changes,
    }),
  )
}

export async function addedDocumentId(
  proposalId: string,
  changeId: string,
): Promise<string> {
  return `doc-${(await sha256(canonicalJson({ proposalId, changeId }))).slice(0, 32)}`
}

function targetGuards(
  env: StorageBindings,
  prefix: string,
  prepared: PreparedChanges,
): D1PreparedStatement[] {
  const statements: D1PreparedStatement[] = []
  for (const change of prepared.changes) {
    if (change.target.documentId)
      statements.push(
        guard(
          env.DB,
          `${prefix}base:${change.id}`,
          'EXISTS(SELECT 1 FROM documents WHERE id=? AND version=? AND deleted=0)',
          [change.target.documentId, change.baseVersion],
        ),
      )
    statements.push(
      guard(
        env.DB,
        `${prefix}alias:${change.id}`,
        'NOT EXISTS(SELECT 1 FROM aliases WHERE locale=? AND slug=? AND document_id IS NOT ?)',
        [change.metadata.locale, change.target.slug, change.target.documentId],
      ),
      guard(
        env.DB,
        `${prefix}path:${change.id}`,
        'NOT EXISTS(SELECT 1 FROM document_paths WHERE path=? AND document_id IS NOT ?)',
        [change.path ?? null, change.target.documentId],
      ),
    )
  }
  for (const folder of prepared.folders)
    statements.push(
      guard(
        env.DB,
        `${prefix}folder:${folder.id}`,
        'EXISTS(SELECT 1 FROM folders WHERE id=? AND slug=? AND parent_id IS ? AND visibility=? AND locale=?)',
        [folder.id, folder.slug, folder.parent_id, folder.visibility, folder.locale],
      ),
    )
  statements.push(
    guard(
      env.DB,
      `${prefix}relations`,
      '(SELECT COUNT(*) FROM documents WHERE deleted=0 AND id IN (SELECT value FROM json_each(?)))=?',
      [JSON.stringify(prepared.relationIds), prepared.relationIds.length],
    ),
  )
  return statements
}

function limitSql(name: keyof typeof DEFAULT_LIMITS): string {
  return `COALESCE((SELECT CAST(json_extract(value,'$.${name}') AS INTEGER) FROM vault_settings WHERE key='limits'),${DEFAULT_LIMITS[name]})`
}

function mutationGuards(
  env: StorageBindings,
  operation: Operation,
  prefix: string,
  input: DurableCreateProposalInput | null,
  editing: DurableProposal | null,
  creating: boolean,
): D1PreparedStatement[] {
  const allowedRoles =
    operation.permission === 'review'
      ? "m.role='maintainer'"
      : "m.role IN ('contributor','maintainer')"
  const statements = [
    guard(
      env.DB,
      `${prefix}member`,
      `EXISTS(SELECT 1 FROM members m JOIN sessions s ON s.principal_id=m.id WHERE m.id=? AND s.token_hash=? AND m.active=1 AND s.expires_at>${mutationTimeSql} AND ${allowedRoles})`,
      [operation.principal.id, operation.identity.tokenHash],
    ),
    guard(
      env.DB,
      `${prefix}read-only`,
      "COALESCE((SELECT value FROM vault_settings WHERE key='read_only'),'false')!='true'",
    ),
    guard(
      env.DB,
      `${prefix}operation`,
      'NOT EXISTS(SELECT 1 FROM operations WHERE id=?)',
      [operation.id],
    ),
  ]
  if (editing)
    statements.push(
      guard(
        env.DB,
        `${prefix}owner`,
        "EXISTS(SELECT 1 FROM members m JOIN proposals p ON p.id=? WHERE m.id=? AND (m.role='maintainer' OR (m.role='contributor' AND p.author_id=m.id)))",
        [editing.id, operation.principal.id],
      ),
    )
  if (creating)
    statements.push(
      guard(
        env.DB,
        `${prefix}open-limit`,
        `(SELECT COUNT(*) FROM proposals WHERE status!='merged') < ${limitSql('maxOpenProposals')}`,
      ),
    )
  if (input) {
    statements.push(
      guard(
        env.DB,
        `${prefix}bytes`,
        `?<=${limitSql('maxProposalBytes')} AND ?<=${limitSql('maxFilesPerProposal')} AND ?<=${limitSql('maxDocumentBytes')}`,
        [
          new TextEncoder().encode(canonicalJson(input)).byteLength,
          input.changes.length,
          Math.max(
            0,
            ...input.changes.map(
              (change) => new TextEncoder().encode(change.after ?? '').byteLength,
            ),
          ),
        ],
      ),
    )
  }
  const window = Math.floor(Date.now() / 60_000)
  for (const key of [
    `writes:actor:${operation.principal.id}:${window}`,
    `writes:vault:${operation.settings.vault.id}:${window}`,
  ]) {
    statements.push(
      guard(
        env.DB,
        `${prefix}rate:${key}`,
        `COALESCE((SELECT count FROM rate_windows WHERE key=?),0)<${limitSql('maxWritesPerMinute')}`,
        [key],
      ),
    )
    statements.push(
      env.DB.prepare(
        'INSERT INTO rate_windows(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1',
      ).bind(key, (window + 2) * 60_000),
    )
  }
  return statements
}

export async function commitOperation(
  env: StorageBindings,
  operation: Operation,
  options: {
    result: ProposalResult
    statements: D1PreparedStatement[]
    prepared?: PreparedChanges
    input?: DurableCreateProposalInput
    previous?: DurableProposal
    editing?: boolean
    creating?: boolean
  },
): Promise<ProposalResult> {
  const prefix = `proposal:${crypto.randomUUID()}:`
  const statements = mutationGuards(
    env,
    operation,
    prefix,
    options.input ?? null,
    options.editing ? (options.previous ?? null) : null,
    options.creating ?? false,
  )
  if (options.previous)
    statements.push(
      guard(
        env.DB,
        `${prefix}proposal`,
        'EXISTS(SELECT 1 FROM proposals WHERE id=? AND version=? AND status=? AND content_hash=?)',
        [
          options.previous.id,
          options.previous.proposalVersion,
          options.previous.status,
          options.previous.contentHash,
        ],
      ),
    )
  if (options.prepared) statements.push(...targetGuards(env, prefix, options.prepared))
  statements.push(
    ...options.statements,
    env.DB.prepare(
      'INSERT INTO operations(id,principal_id,payload_hash,result_json,created_at) VALUES(?,?,?,?,?)',
    ).bind(
      operation.id,
      operation.principal.id,
      operation.payloadHash,
      JSON.stringify(options.result),
      new Date().toISOString(),
    ),
    clearGuards(env.DB, prefix),
  )
  try {
    await env.DB.batch(statements)
    return options.result
  } catch (error) {
    await activePrincipal(env, operation.identity, operation.permission)
    const replay = await replayOperation(env, operation)
    if (replay) return replay
    const settings = await runtimeSettings(env)
    if (settings.readOnly.enabled)
      throw new ApiError(
        'service_unavailable',
        'The vault is temporarily read-only.',
        503,
      )
    if (options.previous) {
      const current = await readStoredProposal(env, options.previous.id)
      if (!current) throw new ApiError('not_found', 'The proposal is unavailable.', 404)
      if (options.editing)
        editableBy(
          current,
          await activePrincipal(env, operation.identity, operation.permission),
        )
      expectProposalVersion(current, options.previous.proposalVersion)
    }
    if (options.input) enforcePayloadLimits(options.input, settings.limits)
    if (options.prepared)
      await prepareChanges(
        env,
        options.prepared.changes.map(
          ({ id, target, changeType, baseVersion, after, metadata, path }) => ({
            id,
            target,
            changeType,
            baseVersion,
            after,
            metadata,
            ...(path ? { path } : {}),
          }),
        ),
      )
    const window = Math.floor(Date.now() / 60_000)
    const rate = await env.DB.prepare(
      'SELECT MAX(count) AS count FROM rate_windows WHERE key IN (?,?)',
    )
      .bind(
        `writes:actor:${operation.principal.id}:${window}`,
        `writes:vault:${settings.vault.id}:${window}`,
      )
      .first<{ count: number | null }>()
    const open = options.creating
      ? await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM proposals WHERE status!='merged'",
        ).first<{ count: number }>()
      : null
    if (
      (rate?.count ?? 0) >= settings.limits.maxWritesPerMinute ||
      (open?.count ?? 0) >= settings.limits.maxOpenProposals
    )
      throw new ApiError(
        'rate_limited',
        'The vault write limit was reached. Retry later.',
        429,
        { retryAfterSeconds: 60 },
      )
    if (error instanceof ApiError) throw error
    throw new ApiError(
      'service_unavailable',
      'The publication could not be committed. Retry with the same idempotency key.',
      503,
    )
  }
}
