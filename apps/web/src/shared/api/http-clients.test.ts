import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMockClients } from '@lorestra/mock-vault'
import type { DurableCreateProposalInput } from '@lorestra/contracts'
import { createHttpClients } from './http-clients'
import { ApiError } from './errors'

const input: DurableCreateProposalInput = {
  title: 'A durable note',
  summary: 'A reviewable note',
  reason: 'Separate reason',
  changes: [
    {
      id: 'change-http',
      target: { documentId: null, title: 'A durable note', slug: 'a-durable-note' },
      changeType: 'added',
      baseVersion: null,
      after: '# Knowledge',
      metadata: {
        type: 'note',
        folderId: 'folder.docs.en',
        tags: [],
        relations: [],
        locale: 'en',
        visibility: 'public',
        status: 'published',
      },
    },
  ],
}
afterEach(() => vi.unstubAllGlobals())
describe('HTTP contract boundary', () => {
  it('uses same-origin cookies, CSRF and stable idempotency headers for durable writes', async () => {
    const proposal = await createMockClients().proposalClient.create(input)
    const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json(proposal))
    vi.stubGlobal('fetch', fetch)
    const controller = new AbortController()
    const returned = await createHttpClients('/api').proposalClient.create(input, {
      idempotencyKey: 'one-intent',
      csrfToken: 'synthetic-csrf',
      signal: controller.signal,
    })
    expect(returned.proposalVersion).toBe(1)
    expect(fetch).toHaveBeenCalledWith(
      '/api/proposals',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
        headers: expect.objectContaining({
          'idempotency-key': 'one-intent',
          'x-csrf-token': 'synthetic-csrf',
        }),
      }),
    )
    const sent = JSON.parse(fetch.mock.calls[0][1]!.body as string)
    expect(sent).toEqual(input)
    expect(sent.changes[0].after).toBe('# Knowledge')
    expect(sent.changes[0]).not.toHaveProperty('before')
  })
  it('distinguishes status 404 from an error whose text contains 404', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({}, { status: 404 }))
      .mockResolvedValueOnce(
        Response.json(
          {
            error: {
              code: 'internal_error',
              message: 'upstream returned 404',
              requestId: 'req-safe',
              details: null,
            },
          },
          { status: 500 },
        ),
      )
    vi.stubGlobal('fetch', fetch)
    const client = createHttpClients('/api').knowledgeClient
    expect(await client.getDocument({ slug: 'missing', locale: 'en' })).toBeNull()
    await expect(
      client.getDocument({ slug: 'missing', locale: 'en' }),
    ).rejects.toMatchObject({
      status: 500,
      code: 'internal_error',
      requestId: 'req-safe',
    })
  })
  it('reports rate limits and malformed success payloads instead of falling back to fixtures', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json(
            {
              error: {
                code: 'rate_limited',
                message: 'Wait',
                requestId: 'req-quota',
                details: null,
              },
            },
            { status: 429, headers: { 'retry-after': '60' } },
          ),
        )
        .mockResolvedValueOnce(Response.json({ documents: [] })),
    )
    const client = createHttpClients('/api').knowledgeClient
    await expect(client.getNavigation()).rejects.toMatchObject({
      status: 429,
      code: 'rate_limited',
      retryAfter: '60',
      requestId: 'req-quota',
    })
    await expect(client.getNavigation()).rejects.toMatchObject({
      status: 502,
      code: 'INVALID_RESPONSE',
    })
  })
  it('propagates cancellation and reports transport failure without pretending to be not-found', async () => {
    const abort = new DOMException('Cancelled', 'AbortError')
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValueOnce(abort)
        .mockRejectedValueOnce(new TypeError('offline')),
    )
    const controller = new AbortController()
    controller.abort()
    const client = createHttpClients('/api').knowledgeClient
    await expect(
      client.getNavigation(undefined, { signal: controller.signal }),
    ).rejects.toBe(abort)
    await expect(client.getNavigation()).rejects.toEqual(
      new ApiError(0, 'NETWORK_ERROR'),
    )
  })
})
