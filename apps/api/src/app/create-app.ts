import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'

import { errorFromUnknown, errorBody } from './errors.js'
import type { ApiApp, AppEnv } from './types.js'
import { createMemoryDependencies, type ApiDependencies } from '../adapters/memory.js'
import { registerHealth } from '../slices/health/route.js'
import { registerReadNavigation } from '../slices/read-navigation/route.js'
import { registerReadDocument } from '../slices/read-document/route.js'
import { registerReadGraph } from '../slices/read-graph/route.js'
import { registerSearchKnowledge } from '../slices/search-knowledge/route.js'
import { registerListProposals } from '../slices/list-proposals/route.js'
import { registerReadProposal } from '../slices/read-proposal/route.js'
import { registerReadHistory } from '../slices/read-history/route.js'

export function createApp(
  dependencies: ApiDependencies = createMemoryDependencies(),
): ApiApp {
  const app = new OpenAPIHono<AppEnv>()

  app.use('*', async (context, next) => {
    context.set('requestId', context.req.header('cf-ray') ?? crypto.randomUUID())
    await next()
  })

  // Local browser development is intentionally the only CORS allowlist.  The
  // public Worker exposes reads only, so preflights never grant POST/PATCH.
  app.use(
    '*',
    cors({
      origin: [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:4175',
        'http://127.0.0.1:4175',
      ],
      allowMethods: ['GET', 'OPTIONS'],
      allowHeaders: ['Accept', 'Content-Type'],
      maxAge: 600,
    }),
  )

  app.onError((error, context) => {
    const requestId = context.get('requestId')
    const result = errorFromUnknown(error, requestId)
    return context.json(result.body, result.status)
  })
  app.notFound((context) =>
    context.json(
      errorBody(context.get('requestId'), 'not_found', 'Route not found.'),
      404,
    ),
  )

  registerHealth(app, dependencies)
  registerReadNavigation(app, dependencies)
  registerReadDocument(app, dependencies)
  registerReadGraph(app, dependencies)
  registerSearchKnowledge(app, dependencies)
  registerListProposals(app, dependencies)
  registerReadProposal(app, dependencies)
  registerReadHistory(app, dependencies)

  app.doc('/openapi.json', {
    openapi: '3.1.0',
    info: {
      title: 'Lorestra API',
      version: dependencies.version,
      description: 'Read-only knowledge and review projections for Lorestra.',
    },
  })

  return app
}
