import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  stat,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

import { stringify } from 'yaml'

import { defaultStatePath, withLocalVault } from './backend-local.mjs'
import { applyLocalMigrations } from './backend-runtime.mjs'
import {
  assertVaultPath,
  parseVaultMarkdown,
  validateSeedReferences,
} from './backend-seed.mjs'

const tables = [
  'vault_settings',
  'members',
  'folders',
  'documents',
  'document_paths',
  'aliases',
  'revisions',
  'relations',
  'proposals',
  'proposal_versions',
  'proposal_targets',
  'history',
  'operations',
]
const excludedTables = ['sessions', 'rate_windows', 'commit_guards']
const hash = (value) => createHash('sha256').update(value).digest('hex')
const maximumBackupBytes = 256 * 1024 * 1024

async function snapshot(DB) {
  const frozen = await DB.prepare(
    "SELECT value FROM vault_settings WHERE key='read_only'",
  ).first()
  if (frozen?.value !== 'true')
    throw new Error(
      'Enable read-only maintenance before taking a backup or portable export',
    )
  // All row projections share one SQLite transaction/snapshot. Writers also guard maintenance at commit.
  const results = await DB.batch(
    tables.map((table) => DB.prepare(`SELECT * FROM ${table}`)),
  )
  return Object.fromEntries(
    tables.map((table, index) => [table, results[index].results]),
  )
}

async function createNewDirectory(destination) {
  const target = path.resolve(destination)
  await mkdir(path.dirname(target), { recursive: true })
  await mkdir(target, { recursive: false })
  return target
}

/** A checksummed local archive, not an authenticity signature or a remote backup service. */
export async function createBackup(env, destination) {
  const data = await snapshot(env.DB)
  const migrations = (
    await env.DB.prepare(
      'SELECT name,sha256 FROM lorestra_local_migrations ORDER BY name',
    ).all()
  ).results
  const objects = []
  const bodies = new Map()
  let bytes = Buffer.byteLength(JSON.stringify(data))
  for (const revision of data.revisions) {
    const object = await env.VAULT.get(revision.object_key)
    if (!object)
      throw new Error('A referenced revision object is missing; backup was not created')
    const body = Buffer.from(await object.arrayBuffer())
    if (body.length > 65_536 || hash(body) !== revision.body_hash)
      throw new Error('A revision checksum or size is invalid; backup was not created')
    bytes += body.length
    if (bytes > maximumBackupBytes)
      throw new Error('This local backup exceeds the 256 MiB safety ceiling')
    const filename = `objects/${revision.body_hash}.md`
    objects.push({
      key: revision.object_key,
      sha256: revision.body_hash,
      bytes: body.length,
      filename,
    })
    bodies.set(filename, body)
  }
  const payload = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    excludedTables,
    migrations,
    tables: data,
    objects,
  }
  const payloadText = JSON.stringify(payload)
  const manifest = { ...payload, checksum: hash(payloadText) }
  const target = await createNewDirectory(destination)
  await mkdir(path.join(target, 'objects'))
  for (const [filename, body] of bodies)
    await writeFile(path.join(target, filename), body, { flag: 'wx', mode: 0o600 })
  await writeFile(
    path.join(target, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { flag: 'wx', mode: 0o600 },
  )
  return {
    directory: target,
    documents: data.documents.length,
    revisions: data.revisions.length,
    checksum: manifest.checksum,
  }
}

