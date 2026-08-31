import type { QueryClient } from '@tanstack/react-query'
import type { MutationRequestOptions, SessionResponse } from '@lorestra/contracts'
import type { AppClients, Proposal } from '../model/types'
import { ApiError } from './errors'

const publications = new Set([
  'documents',
  'document',
  'document-by-id',
  'navigation',
  'graph',
  'search',
  'history',
  'history-event',
])

/** UI and native WebMCP share this single mutation/cache boundary. */
export function coordinateClients(
  clients: AppClients,
  queryClient: QueryClient,
  session: SessionResponse | (() => SessionResponse),
  refreshSession: () => void,
): AppClients {
  // Keep uncertain operations stable for explicit retry, never queue/replay automatically.
  const pendingKeys = new Map<string, string>()
  async function mutate(
    operation: string,
    input: unknown,
    run: (options: MutationRequestOptions) => Promise<Proposal>,
    options?: MutationRequestOptions,
  ) {
    const fingerprint = operation + JSON.stringify(input)
    const idempotencyKey =
      options?.idempotencyKey ?? pendingKeys.get(fingerprint) ?? crypto.randomUUID()
    pendingKeys.set(fingerprint, idempotencyKey)
    try {
      const proposal = await run({
        ...options,
        idempotencyKey,
        csrfToken:
          (typeof session === 'function' ? session() : session).csrfToken ?? undefined,
      })
      pendingKeys.delete(fingerprint)
      await queryClient.invalidateQueries({
        predicate: ({ queryKey }) => {
          const key = queryKey.find(
            (part) =>
              typeof part === 'string' &&
              (publications.has(part) || part === 'proposal' || part === 'proposals'),
          )
          if (
            key === 'proposal' ||
            key === 'proposals' ||
            key === 'history' ||
            key === 'history-event'
          )
            return true
          if (proposal.status !== 'merged') return false
          // Historical snapshots do not change; permission changes replace the entire cache.
          if (
            (key === 'document' || key === 'document-by-id') &&
            queryKey.at(-1) !== 'current'
          )
            return false
          return typeof key === 'string' && publications.has(key)
        },
      })
      return proposal
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        await queryClient.cancelQueries()
        queryClient.clear()
        refreshSession()
      }
      throw error
    }
  }
  return {
    ...clients,
    proposals: {
      ...clients.proposals,
      create: (input, options) =>
        mutate(
          'create',
          input,
          (request) => clients.proposals.create(input, request),
          options,
        ),
      update: (input, options) =>
        mutate(
          'update',
          input,
          (request) => clients.proposals.update(input, request),
          options,
        ),
      transition: (input, options) =>
        mutate(
          'transition',
          input,
          (request) => clients.proposals.transition(input, request),
          options,
        ),
    },
  }
}
