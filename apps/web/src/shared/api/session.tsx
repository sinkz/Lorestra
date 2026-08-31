import { createContext, useContext } from 'react'
import type { SessionResponse } from '@lorestra/contracts'

export const SessionContext = createContext<{
  session: SessionResponse
  logout: () => Promise<void>
  login: (token: string) => Promise<void>
} | null>(null)

export function useSession() {
  const value = useContext(SessionContext)
  if (!value) throw new Error('Session boundary is required.')
  return value
}

export function sessionScope(session: SessionResponse): string {
  return JSON.stringify([
    session.vaultId,
    session.principal?.id ?? 'visitor',
    session.principal?.role ?? 'visitor',
    session.capabilities,
    session.readOnly,
  ])
}
