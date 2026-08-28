import { canTransitionProposal } from '@lorestra/contracts'
import type { Proposal, ProposalStatus } from '@lorestra/contracts'

export type TransitionTarget = Exclude<ProposalStatus, 'open'>

export function canTransition(from: ProposalStatus, to: ProposalStatus): boolean {
  return canTransitionProposal(from, to)
}

export function transitionProposal(
  proposal: Proposal,
  target: TransitionTarget,
  now: string,
  reason?: string,
): Proposal {
  if (!canTransition(proposal.status, target)) {
    throw new Error(`Proposal cannot transition from ${proposal.status} to ${target}`)
  }
  if (target === 'changes_requested' && !reason?.trim()) {
    throw new Error('A reason is required when requesting changes')
  }
  if (
    target === 'merged' &&
    proposal.checks.some((check) => check.status !== 'passed')
  ) {
    throw new Error('All proposal checks must pass before merge')
  }
  return {
    ...proposal,
    status: target,
    updatedAt: now,
    discussionSummary: reason?.trim() || proposal.discussionSummary,
  }
}
