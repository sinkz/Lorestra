import {
  DocumentResponseSchema,
  GraphResponseSchema,
  HistoryResponseSchema,
  NavigationResponseSchema,
  ProposalListResponseSchema,
  ProposalSchema,
  SearchResponseSchema,
  type CreateProposalInput,
  type GetDocumentInput,
  type GetProposalInput,
  type GraphInput,
  type HistoryInput,
  type KnowledgeClient,
  type ListProposalsInput,
  type NavigationInput,
  type ProposalClient,
  type ProposalTransitionInput,
  type SearchInput,
} from '@lorestra/contracts'

type Parser<T> = { parse(value: unknown): T }

function query(input: Record<string, unknown>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value))
    }
  }
  const encoded = params.toString()
  return encoded ? `?${encoded}` : ''
}

async function request<T>(
  baseUrl: string,
  path: string,
  parser: Parser<T>,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  if (!response.ok) {
    throw new Error(`Lorestra API request failed with ${response.status}.`)
  }
  return parser.parse(await response.json())
}

class HttpKnowledgeClient implements KnowledgeClient {
  public constructor(private readonly baseUrl: string) {}

  public getNavigation(input: NavigationInput = { locale: 'en' }) {
    return request(this.baseUrl, `/navigation${query(input)}`, NavigationResponseSchema)
  }

  public async getDocument(input: GetDocumentInput) {
    try {
      return await request(
        this.baseUrl,
        `/documents/${encodeURIComponent(input.slug)}${query({ locale: input.locale, version: input.version })}`,
        DocumentResponseSchema,
      )
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) return null
      throw error
    }
  }

  public getGraph(input: GraphInput = { scope: 'entire', locale: 'en' }) {
    return request(this.baseUrl, `/graph${query(input)}`, GraphResponseSchema)
  }

  public search(input: SearchInput) {
    return request(this.baseUrl, `/search${query(input)}`, SearchResponseSchema)
  }

  public getHistory(input: HistoryInput = { limit: 20 }) {
    return request(this.baseUrl, `/history${query(input)}`, HistoryResponseSchema)
  }
}

class HttpProposalClient implements ProposalClient {
  public constructor(private readonly baseUrl: string) {}

  public list(input: ListProposalsInput = { limit: 20 }) {
    return request(
      this.baseUrl,
      `/proposals${query(input)}`,
      ProposalListResponseSchema,
    )
  }

  public async get(input: GetProposalInput) {
    try {
      return await request(
        this.baseUrl,
        `/proposals/${encodeURIComponent(input.proposalId)}`,
        ProposalSchema,
      )
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) return null
      throw error
    }
  }

  public create(input: CreateProposalInput) {
    return request(this.baseUrl, '/proposals', ProposalSchema, {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  public transition(input: ProposalTransitionInput) {
    return request(
      this.baseUrl,
      `/proposals/${encodeURIComponent(input.proposalId)}/status`,
      ProposalSchema,
      { method: 'PATCH', body: JSON.stringify(input) },
    )
  }
}

export function createHttpClients(baseUrl: string): {
  knowledgeClient: KnowledgeClient
  proposalClient: ProposalClient
} {
  return {
    knowledgeClient: new HttpKnowledgeClient(baseUrl),
    proposalClient: new HttpProposalClient(baseUrl),
  }
}
