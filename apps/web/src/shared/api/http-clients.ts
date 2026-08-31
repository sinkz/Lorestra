import {
  DocumentListResponseSchema,
  DocumentResponseSchema,
  GraphResponseSchema,
  HistoryResponseSchema,
  HistoryEventResponseSchema,
  NavigationResponseSchema,
  ProposalListResponseSchema,
  DurableProposalSchema,
  SearchResponseSchema,
  SessionResponseSchema,
  LocalSessionInputSchema,
  ApiErrorResponseSchema,
  DurableCreateProposalInputSchema,
  DurableUpdateProposalInputSchema,
  DurableProposalTransitionInputSchema,
  type DurableKnowledgeClient,
  type DurableProposalClient,
  type SessionClient,
  type RequestOptions,
  type MutationRequestOptions,
} from '@lorestra/contracts'
import { ApiError } from './errors'

type Parser<T> = { parse(value: unknown): T }

function query(input: object): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== null && value !== '')
      params.set(key, String(value))
  }
  return params.size ? `?${params}` : ''
}

export function createHttpClients(baseUrl: string): {
  knowledgeClient: DurableKnowledgeClient
  proposalClient: DurableProposalClient
  sessionClient: SessionClient
} {
  async function request<T>(
    path: string,
    parser: Parser<T>,
    init?: RequestInit,
  ): Promise<T> {
    let response: Response
    try {
      response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
        ...init,
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          accept: 'application/json',
          ...(init?.body ? { 'content-type': 'application/json' } : {}),
          ...init?.headers,
        },
      })
    } catch (error) {
      if (init?.signal?.aborted) throw error
      throw new ApiError(0, 'NETWORK_ERROR')
    }
    const json: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      const parsed = ApiErrorResponseSchema.safeParse(json)
      const code = parsed.success ? parsed.data.error.code : 'REQUEST_FAILED'
      const requestId = parsed.success
        ? parsed.data.error.requestId
        : (response.headers.get('x-request-id') ?? undefined)
      throw new ApiError(
        response.status,
        code,
        requestId,
        response.headers.get('retry-after') ?? undefined,
        parsed.success
          ? Object.fromEntries(
              Object.entries(parsed.data.error.details ?? {}).filter(
                ([key, value]) =>
                  ['baseVersion', 'currentVersion', 'currentProposalVersion'].includes(
                    key,
                  ) &&
                  typeof value === 'number' &&
                  Number.isSafeInteger(value) &&
                  value > 0,
              ),
            )
          : undefined,
      )
    }
    try {
      return parser.parse(json)
    } catch {
      throw new ApiError(
        502,
        'INVALID_RESPONSE',
        response.headers.get('x-request-id') ?? undefined,
      )
    }
  }
  async function nullable<T>(
    path: string,
    parser: Parser<T>,
    options?: RequestOptions,
  ): Promise<T | null> {
    try {
      return await request(path, parser, { signal: options?.signal })
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null
      throw error
    }
  }
  function write<T>(
    path: string,
    method: string,
    body: unknown,
    parser: Parser<T>,
    options: MutationRequestOptions,
  ) {
    if (!options?.idempotencyKey) throw new ApiError(400, 'IDEMPOTENCY_KEY_REQUIRED')
    return request(path, parser, {
      method,
      body: JSON.stringify(body),
      signal: options.signal,
      headers: {
        'idempotency-key': options.idempotencyKey,
        ...(options.csrfToken ? { 'x-csrf-token': options.csrfToken } : {}),
      },
    })
  }
  return {
    knowledgeClient: {
      getNavigation: (input = { locale: 'en' }, options) =>
        request(`/navigation${query(input)}`, NavigationResponseSchema, {
          signal: options?.signal,
        }),
      listDocuments: (input = { locale: 'en', limit: 20, sort: 'updated' }, options) =>
        request(`/documents${query(input)}`, DocumentListResponseSchema, {
          signal: options?.signal,
        }),
      getDocument: (input, options) =>
        nullable(
          `/documents/${encodeURIComponent(input.slug)}${query({ locale: input.locale, version: input.version })}`,
          DocumentResponseSchema,
          options,
        ),
      getDocumentById: (input, options) =>
        nullable(
          `/documents/by-id/${encodeURIComponent(input.documentId)}${query({ version: input.version })}`,
          DocumentResponseSchema,
          options,
        ),
      getGraph: (input = { scope: 'entire', locale: 'en' }, options) =>
        request(`/graph${query(input)}`, GraphResponseSchema, {
          signal: options?.signal,
        }),
      search: (input, options) =>
        request(`/search${query(input)}`, SearchResponseSchema, {
          signal: options?.signal,
        }),
      getHistory: (input = { limit: 20 }, options) =>
        request(`/history${query(input)}`, HistoryResponseSchema, {
          signal: options?.signal,
        }),
      getHistoryEvent: (input, options) =>
        nullable(
          `/history/${encodeURIComponent(input.eventId)}`,
          HistoryEventResponseSchema,
          options,
        ),
    },
    proposalClient: {
      list: (input = { limit: 20 }, options) =>
        request(`/proposals${query(input)}`, ProposalListResponseSchema, {
          signal: options?.signal,
        }),
      get: (input, options) =>
        nullable(
          `/proposals/${encodeURIComponent(input.proposalId)}`,
          DurableProposalSchema,
          options,
        ),
      create: (input, options) =>
        write(
          '/proposals',
          'POST',
          DurableCreateProposalInputSchema.parse(input),
          DurableProposalSchema,
          options,
        ),
      update: (input, options) =>
        write(
          `/proposals/${encodeURIComponent(input.proposalId)}`,
          'PATCH',
          DurableUpdateProposalInputSchema.parse(input),
          DurableProposalSchema,
          options,
        ),
      transition: (input, options) =>
        write(
          `/proposals/${encodeURIComponent(input.proposalId)}/status`,
          'PATCH',
          DurableProposalTransitionInputSchema.parse(input),
          DurableProposalSchema,
          options,
        ),
    },
    sessionClient: {
      getSession: (options) =>
        request('/session', SessionResponseSchema, { signal: options?.signal }),
      logout: (options) =>
        write('/session/logout', 'POST', {}, { parse: () => undefined }, options),
      login: (input, options) =>
        write(
          '/session',
          'POST',
          LocalSessionInputSchema.parse(input),
          SessionResponseSchema,
          options,
        ),
    },
  }
}
