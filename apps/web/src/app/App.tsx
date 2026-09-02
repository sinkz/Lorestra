import { useCallback, useEffect, useRef, useState } from 'react'
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query'
import type { SessionResponse } from '@lorestra/contracts'
import { I18nextProvider } from 'react-i18next'
import { RouterProvider } from 'react-router'
import { createAppRouter } from './router'
import { createI18n } from '../shared/i18n'
import { ClientProvider } from '../shared/api/client'
import { createAppClients } from '../shared/api/composition'
import { coordinateClients, invalidateClientQueries } from '../shared/api/coordinator'
import {
  createCrossTabInvalidationChannel,
  type CrossTabInvalidation,
} from '../shared/api/cross-tab'
import { SessionContext, sessionScope } from '../shared/api/session'
import { ApiError } from '../shared/api/errors'
import { ErrorState, LoadingState } from '../shared/ui'
import { registerLorestraWebMcpTools } from '../features/webmcp/register'
import { createMergeConfirmationController } from '../features/webmcp/confirmation'
import { WebMcpConfirmationDialog } from '../features/webmcp/WebMcpConfirmationDialog'
import { useShellStore } from '../shared/store/useShellStore'

const sessionQueries = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 0, refetchOnWindowFocus: 'always' },
  },
})
const i18n = createI18n()
const clientsPromise = createAppClients()
const router = createAppRouter()

function clearVaultDrafts(vaultId: string, principalId: string | undefined) {
  try {
    const prefix = `lorestra-draft:${vaultId}:${principalId ?? 'visitor'}:`
    for (const key of Object.keys(localStorage))
      if (key.startsWith(prefix)) localStorage.removeItem(key)
  } catch {
    /* Device storage may be unavailable. No session token is stored here. */
  }
}

function SessionGate() {
  const clients = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsPromise,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
  const session = useQuery({
    queryKey: ['session'],
    enabled: Boolean(clients.data),
    queryFn: ({ signal }) => clients.data!.session!.getSession({ signal }),
    refetchInterval: 60_000,
  })
  const refetchSession = session.refetch
  const refreshSession = useCallback(() => void refetchSession(), [refetchSession])
  useEffect(() => {
    if (!session.data?.expiresAt) return
    const timeout = window.setTimeout(
      () => void refetchSession(),
      Math.max(0, new Date(session.data.expiresAt).getTime() - Date.now()),
    )
    return () => window.clearTimeout(timeout)
  }, [session.data?.expiresAt, refetchSession])
  if (clients.isError || (session.isError && !session.data))
    return (
      <ErrorState
        error={clients.error ?? session.error}
        onRetry={() => {
          void clients.refetch()
          void session.refetch()
        }}
      />
    )
  if (!clients.data || !session.data) return <LoadingState />
  return (
    <WorkspaceSession
      key={sessionScope(session.data)}
      session={session.data}
      clients={clients.data}
      refresh={refreshSession}
    />
  )
}

