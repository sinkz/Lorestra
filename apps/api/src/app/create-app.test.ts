import {
  ApiErrorResponseSchema,
  DocumentListResponseSchema,
  DocumentResponseSchema,
  GraphResponseSchema,
  HealthResponseSchema,
  HistoryResponseSchema,
  NavigationResponseSchema,
  SearchResponseSchema,
} from '@lorestra/contracts'

import { createMemoryDependencies } from '../adapters/memory.js'
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
    expect(document.paths).toHaveProperty('/documents')
    expect(document.paths).toHaveProperty('/documents/{slug}')
    expect(document.paths).toHaveProperty('/proposals')
  })

  it('lists published documents with stable cursor metadata', async () => {
    const firstPage = await app.request(
      'http://localhost/documents?locale=en&limit=2&sort=title',
    )
    expect(firstPage.status).toBe(200)
    const firstBody = await firstPage.json()
    const parsed = DocumentListResponseSchema.parse(firstBody)
    expect(parsed.items).toHaveLength(2)
    expect(parsed.pageInfo.hasPreviousPage).toBe(false)
    expect(parsed.pageInfo.totalCount).toBeGreaterThan(2)
    expect(parsed.pageInfo.hasNextPage).toBe(true)

    const secondPage = await app.request(
      `http://localhost/documents?locale=en&limit=2&sort=title&cursor=${parsed.pageInfo.nextCursor}`,
    )
    const secondBody = DocumentListResponseSchema.parse(await secondPage.json())
    expect(secondBody.pageInfo.hasPreviousPage).toBe(true)
    expect(secondBody.pageInfo.previousCursor).toBe('0')
    expect(secondBody.items[0]?.id).not.toBe(parsed.items[0]?.id)
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

  it('serves public archives across read slices without exposing drafts or internal records', async () => {
    const baseline = await createMemoryDependencies().knowledge.getDocument({
      slug: 'what-is-lorestra',
      locale: 'en',
    })
    if (!baseline) throw new Error('Expected baseline public document')
    const states = [
      { slug: 'public-published', visibility: 'public', status: 'published' },
      { slug: 'public-archived', visibility: 'public', status: 'archived' },
      { slug: 'public-draft', visibility: 'public', status: 'draft' },
      { slug: 'internal-published', visibility: 'internal', status: 'published' },
      { slug: 'internal-archived', visibility: 'internal', status: 'archived' },
      { slug: 'internal-draft', visibility: 'internal', status: 'draft' },
    ] as const
    const records = states.map((state) => ({
      ...baseline.document,
      ...state,
      id: `visibility-${state.slug}`,
      title: `Visibility ${state.slug}`,
      body: `# Visibility ${state.slug}`,
      folderId: 'visibility-folder',
      nav: { visible: true, parentId: 'visibility-folder', order: 1 },
      relations:
        state.slug === 'public-published' ? ['visibility-public-archived'] : [],
    }))
    const projection = createApp(
      createMemoryDependencies({
        documents: records,
        folders: [
          {
            id: 'visibility-folder',
            slug: 'visibility-folder',
            title: 'Visibility',
            parentId: null,
            order: 1,
            visibility: 'public',
            locale: 'en',
          },
        ],
        history: records.map((record) => ({
          id: `history-${record.id}`,
          type: 'document_updated',
          occurredAt: record.updatedAt,
          actor: record.author,
          proposalId: null,
          documentId: record.id,
          documentSlug: record.slug,
          summary: `Updated ${record.title}`,
          resultingVersion: record.version,
        })),
      }),
    )
    const expectedIds = ['visibility-public-archived', 'visibility-public-published']
    const navigation = NavigationResponseSchema.parse(
      await (await projection.request('http://localhost/navigation?locale=en')).json(),
    )
    const listing = DocumentListResponseSchema.parse(
      await (
        await projection.request('http://localhost/documents?locale=en&limit=20')
      ).json(),
    )
    const graph = GraphResponseSchema.parse(
      await (
        await projection.request('http://localhost/graph?scope=entire&locale=en')
      ).json(),
    )
    const search = SearchResponseSchema.parse(
      await (
        await projection.request('http://localhost/search?q=Visibility&locale=en')
      ).json(),
    )
    const archives = DocumentListResponseSchema.parse(
      await (
        await projection.request('http://localhost/documents?locale=en&status=archived')
      ).json(),
    )
    const history = HistoryResponseSchema.parse(
      await (
        await projection.request('http://localhost/history?locale=en&limit=20')
      ).json(),
    )
    for (const items of [
      navigation.documents,
      listing.items,
      search.items,
      graph.nodes.filter((node) => node.kind === 'document'),
    ]) {
      expect(items.map((document) => document.id).sort()).toEqual(expectedIds)
    }
    expect(
      navigation.items
        .filter((item) => item.kind === 'document')
        .map((item) => item.documentId)
        .sort(),
    ).toEqual(expectedIds)
    expect(archives.items).toMatchObject([
      { id: 'visibility-public-archived', status: 'archived' },
    ])
    expect(history.items.map((event) => event.documentId).sort()).toEqual(expectedIds)
    expect(history.pageInfo.totalCount).toBe(2)
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        source: 'visibility-public-published',
        target: 'visibility-public-archived',
      }),
    )
    for (const record of records) {
      const response = await projection.request(
        `http://localhost/documents/${record.slug}?locale=en`,
      )
      if (expectedIds.includes(record.id)) {
        expect(response.status).toBe(200)
        expect(
          DocumentResponseSchema.parse(await response.json()).document,
        ).toMatchObject({ id: record.id, status: record.status })
      } else expect(response.status).toBe(404)
    }
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

  it('filters history before pagination so cursors match the visible locale', async () => {
    const history = await app.request(
      'http://localhost/history?locale=en&category=create&limit=2',
    )
    expect(history.status).toBe(200)
    const body = HistoryResponseSchema.parse(await history.json())
    expect(body.items.length).toBeLessThanOrEqual(2)
    expect(body.items.every((event) => event.type === 'document_published')).toBe(true)

    const noMatch = await app.request(
      'http://localhost/history?locale=en&q=no-event-can-match',
    )
    const noMatchBody = HistoryResponseSchema.parse(await noMatch.json())
    expect(noMatchBody.items).toHaveLength(0)
    expect(noMatchBody.pageInfo.totalCount).toBe(0)
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
