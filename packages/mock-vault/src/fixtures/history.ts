import { documents } from './documents'
import type { FixtureHistoryEvent } from './types'

const createdEvents: readonly FixtureHistoryEvent[] = documents.map((document) => ({
  id: `history-${document.id}-v${String(document.version).padStart(4, '0')}`,
  documentId: document.id,
  documentVersion: document.version,
  type: 'created',
  summary:
    document.locale === 'pt-BR'
      ? 'Documento adicionado ao vault de exemplo.'
      : 'Document added to the example vault.',
  actor: document.author,
  createdAt: document.createdAt,
}))

export const history: readonly FixtureHistoryEvent[] = [
  ...createdEvents,
  {
    id: 'history-incident-proposal-submitted-001',
    documentId: 'lorestra.engineering.incident-response',
    documentVersion: 1,
    type: 'proposal_submitted',
    summary: 'Escalation thresholds proposed for the incident runbook.',
    actor: 'ana.reliability',
    createdAt: '2026-08-25T13:20:00.000Z',
    proposalId: 'proposal-incident-runbook-001',
  },
  {
    id: 'history-reading-loop-proposal-approved-002',
    documentId: 'lorestra.docs.using-lorestra.en',
    documentVersion: 1,
    type: 'proposal_approved',
    summary: 'Reading checklist approved; publication still awaits merge.',
    actor: 'lina.editorial',
    createdAt: '2026-08-26T09:15:00.000Z',
    proposalId: 'proposal-docs-reading-loop-002',
  },
  {
    id: 'history-launch-proposal-approved-003',
    documentId: 'proposal-launch-cookbook-003',
    documentVersion: 0,
    type: 'proposal_approved',
    summary: 'New launch-readiness cookbook approved as a proposed file.',
    actor: 'rafa.platform',
    createdAt: '2026-08-28T08:30:00.000Z',
    proposalId: 'proposal-launch-cookbook-003',
  },
]