function WorkspaceSession({
  session,
  clients,
  refresh,
}: {
  session: SessionResponse
  clients: Awaited<ReturnType<typeof createAppClients>>
  refresh: () => void
}) {
  const sessionRef = useRef(session)
  sessionRef.current = session
  // A principal/policy change remounts this boundary. No previous user's placeholder cache survives.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error) => {
            if (
              error instanceof ApiError &&
              (error.status === 401 || error.status === 403)
            ) {
              if (error.status === 401) {
                void queryClient.cancelQueries()
                queryClient.clear()
              }
              refresh()
            }
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: 'always',
            retry: (count, error) =>
              count < 1 && (!(error instanceof ApiError) || error.status >= 500),
          },
        },
      }),
  )
  const [mergeConfirmation] = useState(createMergeConfirmationController)
  // Keep the coordinator side-effect free during StrictMode's discarded
  // render. The real BroadcastChannel is created and closed by the effect.
  const crossTabRef = useRef<ReturnType<
    typeof createCrossTabInvalidationChannel
  > | null>(null)
  const crossTabBridge = useRef({
    publish: (kind: CrossTabInvalidation['kind']) => crossTabRef.current?.publish(kind),
  }).current
  const [coordinated] = useState(() =>
    coordinateClients(clients, queryClient, () => sessionRef.current, refresh, {
      crossTab: crossTabBridge,
    }),
  )
  useEffect(() => {
    let active = true
    const clearSession = (clearDraft: boolean) => {
      // A principal change invalidates private cache, the old principal's
      // local drafts, and any native confirmation for the old session.
      mergeConfirmation.cancel()
      if (clearDraft)
        clearVaultDrafts(session.vaultId, sessionRef.current.principal?.id)
      void queryClient
        .cancelQueries()
        .catch(() => undefined)
        .then(() => {
          if (!active) return
          queryClient.clear()
          refresh()
        })
    }
    const handleSignal = async (signal: CrossTabInvalidation) => {
      if (signal.kind === 'session') {
        mergeConfirmation.cancel()
        let principalChanged = false
        try {
          const current = await clients.session?.getSession()
          principalChanged =
            !current || sessionScope(current) !== sessionScope(sessionRef.current)
        } catch {
          // The cache is still cleared below, while the session query retries;
          // preserve the local draft until a changed principal is confirmed.
        }
        if (active) clearSession(principalChanged)
        return
      }
      // Cookies can change in another tab before this tab's SessionGate has
      // observed it. Verify our authority before refetching private queries.
      try {
        const current = await clients.session?.getSession()
        if (!active) return
        if (!current || sessionScope(current) !== sessionScope(sessionRef.current)) {
          clearSession(true)
          return
        }
        await invalidateClientQueries(queryClient, signal.kind)
      } catch {
        // Keep the current snapshot/draft and let the session query retry; an
        // authority check that cannot complete must not trigger blind refetch.
        if (active) refresh()
      }
    }
    const channel = createCrossTabInvalidationChannel(session.vaultId, (signal) => {
      void handleSignal(signal)
    })
    crossTabRef.current = channel
    return () => {
      active = false
      if (crossTabRef.current === channel) crossTabRef.current = null
      channel.close()
    }
  }, [clients, mergeConfirmation, queryClient, refresh, session.vaultId])
  useEffect(() => {
    const controller = new AbortController()
    const registration = registerLorestraWebMcpTools(
      document,
      coordinated,
      () => useShellStore.getState().locale,
      controller.signal,
      mergeConfirmation,
      { readOnly: session.principal === null || session.readOnly.enabled },
    )
    return () => {
      controller.abort()
      void registration.then((result) => result.dispose())
      void queryClient.cancelQueries()
      queryClient.clear()
    }
  }, [
    coordinated,
    queryClient,
    mergeConfirmation,
    session.principal,
    session.readOnly.enabled,
  ])
  const logout = async () => {
    await clients.session!.logout({
      idempotencyKey: crypto.randomUUID(),
      csrfToken: session.csrfToken ?? undefined,
    })
    await queryClient.cancelQueries()
    queryClient.clear()
    clearVaultDrafts(session.vaultId, session.principal?.id)
    crossTabBridge.publish('session')
    refresh()
  }
  const login = async (token: string) => {
    if (!clients.session?.login) return
    await clients.session.login(
      { token },
      {
        idempotencyKey: crypto.randomUUID(),
        csrfToken: session.csrfToken ?? undefined,
      },
    )
    crossTabBridge.publish('session')
    refresh()
  }
  return (
    <SessionContext.Provider value={{ session, logout, login }}>
      <QueryClientProvider client={queryClient}>
        <ClientProvider clients={coordinated}>
          <RouterProvider router={router} />
          <WebMcpConfirmationDialog controller={mergeConfirmation} />
        </ClientProvider>
      </QueryClientProvider>
    </SessionContext.Provider>
  )
}

export function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={sessionQueries}>
        <SessionGate />
      </QueryClientProvider>
    </I18nextProvider>
  )
}
