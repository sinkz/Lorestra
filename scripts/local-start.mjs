import { fork } from 'node:child_process'
import { createRequire } from 'node:module'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { clearTimeout, setTimeout } from 'node:timers'
import { fileURLToPath, pathToFileURL, URL } from 'node:url'

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))
const defaultStatePath = path.join(repositoryRoot, '.lorestra/state')
const webRoot = path.join(repositoryRoot, 'apps', 'web')

export const defaultPreviewPort = 4173
const shutdownGracePeriodMs = 10_000

function parsePort(value, label) {
  const port = Number(value)
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error(`${label} must be an integer between 1024 and 65535`)
  return port
}

export function parseLocalStartOptions(
  argv = process.argv.slice(2),
  env = process.env,
) {
  const options = {
    statePath: path.resolve(env.LORESTRA_LOCAL_STATE ?? defaultStatePath),
    port: parsePort(
      env.LORESTRA_LOCAL_WEB_PORT ?? defaultPreviewPort,
      'The local web port',
    ),
    // Docker publishes the container's all-interface listener to a host loopback
    // port. Direct/native runs remain loopback-only unless the compose wrapper
    // opts into the container binding explicitly.
    host: env.LORESTRA_LOCAL_CONTAINER === '1' ? '0.0.0.0' : '127.0.0.1',
    help: false,
  }
  for (const argument of argv) {
    if (argument === '--help') {
      options.help = true
      continue
    }
    if (argument.startsWith('--state='))
      options.statePath = path.resolve(argument.slice('--state='.length))
    else if (argument.startsWith('--port='))
      options.port = parsePort(argument.slice('--port='.length), 'The local web port')
    else throw new Error(`Unknown local release option: ${argument}`)
  }
  return options
}

export function browserOriginForPort(port) {
  return `http://127.0.0.1:${parsePort(port, 'The local web port')}`
}

