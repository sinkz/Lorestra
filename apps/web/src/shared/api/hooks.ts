import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useSession, sessionScope } from './session'
import { useAppClients } from './client'
import { useShellStore } from '../store/useShellStore'
import type { DocumentKind, DocumentStatus, HistoryEventType } from '../model/types'

const queryKeys = {
  navigation: (locale: string) => ['navigation', locale] as const,
  documents: (input: {
    locale: string
    folderId?: string
    query?: string
    kind?: string
    status?: string
    sort?: string
    cursor?: string
  }) => ['documents', input] as const,
  document: (slug: string, locale: string, version?: number) =>
    ['document', slug, locale, version ?? 'current'] as const,
  graph: (
    scope: string,
    documentId: string | undefined,
    folderId: string | undefined,
    locale: string,
  ) => ['graph', scope, documentId, folderId, locale] as const,
  search: (query: string, locale: string) => ['search', query, locale] as const,
  history: (
    documentId: string | undefined,
    locale: string,
    cursor?: string,
    query?: string,
    type?: string,
  ) =>
    [
      'history',
      documentId,
      locale,
      cursor ?? 'first',
      query ?? '',
      type ?? 'all',
    ] as const,
  proposals: (status: string, locale: string, cursor?: string) =>
    ['proposals', status, locale, cursor ?? 'first'] as const,
  proposal: (id: string, locale: string) => ['proposal', id, locale] as const,
}

export function useLocale() {
  return useShellStore((state) => state.locale)
}

export function useNavigationQuery(input?: {
  parentId?: string
  cursor?: string
  limit?: number
}) {
  const clients = useAppClients()
  const locale = useLocale()
  const scope = sessionScope(useSession().session)
  return useQuery({
    queryKey: [scope, ...queryKeys.navigation(locale), input ?? {}],
    queryFn: ({ signal }) =>
      clients.knowledge.getNavigation({ locale, ...input }, { signal }),
  })
}

export function useDocumentsQuery(input: {
  folderId?: string
  query?: string
  kind?: Exclude<DocumentKind, 'folder'>
  status?: DocumentStatus
  sort?: 'updated' | 'title' | 'kind'
  cursor?: string
}) {
  const clients = useAppClients()
  const locale = useLocale()
  const scope = sessionScope(useSession().session)
  return useQuery({
    queryKey: [scope, ...queryKeys.documents({ ...input, locale })],
    queryFn: ({ signal }) =>
      clients.knowledge.listDocuments({ ...input, locale, limit: 50 }, { signal }),
    placeholderData: keepPreviousData,
  })
}

export function useDocumentQuery(slug: string | undefined, version?: number) {
  const clients = useAppClients()
  const locale = useLocale()
  const scope = sessionScope(useSession().session)
  return useQuery({
    queryKey: [scope, ...queryKeys.document(slug ?? '', locale, version)],
    queryFn: ({ signal }) =>
      clients.knowledge.getDocument({ slug: slug ?? '', locale, version }, { signal }),
    enabled: Boolean(slug),
  })
}

export function useGraphQuery(input: {
  scope: 'entire' | 'folder' | 'related'
  documentId?: string
  folderId?: string
}) {
  const clients = useAppClients()
  const locale = useLocale()
  const scope = sessionScope(useSession().session)
  return useQuery({
    queryKey: [
      scope,
      ...queryKeys.graph(input.scope, input.documentId, input.folderId, locale),
    ],
    queryFn: ({ signal }) =>
      clients.knowledge.getGraph({ ...input, locale }, { signal }),
  })
}

export function useSearchQuery(query: string) {
  const clients = useAppClients()
  const locale = useLocale()
  const scope = sessionScope(useSession().session)
  return useQuery({
    queryKey: [scope, ...queryKeys.search(query, locale)],
    queryFn: ({ signal }) =>
      clients.knowledge.search({ query, locale, limit: 8 }, { signal }),
    enabled: query.trim().length > 1,
  })
}

export function useHistoryQuery(
  documentId?: string,
  cursor?: string,
  query?: string,
  type?: HistoryEventType,
  enabled = true,
) {
  const clients = useAppClients()
  const locale = useLocale()
  const scope = sessionScope(useSession().session)
  return useQuery({
    queryKey: [scope, ...queryKeys.history(documentId, locale, cursor, query, type)],
    queryFn: ({ signal }) =>
      clients.knowledge.getHistory(
        { documentId, locale, cursor, query, type },
        { signal },
      ),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useProposalsQuery(status: string, cursor?: string) {
  const clients = useAppClients()
  const locale = useLocale()
  const scope = sessionScope(useSession().session)
  return useQuery({
    queryKey: [scope, ...queryKeys.proposals(status, locale, cursor)],
    queryFn: ({ signal }) =>
      clients.proposals.list(
        {
          status: status === 'all' ? 'all' : (status as never),
          locale,
          cursor,
          limit: 30,
        },
        { signal },
      ),
    placeholderData: keepPreviousData,
  })
}

export function useProposalQuery(id: string | undefined) {
  const clients = useAppClients()
  const locale = useLocale()
  const scope = sessionScope(useSession().session)
  return useQuery({
    queryKey: [scope, ...queryKeys.proposal(id ?? '', locale)],
    queryFn: ({ signal }) =>
      clients.proposals.get({ proposalId: id ?? '', locale }, { signal }),
    enabled: Boolean(id),
  })
}

export function useDocumentByIdQuery(documentId?: string, version?: number) {
  const clients = useAppClients()
  const locale = useLocale()
  const scope = sessionScope(useSession().session)
  return useQuery({
    queryKey: [scope, 'document-by-id', documentId, locale, version ?? 'current'],
    queryFn: ({ signal }) =>
      clients.knowledge.getDocumentById(
        { documentId: documentId ?? '', locale, version },
        { signal },
      ),
    enabled: Boolean(documentId),
  })
}

export function useHistoryEventQuery(eventId?: string) {
  const clients = useAppClients()
  const locale = useLocale()
  const scope = sessionScope(useSession().session)
  return useQuery({
    queryKey: [scope, 'history-event', eventId, locale],
    queryFn: ({ signal }) =>
      clients.knowledge.getHistoryEvent({ eventId: eventId ?? '', locale }, { signal }),
    enabled: Boolean(eventId),
  })
}
