import { canTransition, transitionProposal } from './transition.js'
import type { Proposal } from '@lorestra/contracts'

const proposal: Proposal = {
  id: 'proposal-1',
  title: 'Update document',
  summary: 'Clarify the document.',
  status: 'open',
  author: { id: 'author-1', name: 'Lorestra' },
  createdAt: '2026-08-28T00:00:00.000Z',
  updatedAt: '2026-08-28T00:00:00.000Z',
  changeCount: 1,
  createsDocument: false,
  changes: [
    {
      id: 'change-1',
      target: {
        documentId: 'doc-1',
        slug: 'what-is-lorestra',
        title: 'What is Lorestra?',
      },
      changeType: 'modified',
      before: 'old',
      after: 'new',
    },
  ],
  checks: [{ name: 'Contract validation', status: 'passed' }],
  discussionSummary: 'Ready for review.',
}

describe('proposal transition policy', () => {
  it('allows review then merge, but never changes a merged proposal', () => {
    const allowed = [
      ['open', 'changes_requested'],
      ['open', 'approved'],
      ['changes_requested', 'open'],
      ['changes_requested', 'approved'],
      ['approved', 'merged'],
    ] as const
    const rejected = [
      ['open', 'merged'],
      ['changes_requested', 'merged'],
      ['approved', 'open'],
      ['approved', 'changes_requested'],
      ['merged', 'open'],
      ['merged', 'changes_requested'],
      ['merged', 'approved'],
      ['merged', 'merged'],
    ] as const

    for (const [from, to] of allowed) expect(canTransition(from, to)).toBe(true)
    for (const [from, to] of rejected) expect(canTransition(from, to)).toBe(false)

    expect(() =>
      transitionProposal(
        { ...proposal, status: 'merged' },
        'approved',
        '2026-08-28T01:00:00.000Z',
      ),
    ).toThrow('cannot transition from merged to approved')
  })

  it('requires a reason for requested changes and passing checks for merge', () => {
    expect(() =>
      transitionProposal(proposal, 'changes_requested', '2026-08-28T00:00:00.000Z'),
    ).toThrow('reason is required')
    const approved = transitionProposal(
      proposal,
      'approved',
      '2026-08-28T00:00:00.000Z',
    )
    expect(approved.status).toBe('approved')
    const merged = transitionProposal(approved, 'merged', '2026-08-28T00:00:00.000Z')
    expect(merged.status).toBe('merged')
  })

  it('rejects whitespace-only review reasons and preserves a trimmed rationale', () => {
    expect(() =>
      transitionProposal(
        proposal,
        'changes_requested',
        '2026-08-28T01:00:00.000Z',
        '   ',
      ),
    ).toThrow('reason is required')

    const changed = transitionProposal(
      proposal,
      'changes_requested',
      '2026-08-28T01:00:00.000Z',
      '  Add the missing evidence.  ',
    )
    expect(changed).toMatchObject({
      status: 'changes_requested',
      updatedAt: '2026-08-28T01:00:00.000Z',
      discussionSummary: 'Add the missing evidence.',
    })
  })

  it('blocks merge while any check is not passed and retains the prior summary otherwise', () => {
    for (const status of ['pending', 'failed'] as const) {
      expect(() =>
        transitionProposal(
          {
            ...proposal,
            status: 'approved',
            checks: [{ name: 'Contract validation', status }],
          },
          'merged',
          '2026-08-28T02:00:00.000Z',
        ),
      ).toThrow('checks must pass')
    }

    expect(
      transitionProposal(
        {
          ...proposal,
          checks: [{ name: 'Advisory check', status: 'failed' }],
        },
        'approved',
        '2026-08-28T01:30:00.000Z',
      ).status,
    ).toBe('approved')

    expect(() =>
      transitionProposal(
        {
          ...proposal,
          status: 'approved',
          checks: [
            { name: 'Contract validation', status: 'passed' },
            { name: 'Broken links', status: 'failed' },
          ],
        },
        'merged',
        '2026-08-28T02:00:00.000Z',
      ),
    ).toThrow('checks must pass')

    const merged = transitionProposal(
      { ...proposal, status: 'approved' },
      'merged',
      '2026-08-28T02:00:00.000Z',
    )
    expect(merged).toMatchObject({
      status: 'merged',
      updatedAt: '2026-08-28T02:00:00.000Z',
      discussionSummary: proposal.discussionSummary,
    })
  })
})
