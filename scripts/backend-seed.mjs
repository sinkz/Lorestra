import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { lstat, readFile, readdir, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL, URL } from 'node:url'

import { build } from 'esbuild'
import { parseDocument } from 'yaml'

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))
const maximumMarkdownBytes = 1024 * 1024

const hash = (value) => createHash('sha256').update(value, 'utf8').digest('hex')

/** This CLI-only bridge imports metadata, never the mock business adapter. */
async function loadSeedMetadata(root) {
  const result = await build({
    stdin: {
      contents: `
        import { folders } from './packages/mock-vault/src/fixtures/folders.ts';
        import { documents } from './packages/mock-vault/src/fixtures/documents.ts';
        export { DocumentSchema } from './packages/contracts/src/document.ts';
        export { folders };
        export const kinds = Object.fromEntries(documents.map(doc => [doc.id, {
          kind: doc.kind, type: doc.type
        }]));
      `,
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    write: false,
    logLevel: 'silent',
  })
  return import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`
  )
}

export function assertVaultPath(value) {
  if (
    typeof value !== 'string' ||
    !value.startsWith('vault/') ||
    !value.endsWith('.md') ||
    value.includes('\\') ||
    value.includes('\0') ||
    value
      .split('/')
      .some((segment) => segment === '..' || segment === '.' || !segment) ||
    /[:%]/.test(value)
  ) {
    throw new Error('A document path must be a normalized relative vault/*.md path')
  }
  return value
}

/** Parse safely before any storage operation; content is never executed. */
export function parseVaultMarkdown(source, documentPath) {
  assertVaultPath(documentPath)
  if (Buffer.byteLength(source, 'utf8') > maximumMarkdownBytes) {
    throw new Error(`${documentPath}: Markdown exceeds the 1 MiB import limit`)
  }
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(normalized)
  if (!match) throw new Error(`${documentPath}: YAML frontmatter is required`)
  const yaml = parseDocument(match[1], {
    schema: 'core',
    uniqueKeys: true,
    stringKeys: true,
    resolveKnownTags: false,
    prettyErrors: false,
  })
  if (yaml.errors.length || yaml.warnings.length) {
    throw new Error(`${documentPath}: invalid or unsupported YAML frontmatter`)
  }
  let metadata
  try {
    metadata = yaml.toJS({ maxAliasCount: 0 })
  } catch {
    throw new Error(`${documentPath}: YAML aliases are not supported`)
  }
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error(`${documentPath}: frontmatter must be a mapping`)
  }
  const body = normalized.slice(match[0].length).replace(/^\n/, '')
  return { metadata, body, sourceHash: hash(body) }
}

function inferType(metadata, fixture = {}) {
  if (metadata.type || fixture.type) return metadata.type ?? fixture.type
  const values =
    `${metadata.id} ${metadata.title} ${(metadata.tags ?? []).join(' ')}`.toLowerCase()
  if (values.includes('incident')) return 'incident'
  if (values.includes('decision') || values.includes('adr')) return 'decision'
  if (values.includes('process') || values.includes('runbook')) return 'process'
  if (values.includes('lesson')) return 'lesson'
  return fixture.kind === 'folder-index' ? 'document' : 'note'
}

export function validateSeedReferences(manifest) {
  const ids = new Set()
  const slugs = new Set()
  const paths = new Set()
  const folders = new Map(manifest.folders.map((folder) => [folder.id, folder]))
  if (folders.size !== manifest.folders.length) throw new Error('Duplicate folder ID')
  for (const folder of folders.values()) {
    if (folder.parentId !== null && !folders.has(folder.parentId)) {
      throw new Error(`Unknown parent folder: ${folder.id}`)
    }
    const visited = new Set([folder.id])
    let parent = folder.parentId
    while (parent !== null) {
      if (visited.has(parent)) throw new Error(`Folder cycle: ${folder.id}`)
      visited.add(parent)
      parent = folders.get(parent).parentId
    }
  }
  for (const document of manifest.documents) {
    assertVaultPath(document.path)
    if (ids.has(document.id)) throw new Error(`Duplicate document ID: ${document.id}`)
    const slug = `${document.locale}:${document.slug}`
    if (slugs.has(slug)) throw new Error(`Duplicate locale/slug: ${slug}`)
    if (paths.has(document.path))
      throw new Error(`Duplicate document path: ${document.path}`)
    ids.add(document.id)
    slugs.add(slug)
    paths.add(document.path)
    const folder = folders.get(document.folderId)
    if (!folder) throw new Error(`Unknown folder: ${document.folderId}`)
    if (folder.locale !== 'all' && folder.locale !== document.locale) {
      throw new Error(`Document/folder locale mismatch: ${document.id}`)
    }
    if (document.nav.parentId !== null && !folders.has(document.nav.parentId)) {
      throw new Error(`Unknown document navigation parent: ${document.id}`)
    }
    if (document.sourceHash && document.sourceHash !== hash(document.body)) {
      throw new Error(`Content hash mismatch: ${document.id}`)
    }
  }
  for (const document of manifest.documents) {
    for (const relation of document.relations) {
      if (!ids.has(relation))
        throw new Error(`Unknown relation: ${document.id} -> ${relation}`)
    }
  }
  return manifest
}

async function readMarkdownTree(root) {
  const rootPath = await realpath(root)
  const vaultPath = path.join(rootPath, 'vault')
  if ((await lstat(vaultPath)).isSymbolicLink())
    throw new Error('Vault imports do not follow symlinks')
  const vaultRoot = await realpath(vaultPath)
  if (path.dirname(vaultRoot) !== rootPath)
    throw new Error('Vault import escaped its source directory')
  const files = []
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true })
    entries.sort((left, right) => left.name.localeCompare(right.name, 'en'))
    for (const entry of entries) {
      if (entry.isSymbolicLink())
        throw new Error('Vault imports do not follow symlinks')
      const target = path.join(directory, entry.name)
      const resolved = await realpath(target)
      const relative = path.relative(vaultRoot, resolved)
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error('Vault import escaped its source directory')
      }
      if (entry.isDirectory()) await visit(resolved)
      else if (entry.isFile() && entry.name.endsWith('.md')) files.push(resolved)
    }
  }
  await visit(vaultRoot)
  return files
}

/** Build the complete canonical seed without creating files or contacting an API. */
export async function buildVaultSeed({ root = repositoryRoot } = {}) {
  const filenames = await readMarkdownTree(root)
  const { folders, kinds, DocumentSchema } = await loadSeedMetadata(root)
  const documents = []
  for (const filename of filenames) {
    const documentPath = path.relative(root, filename).split(path.sep).join('/')
    assertVaultPath(documentPath)
    if ((await stat(filename)).size > maximumMarkdownBytes)
      throw new Error(`${documentPath}: Markdown exceeds the import size ceiling`)
    const { metadata, body, sourceHash } = parseVaultMarkdown(
      await readFile(filename, 'utf8'),
      documentPath,
    )
    const authorName = metadata.author
    if (typeof authorName !== 'string' || !authorName.trim()) {
      throw new Error(`${documentPath}: author must be a nonempty string`)
    }
    const document = DocumentSchema.parse({
      ...metadata,
      type: inferType(metadata, kinds[metadata.id]),
      author: { id: `seed.author.${hash(authorName).slice(0, 16)}`, name: authorName },
      excerpt:
        metadata.description ??
        body
          .replace(/[#*_`>\n]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 500),
      relations: metadata.relatedDocumentIds ?? [],
      relationCount: metadata.relatedDocumentIds?.length ?? 0,
      body,
    })
    documents.push({
      ...document,
      folderId: metadata.folderId,
      path: documentPath,
      sourceHash,
    })
  }
  return validateSeedReferences({
    schemaVersion: 1,
    seedId: 'lorestra-vault-v1',
    vault: { id: 'lorestra', name: 'Lorestra Vault', branch: 'main' },
    folders,
    documents,
  })
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  try {
    const manifest = await buildVaultSeed()
    if (process.argv.includes('--json'))
      process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`)
    else
      process.stdout.write(
        `Validated ${manifest.documents.length} Markdown documents and ${manifest.folders.length} folders. No storage was changed.\n`,
      )
  } catch (error) {
    process.stderr.write(
      `Seed validation failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`,
    )
    process.exitCode = 1
  }
}
