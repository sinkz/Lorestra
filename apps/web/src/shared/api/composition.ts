import { createMockClients } from '@lorestra/mock-vault'

import type { AppClients } from '../model/types'
import {
  createKnowledgeAdapter,
  createProposalAdapter,
  type ProposalFileMetadata,
} from './client'
import { createHttpClients } from './http-clients'

/**
 * The sole adapter switch. Pages, features, query hooks, and UI components
 * consume the stable application clients and never import fixtures.
 */
export function createAppClients(): AppClients {
  const contractClients =
    import.meta.env.VITE_DATA_ADAPTER === 'http'
      ? createHttpClients(import.meta.env.VITE_LORESTRA_API_URL || '/api')
      : createMockClients()
  const knowledge = createKnowledgeAdapter(contractClients.knowledgeClient)
  const isMock = import.meta.env.VITE_DATA_ADAPTER !== 'http'

  return {
    knowledge,
    proposals: createProposalAdapter(contractClients.proposalClient, {
      resolveDocument: async (documentId, locale = 'en') => {
        const navigation = await knowledge.getNavigation({ locale })
        const document = navigation.documents.find((item) => item.id === documentId)
        return document ? { slug: document.slug, title: document.title } : undefined
      },
      resolveFiles: isMock
        ? (proposalId) => {
            const mock = contractClients as ReturnType<typeof createMockClients>
            return mock.store
              .findProposal(proposalId)
              ?.files.map((file): ProposalFileMetadata => ({
                path: file.path,
                changeType: file.changeType,
              }))
          }
        : undefined,
    }),
  }
}
