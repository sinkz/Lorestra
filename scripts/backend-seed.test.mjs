import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, realpath, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  assertVaultPath,
  buildVaultSeed,
  parseVaultMarkdown,
  validateSeedReferences,
} from './backend-seed.mjs'

const clone = (value) => JSON.parse(JSON.stringify(value))

test('a symlinked vault root is rejected before metadata or Markdown is read', async () => {
  const scratch = await mkdtemp(path.join(tmpdir(), 'lorestra-seed-'))
  try {
    const source = path.join(scratch, 'source')
    const outside = path.join(scratch, 'outside')
    await mkdir(source)
    await mkdir(outside)
    await symlink(outside, path.join(source, 'vault'), 'junction')
    await assert.rejects(buildVaultSeed({ root: source }), /do not follow symlinks/)
  } finally {
    await removeSeedScratch(scratch)
  }
})

async function removeSeedScratch(scratch) {
  const target = await realpath(scratch)
  if (
    path.dirname(target) !== (await realpath(tmpdir())) ||
    !path.basename(target).startsWith('lorestra-seed-')
  )
    throw new Error('Refusing cleanup outside isolated seed test directory')
  await rm(target, { recursive: true, force: false })
}

test('the seed includes canonical bilingual docs and every celestial example', async () => {
  const manifest = await buildVaultSeed()
  assert.equal(manifest.schemaVersion, 1)
  for (const locale of ['en', 'pt-BR']) {
    for (const galaxy of ['orion', 'lyra', 'cygnus']) {
      const prefix = `vault/Examples/${locale}/${galaxy}/`
      assert.equal(
        manifest.documents.filter((document) => document.path.startsWith(prefix))
          .length,
        6,
      )
    }
    assert.ok(
      manifest.documents.some(
        (document) =>
          document.locale === locale &&
          document.id.startsWith('lorestra.docs.what-is-lorestra.'),
      ),
    )
  }
  const internal = manifest.documents.find(
    (document) => document.id === 'lorestra.engineering.review-checklist',
  )
  assert.equal(internal.visibility, 'internal')
  assert.match(internal.body, /Worker entrypoint free of Node-only imports/)
  const runbook = manifest.documents.find(
    (document) => document.id === 'lorestra.demo.orion.runbook.en',
  )
  assert.equal(runbook.type, 'process')
  assert.equal(
    runbook.sourceHash,
    createHash('sha256').update(runbook.body).digest('hex'),
  )
})

test('Markdown parsing preserves body and rejects ambiguous or executable YAML tags', () => {
  const parsed = parseVaultMarkdown(
    '---\r\nid: example\r\n---\r\n\r\n# Body\r\n',
    'vault/Example.md',
  )
  assert.equal(parsed.metadata.id, 'example')
  assert.equal(parsed.body, '# Body\n')
  for (const yaml of [
    'id: first\nid: second',
    'id: !!js/function function() {}',
    'id: &a [a]\nrelations: *a',
  ]) {
    assert.throws(() =>
      parseVaultMarkdown(`---\n${yaml}\n---\nBody`, 'vault/Example.md'),
    )
  }
  assert.throws(() => parseVaultMarkdown('# Missing frontmatter', 'vault/Example.md'))
})

test('vault paths reject traversal, encoded separators, absolute paths and alternate separators', () => {
  assert.equal(
    assertVaultPath('vault/Examples/en/orion/demo-orion-runbook.md'),
    'vault/Examples/en/orion/demo-orion-runbook.md',
  )
  for (const value of [
    'vault/../secret.md',
    '/vault/a.md',
    'C:/vault/a.md',
    'vault\\a.md',
    'vault/%2e%2e/a.md',
    'vault//a.md',
    'vault/./a.md',
  ]) {
    assert.throws(() => assertVaultPath(value))
  }
})

test('duplicate identities, missing references and cyclic folders fail before import', () => {
  const baseline = {
    folders: [{ id: 'folder.a', parentId: null, locale: 'en' }],
    documents: [
      {
        id: 'doc.a',
        locale: 'en',
        slug: 'a',
        folderId: 'folder.a',
        path: 'vault/a.md',
        body: 'A',
        nav: { parentId: 'folder.a' },
        relations: [],
      },
    ],
  }
  const withDuplicateId = clone(baseline)
  withDuplicateId.documents.push({
    ...withDuplicateId.documents[0],
    path: 'vault/b.md',
    slug: 'b',
  })
  assert.throws(() => validateSeedReferences(withDuplicateId), /Duplicate document ID/)
  const withDuplicateSlug = clone(baseline)
  withDuplicateSlug.documents.push({
    ...withDuplicateSlug.documents[0],
    id: 'doc.b',
    path: 'vault/b.md',
  })
  assert.throws(
    () => validateSeedReferences(withDuplicateSlug),
    /Duplicate locale\/slug/,
  )
  const withMissingRelation = clone(baseline)
  withMissingRelation.documents[0].relations.push('doc.unknown')
  assert.throws(() => validateSeedReferences(withMissingRelation), /Unknown relation/)
  const withCycle = clone(baseline)
  withCycle.folders[0].parentId = 'folder.a'
  assert.throws(() => validateSeedReferences(withCycle), /Folder cycle/)
  const withBadHash = clone(baseline)
  withBadHash.documents[0].sourceHash = '0'.repeat(64)
  assert.throws(() => validateSeedReferences(withBadHash), /Content hash mismatch/)
})