export async function readBackup(source) {
  const root = await realpath(source)
  const manifestPath = path.join(root, 'manifest.json')
  if ((await stat(manifestPath)).size > maximumBackupBytes)
    throw new Error('Backup manifest is too large')
  if ((await lstat(manifestPath)).isSymbolicLink())
    throw new Error('Backup files must not be symlinks')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const { checksum, ...payload } = manifest
  if (manifest.schemaVersion !== 1 || hash(JSON.stringify(payload)) !== checksum)
    throw new Error('Backup manifest checksum or schema version is invalid')
  if (
    !manifest.tables ||
    JSON.stringify(Object.keys(manifest.tables).sort()) !==
      JSON.stringify([...tables].sort()) ||
    !Array.isArray(manifest.objects) ||
    !Array.isArray(manifest.migrations)
  )
    throw new Error('Backup table or object manifest is invalid')
  for (const rows of Object.values(manifest.tables)) {
    if (
      !Array.isArray(rows) ||
      rows.length > 100_000 ||
      rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row))
    )
      throw new Error('Backup rows are invalid')
  }
  const bodies = new Map()
  let bytes = 0
  for (const object of manifest.objects) {
    if (
      !object ||
      typeof object.key !== 'string' ||
      !/^revisions\/[A-Za-z0-9._:-]+\/[1-9]\d*\/[a-f0-9]{64}\.md$/.test(object.key) ||
      !/^[a-f0-9]{64}$/.test(object.sha256) ||
      object.filename !== `objects/${object.sha256}.md` ||
      bodies.has(object.key)
    )
      throw new Error('Backup object reference is invalid')
    const filename = path.join(root, object.filename)
    const resolved = await realpath(filename)
    if (
      path.dirname(resolved) !== path.join(root, 'objects') ||
      (await lstat(filename)).isSymbolicLink()
    )
      throw new Error('Backup object escaped its archive')
    const metadata = await stat(resolved)
    if (metadata.size > 65_536 || metadata.size !== object.bytes)
      throw new Error('Backup object size is invalid')
    const body = await readFile(resolved)
    bytes += body.length
    if (bytes > maximumBackupBytes || hash(body) !== object.sha256)
      throw new Error('Backup object checksum or total size is invalid')
    bodies.set(object.key, body)
  }
  if (manifest.tables.revisions.length !== manifest.objects.length)
    throw new Error('Backup has missing or extra revision objects')
  for (const revision of manifest.tables.revisions) {
    const body = bodies.get(revision.object_key)
    if (!body || hash(body) !== revision.body_hash)
      throw new Error('Backup revision does not match its object')
  }
  return { manifest, bodies }
}

/** Restore only after archive validation, into a newly initialized empty local store. */
export async function restoreBackup(env, backup) {
  const { manifest, bodies } = backup
  const existing = await env.DB.batch(
    tables
      .filter((table) => table !== 'vault_settings')
      .map((table) => env.DB.prepare(`SELECT COUNT(*) AS count FROM ${table}`)),
  )
  if (
    existing.some((result) => result.results[0].count !== 0) ||
    (await env.VAULT.list({ limit: 1 })).objects.length
  )
    throw new Error('Restore requires an empty target database and bucket')
  const migrations = (
    await env.DB.prepare(
      'SELECT name,sha256 FROM lorestra_local_migrations ORDER BY name',
    ).all()
  ).results
  if (JSON.stringify(migrations) !== JSON.stringify(manifest.migrations))
    throw new Error('Backup migrations do not match this checkout')
  const statements = []
  for (const table of tables) {
    const columns = (
      await env.DB.prepare(`PRAGMA table_info(${table})`).all()
    ).results.map((column) => column.name)
    for (const row of manifest.tables[table]) {
      if (
        JSON.stringify(Object.keys(row).sort()) !==
          JSON.stringify([...columns].sort()) ||
        Object.values(row).some(
          (value) =>
            value !== null &&
            typeof value !== 'string' &&
            (typeof value !== 'number' || !Number.isFinite(value)),
        )
      )
        throw new Error('Backup row columns or value types do not match the schema')
      statements.push(
        env.DB.prepare(
          `INSERT ${table === 'vault_settings' ? 'OR REPLACE ' : ''}INTO ${table}(${columns.join(',')}) VALUES(${columns.map(() => '?').join(',')})`,
        ).bind(...columns.map((column) => row[column])),
      )
    }
  }
  statements.push(
    env.DB.prepare(
      "INSERT INTO vault_settings(key,value) VALUES('read_only','true') ON CONFLICT(key) DO UPDATE SET value='true'",
    ),
    env.DB.prepare(
      "INSERT INTO vault_settings(key,value) VALUES('read_only_reason','Restored backup: verify before enabling writes') ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    ),
  )
  for (const object of manifest.objects)
    await env.VAULT.put(object.key, bodies.get(object.key), {
      onlyIf: { etagDoesNotMatch: '*' },
      customMetadata: { sha256: object.sha256 },
      httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
    })
  await env.DB.batch(statements)
  const sessions = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM sessions',
  ).first()
  if (sessions.count !== 0) throw new Error('Restored sessions must be empty')
  return {
    documents: manifest.tables.documents.length,
    revisions: manifest.tables.revisions.length,
    readOnly: true,
  }
}

