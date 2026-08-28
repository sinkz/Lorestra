export { documents } from './documents'
export { intentionallyUnrepresentedVaultPaths } from './coverage'
export { folders } from './folders'
export { graphEdges, graphNodes } from './graph'
export { history } from './history'
export { proposals } from './proposals'
export type {
  FixtureDocument,
  FixtureDocumentKind,
  FixtureFolder,
  FixtureGraphEdge,
  FixtureGraphNode,
  FixtureHistoryEvent,
  FixtureHistoryEventType,
  FixtureLocale,
  FixtureProposal,
  FixtureProposalCheck,
  FixtureProposalCheckStatus,
  FixtureProposalFile,
  FixtureProposalKind,
  FixtureProposalRevision,
  FixtureProposalStatus,
  FixtureStatus,
  FixtureStoreData,
  FixtureVisibility,
} from './types'

import { documents } from './documents'
import { folders } from './folders'
import { history } from './history'
import { proposals } from './proposals'
import type { FixtureStoreData } from './types'

export const mockVaultData: FixtureStoreData = {
  folders,
  documents,
  proposals,
  history,
}
