import { ApiErrorResponseSchema, HealthResponseSchema } from '@lorestra/contracts'

import { createApp } from './create-app.js'

describe('Lorestra API', () => {
  const app = createApp()

  it('serves health and publishes an OpenAPI document', async () => {
    const health = await app.request('http://localhost/health')
    expect(health.status).toBe(200)
    expect(HealthResponseSchema.safeParse(await health.json()).success).toBe(true)

    const openapi = await app.request('http://localhost/openapi.json')
    expect(openapi.status).toBe(200)
    const document = (await openapi.json()) as { paths?: Record<string, unknown> }
    expect(document.paths).toHaveProperty('/documents/{slug}')
    expect(document.paths).toHaveProperty('/proposals')
  })

  it('returns a published document and hides internal drafts', async () => {
    const response = await app.request(
      'http://localhost/documents/what-is-lorestra?locale=en',
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({ document: { slug: 'what-is-lorestra', version: 1 } })

    const hidden = await app.request(
      'http://localhost/documents/internal-draft?locale=en',
    )
    expect(hidden.status).toBe(404)
    expect(ApiErrorResponseSchema.safeParse(await hidden.json()).success).toBe(true)
  })

  it('keeps search and navigation inside the public projection', async () => {
    const search = await app.request('http://localhost/search?q=internal&locale=en')
    expect(search.status).toBe(200)
    const searchBody = (await search.json()) as { items: unknown[] }
    expect(searchBody.items).toHaveLength(0)

    const navigation = await app.request('http://localhost/navigation?locale=en')
    expect(navigation.status).toBe(200)
    const navigationBody = (await navigation.json()) as {
      items: Array<{ slug: string | null }>
      documents: Array<Record<string, unknown>>
    }
    const { items } = navigationBody
    expect(items.some((item) => item.slug === 'internal-draft')).toBe(false)
    const document = navigationBody.documents.find(
      (item) => item.slug === 'what-is-lorestra',
    )
    expect(document).toMatchObject({
      id: 'doc-what-is-lorestra-en',
      slug: 'what-is-lorestra',
      title: 'What is Lorestra?',
    })
    expect(document).not.toHaveProperty('body')
    expect(document).not.toHaveProperty('relations')
  })

  it('supports bounded graph and proposal read slices', async () => {
    const graph = await app.request(
      'http://localhost/graph?scope=related&documentId=doc-what-is-lorestra-en&locale=en',
    )
    expect(graph.status).toBe(200)
    const graphBody = (await graph.json()) as { centerId: string | null }
    expect(graphBody.centerId).toBe('doc-what-is-lorestra-en')

    const proposals = await app.request('http://localhost/proposals?limit=1')
    expect(proposals.status).toBe(200)
    const proposalsBody = (await proposals.json()) as { items: unknown[] }
    expect(proposalsBody.items).toHaveLength(1)

    const proposal = await app.request(
      'http://localhost/proposals/proposal-clarify-workflow',
    )
    expect(proposal.status).toBe(200)
    const proposalBody = (await proposal.json()) as { status: string }
    expect(proposalBody.status).toBe('open')
  })

  it('allows only localhost read CORS requests', async () => {
    const allowed = await app.request('http://localhost/health', {
      headers: { Origin: 'http://localhost:5173' },
    })
    expect(allowed.headers.get('access-control-allow-origin')).toBe(
      'http://localhost:5173',
    )

    const preflight = await app.request('http://localhost/navigation', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET',
      },
    })
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('access-control-allow-methods')).toContain('GET')
    expect(preflight.headers.get('access-control-allow-methods')).not.toContain('POST')

    const blocked = await app.request('http://localhost/health', {
      headers: { Origin: 'https://untrusted.example' },
    })
    expect(blocked.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('resolves the explicitly requested current revision', async () => {
    const revision = await app.request(
      'http://localhost/documents/what-is-lorestra?locale=en&version=1',
    )
    expect(revision.status).toBe(200)
    const revisionBody = (await revision.json()) as {
      revision: { version: number }
    }
    expect(revisionBody.revision).toMatchObject({ version: 1 })

    const missing = await app.request(
      'http://localhost/documents/what-is-lorestra?locale=en&version=2',
    )
    expect(missing.status).toBe(404)
  })
})
