import type { QueryClient } from '@tanstack/react-query'
import type { MutationRequestOptions, SessionResponse } from '@lorestra/contracts'
import type { AppClients, Proposal } from '../model/types'
import { ApiError } from './errors'
import type { CrossTabInvalidationChannel } from './cross-tab'

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

export type QueryInvalidationKind = 'publication' | 'proposal'

/**
 * Mark only mutable projections stale. Historical document snapshots are
 * immutable and must not be replaced by a newer publication.
 */
export function invalidateClientQueries(
  queryClient: QueryClient,
  kind: QueryInvalidationKind,
): Promise<void> {
  return queryClient.invalidateQueries({
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
      if (kind !== 'publication') return false
      // Historical snapshots do not change; permission changes replace the
      // entire cache at the session boundary instead.
      if (
        (key === 'document' || key === 'document-by-id') &&
        queryKey.at(-1) !== 'current'
      )
        return false
      return typeof key === 'string' && publications.has(key)
    },
  })
}

export type MutationCoordinatorOptions = {
  crossTab?: Pick<CrossTabInvalidationChannel, 'publish'>
}

/** UI and native WebMCP share this single mutation/cache boundary. */
export function coordinateClients(
  clients: AppClients,
  queryClient: QueryClient,
  session: SessionResponse | (() => SessionResponse),
  refreshSession: () => void,
  coordinatorOptions: MutationCoordinatorOptions = {},
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
      const kind: QueryInvalidationKind =
        proposal.status === 'merged' ? 'publication' : 'proposal'
      // The server response is the commit point. Publishing the marker before
      // local refetch means another tab still refreshes if one local query
      // happens to fail after the write was accepted.
      try {
        coordinatorOptions.crossTab?.publish(kind)
      } catch {
        // A transport failure must never turn an already committed write into
        // a failed mutation. The local cache still invalidates below, and the
        // focus-refresh fallback covers browsers without BroadcastChannel.
      }
      await invalidateClientQueries(queryClient, kind)
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
