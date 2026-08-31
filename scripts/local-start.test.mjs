import assert from 'node:assert/strict'
import { createServer } from 'node:net'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import test from 'node:test'
import { URL } from 'node:url'

import {
  assertInitialized,
  assertLocalBuild,
  assertLoopbackHttpOrigin,
  createShutdownController,
  createLocalPreviewOptions,
  parseLocalStartOptions,
  serveLocalRelease,
  startLocalPreview,
} from './local-start.mjs'

test('local release options stay on the loopback preview and resolve state explicitly', () => {
  const options = parseLocalStartOptions(
    ['--state=.lorestra/release-state', '--port=4174'],
    {},
  )
  assert.equal(options.port, 4174)
  assert.equal(options.statePath, path.resolve('.lorestra/release-state'))
  assert.equal(options.help, false)
  assert.equal(options.host, '127.0.0.1')
  assert.equal(
    parseLocalStartOptions([], { LORESTRA_LOCAL_CONTAINER: '1' }).host,
    '0.0.0.0',
  )
})

test('local release options reject unknown or unsafe ports', () => {
  assert.throws(
    () => parseLocalStartOptions(['--port=8787.5'], {}),
    /integer between 1024 and 65535/,
  )
  assert.throws(
    () => parseLocalStartOptions(['--port=80'], {}),
    /integer between 1024 and 65535/,
  )
  assert.throws(
    () => parseLocalStartOptions(['--unknown=value'], {}),
    /Unknown local release option/,
  )
})

test('preview proxy is strict and cannot target a remote origin', () => {
  const options = createLocalPreviewOptions({
    port: 4173,
    apiOrigin: 'http://127.0.0.1:4321',
  })
  assert.deepEqual(options, {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:4321', changeOrigin: false },
    },
  })
  assert.throws(
    () => assertLoopbackHttpOrigin('https://example.test'),
    /HTTP loopback URL/,
  )
  assert.throws(
    () => assertLoopbackHttpOrigin('http://127.0.0.1:4321?token=secret'),
    /without credentials/,
  )
  assert.equal(
    createLocalPreviewOptions({
      host: '0.0.0.0',
      port: 4173,
      apiOrigin: 'http://127.0.0.1:4321',
    }).host,
    '0.0.0.0',
  )
  assert.throws(
    () =>
      createLocalPreviewOptions({
        host: '192.168.1.10',
        port: 4173,
        apiOrigin: 'http://127.0.0.1:4321',
      }),
    /127\.0\.0\.1 or the explicit container binding/,
  )
})

test('startup requires the explicit seed marker and does not invent one', async () => {
  const prepared = {
    prepare(sql) {
      assert.match(sql, /vault_settings/)
      return { first: async () => ({ value: 'seed-2026' }) }
    },
  }
  assert.equal(await assertInitialized(prepared), 'seed-2026')
  await assert.rejects(
    () =>
      assertInitialized({
        prepare: () => ({ first: async () => undefined }),
      }),
    /backend:init/,
  )
  await assert.rejects(
    () =>
      assertInitialized({
        prepare: () => ({
          first: async () => {
            throw new Error('missing table')
          },
        }),
      }),
    /backend:init/,
  )
})

test('missing production bundle points to the explicit build command', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'lorestra-local-start-'))
  await assert.rejects(() => assertLocalBuild(directory), /pnpm local:build/)
})

test('owned shutdown controller handles SIGINT and removes its listeners', async () => {
  const controller = createShutdownController()
  process.emit('SIGINT')
  assert.equal(await controller.promise, 'SIGINT')
  controller.dispose()
})

test('occupied preview port fails instead of selecting another port', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'lorestra-local-preview-'))
  await writeFile(
    path.join(directory, 'index.html'),
    '<!doctype html><title>test</title>',
  )
  const occupied = createServer()
  await new Promise((resolve) => occupied.listen(0, '127.0.0.1', resolve))
  const address = occupied.address()
  assert.ok(address && typeof address !== 'string')
  try {
    await assert.rejects(
      () =>
        startLocalPreview({
          port: address.port,
          apiOrigin: 'http://127.0.0.1:4321',
          webDirectory: directory,
        }),
      /port|address|use|listen/i,
    )
  } finally {
    await new Promise((resolve, reject) =>
      occupied.close((error) => (error ? reject(error) : resolve())),
    )
  }
})

test('production preview serves the built index and closes cleanly', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'lorestra-local-preview-'))
  await mkdir(path.join(directory, 'dist'))
  await writeFile(
    path.join(directory, 'dist', 'index.html'),
    '<!doctype html><title>release-preview</title>',
  )
  const available = createServer()
  await new Promise((resolve) => available.listen(0, '127.0.0.1', resolve))
  const address = available.address()
  assert.ok(address && typeof address !== 'string')
  await new Promise((resolve, reject) =>
    available.close((error) => (error ? reject(error) : resolve())),
  )

  const server = await startLocalPreview({
    port: address.port,
    apiOrigin: 'http://127.0.0.1:4321',
    webDirectory: directory,
  })
  try {
    const response = await globalThis.fetch(`http://127.0.0.1:${address.port}/`)
    assert.equal(response.status, 200)
    assert.match(await response.text(), /release-preview/)
  } finally {
    await server.close()
  }
})

test('release orchestration closes preview and vault ownership on SIGINT', async () => {
  const events = []
  await serveLocalRelease({
    statePath: await mkdtemp(path.join(tmpdir(), 'lorestra-local-release-')),
    dependencies: {
      assertBuild: async () => undefined,
      migrate: async () => undefined,
      initialized: async () => 'seed-for-test',
      withVault: async (_options, callback) => {
        try {
          return await callback({
            env: { DB: {} },
            runtime: { ready: Promise.resolve(new URL('http://127.0.0.1:4321')) },
          })
        } finally {
          events.push('vault-close')
        }
      },
      startPreview: async () => {
        events.push('preview-start')
        return { close: async () => events.push('preview-close') }
      },
      shutdownControllerFactory: () => {
        const controller = createShutdownController()
        globalThis.setImmediate(() => controller.stop('SIGINT'))
        return controller
      },
    },
  })
  assert.deepEqual(events, ['preview-start', 'preview-close', 'vault-close'])
})
