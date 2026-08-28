import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useAppClients } from './client'
import { useShellStore } from '../store/useShellStore'
import type {
  DocumentKind,
  DocumentStatus,
  HistoryEventType,
} from '../model/types'

export const queryKeys = {
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
  ) => ['history', documentId, locale, cursor ?? 'first', query ?? '', type ?? 'all'] as const,
  proposals: (status: string, locale: string, cursor?: string) =>
    ['proposals', status, locale, cursor ?? 'first'] as const,
  proposal: (id: string, locale: string) => ['proposal', id, locale] as const,
}

export function useLocale() {
  return useShellStore((state) => state.locale)
}

export function useNavigationQuery() {
  const clients = useAppClients()
  const locale = useLocale()
  return useQuery({
    queryKey: queryKeys.navigation(locale),
    queryFn: () => clients.knowledge.getNavigation({ locale }),
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
  return useQuery({
    queryKey: queryKeys.documents({ ...input, locale }),
    queryFn: () => clients.knowledge.listDocuments({ ...input, locale, limit: 50 }),
    placeholderData: keepPreviousData,
  })
}

export function useDocumentQuery(slug: string | undefined, version?: number) {
  const clients = useAppClients()
  const locale = useLocale()
  return useQuery({
    queryKey: queryKeys.document(slug ?? '', locale, version),
    queryFn: () => clients.knowledge.getDocument({ slug: slug ?? '', locale, version }),
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
  return useQuery({
    queryKey: queryKeys.graph(input.scope, input.documentId, input.folderId, locale),
    queryFn: () => clients.knowledge.getGraph({ ...input, locale }),
  })
}

export function useSearchQuery(query: string) {
  const clients = useAppClients()
  const locale = useLocale()
  return useQuery({
    queryKey: queryKeys.search(query, locale),
    queryFn: () => clients.knowledge.search({ query, locale, limit: 8 }),
    enabled: query.trim().length > 1,
  })
}

export function useHistoryQuery(
  documentId?: string,
  cursor?: string,
  query?: string,
  type?: HistoryEventType,
) {
  const clients = useAppClients()
  const locale = useLocale()
  return useQuery({
    queryKey: queryKeys.history(documentId, locale, cursor, query, type),
    queryFn: () =>
      clients.knowledge.getHistory({ documentId, locale, cursor, query, type }),
    placeholderData: keepPreviousData,
  })
}

export function useProposalsQuery(status: string, cursor?: string) {
  const clients = useAppClients()
  const locale = useLocale()
  return useQuery({
    queryKey: queryKeys.proposals(status, locale, cursor),
    queryFn: () =>
      clients.proposals.list({
        status: status === 'all' ? 'all' : (status as never),
        locale,
        cursor,
        limit: 30,
      }),
    placeholderData: keepPreviousData,
  })
}

export function useProposalQuery(id: string | undefined) {
  const clients = useAppClients()
  const locale = useLocale()
  return useQuery({
    queryKey: queryKeys.proposal(id ?? '', locale),
    queryFn: () => clients.proposals.get({ proposalId: id ?? '', locale }),
    enabled: Boolean(id),
  })
}
