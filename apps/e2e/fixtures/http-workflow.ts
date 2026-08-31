import { randomUUID } from 'node:crypto'

import {
  DocumentResponseSchema,
  DurableProposalSchema,
  type Document,
  type DurableCreateProposalInput,
  type DurableProposal,
  type DurableProposalChangeInput,
} from '@lorestra/contracts'
import { expect } from '@playwright/test'

import type { actors, BackendRuntime } from './backend'

export function changeDocument(
  document: Document,
  body: string,
): DurableProposalChangeInput {
  if (!document.folderId)
    throw new Error('A persisted document must retain its folder identity')
  return {
    id: randomUUID(),
    target: { documentId: document.id, slug: document.slug, title: document.title },
    changeType: 'modified',
    baseVersion: document.version,
    after: body,
    metadata: {
      type: document.type,
      folderId: document.folderId,
      tags: document.tags,
      relations: document.relations,
      visibility: document.visibility,
      status: document.status,
      locale: document.locale,
    },
  }
}

export async function readDocument(
  backend: BackendRuntime,
  slug = 'demo-orion-runbook',
  actor?: keyof typeof actors,
  version?: number,
) {
  const response = await backend.request(
    `/documents/${slug}?locale=en${version ? `&version=${version}` : ''}`,
    actor,
  )
  expect(response.status).toBe(200)
  return DocumentResponseSchema.parse(await response.json()).document
}

export async function readProposal(
  backend: BackendRuntime,
  id: string,
  actor: keyof typeof actors = 'morgan',
) {
  const response = await backend.request(`/proposals/${id}`, actor)
  expect(response.status).toBe(200)
  return DurableProposalSchema.parse(await response.json())
}

export async function createProposal(
  backend: BackendRuntime,
  input: DurableCreateProposalInput,
  actor: keyof typeof actors = 'casey',
  key = randomUUID(),
) {
  const response = await backend.request('/proposals', actor, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': key },
    body: JSON.stringify(input),
  })
  expect(response.status).toBe(200)
  return DurableProposalSchema.parse(await response.json())
}

export async function transitionProposal(
  backend: BackendRuntime,
  proposal: DurableProposal,
  status: 'approved' | 'merged',
  actor: keyof typeof actors = 'morgan',
) {
  const response = await backend.request(`/proposals/${proposal.id}/status`, actor, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'idempotency-key': randomUUID() },
    body: JSON.stringify({
      proposalId: proposal.id,
      expectedProposalVersion: proposal.proposalVersion,
      status,
      ...(status === 'merged'
        ? {
            confirmation: {
              proposalId: proposal.id,
              proposalVersion: proposal.proposalVersion,
              contentHash: proposal.contentHash,
            },
          }
        : {}),
    }),
  })
  expect(response.status).toBe(200)
  return DurableProposalSchema.parse(await response.json())
}
