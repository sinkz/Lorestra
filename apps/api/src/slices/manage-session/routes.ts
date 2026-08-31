import { z } from 'zod'
import { setCookie, deleteCookie } from 'hono/cookie'
import { LocalSessionInputSchema, SessionResponseSchema } from '@lorestra/contracts'
import {
  identityFromToken,
  requireMutation,
  sessionResponse,
} from '../../adapters/durable/identity.js'
import { ApiError } from '../../app/errors.js'
import type { Endpoint } from '../../app/durable-endpoint.js'
export function sessionEndpoints(mode: 'local' | 'shared'): Endpoint[] {
  const options = { mode }
  const endpoints: Endpoint[] = [
    {
      method: 'get',
      path: '/session',
      input: z.object({}),
      output: SessionResponseSchema,
      handler: (c) => sessionResponse(c.env, c.get('identity'), options.mode),
    },
  ]
  // The local exchange is selected by an explicit composition root, not an env bypass.
  if (options.mode === 'local')
    endpoints.push({
      method: 'post',
      path: '/session',
      input: LocalSessionInputSchema,
      output: SessionResponseSchema,
      handler: async (c, i) => {
        if (c.req.header('origin') !== c.env.LORESTRA_ORIGIN)
          throw new ApiError('forbidden', 'The request origin is not allowed.', 403)
        const { token } = LocalSessionInputSchema.parse(i)
        const identity = await identityFromToken(c.env, token)
        if (!identity.principal)
          throw new ApiError(
            'unauthorized',
            'The local session token is invalid or expired.',
            401,
          )
        setCookie(c, 'lorestra_session', token, {
          httpOnly: true,
          sameSite: 'Lax',
          path: '/',
          secure: new URL(c.req.url).protocol === 'https:',
          expires: new Date(identity.expiresAt!),
        })
        return sessionResponse(c.env, identity, options.mode)
      },
    })
  endpoints.push({
    method: 'post',
    path: '/session/logout',
    input: z.object({}).strict(),
    output: z.object({ ok: z.literal(true) }),
    handler: async (c) => {
      const identity = c.get('identity')
      await requireMutation(
        c.env,
        identity,
        c.req.raw,
        c.env.LORESTRA_ORIGIN ?? '',
        true,
      )
      await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash=?')
        .bind(identity.tokenHash)
        .run()
      deleteCookie(c, 'lorestra_session', {
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
        secure: options.mode === 'shared',
      })
      return { ok: true }
    },
  })

  return endpoints
}
