import { z } from 'zod'
import {
  DocumentSchema,
  IdSchema,
  LocaleSchema,
  SlugSchema,
  VaultPathSchema,
} from '@lorestra/contracts'
import { ApiError } from '../../app/errors.js'
import {
  canonicalJson,
  clearGuards,
  guard,
  sha256,
  type StorageBindings,
} from './primitives.js'
import { documentStatements } from './documents.js'

const folderSchema = z.object({
  id: IdSchema,
  slug: z.string(),
  title: z.string(),
  parentId: IdSchema.nullable(),
  order: z.number().int().nonnegative(),
  visibility: z.enum(['public', 'internal']),
  locale: z.enum(['en', 'pt-BR', 'all']),
})
const VaultImportSchema = z.object({
  schemaVersion: z.literal(1),
  seedId: z.string().min(1).max(100),
  vault: z.object({
    id: IdSchema,
    name: z.string().min(1),
    branch: z.string().default('main'),
  }),
  folders: z.array(folderSchema).max(10_000),
  aliases: z
    .array(z.object({ locale: LocaleSchema, slug: SlugSchema, documentId: IdSchema }))
    .max(100_000)
    .default([]),
  pathAliases: z
    .array(z.object({ path: VaultPathSchema, documentId: IdSchema }))
    .max(100_000)
    .default([]),
  documents: z
    .array(
      DocumentSchema.extend({
        folderId: IdSchema,
        path: VaultPathSchema,
        sourceHash: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .optional(),
      }),
    )
    .max(10_000),
})

