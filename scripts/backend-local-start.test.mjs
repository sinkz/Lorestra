import assert from 'node:assert/strict'
import { fork, spawn } from 'node:child_process'
import { access, mkdtemp, rm } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import process from 'node:process'
import test from 'node:test'
import { clearTimeout, setTimeout } from 'node:timers'
import { createServer } from 'node:net'
import { fileURLToPath, URL } from 'node:url'

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))
const localStartEntrypoint = path.join(repositoryRoot, 'scripts/local-start.mjs')
const backendLocalEntrypoint = path.join(repositoryRoot, 'scripts/backend-local.mjs')
const productionIndex = path.join(repositoryRoot, 'apps/web/dist/index.html')

test(
  'local release supervisor stops its isolated runtime and releases the store lock',
  { timeout: 120_000 },
  async () => {
    const scratch = await mkdtemp(path.join(tmpdir(), 'lorestra-local-start-'))
    const statePath = path.join(scratch, 'state')
    let supervisor
    try {
      await ensureProductionBundle()
      await runNode(backendLocalEntrypoint, ['init', `--state=${statePath}`])
      const port = await findFreePort()

      supervisor = startSupervisor(statePath, port)
      await waitForReady(supervisor)
      const firstDocument = await readFirstDocument(port)
      assert.ok(firstDocument.summary.id)
      await stopSupervisor(supervisor)
      supervisor = undefined
      await assertNoLock(statePath)

      supervisor = startSupervisor(statePath, port)
      await waitForReady(supervisor)
      const restartedDocument = await readFirstDocument(port)
      assert.equal(restartedDocument.summary.id, firstDocument.summary.id)
      assert.equal(
        restartedDocument.detail.document.version,
        firstDocument.detail.document.version,
      )
      assert.equal(
        restartedDocument.detail.document.body,
        firstDocument.detail.document.body,
      )
      await stopSupervisor(supervisor)
      supervisor = undefined
      await assertNoLock(statePath)
    } finally {
      if (supervisor) await stopSupervisor(supervisor)
      await removeScratch(scratch)
    }
  },
)

async function ensureProductionBundle() {
  try {
    await access(productionIndex)
  } catch {
    const { buildLocalWeb } = await import('./local-build.mjs')
    await buildLocalWeb()
  }
}

function startSupervisor(statePath, port) {
  const child = fork(localStartEntrypoint, [`--state=${statePath}`, `--port=${port}`], {
    cwd: repositoryRoot,
    env: withoutNodeOptions(),
    execArgv: [],
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  })
  return { child, exit: waitForClose(child) }
}

function withoutNodeOptions() {
  const env = { ...process.env }
  delete env.NODE_OPTIONS
  return env
}

async function runNode(entrypoint, args) {
  const child = spawn(process.execPath, [entrypoint, ...args], {
    cwd: repositoryRoot,
    env: withoutNodeOptions(),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const output = collectOutput(child)
  const result = await waitForClose(child)
  if (result.code !== 0)
    throw new Error(
      `${path.basename(entrypoint)} exited with ${result.code ?? result.signal}: ${output()}`,
    )
}

function collectOutput(child) {
  let text = ''
  child.stdout?.on('data', (chunk) => {
    text += chunk.toString()
  })
  child.stderr?.on('data', (chunk) => {
    text += chunk.toString()
  })
  return () => text
}

function waitForClose(child) {
  if (child.exitCode !== null || child.signalCode !== null)
    return Promise.resolve({ code: child.exitCode, signal: child.signalCode })
  return new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code, signal) => resolve({ code, signal }))
  })
}

function waitForReady(supervisor) {
  const child = supervisor.child
  return new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`Timed out waiting for local release: ${output}`))
    }, 60_000)
    const onData = (chunk) => {
      output += chunk.toString()
      if (output.includes('Lorestra local release:')) {
        cleanup()
        resolve()
      }
    }
    const onClose = (code, signal) => {
      cleanup()
      reject(
        new Error(`Local release exited before ready (${code ?? signal}): ${output}`),
      )
    }
    const cleanup = () => {
      clearTimeout(timer)
      child.stdout?.off('data', onData)
      child.stderr?.off('data', onData)
      child.off('close', onClose)
    }
    child.stdout?.on('data', onData)
    child.stderr?.on('data', onData)
    child.once('close', onClose)
  })
}

async function readFirstDocument(port) {
  const response = await globalThis.fetch(
    `http://127.0.0.1:${port}/api/documents?locale=en&limit=1&sort=title`,
  )
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.ok(Array.isArray(body.items) && body.items.length > 0)
  const summary = body.items[0]
  const detailResponse = await globalThis.fetch(
    `http://127.0.0.1:${port}/api/documents/${encodeURIComponent(summary.slug)}?locale=en`,
  )
  assert.equal(detailResponse.status, 200)
  return { summary, detail: await detailResponse.json() }
}

async function stopSupervisor(supervisor) {
  const { child, exit } = supervisor
  if (child.exitCode !== null || child.signalCode !== null) {
    const result = await exit
    assert.equal(result.code, 0)
    return
  }
  if (process.platform === 'win32')
    await new Promise((resolve, reject) =>
      child.send({ type: 'shutdown', signal: 'SIGTERM' }, (error) =>
        error ? reject(error) : resolve(),
      ),
    )
  else child.kill('SIGTERM')
  const result = await exit
  assert.equal(result.code, 0)
}

async function assertNoLock(statePath) {
  await assert.rejects(access(path.join(statePath, 'operator.lock')))
}

async function findFreePort() {
  const server = createServer()
  await new Promise((resolve, reject) =>
    server.listen(0, '127.0.0.1', (error) => (error ? reject(error) : resolve())),
  )
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const port = address.port
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )
  return port
}

async function removeScratch(scratch) {
  const resolved = path.resolve(scratch)
  const tempRoot = path.resolve(tmpdir())
  if (
    path.dirname(resolved) !== tempRoot ||
    !path.basename(resolved).startsWith('lorestra-local-start-')
  )
    throw new Error('Refusing cleanup outside the local-start tooling test root')
  await rm(resolved, { recursive: true, force: false })
}