/** Portable current Markdown does not replace the full review/history backup. */
export async function exportMarkdown(env, destination) {
  const data = await snapshot(env.DB)
  const revisions = new Map(data.revisions.map((revision) => [revision.id, revision]))
  const files = new Map()
  const current = data.documents.filter((document) => document.deleted === 0)
  const liveIds = new Set(current.map((document) => document.id))
  for (const row of current) {
    const revision = revisions.get(row.current_revision_id)
    if (!revision) throw new Error('Current revision is missing')
    const metadata = JSON.parse(revision.snapshot_json)
    const filename = assertVaultPath(
      metadata.path ?? `vault/${metadata.locale}/${metadata.slug}.md`,
    )
    if (files.has(filename))
      throw new Error('Two current documents have the same export path')
    const object = await env.VAULT.get(revision.object_key)
    if (!object) throw new Error('Current Markdown object is missing')
    const body = await object.text()
    if (hash(body) !== revision.body_hash)
      throw new Error('Current Markdown checksum is invalid')
    const frontmatter = {
      id: metadata.id,
      slug: metadata.slug,
      locale: metadata.locale,
      title: metadata.title,
      description: metadata.excerpt,
      folderId: metadata.folderId,
      type: metadata.type,
      kind: metadata.kind,
      visibility: metadata.visibility,
      status: metadata.status,
      version: metadata.version,
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
      author: metadata.author,
      tags: metadata.tags,
      relatedDocumentIds: data.relations
        .filter(
          (relation) =>
            relation.source_id === row.id && liveIds.has(relation.target_id),
        )
        .map((relation) => relation.target_id),
      nav: metadata.nav,
    }
    files.set(
      filename,
      `---\n${stringify(frontmatter, { aliasDuplicateObjects: false })}---\n\n${body}`,
    )
  }
  const settings = new Map(
    data.vault_settings.map((setting) => [setting.key, setting.value]),
  )
  const manifest = {
    schemaVersion: 1,
    format: 'lorestra-portable-markdown',
    vault: JSON.parse(settings.get('vault')),
    folders: data.folders.map((folder) => ({
      id: folder.id,
      slug: folder.slug,
      title: folder.title,
      parentId: folder.parent_id,
      order: folder.sort_order,
      visibility: folder.visibility,
      locale: folder.locale,
    })),
    aliases: data.aliases
      .filter((alias) => liveIds.has(alias.document_id))
      .map((alias) => ({
        locale: alias.locale,
        slug: alias.slug,
        documentId: alias.document_id,
      })),
    pathAliases: data.document_paths
      .filter((alias) => liveIds.has(alias.document_id))
      .map((alias) => ({ path: alias.path, documentId: alias.document_id })),
    excludedDeletedDocuments: data.documents.length - current.length,
    documents: [...files].map(([filename, content]) => ({
      path: filename,
      sha256: hash(content),
    })),
  }
  if (
    [...files.values()].reduce(
      (bytes, content) => bytes + Buffer.byteLength(content),
      Buffer.byteLength(JSON.stringify(manifest)),
    ) > maximumBackupBytes
  )
    throw new Error('Portable export exceeds the 256 MiB safety ceiling')
  const target = await createNewDirectory(destination)
  for (const [filename, markdown] of files) {
    const output = path.resolve(target, filename)
    if (!output.startsWith(`${target}${path.sep}`))
      throw new Error('Export path escaped its target')
    await mkdir(path.dirname(output), { recursive: true })
    await writeFile(output, markdown, { flag: 'wx', mode: 0o600 })
  }
  await writeFile(
    path.join(target, 'lorestra-vault.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { flag: 'wx', mode: 0o600 },
  )
  return { directory: target, documents: files.size }
}

/** Data-only import: never load executable files or fixture metadata from the archive. */
export async function readPortableMarkdown(source) {
  const root = await realpath(source)
  async function boundedFile(relative, maximum) {
    let filename = root
    for (const segment of relative.split('/')) {
      filename = path.join(filename, segment)
      if ((await lstat(filename)).isSymbolicLink())
        throw new Error('Portable imports do not follow symlinks')
    }
    const resolved = await realpath(filename)
    const relativePath = path.relative(root, resolved)
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath))
      throw new Error('Portable file escaped its source directory')
    const metadata = await stat(resolved)
    if (!metadata.isFile() || metadata.size > maximum)
      throw new Error('Portable file exceeds its size limit')
    return readFile(resolved, 'utf8')
  }
  const manifestText = await boundedFile('lorestra-vault.json', 16 * 1024 * 1024)
  const manifest = JSON.parse(manifestText)
  if (
    manifest.schemaVersion !== 1 ||
    manifest.format !== 'lorestra-portable-markdown' ||
    !Array.isArray(manifest.documents) ||
    manifest.documents.length > 10_000 ||
    !Array.isArray(manifest.folders)
  )
    throw new Error('Unsupported portable Markdown manifest')
  let bytes = Buffer.byteLength(manifestText)
  const documents = []
  for (const entry of manifest.documents) {
    const filename = assertVaultPath(entry.path)
    const content = await boundedFile(filename, 1024 * 1024)
    bytes += Buffer.byteLength(content)
    if (bytes > maximumBackupBytes || hash(content) !== entry.sha256)
      throw new Error('Portable Markdown checksum or total size is invalid')
    const { metadata } = parseVaultMarkdown(content, filename)
    // Exported bodies retain their original bytes, including CRLF inside Markdown.
    const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n(?:\r?\n)?/, '')
    documents.push({
      ...metadata,
      excerpt: metadata.description,
      body,
      relations: metadata.relatedDocumentIds ?? [],
      relationCount: metadata.relatedDocumentIds?.length ?? 0,
      path: filename,
      sourceHash: hash(body),
    })
  }
  return validateSeedReferences({
    schemaVersion: 1,
    seedId: `portable-${hash(manifestText).slice(0, 24)}`,
    vault: manifest.vault,
    folders: manifest.folders,
    documents,
    aliases: manifest.aliases ?? [],
    pathAliases: manifest.pathAliases ?? [],
  })
}

