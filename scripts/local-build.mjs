import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

import { repositoryRoot } from './backend-runtime.mjs'

const webRoot = path.join(repositoryRoot, 'apps', 'web')
const webRequire = createRequire(path.join(webRoot, 'package.json'))
const { build } = await import(pathToFileURL(webRequire.resolve('vite')).href)

/** Build the browser bundle with the durable same-origin HTTP adapter selected. */
export async function buildLocalWeb() {
  const previousAdapter = process.env.VITE_DATA_ADAPTER
  const previousApiUrl = process.env.VITE_LORESTRA_API_URL
  process.env.VITE_DATA_ADAPTER = 'http'
  process.env.VITE_LORESTRA_API_URL = '/api'
  try {
    return await build({
      root: webRoot,
      configFile: path.join(webRoot, 'vite.config.ts'),
      mode: 'production',
      logLevel: 'info',
    })
  } finally {
    if (previousAdapter === undefined) delete process.env.VITE_DATA_ADAPTER
    else process.env.VITE_DATA_ADAPTER = previousAdapter
    if (previousApiUrl === undefined) delete process.env.VITE_LORESTRA_API_URL
    else process.env.VITE_LORESTRA_API_URL = previousApiUrl
  }
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  buildLocalWeb().catch((error) => {
    process.stderr.write(
      `Local web build failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`,
    )
    process.exitCode = 1
  })
}
