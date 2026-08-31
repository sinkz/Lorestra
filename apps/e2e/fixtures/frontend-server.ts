import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createServer, type ViteDevServer } from 'vite'

/** An owned Vite server, closed in-process without Windows shell-tree teardown. */
export async function startFrontend(
  adapter: 'http' | 'mock',
  port: number,
  apiOrigin?: string,
) {
  const root = fileURLToPath(new URL('../../web/', import.meta.url))
  const previousAdapter = process.env.VITE_DATA_ADAPTER
  const previousApi = process.env.LORESTRA_API_ORIGIN
  const restoreEnvironment = () => {
    if (previousAdapter === undefined) delete process.env.VITE_DATA_ADAPTER
    else process.env.VITE_DATA_ADAPTER = previousAdapter
    if (previousApi === undefined) delete process.env.LORESTRA_API_ORIGIN
    else process.env.LORESTRA_API_ORIGIN = previousApi
  }
  process.env.VITE_DATA_ADAPTER = adapter
  if (apiOrigin) process.env.LORESTRA_API_ORIGIN = apiOrigin
  let server: ViteDevServer | undefined
  try {
    server = await createServer({
      root,
      configFile: path.join(root, 'vite.config.ts'),
      logLevel: 'error',
      server: {
        host: '127.0.0.1',
        port,
        // Port collision is an error: never reuse or kill another developer server.
        strictPort: true,
        ...(apiOrigin
          ? { proxy: { '/api': { target: apiOrigin, changeOrigin: false } } }
          : {}),
      },
    })
    await server.listen()
  } catch (error) {
    await server?.close()
    restoreEnvironment()
    throw error
  }
  return async () => {
    try {
      await server.close()
    } finally {
      restoreEnvironment()
    }
  }
}
