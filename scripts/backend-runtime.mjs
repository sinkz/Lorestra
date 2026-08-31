import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import { build } from 'esbuild'
import { Miniflare } from 'miniflare'
import { unstable_splitSqlQuery as splitSqlQuery } from 'wrangler'

export const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))

/** Local operator/test composition only; the shared Worker never imports this. */
export async function compileLocalBackend() {
  const common = { bundle: true, write: false, format: 'esm', logLevel: 'silent' }
  const [worker, setup] = await Promise.all([
    build({
      ...common,
      platform: 'browser',
      target: 'es2022',
      stdin: {
        contents: `import { createDurableApp } from './apps/api/src/app/create-durable-app.ts'; export default createDurableApp({mode:'local'});`,
        resolveDir: repositoryRoot,
        loader: 'ts',
      },
    }),
    build({
      ...common,
      platform: 'node',
      target: 'node24',
      stdin: {
        contents: `export { importVault } from './apps/api/src/adapters/durable/import-vault.ts'; export { createLocalSession } from './apps/api/src/adapters/durable/identity.ts';`,
        resolveDir: repositoryRoot,
        loader: 'ts',
      },
    }),
  ])
  return {
    worker: worker.outputFiles[0].text,
    setup: await import(
      `data:text/javascript;base64,${Buffer.from(setup.outputFiles[0].text).toString('base64')}`
    ),
  }
}

/** Miniflare 5 configuration: explicit loopback, no telemetry or remote bindings. */
export function createLocalRuntime({ worker, storagePath, origin, port }) {
  const parsedOrigin = new URL(origin)
  if (
    parsedOrigin.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost'].includes(parsedOrigin.hostname)
  ) {
    throw new Error('The local runtime only accepts an HTTP loopback origin')
  }
  return new Miniflare({
    host: '127.0.0.1',
    port,
    cf: false,
    telemetry: { enabled: false },
    logRequests: false,
    resourcePersistencePath: path.resolve(storagePath),
    workers: [
      {
        config: {
          name: 'lorestra-local',
          type: 'worker',
          compatibilityDate: '2026-08-28',
          manifest: {
            mainModule: 'worker.mjs',
            modulesRoot: repositoryRoot,
            modules: { 'worker.mjs': { type: 'esm', contents: worker } },
          },
          env: {
            DB: { type: 'd1', id: 'lorestra-local' },
            VAULT: { type: 'r2', name: 'lorestra-local' },
            LORESTRA_ORIGIN: { type: 'text', value: origin },
            LORESTRA_ENV: { type: 'text', value: 'local' },
          },
        },
        dev: { rootPath: repositoryRoot, unsafeRegisterWorker: false },
      },
    ],
  })
}

export async function localBindings(runtime) {
  return {
    DB: await runtime.getD1Database('DB'),
    VAULT: await runtime.getR2Bucket('VAULT'),
  }
}

/** Wrangler's pinned parser understands trigger BEGIN/END, comments and strings. */
export async function applyLocalMigrations(DB) {
  await DB.prepare(
    'CREATE TABLE IF NOT EXISTS lorestra_local_migrations (name TEXT PRIMARY KEY, sha256 TEXT NOT NULL)',
  ).run()
  const directory = path.join(repositoryRoot, 'apps/api/migrations')
  for (const name of (await readdir(directory))
    .filter((file) => file.endsWith('.sql'))
    .sort()) {
    const sql = await readFile(path.join(directory, name), 'utf8')
    const hash = createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex')
    const applied = await DB.prepare(
      'SELECT sha256 FROM lorestra_local_migrations WHERE name=?',
    )
      .bind(name)
      .first()
    if (applied) {
      if (applied.sha256 !== hash) throw new Error(`Applied migration changed: ${name}`)
      continue
    }
    await DB.batch([
      ...splitSqlQuery(sql).map((query) => DB.prepare(query)),
      DB.prepare('INSERT INTO lorestra_local_migrations(name,sha256) VALUES(?,?)').bind(
        name,
        hash,
      ),
    ])
  }
}
