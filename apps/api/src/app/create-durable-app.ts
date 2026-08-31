import { Hono } from 'hono'
import { z } from 'zod'
import { ApiError, errorBody, errorFromUnknown } from './errors.js'
import type { DurableEnv } from './durable-endpoint.js'
import {
  readIdentity,
  requireMutation,
  runtimeSettings,
} from '../adapters/durable/identity.js'
import { sha256 } from '../adapters/durable/primitives.js'
import { readVaultEndpoints } from '../slices/read-vault/routes.js'
import { proposalEndpoints } from '../slices/manage-proposals/routes.js'
import { sessionEndpoints } from '../slices/manage-session/routes.js'

/** Streaming ceiling applies before JSON.parse and does not trust Content-Length. */
async function boundedJson(request: Request, limit: number): Promise<unknown> {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new ApiError('bad_request', 'Use application/json.', 400)
  if (Number(request.headers.get('content-length') ?? 0) > limit)
    throw new ApiError('payload_too_large', 'Request body exceeds the byte limit.', 413)
  const reader = request.body?.getReader()
  if (!reader) throw new ApiError('bad_request', 'A JSON body is required.', 400)
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    size += chunk.value.byteLength
    if (size > limit) {
      await reader.cancel()
      throw new ApiError(
        'payload_too_large',
        'Request body exceeds the byte limit.',
        413,
      )
    }
    chunks.push(chunk.value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch {
    throw new ApiError('bad_request', 'Invalid JSON body.', 400)
  }
}

export function createDurableApp(options: { mode: 'local' | 'shared' }) {
  const app = new Hono<DurableEnv>()
  const endpoints = [
    ...readVaultEndpoints(),
    ...proposalEndpoints(),
    ...sessionEndpoints(options.mode),
  ]
  app.use('*', async (c, next) => {
    const startedAt = Date.now()
    const requestId = crypto.randomUUID()
    c.set('requestId', requestId)
    c.header('X-Request-ID', requestId)
    c.header('Cache-Control', 'private, no-store')
    c.header('Vary', 'Cookie, Origin')
    c.header('X-Content-Type-Options', 'nosniff')
    const identity = await readIdentity(c.env, c.req.raw)
    c.set('identity', identity)
    const settings = await runtimeSettings(c.env)
    // Use trusted edge metadata only in shared mode. Local clients share an anonymous bucket.
    const bucket = await sha256(
      identity.principal?.id ??
        (options.mode === 'shared'
          ? (c.req.header('cf-connecting-ip') ?? 'anonymous')
          : 'anonymous'),
    )
    const minute = Math.floor(Date.now() / 60_000)
    await c.env.DB.prepare(
      'DELETE FROM rate_windows WHERE key IN(SELECT key FROM rate_windows WHERE expires_at<? ORDER BY expires_at LIMIT 100)',
    )
      .bind(Date.now())
      .run()
    const result = await c.env.DB.prepare(
      'INSERT INTO rate_windows(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',
    )
      .bind(`read:${bucket}:${minute}`, (minute + 2) * 60_000)
      .first<number>('count')
    if ((result ?? 0) > settings.limits.maxRequestsPerMinute)
      throw new ApiError(
        'rate_limited',
        'Too many requests. Retry after the current window.',
        429,
        { retryAfterSeconds: 60 },
      )
    await next()
    if (options.mode === 'shared' && c.res.status < 400)
      console.info(
        JSON.stringify({
          event: 'http.request',
          requestId,
          method: c.req.method,
          status: c.res.status,
          durationMs: Date.now() - startedAt,
        }),
      )
  })
  app.onError((error, c) => {
    const result = errorFromUnknown(error, c.get('requestId') ?? crypto.randomUUID())
    if (options.mode === 'shared')
      console.warn(
        JSON.stringify({
          event: 'http.error',
          requestId: result.body.error.requestId,
          code: result.body.error.code,
          status: result.status,
        }),
      )
    if (result.status === 429) {
      c.header('Retry-After', '60')
      result.body.error.retryAfterSeconds = 60
    }
    return c.json(result.body, result.status)
  })
  app.notFound((c) =>
    c.json(errorBody(c.get('requestId'), 'not_found', 'Route not found.'), 404),
  )
  app.get('/api/health', async (c) => {
    const settings = await runtimeSettings(c.env)
    return c.json(
      {
        status: settings.seedId ? 'ok' : 'unseeded',
        version: '0.1.0',
        ...(options.mode === 'local'
          ? { mode: options.mode, seedId: settings.seedId }
          : {}),
        readOnly: settings.readOnly.enabled,
      },
      settings.seedId ? 200 : 503,
    )
  })
  for (const endpoint of endpoints) {
    app.on(endpoint.method.toUpperCase(), `/api${endpoint.path}`, async (c) => {
      let input: unknown
      if (endpoint.method === 'get') input = { ...c.req.query(), ...c.req.param() }
      else {
        if (endpoint.mutates)
          await requireMutation(
            c.env,
            c.get('identity'),
            c.req.raw,
            c.env.LORESTRA_ORIGIN ?? '',
          )
        const limit = endpoint.mutates
          ? (await runtimeSettings(c.env)).limits.maxProposalBytes
          : 2048
        input = await boundedJson(c.req.raw, limit)
        const pathId = c.req.param('proposalId')
        if (
          pathId &&
          (!input ||
            typeof input !== 'object' ||
            !('proposalId' in input) ||
            input.proposalId !== pathId)
        )
          throw new ApiError(
            'bad_request',
            'The route and proposal identity must match.',
            400,
          )
      }
      const result = await endpoint.handler(c, endpoint.input.parse(input))
      if (result === null) throw new ApiError('not_found', 'Resource not found.', 404)
      return c.json(endpoint.output.parse(result))
    })
  }
  app.get('/api/openapi.json', (c) => {
    const paths: Record<string, Record<string, unknown>> = {}
    for (const endpoint of endpoints) {
      const path = `/api${endpoint.path.replace(/:([A-Za-z]+)/g, '{$1}')}`
      const input = z.toJSONSchema(endpoint.input, { unrepresentable: 'any' })
      const output = z.toJSONSchema(endpoint.output, { unrepresentable: 'any' })
      const params = Object.entries(input.properties ?? {}).map(([name, schema]) => ({
        name,
        in: path.includes(`{${name}}`) ? 'path' : 'query',
        required: path.includes(`{${name}}`) || input.required?.includes(name) || false,
        schema,
      }))
      paths[path] ??= {}
      paths[path][endpoint.method] = {
        ...(endpoint.method === 'get'
          ? { parameters: params }
          : {
              parameters: params.filter((param) => param.in === 'path'),
              requestBody: {
                required: true,
                content: { 'application/json': { schema: input } },
              },
            }),
        responses: {
          '200': {
            description: 'Successful operation',
            content: { 'application/json': { schema: output } },
          },
          '401': { description: 'Authentication required' },
          '403': { description: 'Operation not permitted' },
          '409': { description: 'Version or idempotency conflict' },
          '422': { description: 'Invalid input' },
          '429': { description: 'Rate limit exceeded' },
        },
      }
    }
    return c.json({
      openapi: '3.1.0',
      info: { title: 'Lorestra durable API', version: '0.1.0' },
      paths,
    })
  })
  return app
}
