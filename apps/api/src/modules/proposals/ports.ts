import type {
  GetProposalInput,
  ListProposalsInput,
  Proposal,
  ProposalListResponse,
} from '@lorestra/contracts'

export interface ProposalReader {
  list(input: ListProposalsInput): Promise<ProposalListResponse>
  get(input: GetProposalInput): Promise<Proposal | null>
}
