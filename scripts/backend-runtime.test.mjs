import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readdir, realpath, rm } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'

import {
  applyLocalMigrations,
  createLocalRuntime,
  localBindings,
  repositoryRoot,
} from './backend-runtime.mjs'

test(
  'local D1 migrations preserve triggers and R2 survives a runtime restart',
  { timeout: 30_000 },
  async () => {
    const scratchRoot = tmpdir()
    await mkdir(scratchRoot, { recursive: true })
    const scratch = await mkdtemp(path.join(scratchRoot, 'lorestra-runtime-'))
    const options = {
      worker: 'export default {fetch(){return new Response("storage fixture")}}',
      storagePath: scratch,
      origin: 'http://127.0.0.1:4176',
      port: 0,
    }
    const migrationCount = (
      await readdir(path.join(repositoryRoot, 'apps/api/migrations'))
    ).filter((file) => file.endsWith('.sql')).length
    let runtime = createLocalRuntime(options)
    try {
      await runtime.ready
      const { DB, VAULT } = await localBindings(runtime)
      await applyLocalMigrations(DB)
      await applyLocalMigrations(DB)
      const migration = await DB.prepare(
        'SELECT COUNT(*) AS count FROM lorestra_local_migrations',
      ).first()
      assert.equal(migration.count, migrationCount)
      const triggers = await DB.prepare(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE type='trigger' AND name LIKE 'immutable_%'",
      ).first()
      assert.equal(triggers.count, 6)
      await assert.rejects(
        DB.batch([
          DB.prepare(
            "INSERT INTO vault_settings(key,value) VALUES('tooling-rollback','must-not-publish')",
          ),
          DB.prepare("INSERT INTO commit_guards(id,ok) VALUES('tooling-invalid',0)"),
        ]),
      )
      assert.equal(
        await DB.prepare(
          "SELECT value FROM vault_settings WHERE key='tooling-rollback'",
        ).first(),
        null,
      )
      await VAULT.put('tooling/readme.md', '# Persisted storage fixture\n')
      await runtime.dispose()
      runtime = createLocalRuntime(options)
      await runtime.ready
      const restored = await localBindings(runtime)
      assert.equal(
        await (await restored.VAULT.get('tooling/readme.md')).text(),
        '# Persisted storage fixture\n',
      )
      assert.equal(
        (
          await restored.DB.prepare(
            'SELECT COUNT(*) AS count FROM lorestra_local_migrations',
          ).first()
        ).count,
        migrationCount,
      )
    } finally {
      await runtime.dispose()
      await removeScratch(scratchRoot, scratch)
    }
  },
)

async function removeScratch(scratchRoot, scratch) {
  const resolvedRoot = await realpath(scratchRoot)
  const resolvedScratch = await realpath(scratch)
  if (
    path.dirname(resolvedScratch) !== resolvedRoot ||
    !path.basename(resolvedScratch).startsWith('lorestra-runtime-')
  ) {
    throw new Error('Refusing to remove a directory outside the tooling test root')
  }
  await rm(resolvedScratch, { recursive: true, force: false })
}