async function main() {
  const [command, ...argv] = process.argv.slice(2)
  if (
    !command ||
    command === 'help' ||
    command === '--help' ||
    argv.includes('--help')
  ) {
    process.stdout.write(
      `Local-only Lorestra backup tooling (no remote account access)\n\n  node scripts/backend-backup.mjs create --out=NEW_ARCHIVE [--state=LOCAL_STATE]\n  node scripts/backend-backup.mjs export --out=NEW_MARKDOWN_DIRECTORY [--state=LOCAL_STATE]\n  node scripts/backend-backup.mjs restore --from=ARCHIVE --state=NEW_EMPTY_STATE\n  node scripts/backend-backup.mjs import --from=MARKDOWN_DIRECTORY --state=NEW_EMPTY_STATE\n\nStop backend:dev and enable read-only maintenance before create/export.\nArchives include private knowledge and review history, exclude sessions, and are not encrypted.\nRestore/import verifies checksums and schema, refuses occupied destinations, and leaves writes disabled.\nPortable Markdown preserves current content and aliases, not deleted documents, reviews or historical revisions.\n`,
    )
    return
  }
  const options = { state: process.env.LORESTRA_LOCAL_STATE ?? defaultStatePath }
  for (const argument of argv) {
    const match = /^--(state|out|from)=(.+)$/.exec(argument)
    if (!match) throw new Error('Expected --state=path, --out=path or --from=path')
    options[match[1]] = path.resolve(match[2])
  }
  if (!['create', 'restore', 'export', 'import'].includes(command))
    throw new Error('Choose create, restore, export or import')
  if (command === 'restore' || command === 'import') {
    if (!options.from || !argv.some((argument) => argument.startsWith('--state=')))
      throw new Error(
        'Restore/import requires --from=archive and an explicit --state=new-empty-target',
      )
    const backup =
      command === 'restore'
        ? await readBackup(options.from)
        : await readPortableMarkdown(options.from)
    try {
      if ((await readdir(options.state)).length)
        throw new Error('Restore target must be a new or empty directory')
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    const result = await withLocalVault(
      { statePath: options.state },
      async ({ env, bundle }) => {
        await applyLocalMigrations(env.DB)
        if (command === 'restore') return restoreBackup(env, backup)
        const result = await bundle.setup.importVault(env, backup)
        await env.DB.batch([
          env.DB.prepare(
            "UPDATE vault_settings SET value='true' WHERE key='read_only'",
          ),
          env.DB.prepare(
            "INSERT INTO vault_settings(key,value) VALUES('read_only_reason','Imported portable vault: verify before enabling writes')",
          ),
        ])
        return { documents: result.imported, revisions: result.imported }
      },
    )
    process.stdout.write(
      `${command === 'restore' ? 'Restored' : 'Imported'} ${result.documents} documents and ${result.revisions} revisions. Sessions were not restored; writes remain disabled.\n`,
    )
  } else {
    if (!options.out) throw new Error('An explicit new --out=directory is required')
    const result = await withLocalVault({ statePath: options.state }, ({ env }) =>
      command === 'create'
        ? createBackup(env, options.out)
        : exportMarkdown(env, options.out),
    )
    process.stdout.write(
      `${command === 'create' ? 'Backup' : 'Portable Markdown'} created at ${result.directory} (${result.documents} documents). Keep private vault exports private.\n`,
    )
  }
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main().catch((error) => {
    process.stderr.write(
      `Backup operation failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`,
    )
    process.exitCode = 1
  })
}
