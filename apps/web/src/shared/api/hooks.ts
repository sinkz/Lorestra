import { useQuery } from '@tanstack/react-query'
import { useAppClients } from './client'
import { useShellStore } from '../store/useShellStore'

export const queryKeys = {
  navigation: (locale: string) => ['navigation', locale] as const,
  document: (slug: string, locale: string, version?: number) =>
    ['document', slug, locale, version ?? 'current'] as const,
  graph: (
    scope: string,
    documentId: string | undefined,
    folderId: string | undefined,
    locale: string,
  ) => ['graph', scope, documentId, folderId, locale] as const,
  search: (query: string, locale: string) => ['search', query, locale] as const,
  history: (documentId: string | undefined, locale: string) =>
    ['history', documentId, locale] as const,
  proposals: (status: string, locale: string) => ['proposals', status, locale] as const,
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

export function useHistoryQuery(documentId?: string) {
  const clients = useAppClients()
  const locale = useLocale()
  return useQuery({
    queryKey: queryKeys.history(documentId, locale),
    queryFn: () => clients.knowledge.getHistory({ documentId, locale }),
  })
}

export function useProposalsQuery(status: string) {
  const clients = useAppClients()
  const locale = useLocale()
  return useQuery({
    queryKey: queryKeys.proposals(status, locale),
    queryFn: () =>
      clients.proposals.list({
        status: status === 'all' ? 'all' : (status as never),
        locale,
      }),
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
