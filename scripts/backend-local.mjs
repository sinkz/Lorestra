import { randomUUID } from 'node:crypto'
import { mkdir, open, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

import {
  applyLocalMigrations,
  compileLocalBackend,
  createLocalRuntime,
  localBindings,
  repositoryRoot,
} from './backend-runtime.mjs'
import { buildVaultSeed } from './backend-seed.mjs'

export const defaultStatePath = path.join(repositoryRoot, '.lorestra/state')

/** One operator owns a local SQLite store. Stop dev before backup, seed or restore. */
export async function withLocalVault(
  { statePath = defaultStatePath, origin = 'http://127.0.0.1:5173', port = 0 } = {},
  callback,
) {
  const directory = path.resolve(statePath)
  await mkdir(directory, { recursive: true })
  const lockPath = path.join(directory, 'operator.lock')
  const nonce = randomUUID()
  let lock
  try {
    lock = await open(lockPath, 'wx', 0o600)
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new Error(
        'This local store is locked. Stop backend:dev first. If its process crashed, inspect and remove only the stale operator.lock file before retrying.',
        { cause: error },
      )
    }
    throw error
  }
  await lock.writeFile(
    JSON.stringify({ pid: process.pid, nonce, createdAt: new Date().toISOString() }),
  )
  await lock.close()
  let runtime
  try {
    const bundle = await compileLocalBackend()
    runtime = createLocalRuntime({
      worker: bundle.worker,
      storagePath: directory,
      origin,
      port,
    })
    await runtime.ready
    return await callback({
      env: await localBindings(runtime),
      bundle,
      runtime,
      directory,
    })
  } finally {
    await runtime?.dispose()
    const current = JSON.parse(await readFile(lockPath, 'utf8'))
    if (current.nonce === nonce) await unlink(lockPath)
  }
}

async function saveOperatorSession({ env, bundle, directory }) {
  const session = await bundle.setup.createLocalSession(env, {
    id: 'local.operator',
    name: 'Local maintainer',
    role: 'maintainer',
  })
  const filename = path.join(directory, 'local-session.json')
  await writeFile(
    filename,
    `${JSON.stringify({ ...session, mode: 'local', warning: 'Local synthetic credential. Never commit or share this file.' }, null, 2)}\n`,
    { mode: 0o600 },
  )
  process.stdout.write(
    `Local session written to ${filename}. Copy its token into the local sign-in dialog; no token was printed.\n`,
  )
}

function readOptions(argv) {
  const options = {
    command: argv.includes('--help') ? 'help' : (argv[0] ?? 'help'),
    statePath: process.env.LORESTRA_LOCAL_STATE ?? defaultStatePath,
    origin: process.env.LORESTRA_LOCAL_ORIGIN ?? 'http://127.0.0.1:5173',
    port: 8787,
  }
  for (const argument of argv.slice(1)) {
    if (argument === '--help') continue
    if (argument.startsWith('--state='))
      options.statePath = path.resolve(argument.slice(8))
    else if (argument.startsWith('--origin=')) options.origin = argument.slice(9)
    else if (argument.startsWith('--port=')) options.port = Number(argument.slice(7))
    else if (argument.startsWith('--reason=')) options.reason = argument.slice(9)
    else if (argument === 'on' || argument === 'off')
      options.readOnly = argument === 'on'
    else throw new Error(`Unknown local option: ${argument}`)
  }
  if (!Number.isInteger(options.port) || options.port < 1024 || options.port > 65535)
    throw new Error('The local port must be an integer between 1024 and 65535')
  return options
}

async function main() {
  const options = readOptions(process.argv.slice(2))
  if (options.command === 'help') {
    process.stdout.write(
      'Local-only Lorestra operator commands:\n  init       Migrate, seed canonical Markdown and create a local maintainer credential\n  seed       Migrate and explicitly import canonical Markdown, without overwriting live changes\n  session    Create a new local maintainer credential file\n  dev        Serve existing D1/R2 state (no automatic seed)\n  readonly on|off [--reason=message]\nOptions: --state=path --origin=http://127.0.0.1:5173 --port=8787\nStop dev before running another operator command. No remote provisioning or deployment occurs.\n',
    )
    return
  }
  if (!['init', 'seed', 'session', 'dev', 'readonly'].includes(options.command))
    throw new Error('Unknown local operator command')
  if (options.command === 'readonly' && options.readOnly === undefined)
    throw new Error('Choose readonly on or readonly off explicitly')
  // Seed parsing and validation must finish before a storage operation begins.
  const seed = ['init', 'seed'].includes(options.command)
    ? await buildVaultSeed()
    : undefined
  await withLocalVault(
    { ...options, port: options.command === 'dev' ? options.port : 0 },
    async (local) => {
      await applyLocalMigrations(local.env.DB)
      if (seed) {
        const result = await local.bundle.setup.importVault(local.env, seed)
        process.stdout.write(
          `Imported ${result.imported} documents; ${result.unchanged} were unchanged.\n`,
        )
      }
      if (options.command === 'init' || options.command === 'session')
        await saveOperatorSession(local)
      if (options.command === 'readonly') {
        await local.env.DB.batch([
          local.env.DB.prepare(
            "INSERT INTO vault_settings(key,value) VALUES('read_only',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
          ).bind(String(options.readOnly)),
          local.env.DB.prepare(
            "INSERT INTO vault_settings(key,value) VALUES('read_only_reason',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
          ).bind(
            options.readOnly ? (options.reason ?? 'Local operator maintenance') : '',
          ),
        ])
        process.stdout.write(
          `Read-only mode is ${options.readOnly ? 'enabled' : 'disabled'}.\n`,
        )
      }
      if (options.command === 'dev') {
        const seedState = await local.env.DB.prepare(
          "SELECT value FROM vault_settings WHERE key='seed_id'",
        ).first()
        if (!seedState)
          throw new Error('The local vault is not initialized. Run backend:init first.')
        process.stdout.write(
          `Lorestra local Worker: http://127.0.0.1:${options.port}/api\nD1/R2 state: ${local.directory}\nAllowed browser origin: ${options.origin}\nNo seed was imported. Press Ctrl+C to stop.\n`,
        )
        await new Promise((resolve) => {
          const stop = () => {
            process.off('SIGINT', stop)
            process.off('SIGTERM', stop)
            resolve()
          }
          process.once('SIGINT', stop)
          process.once('SIGTERM', stop)
        })
      }
    },
  )
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main().catch((error) => {
    process.stderr.write(
      `Local operation failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`,
    )
    process.exitCode = 1
  })
}
