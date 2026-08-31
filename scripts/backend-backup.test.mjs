import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { URL } from 'node:url'

import {
  createBackup,
  exportMarkdown,
  readBackup,
  readPortableMarkdown,
  restoreBackup,
} from './backend-backup.mjs'
import {
  applyLocalMigrations,
  compileLocalBackend,
  createLocalRuntime,
  localBindings,
} from './backend-runtime.mjs'
import { buildVaultSeed, parseVaultMarkdown } from './backend-seed.mjs'

test(
  'B02 B25 B38 B39 seed is repeatable and backup restores revisions, proposals and links without sessions',
  { timeout: 120_000 },
  async () => {
    const scratch = await mkdtemp(path.join(tmpdir(), 'lorestra-backup-'))
    const bundle = await compileLocalBackend()
    const canonical = await buildVaultSeed()
    const selected = canonical.documents.filter(
      (document) =>
        document.id === 'lorestra.demo.orion.runbook.en' ||
        document.id === 'lorestra.demo.orion.runbook.pt-br',
    )
    assert.equal(selected.length, 2)
    // Small bilingual subset of the canonical vault, with a real reference retained between them.
    const seed = {
      ...canonical,
      documents: selected.map((document) => ({
        ...document,
        relations: selected
          .filter((other) => other.id !== document.id)
          .map((other) => other.id),
        relationCount: 1,
      })),
    }
    const options = { worker: bundle.worker, origin: 'http://127.0.0.1:5173', port: 0 }
    const source = createLocalRuntime({
      ...options,
      storagePath: path.join(scratch, 'source'),
    })
    const destination = createLocalRuntime({
      ...options,
      storagePath: path.join(scratch, 'restored'),
    })
    let portable
    let destinationDisposed = false
    try {
      const address = await source.ready
      await destination.ready
      const env = await localBindings(source)
      const target = await localBindings(destination)
      await applyLocalMigrations(env.DB)
      await applyLocalMigrations(target.DB)
      await bundle.setup.importVault(env, seed)
      const initialState = await storedBusinessRows(env.DB)
      assert.deepEqual(await bundle.setup.importVault(env, seed), {
        imported: 0,
        unchanged: 2,
        seedId: seed.seedId,
      })
      assert.deepEqual(await storedBusinessRows(env.DB), initialState)
      for (const invalid of [
        { ...seed, documents: [...seed.documents, seed.documents[0]] },
        {
          ...seed,
          documents: seed.documents.map((document, index) =>
            index === 0 ? { ...document, path: 'vault/../outside.md' } : document,
          ),
        },
      ]) {
        await assert.rejects(bundle.setup.importVault(env, invalid))
        assert.deepEqual(await storedBusinessRows(env.DB), initialState)
      }
      const session = await bundle.setup.createLocalSession(env, {
        id: 'backup.operator',
        name: 'Backup test operator',
        role: 'maintainer',
      })
      const request = async (endpoint, method, input) => {
        const response = await globalThis.fetch(new URL(`/api${endpoint}`, address), {
          method,
          headers: {
            origin: options.origin,
            cookie: `lorestra_session=${session.token}`,
            'x-csrf-token': session.csrfToken,
            'content-type': 'application/json',
            'idempotency-key': randomUUID(),
          },
          body: JSON.stringify(input),
        })
        const payload = await response.json()
        assert.equal(
          response.status,
          200,
          JSON.stringify(payload.error ?? { status: response.status }),
        )
        return payload
      }
      const document = seed.documents.find((document) => document.locale === 'en')
      const body =
        '# Preserved backup revision\r\n\r\nA reviewed recuperação procedure. 🚀\r\n'
      const input = {
        title: 'Backup reviewed change',
        summary: 'Verify durable restore',
        changes: [
          {
            id: randomUUID(),
            target: {
              documentId: document.id,
              slug: 'backup-recovery-process',
              title: document.title,
            },
            changeType: 'modified',
            baseVersion: 1,
            after: body,
            metadata: {
              locale: document.locale,
              type: document.type,
              folderId: document.folderId,
              tags: document.tags,
              relations: document.relations,
              visibility: document.visibility,
              status: document.status,
            },
          },
        ],
      }
      const created = await request('/proposals', 'POST', input)
      const approved = await request(`/proposals/${created.id}/status`, 'PATCH', {
        proposalId: created.id,
        expectedProposalVersion: 1,
        status: 'approved',
      })
      await request(`/proposals/${created.id}/status`, 'PATCH', {
        proposalId: created.id,
        expectedProposalVersion: approved.proposalVersion,
        status: 'merged',
        confirmation: {
          proposalId: created.id,
          proposalVersion: approved.proposalVersion,
          contentHash: approved.contentHash,
        },
      })
      const pending = await request('/proposals', 'POST', {
        ...input,
        title: 'Unmerged follow-up retained by backup',
        changes: [
          { ...input.changes[0], baseVersion: 2, after: '# A pending third version\n' },
        ],
      })
      const afterPublication = await storedBusinessRows(env.DB)
      await bundle.setup.importVault(env, seed)
      assert.deepEqual(await storedBusinessRows(env.DB), afterPublication)
      await assert.rejects(
        createBackup(env, path.join(scratch, 'unsafe')),
        /read-only maintenance/,
      )
      await env.DB.prepare(
        "UPDATE vault_settings SET value='true' WHERE key='read_only'",
      ).run()
      const archive = path.join(scratch, 'archive')
      const backup = await createBackup(env, archive)
      assert.equal(backup.documents, 2)
      assert.equal(backup.revisions, 3)
      const verified = await readBackup(archive)
      const manifestText = await readFile(path.join(archive, 'manifest.json'), 'utf8')
      assert.ok(!manifestText.includes(session.token))
      assert.ok(!manifestText.includes(session.csrfToken))
      assert.ok(!Object.hasOwn(verified.manifest.tables, 'sessions'))
      assert.deepEqual(await restoreBackup(target, verified), {
        documents: 2,
        revisions: 3,
        readOnly: true,
      })
      for (const table of [
        'documents',
        'document_paths',
        'revisions',
        'relations',
        'proposals',
        'proposal_versions',
        'history',
        'operations',
      ]) {
        const sourceRows = (await env.DB.prepare(`SELECT * FROM ${table}`).all())
          .results
        const restoredRows = (await target.DB.prepare(`SELECT * FROM ${table}`).all())
          .results
        assert.deepEqual(restoredRows, sourceRows, `${table} must match exactly`)
      }
      assert.equal(
        (await target.DB.prepare('SELECT COUNT(*) AS count FROM sessions').first())
          .count,
        0,
      )
      assert.equal(
        (
          await target.DB.prepare(
            "SELECT value FROM vault_settings WHERE key='read_only'",
          ).first()
        ).value,
        'true',
      )
      const restoredAddress = await destination.ready
      const publicResponse = await globalThis.fetch(
        new URL(`/api/documents/${document.slug}?locale=en`, restoredAddress),
      )
      assert.equal(publicResponse.status, 200)
      assert.equal((await publicResponse.json()).document.body, body)
      const pendingRow = await target.DB.prepare(
        'SELECT payload_json FROM proposals WHERE id=?',
      )
        .bind(pending.id)
        .first()
      assert.equal(JSON.parse(pendingRow.payload_json).status, 'open')
      for (const object of verified.manifest.objects)
        assert.deepEqual(
          Buffer.from(await (await target.VAULT.get(object.key)).arrayBuffer()),
          verified.bodies.get(object.key),
        )
      await assert.rejects(restoreBackup(target, verified), /empty target/)
      const exported = path.join(scratch, 'portable')
      assert.equal((await exportMarkdown(env, exported)).documents, 2)
      for (const original of seed.documents) {
        const current = JSON.parse(
          (
            await env.DB.prepare(
              'SELECT snapshot_json FROM revisions WHERE document_id=? ORDER BY version DESC LIMIT 1',
            )
              .bind(original.id)
              .first()
          ).snapshot_json,
        )
        const markdown = await readFile(path.join(exported, current.path), 'utf8')
        const parsed = parseVaultMarkdown(markdown, current.path)
        assert.equal(parsed.metadata.id, original.id)
        assert.equal(parsed.metadata.locale, original.locale)
        assert.deepEqual(parsed.metadata.author, current.author)
        assert.deepEqual(parsed.metadata.relatedDocumentIds, original.relations)
        assert.equal(
          parsed.body,
          original.locale === 'en' ? body.replace(/\r\n/g, '\n') : original.body,
        )
      }
      const damaged = path.join(archive, verified.manifest.objects[0].filename)
      const originalBytes = await readFile(damaged)
      await writeFile(damaged, Buffer.alloc(originalBytes.length, 'x'))
      await assert.rejects(readBackup(archive), /checksum/)
      assert.equal(
        (await target.DB.prepare('SELECT COUNT(*) AS count FROM revisions').first())
          .count,
        3,
      )
      // Portable import restores only current knowledge, not review/session history.
      const portableManifest = await readPortableMarkdown(exported)
      assert.equal(portableManifest.documents.length, 2)
      assert.ok(
        portableManifest.aliases.some(
          (alias) => alias.slug === document.slug && alias.documentId === document.id,
        ),
      )
      assert.ok(
        portableManifest.pathAliases.some(
          (alias) => alias.path === document.path && alias.documentId === document.id,
        ),
      )
      await destination.dispose()
      destinationDisposed = true
      portable = createLocalRuntime({
        ...options,
        storagePath: path.join(scratch, 'portable-store'),
      })
      const portableAddress = await portable.ready
      const imported = await localBindings(portable)
      await applyLocalMigrations(imported.DB)
      assert.equal(
        (await bundle.setup.importVault(imported, portableManifest)).imported,
        2,
      )
      for (const current of portableManifest.documents) {
        const response = await globalThis.fetch(
          new URL(
            `/api/documents/${current.slug}?locale=${current.locale}`,
            portableAddress,
          ),
        )
        assert.equal(response.status, 200)
        const actual = (await response.json()).document
        assert.equal(actual.id, current.id)
        assert.equal(actual.locale, current.locale)
        assert.equal(actual.body, current.body)
        assert.equal(actual.version, current.version)
        assert.deepEqual(actual.author, current.author)
        assert.deepEqual(actual.relations, current.relations)
      }
      const oldSlugResponse = await globalThis.fetch(
        new URL(`/api/documents/${document.slug}?locale=en`, portableAddress),
      )
      assert.equal(oldSlugResponse.status, 200)
      assert.equal((await oldSlugResponse.json()).document.id, document.id)
      assert.equal(
        (
          await imported.DB.prepare(
            'SELECT document_id FROM document_paths WHERE path=?',
          )
            .bind(document.path)
            .first()
        ).document_id,
        document.id,
      )
      for (const table of ['sessions', 'proposals', 'history'])
        assert.equal(
          (await imported.DB.prepare(`SELECT COUNT(*) AS count FROM ${table}`).first())
            .count,
          0,
        )
    } finally {
      await Promise.all([
        source.dispose(),
        destinationDisposed ? undefined : destination.dispose(),
        portable?.dispose(),
      ])
      await removeBackupScratch(scratch)
    }
  },
)

async function removeBackupScratch(scratch) {
  const target = await realpath(scratch)
  if (
    path.dirname(target) !== (await realpath(tmpdir())) ||
    !path.basename(target).startsWith('lorestra-backup-')
  )
    throw new Error('Refusing cleanup outside isolated backup test directory')
  await rm(target, { recursive: true, force: false })
}

async function storedBusinessRows(DB) {
  const tables = [
    'documents',
    'document_paths',
    'revisions',
    'relations',
    'proposals',
    'proposal_versions',
    'history',
    'operations',
  ]
  return (
    await DB.batch(
      tables.map((table) => DB.prepare(`SELECT * FROM ${table} ORDER BY rowid`)),
    )
  ).map((result) => result.results)
}
