import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { RouterProvider } from 'react-router'
import { createAppRouter } from './router'
import { createI18n } from '../shared/i18n'
import { ClientProvider } from '../shared/api/client'
import { createAppClients } from '../shared/api/composition'
import { registerLorestraWebMcpTools } from '../features/webmcp/register'
import { useShellStore } from '../shared/store/useShellStore'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

const i18n = createI18n()
const clients = createAppClients()
const router = createAppRouter()

const webMcpRegistration = registerLorestraWebMcpTools(
  document,
  clients,
  () => useShellStore.getState().locale,
)

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    void webMcpRegistration.then((registration) => registration.dispose())
  })
}

export function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <ClientProvider clients={clients}>
          <RouterProvider router={router} />
        </ClientProvider>
      </QueryClientProvider>
    </I18nextProvider>
  )
}