/** Import is a trusted operator operation, not an HTTP write route or startup hook. */
export async function importVault(env: StorageBindings, input: unknown) {
  const manifest = VaultImportSchema.parse(input)
  const currentVault = await env.DB.prepare(
    "SELECT value FROM vault_settings WHERE key='vault'",
  ).first<string>('value')
  if (currentVault && JSON.parse(currentVault).id !== manifest.vault.id)
    throw new ApiError(
      'conflict',
      'This installation already owns a different vault.',
      409,
    )
  const folderIds = new Set(manifest.folders.map((folder) => folder.id))
  const docIds = new Set(manifest.documents.map((doc) => doc.id))
  const keys = new Set(manifest.documents.map((doc) => `${doc.locale}:${doc.slug}`))
  const paths = new Set(manifest.documents.map((doc) => doc.path))
  if (
    folderIds.size !== manifest.folders.length ||
    docIds.size !== manifest.documents.length ||
    keys.size !== docIds.size ||
    paths.size !== docIds.size
  )
    throw new ApiError(
      'validation_error',
      'The import contains duplicate identities or paths.',
      422,
    )
  const foldersById = new Map(manifest.folders.map((folder) => [folder.id, folder]))
  const aliasOwners = new Map(
    manifest.documents.map((doc) => [`${doc.locale}:${doc.slug}`, doc.id]),
  )
  const pathOwners = new Map(manifest.documents.map((doc) => [doc.path, doc.id]))
  const documentLocales = new Map(manifest.documents.map((doc) => [doc.id, doc.locale]))
  const importedAliasKeys = new Set<string>()
  const importedPathKeys = new Set<string>()
  for (const alias of manifest.aliases) {
    const key = `${alias.locale}:${alias.slug}`
    if (
      !docIds.has(alias.documentId) ||
      alias.locale !== documentLocales.get(alias.documentId) ||
      importedAliasKeys.has(key) ||
      (aliasOwners.has(key) && aliasOwners.get(key) !== alias.documentId)
    )
      throw new ApiError(
        'validation_error',
        'Invalid or conflicting imported slug alias.',
        422,
      )
    aliasOwners.set(key, alias.documentId)
    importedAliasKeys.add(key)
  }
  for (const alias of manifest.pathAliases) {
    if (
      !docIds.has(alias.documentId) ||
      importedPathKeys.has(alias.path) ||
      (pathOwners.has(alias.path) && pathOwners.get(alias.path) !== alias.documentId)
    )
      throw new ApiError(
        'validation_error',
        'Invalid or conflicting imported path alias.',
        422,
      )
    pathOwners.set(alias.path, alias.documentId)
    importedPathKeys.add(alias.path)
  }
  for (const folder of manifest.folders) {
    const visited = new Set([folder.id])
    let parent = folder.parentId
    while (parent) {
      if (visited.has(parent) || !folderIds.has(parent))
        throw new ApiError(
          'validation_error',
          'The folder tree contains a cycle or missing parent.',
          422,
        )
      visited.add(parent)
      parent = foldersById.get(parent)?.parentId ?? null
    }
  }
  for (const doc of manifest.documents) {
    if (!folderIds.has(doc.folderId) || doc.relations.some((id) => !docIds.has(id)))
      throw new ApiError(
        'validation_error',
        'The import contains unresolved folder or document references.',
        422,
        { documentId: doc.id },
      )
    if (new TextEncoder().encode(doc.body).byteLength > 65_536)
      throw new ApiError(
        'payload_too_large',
        'Imported Markdown exceeds the document byte limit.',
        413,
      )
    if (doc.sourceHash && (await sha256(doc.body)) !== doc.sourceHash)
      throw new ApiError(
        'validation_error',
        'Imported Markdown checksum does not match.',
        422,
        { documentId: doc.id },
      )
  }
  const existingDocs = new Map(
    (
      await env.DB.prepare('SELECT id,source_hash,locale,slug FROM documents').all<{
        id: string
        source_hash: string | null
        locale: string
        slug: string
      }>()
    ).results.map((row) => [row.id, row]),
  )
  const existingFolders = new Map(
    (
      await env.DB.prepare('SELECT id,source_hash FROM folders').all<{
        id: string
        source_hash: string
      }>()
    ).results.map((row) => [row.id, row.source_hash]),
  )
  const newDocs = []
  const existingPaths = new Map(
    (
      await env.DB.prepare('SELECT path,document_id FROM document_paths').all<{
        path: string
        document_id: string
      }>()
    ).results.map((row) => [row.path, row.document_id]),
  )
  for (const doc of manifest.documents) {
    if (existingPaths.has(doc.path) && existingPaths.get(doc.path) !== doc.id)
      throw new ApiError(
        'conflict',
        'Import would reuse a reserved Markdown path.',
        409,
        { documentId: doc.id },
      )
    const sourceHash = await sha256(canonicalJson(doc))
    const existing = existingDocs.get(doc.id)
    if (existing && existing.source_hash !== sourceHash)
      throw new ApiError(
        'conflict',
        'Import would overwrite an existing identity. Use a proposal.',
        409,
        { documentId: doc.id },
      )
    if (!existing) newDocs.push({ doc, sourceHash })
  }
  for (const folder of manifest.folders) {
    const existing = existingFolders.get(folder.id)
    if (existing && existing !== (await sha256(canonicalJson(folder))))
      throw new ApiError('conflict', 'Import would change an existing folder.', 409, {
        folderId: folder.id,
      })
  }
  const prefix = `import:${crypto.randomUUID()}:`
  const statements: D1PreparedStatement[] = []
  for (const folder of manifest.folders) {
    if (existingFolders.has(folder.id)) continue
    statements.push(
      env.DB.prepare(
        'INSERT INTO folders(id,slug,title,parent_id,sort_order,visibility,locale,source_hash) VALUES(?,?,?,?,?,?,?,?)',
      ).bind(
        folder.id,
        folder.slug,
        folder.title,
        folder.parentId,
        folder.order,
        folder.visibility,
        folder.locale,
        await sha256(canonicalJson(folder)),
      ),
    )
  }
  const relationStatements: D1PreparedStatement[] = []
  for (const { doc, sourceHash } of newDocs) {
    statements.push(
      guard(
        env.DB,
        `${prefix}${doc.id}`,
        'NOT EXISTS(SELECT 1 FROM aliases WHERE locale=? AND slug=?) AND NOT EXISTS(SELECT 1 FROM documents WHERE id=?) AND NOT EXISTS(SELECT 1 FROM document_paths WHERE path=?)',
        [doc.locale, doc.slug, doc.id, doc.path],
      ),
    )
    const prepared = await documentStatements(
      env,
      doc,
      doc.folderId,
      doc.path,
      'Imported example vault',
      false,
      sourceHash,
    )
    statements.push(...prepared.statements)
    relationStatements.push(...prepared.relations)
  }
  statements.push(
    ...relationStatements,
    ...manifest.aliases.flatMap((alias) => [
      guard(
        env.DB,
        `${prefix}alias:${alias.locale}:${alias.slug}`,
        'NOT EXISTS(SELECT 1 FROM aliases WHERE locale=? AND slug=? AND document_id<>?)',
        [alias.locale, alias.slug, alias.documentId],
      ),
      env.DB.prepare(
        'INSERT INTO aliases(locale,slug,document_id) VALUES(?,?,?) ON CONFLICT DO NOTHING',
      ).bind(alias.locale, alias.slug, alias.documentId),
    ]),
    ...manifest.pathAliases.flatMap((alias) => [
      guard(
        env.DB,
        `${prefix}path:${alias.path}`,
        'NOT EXISTS(SELECT 1 FROM document_paths WHERE path=? AND document_id<>?)',
        [alias.path, alias.documentId],
      ),
      env.DB.prepare(
        'INSERT INTO document_paths(path,document_id) VALUES(?,?) ON CONFLICT DO NOTHING',
      ).bind(alias.path, alias.documentId),
    ]),
    env.DB.prepare(
      "INSERT INTO vault_settings(key,value) VALUES('vault',?) ON CONFLICT(key) DO NOTHING",
    ).bind(JSON.stringify(manifest.vault)),
    env.DB.prepare(
      "INSERT INTO vault_settings(key,value) VALUES('seed_id',?) ON CONFLICT(key) DO NOTHING",
    ).bind(manifest.seedId),
    clearGuards(env.DB, prefix),
  )
  await env.DB.batch(statements)
  return {
    imported: newDocs.length,
    unchanged: manifest.documents.length - newDocs.length,
    seedId: manifest.seedId,
  }
}