export function assertLoopbackHttpOrigin(value) {
  let parsed
  try {
    parsed = new URL(value)
  } catch (error) {
    throw new Error('The local API origin must be a valid HTTP loopback URL', {
      cause: error,
    })
  }
  if (
    parsed.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost'].includes(parsed.hostname) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  )
    throw new Error(
      'The local API origin must be an HTTP loopback URL without credentials',
    )
  return parsed.origin
}

export function createLocalPreviewOptions({ port, apiOrigin, host = '127.0.0.1' }) {
  const normalizedPort = parsePort(port, 'The local web port')
  if (!['127.0.0.1', '0.0.0.0'].includes(host))
    throw new Error(
      'The local web host must be 127.0.0.1 or the explicit container binding',
    )
  return {
    host,
    port: normalizedPort,
    strictPort: true,
    proxy: {
      '/api': {
        target: assertLoopbackHttpOrigin(apiOrigin),
        changeOrigin: false,
      },
    },
  }
}

export async function assertLocalBuild(webDirectory = webRoot) {
  const indexPath = path.join(webDirectory, 'dist', 'index.html')
  try {
    const details = await stat(indexPath)
    if (!details.isFile()) throw new Error('not a file')
  } catch (error) {
    throw new Error(
      'The production web bundle is missing. Run pnpm local:build first.',
      {
        cause: error,
      },
    )
  }
  return indexPath
}

export async function assertInitialized(DB) {
  let seedState
  try {
    seedState = await DB.prepare(
      "SELECT value FROM vault_settings WHERE key='seed_id'",
    ).first()
  } catch (error) {
    throw new Error(
      'The local vault is not initialized. Run pnpm backend:init first.',
      {
        cause: error,
      },
    )
  }
  if (!seedState || typeof seedState.value !== 'string' || !seedState.value)
    throw new Error('The local vault is not initialized. Run pnpm backend:init first.')
  return seedState.value
}

export async function startLocalPreview({
  port = defaultPreviewPort,
  apiOrigin,
  host = '127.0.0.1',
  webDirectory = webRoot,
}) {
  const webRequire = createRequire(path.join(webRoot, 'package.json'))
  const { preview } = await import(pathToFileURL(webRequire.resolve('vite')).href)
  return preview({
    root: webDirectory,
    configFile: path.join(webRoot, 'vite.config.ts'),
    mode: 'production',
    logLevel: 'error',
    preview: createLocalPreviewOptions({ port, apiOrigin, host }),
  })
}

/** Own the signal listeners so tests and callers can stop the whole process in-process. */
export function createShutdownController() {
  let stopped = false
  let resolveShutdown
  const promise = new Promise((resolve) => {
    resolveShutdown = resolve
  })
  const cleanup = () => {
    process.off('SIGINT', onInterrupt)
    process.off('SIGTERM', onTerminate)
  }
  const stop = (signal) => {
    if (stopped) return
    stopped = true
    cleanup()
    resolveShutdown(signal)
  }
  const onInterrupt = () => stop('SIGINT')
  const onTerminate = () => stop('SIGTERM')
  process.once('SIGINT', onInterrupt)
  process.once('SIGTERM', onTerminate)
  return {
    promise,
    stop,
    dispose: () => stop('disposed'),
  }
}

/** Serve the already-built HTTP application while holding the local vault lock. */
export async function serveLocalRelease({
  statePath = defaultStatePath,
  port = defaultPreviewPort,
  host = '127.0.0.1',
  webDirectory = webRoot,
  dependencies = {},
  onReady,
} = {}) {
  const {
    assertBuild = assertLocalBuild,
    initialized = assertInitialized,
    startPreview = startLocalPreview,
    shutdownControllerFactory = createShutdownController,
  } = dependencies
  const migrate =
    dependencies.migrate ?? (await import('./backend-runtime.mjs')).applyLocalMigrations
  const withVault =
    dependencies.withVault ?? (await import('./backend-local.mjs')).withLocalVault
  await assertBuild(webDirectory)
  const browserOrigin = browserOriginForPort(port)
  return withVault(
    { statePath, origin: browserOrigin, port: 0 },
    async ({ env, runtime }) => {
      await migrate(env.DB)
      const seedId = await initialized(env.DB)
      const apiOrigin = (await runtime.ready).origin
      let server
      const shutdown = shutdownControllerFactory()
      try {
        server = await startPreview({ port, apiOrigin, host, webDirectory })
        process.stdout.write(
          `Lorestra local release: ${browserOrigin}\n` +
            `API proxy: ${apiOrigin}/api\n` +
            `D1/R2 state: ${path.resolve(statePath)}\n` +
            `Seed: ${seedId}\n` +
            'No seed was imported. Press Ctrl+C to stop.\n',
        )
        await onReady?.({ browserOrigin, apiOrigin, seedId })
        await shutdown.promise
      } finally {
        shutdown.dispose()
        await server?.close()
      }
    },
  )
}

function normalizeShutdownSignal(value) {
  return value === 'SIGINT' || value === 'SIGTERM' ? value : undefined
}

/** Spawn the private runtime child; the parent process owns user signals. */
function spawnLocalReleaseChild(
  { statePath = defaultStatePath, port = defaultPreviewPort },
  {
    entrypoint = fileURLToPath(import.meta.url),
    cwd = repositoryRoot,
    env = process.env,
  } = {},
) {
  return fork(
    entrypoint,
    ['--child', `--state=${path.resolve(statePath)}`, `--port=${port}`],
    {
      cwd,
      env,
      // Do not inherit --test/--input-type/-e flags from a parent harness.
      execArgv: [],
      detached: true,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    },
  )
}

/**
 * Run the release as a small signal-owning supervisor. Miniflare and Vite
 * both install process signal handlers, so the long-lived runtime is kept in
 * a detached child and stopped through its private IPC channel instead.
 */
async function runLocalReleaseSupervisor(
  options,
  {
    childFactory = spawnLocalReleaseChild,
    processRef = process,
    gracePeriodMs = shutdownGracePeriodMs,
  } = {},
) {
  const child = childFactory(options)
  let requestedSignal
  let graceTimer
  let forceTimer

  const forward = (stream, target) => {
    stream?.on('data', (chunk) => target?.write(chunk))
  }
  forward(child.stdout, processRef.stdout)
  forward(child.stderr, processRef.stderr)

  const forceChildStop = () => {
    if (child.exitCode !== null || child.signalCode !== null) return
    try {
      child.kill('SIGTERM')
    } catch {
      // The child may have exited between the state check and kill call.
    }
    forceTimer = setTimeout(() => {
      if (child.exitCode !== null || child.signalCode !== null) return
      try {
        child.kill('SIGKILL')
      } catch {
        // A final scoped child-only fallback cannot affect another process.
      }
    }, 2_000)
    forceTimer.unref?.()
  }

  const requestShutdown = (value) => {
    const signal = normalizeShutdownSignal(value)
    if (!signal || requestedSignal) return
    requestedSignal = signal
    let sent = false
    if (child.connected) {
      try {
        child.send({ type: 'shutdown', signal }, () => undefined)
        sent = true
      } catch {
        sent = false
      }
    }
    if (!sent) forceChildStop()
    else {
      graceTimer = setTimeout(forceChildStop, gracePeriodMs)
      graceTimer.unref?.()
    }
  }

  const onInterrupt = () => requestShutdown('SIGINT')
  const onTerminate = () => requestShutdown('SIGTERM')
  const onMessage = (message) => {
    if (message?.type === 'shutdown') requestShutdown(message.signal)
  }
  processRef.prependOnceListener('SIGINT', onInterrupt)
  processRef.prependOnceListener('SIGTERM', onTerminate)
  if (processRef.connected) processRef.on('message', onMessage)

  const childExit = new Promise((resolve, reject) => {
    let settled = false
    child.once('error', (error) => {
      if (settled) return
      settled = true
      reject(error)
    })
    child.once('close', (code, signal) => {
      if (settled) return
      settled = true
      resolve({ code, signal })
    })
  })

  try {
    const result = await childExit
    if (result.code !== 0) {
      const reason = result.signal
        ? `terminated by ${result.signal}`
        : `exited with code ${result.code ?? 'unknown'}`
      throw new Error(`Local release child ${reason}`)
    }
    return result
  } finally {
    processRef.off('SIGINT', onInterrupt)
    processRef.off('SIGTERM', onTerminate)
    if (processRef.connected) processRef.off('message', onMessage)
    if (graceTimer) clearTimeout(graceTimer)
    if (forceTimer) clearTimeout(forceTimer)
  }
}

async function runLocalReleaseChild(options) {
  if (!process.connected || typeof process.send !== 'function')
    throw new Error(
      'The local release runtime child requires a live supervisor IPC channel',
    )
  const shutdown = createShutdownController()
  let finished = false
  const notify = (message) => {
    if (!process.connected || typeof process.send !== 'function') return
    try {
      process.send(message, () => undefined)
    } catch {
      // The supervisor may have closed its IPC channel during an early error.
    }
  }
  const onMessage = (message) => {
    if (finished || message?.type !== 'shutdown') return
    const signal = normalizeShutdownSignal(message.signal)
    if (signal) shutdown.stop(signal)
  }
  const onDisconnect = () => {
    if (!finished) shutdown.stop('SIGTERM')
  }
  process.on('message', onMessage)
  process.once('disconnect', onDisconnect)
  if (!process.connected) {
    process.off('message', onMessage)
    process.off('disconnect', onDisconnect)
    shutdown.dispose()
    throw new Error('The local release supervisor disconnected before runtime startup')
  }
  try {
    await serveLocalRelease({
      ...options,
      onReady: (details) => notify({ type: 'ready', ...details }),
      dependencies: { shutdownControllerFactory: () => shutdown },
    })
    notify({ type: 'closed' })
  } finally {
    finished = true
    process.off('message', onMessage)
    process.off('disconnect', onDisconnect)
    shutdown.dispose()
    if (process.connected) process.disconnect()
  }
}

function printHelp() {
  process.stdout.write(
    'Serve the built durable Lorestra UI with a private local Worker child.\n' +
      'Run pnpm backend:init once, then pnpm local:build before this command.\n' +
      'Options: --state=path --port=4173\n' +
      'The UI and Worker are loopback-only; startup never seeds or resets state.\n',
  )
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  try {
    const childMode = process.argv.includes('--child')
    const options = parseLocalStartOptions(
      process.argv.slice(2).filter((argument) => argument !== '--child'),
    )
    if (options.help) printHelp()
    else if (childMode) await runLocalReleaseChild(options)
    else await runLocalReleaseSupervisor(options)
  } catch (error) {
    process.stderr.write(
      `Local release failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`,
    )
    process.exitCode = 1
  }
}
