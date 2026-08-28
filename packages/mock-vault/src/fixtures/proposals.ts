import { documents } from './documents'
import type { FixtureProposal } from './types'

const documentById = (id: string) => {
  const found = documents.find((item) => item.id === id)
  if (!found) {
    throw new Error(`Fixture document not found: ${id}`)
  }
  return found
}

const incident = documentById('lorestra.engineering.incident-response')
const usingLorestra = documentById('lorestra.docs.using-lorestra.en')

export const proposals: readonly FixtureProposal[] = [
  {
    id: 'proposal-incident-runbook-001',
    title: 'Add escalation thresholds to the incident runbook',
    summary:
      'Clarify when an incident owner should page the reliability guild and when a follow-up proposal is required.',
    targetDocumentId: incident.id,
    kind: 'update',
    status: 'open',
    author: 'ana.reliability',
    reviewers: ['rafa.platform', 'marina.security'],
    createdAt: '2026-08-25T13:20:00.000Z',
    updatedAt: '2026-08-27T16:40:00.000Z',
    baseVersion: incident.version,
    proposed: {
      title: incident.title,
      description: incident.description,
      slug: incident.slug,
      locale: incident.locale,
      folderId: incident.folderId,
      tags: [...incident.tags, 'escalation'],
      relatedDocumentIds: [
        ...incident.relatedDocumentIds,
        'lorestra.team.security-escalation',
      ],
      content: `${incident.content}\n\n## Escalation thresholds\n\nPage the reliability owner when customer impact is confirmed, the mitigation is not reversible, or the owner cannot establish a next check within fifteen minutes. Create a follow-up proposal for every material change to the runbook.`,
    },
    files: [
      {
        path: 'vault/Engineering/incident-response.md',
        changeType: 'modified',
        additions: 6,
        deletions: 0,
      },
    ],
    checks: [
      { name: 'Contract validation', status: 'passed' },
      { name: 'Human review', status: 'pending' },
    ],
    comments: [
      'Please link the escalation owner to the security escalation procedure before approval.',
      'The base version is still current; no merge has happened.',
    ],
  },
  {
    id: 'proposal-docs-reading-loop-002',
    title: 'Make the reading loop explicit in the Docs guide',
    summary:
      'Add a short checklist for readers who need context quickly and for contributors who want to leave a useful trail.',
    targetDocumentId: usingLorestra.id,
    kind: 'update',
    status: 'approved',
    author: 'joao.product',
    reviewers: ['lina.editorial'],
    createdAt: '2026-08-21T11:10:00.000Z',
    updatedAt: '2026-08-26T09:15:00.000Z',
    baseVersion: usingLorestra.version,
    proposed: {
      title: usingLorestra.title,
      description: usingLorestra.description,
      slug: usingLorestra.slug,
      locale: usingLorestra.locale,
      folderId: usingLorestra.folderId,
      tags: [...usingLorestra.tags, 'checklist'],
      relatedDocumentIds: usingLorestra.relatedDocumentIds,
      content: `${usingLorestra.content}\n\n## Reader checklist\n\nBefore acting, check the document version, owner, evidence links, and related decisions. If the answer is incomplete, open a proposal with the missing context instead of patching the published body.`,
    },
    files: [
      {
        path: 'vault/Docs/en/using-lorestra.md',
        changeType: 'modified',
        additions: 5,
        deletions: 0,
      },
    ],
    checks: [
      { name: 'Contract validation', status: 'passed' },
      { name: 'Human review', status: 'passed' },
    ],
    comments: [
      'Approved: the checklist makes the public reading path more actionable.',
    ],
  },
  {
    id: 'proposal-launch-cookbook-003',
    title: 'Add a launch-readiness cookbook',
    summary:
      'Create a worked example that links product intent, test evidence, ownership, and rollback context.',
    targetDocumentId: null,
    kind: 'create',
    status: 'approved',
    author: 'carlos.delivery',
    reviewers: ['joao.product', 'rafa.platform'],
    createdAt: '2026-08-23T08:30:00.000Z',
    updatedAt: '2026-08-28T08:30:00.000Z',
    baseVersion: null,
    proposed: {
      title: 'Cookbook: launch readiness',
      description: 'A worked example of making a knowledge surface ready to ship.',
      slug: 'cookbook-launch-readiness',
      locale: 'en',
      folderId: 'folder.docs.en',
      tags: ['cookbook', 'launch', 'quality'],
      relatedDocumentIds: [
        'lorestra.product.launch-readiness',
        'lorestra.engineering.mock-removal',
      ],
      content:
        'Use this cookbook when a knowledge surface is ready for a deliberate launch. Link the product intent, the contract seam, the browser smoke scenarios, the owner for unresolved risks, and the rollback decision.\n\nApproval means the proposed content is coherent; merge is still required before readers see the new document.',
    },
    files: [
      {
        path: 'vault/Docs/en/cookbooks/launch-readiness.md',
        changeType: 'added',
        additions: 7,
        deletions: 0,
      },
    ],
    checks: [
      { name: 'Contract validation', status: 'passed' },
      { name: 'Human review', status: 'passed' },
    ],
    comments: [
      'The new-file diff is intentionally shown in full so a reviewer can assess it without opening another tool.',
    ],
  },
]
