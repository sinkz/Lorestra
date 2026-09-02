import type { SessionResponse } from '@lorestra/contracts'
import type { AppClients } from '../model/types'
import { createKnowledgeAdapter, createProposalAdapter } from './client'
import { createHttpClients } from './http-clients'

/** Only this build-time branch can load demonstration fixtures. HTTP never falls back. */
export async function createAppClients(): Promise<AppClients> {
  const publicReadOnly = import.meta.env.MODE === 'public'
  if (
    publicReadOnly ||
    import.meta.env.VITE_DATA_ADAPTER === 'mock' ||
    (import.meta.env.DEV && !import.meta.env.VITE_DATA_ADAPTER)
  ) {
    const { createMockClients } = await import('@lorestra/mock-vault')
    const mock = createMockClients()
    const session: SessionResponse = {
      vaultId: 'lorestra-vault',
      principal: publicReadOnly
        ? null
        : { id: 'local-human', name: 'Local demo', role: 'maintainer' },
      capabilities: publicReadOnly
        ? {
            readPublic: true,
            readInternal: false,
            // Public proposal data is fictional and intentionally inspectable.
            // Mutations remain disabled and are not registered through WebMCP.
            readProposals: true,
            createProposal: false,
            editOwnProposal: false,
            editAnyProposal: false,
            reviewProposal: false,
            mergeProposal: false,
            manageVault: false,
          }
        : {
            readPublic: true,
            readInternal: true,
            readProposals: true,
            createProposal: true,
            editOwnProposal: true,
            editAnyProposal: true,
            reviewProposal: true,
            mergeProposal: true,
            manageVault: true,
          },
      mode: 'mock',
      csrfToken: null,
      expiresAt: null,
      readOnly: publicReadOnly
        ? { enabled: true, reason: null }
        : { enabled: false, reason: null },
      limits: {
        maxDocumentBytes: 65536,
        maxProposalBytes: 262144,
        maxFilesPerProposal: 20,
        maxOpenProposals: 100,
        maxRequestsPerMinute: 240,
        maxWritesPerMinute: 60,
      },
    }
    return {
      knowledge: createKnowledgeAdapter(mock.knowledgeClient),
      proposals: createProposalAdapter(mock.proposalClient),
      session: { getSession: async () => session, logout: async () => undefined },
    }
  }
  const http = createHttpClients(import.meta.env.VITE_LORESTRA_API_URL || '/api')
  return {
    knowledge: createKnowledgeAdapter(http.knowledgeClient),
    proposals: createProposalAdapter(http.proposalClient),
    session: http.sessionClient,
  }
}
