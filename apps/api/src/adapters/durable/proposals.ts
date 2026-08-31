import {
  canEditProposal,
  canTransitionProposal,
  DocumentSchema,
  DurableCreateProposalInputSchema,
  DurableProposalSchema,
  DurableProposalTransitionInputSchema,
  DurableUpdateProposalInputSchema,
  type DurableCreateProposalInput,
  type DurableProposal,
  type DurableProposalTransitionInput,
  type DurableUpdateProposalInput,
  type HistoryEvent,
  type Principal,
  type Author,
} from '@lorestra/contracts'

import { ApiError } from '../../app/errors.js'
import { documentStatements } from './documents.js'
import type { Identity } from './identity.js'
import type { StorageBindings } from './primitives.js'
import {
  addedDocumentId,
  beginOperation,
  commitOperation,
  contentHash,
  editableBy,
  enforcePayloadLimits,
  expectProposalVersion,
  prepareChanges,
  readStoredProposal,
  replayOperation,
  type Operation,
  type PreparedChanges,
  type ProposalResult,
} from './proposal-storage.js'

function now(): string {
  return new Date().toISOString()
}

function storedInput(proposal: DurableProposal): DurableCreateProposalInput {
  return {
    title: proposal.title,
    summary: proposal.summary,
    ...(proposal.reason ? { reason: proposal.reason } : {}),
    changes: proposal.changes.map(
      ({ id, target, path, changeType, baseVersion, after, metadata }) => ({
        id,
        target,
        changeType,
        baseVersion,
        after,
        metadata,
        ...(path ? { path } : {}),
      }),
    ),
  }
}

async function proposalStatements(
  env: StorageBindings,
  proposal: DurableProposal,
): Promise<D1PreparedStatement[]> {
  const payload = JSON.stringify(proposal)
  const targets = await Promise.all(
    proposal.changes.map(
      (change) => change.target.documentId ?? addedDocumentId(proposal.id, change.id),
    ),
  )
  return [
    env.DB.prepare(
      `INSERT INTO proposals(id,version,status,author_id,updated_at,payload_json,content_hash) VALUES(?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET version=excluded.version,status=excluded.status,updated_at=excluded.updated_at,payload_json=excluded.payload_json,content_hash=excluded.content_hash`,
    ).bind(
      proposal.id,
      proposal.proposalVersion,
      proposal.status,
      proposal.author.id,
      proposal.updatedAt,
      payload,
      proposal.contentHash,
    ),
    env.DB.prepare(
      'INSERT INTO proposal_versions(proposal_id,version,payload_json) VALUES(?,?,?)',
    ).bind(proposal.id, proposal.proposalVersion, payload),
    env.DB.prepare('DELETE FROM proposal_targets WHERE proposal_id=?').bind(
      proposal.id,
    ),
    ...targets.map((id) =>
      env.DB.prepare(
        'INSERT INTO proposal_targets(proposal_id,document_id) VALUES(?,?)',
      ).bind(proposal.id, id),
    ),
  ]
}

function historyStatement(
  env: StorageBindings,
  proposal: DurableProposal,
  actor: Principal,
  type: HistoryEvent['type'],
  details: {
    documentId?: string
    documentSlug?: string
    resultingVersion?: number
    locale?: string
    reason?: string
    requestId?: string
  } = {},
): D1PreparedStatement {
  const event: HistoryEvent = {
    id: `event-${crypto.randomUUID()}`,
    type,
    occurredAt: proposal.updatedAt,
    actor,
    proposalId: proposal.id,
    documentId: details.documentId ?? null,
    documentSlug: details.documentSlug ?? null,
    resultingVersion: details.resultingVersion ?? null,
    summary:
      `${type.replaceAll('_', ' ')}: ${proposal.title}${details.reason ? ` — ${details.reason}` : ''}`.slice(
        0,
        500,
      ),
  }
  return env.DB.prepare(
    'INSERT INTO history(id,occurred_at,type,proposal_id,document_id,locale,payload_json) VALUES(?,?,?,?,?,?,?)',
  ).bind(
    event.id,
    event.occurredAt,
    type,
    proposal.id,
    event.documentId,
    details.locale ?? null,
    JSON.stringify({
      ...event,
      proposalVersion: proposal.proposalVersion,
      ...(details.requestId ? { requestId: details.requestId } : {}),
      ...(details.reason ? { reason: details.reason } : {}),
    }),
  )
}

async function buildProposal(
  input: DurableCreateProposalInput,
  prepared: PreparedChanges,
  identity: {
    id: string
    version: number
    author: Author
    createdAt: string
    discussionSummary: string
  },
): Promise<DurableProposal> {
  const content = {
    title: input.title,
    summary: input.summary,
    changes: prepared.changes,
    ...(input.reason ? { reason: input.reason } : {}),
  }
  return DurableProposalSchema.parse({
    ...content,
    id: identity.id,
    proposalVersion: identity.version,
    author: identity.author,
    status: 'open',
    createdAt: identity.createdAt,
    updatedAt: now(),
    changeCount: prepared.changes.length,
    createsDocument: prepared.changes.some((change) => change.changeType === 'added'),
    checks: [{ name: 'Contract, references and base versions', status: 'passed' }],
    discussionSummary: identity.discussionSummary,
    approval: null,
    contentHash: await contentHash(content),
  })
}

async function preparePublication(
  env: StorageBindings,
  operation: Operation,
  proposal: DurableProposal,
  prepared: PreparedChanges,
): Promise<D1PreparedStatement[]> {
  const statements: D1PreparedStatement[] = []
  const relations: D1PreparedStatement[] = []
  for (const change of proposal.changes) {
    const previous = change.target.documentId
      ? prepared.before.get(change.target.documentId)
      : undefined
    const id =
      change.target.documentId ?? (await addedDocumentId(proposal.id, change.id))
    const deleted = change.changeType === 'deleted'
    const body = change.after ?? ''
    const plain = body
      .replace(/[#*_`>]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const document = DocumentSchema.parse({
      id,
      slug: change.target.slug,
      title: change.target.title,
      ...change.metadata,
      folderId: change.metadata.folderId,
      version: (previous?.version ?? 0) + 1,
      author: previous?.snapshot.author ?? operation.principal,
      createdAt: previous?.snapshot.createdAt ?? proposal.updatedAt,
      updatedAt: proposal.updatedAt,
      excerpt: plain.slice(0, 500),
      body,
      relationCount: deleted ? 0 : change.metadata.relations.length,
      relations: deleted ? [] : change.metadata.relations,
      nav: {
        visible: !deleted,
        parentId: change.metadata.folderId,
        order: previous?.snapshot.nav.order ?? 10,
      },
      deleted,
    })
    const path = prepared.paths.get(change.id)
    if (!path)
      throw new ApiError(
        'validation_error',
        'A canonical document path is required.',
        422,
      )
    // No D1 publication statement executes until every immutable body is ready.
    const preparedDocument = await documentStatements(
      env,
      document,
      change.metadata.folderId,
      path,
      proposal.reason ?? proposal.summary,
      deleted,
      null,
      { actor: operation.principal, proposalId: proposal.id },
    )
    statements.push(...preparedDocument.statements)
    relations.push(...preparedDocument.relations)
    if (deleted)
      relations.push(env.DB.prepare('DELETE FROM relations WHERE target_id=?').bind(id))
    statements.push(
      historyStatement(
        env,
        proposal,
        operation.principal,
        deleted
          ? 'document_deleted'
          : previous
            ? 'document_updated'
            : 'document_published',
        {
          documentId: id,
          documentSlug: document.slug,
          resultingVersion: document.version,
          locale: document.locale,
          requestId: operation.requestId,
        },
      ),
    )
  }
  return [...statements, ...relations]
}

export async function createProposal(
  env: StorageBindings,
  identity: Identity,
  input: DurableCreateProposalInput,
  idempotencyKey: string,
  requestId?: string,
): Promise<ProposalResult> {
  const parsed = DurableCreateProposalInputSchema.parse(input)
  const operation = await beginOperation(
    env,
    identity,
    parsed,
    'create-proposal',
    idempotencyKey,
    'contribute',
    requestId,
  )
  const replay = await replayOperation(env, operation)
  if (replay) return replay
  enforcePayloadLimits(parsed, operation.settings.limits)
  const prepared = await prepareChanges(env, parsed.changes)
  const proposal = await buildProposal(parsed, prepared, {
    id: `proposal-${operation.id.slice(0, 32)}`,
    version: 1,
    author: operation.principal,
    createdAt: now(),
    discussionSummary: parsed.reason ?? parsed.summary,
  })
  return commitOperation(env, operation, {
    result: { proposal },
    input: parsed,
    prepared,
    creating: true,
    statements: [
      ...(await proposalStatements(env, proposal)),
      historyStatement(env, proposal, operation.principal, 'proposal_created', {
        requestId: operation.requestId,
        reason: parsed.reason,
      }),
    ],
  })
}

export async function updateProposal(
  env: StorageBindings,
  identity: Identity,
  input: DurableUpdateProposalInput,
  idempotencyKey: string,
  requestId?: string,
): Promise<ProposalResult> {
  const parsed = DurableUpdateProposalInputSchema.parse(input)
  const operation = await beginOperation(
    env,
    identity,
    parsed,
    `update-proposal:${parsed.proposalId}`,
    idempotencyKey,
    'contribute',
    requestId,
  )
  const replay = await replayOperation(env, operation)
  if (replay) return replay
  const previous = await readStoredProposal(env, parsed.proposalId)
  if (!previous) throw new ApiError('not_found', 'The proposal is unavailable.', 404)
  editableBy(previous, operation.principal)
  expectProposalVersion(previous, parsed.expectedProposalVersion)
  if (!canEditProposal(previous.status))
    throw new ApiError('invalid_transition', 'Merged proposals cannot be edited.', 409)
  const content = {
    title: parsed.title,
    summary: parsed.summary,
    changes: parsed.changes,
    ...(parsed.reason ? { reason: parsed.reason } : {}),
  }
  enforcePayloadLimits(content, operation.settings.limits)
  const prepared = await prepareChanges(env, parsed.changes)
  const proposal = await buildProposal(content, prepared, {
    id: previous.id,
    version: previous.proposalVersion + 1,
    author: previous.author,
    createdAt: previous.createdAt,
    discussionSummary: previous.discussionSummary,
  })
  return commitOperation(env, operation, {
    result: { proposal },
    input: content,
    prepared,
    previous,
    editing: true,
    statements: [
      ...(await proposalStatements(env, proposal)),
      historyStatement(env, proposal, operation.principal, 'proposal_updated', {
        requestId: operation.requestId,
        reason: parsed.reason,
      }),
    ],
  })
}

export async function transitionProposal(
  env: StorageBindings,
  identity: Identity,
  input: DurableProposalTransitionInput,
  idempotencyKey: string,
  requestId?: string,
): Promise<ProposalResult> {
  const parsed = DurableProposalTransitionInputSchema.parse(input)
  const operation = await beginOperation(
    env,
    identity,
    parsed,
    `transition-proposal:${parsed.proposalId}`,
    idempotencyKey,
    'review',
    requestId,
  )
  const replay = await replayOperation(env, operation)
  if (replay) return replay
  const previous = await readStoredProposal(env, parsed.proposalId)
  if (!previous) throw new ApiError('not_found', 'The proposal is unavailable.', 404)
  expectProposalVersion(previous, parsed.expectedProposalVersion)
  if (!canTransitionProposal(previous.status, parsed.status))
    throw new ApiError(
      'invalid_transition',
      `Cannot transition ${previous.status} to ${parsed.status}.`,
      409,
    )
  if ((await contentHash(previous)) !== previous.contentHash)
    throw new ApiError(
      'service_unavailable',
      'Proposal integrity verification failed.',
      503,
    )
  if (
    parsed.status === 'merged' &&
    (!previous.approval ||
      previous.approval.contentHash !== previous.contentHash ||
      previous.approval.reviewedProposalVersion !== previous.proposalVersion - 1)
  )
    throw new ApiError(
      'proposal_version_conflict',
      'Approval does not match the current proposal content.',
      409,
    )
  if (parsed.confirmation && parsed.confirmation.contentHash !== previous.contentHash)
    throw new ApiError(
      'proposal_version_conflict',
      'The merge confirmation is stale.',
      409,
    )
  if (
    parsed.status === 'merged' &&
    previous.checks.some((check) => check.status !== 'passed')
  )
    throw new ApiError(
      'invalid_transition',
      'All blocking checks must pass before merge.',
      409,
    )
  const timestamp = now()
  const proposal: DurableProposal = {
    ...previous,
    status: parsed.status,
    proposalVersion: previous.proposalVersion + 1,
    updatedAt: timestamp,
    approval:
      parsed.status === 'approved'
        ? {
            reviewedProposalVersion: previous.proposalVersion,
            contentHash: previous.contentHash,
            reviewedBy: operation.principal,
            reviewedAt: timestamp,
          }
        : parsed.status === 'changes_requested'
          ? null
          : previous.approval,
    discussionSummary: parsed.reason
      ? `${previous.discussionSummary}\n${parsed.reason}`.slice(-2000)
      : previous.discussionSummary,
  }
  const content = storedInput(previous)
  enforcePayloadLimits(content, operation.settings.limits)
  const prepared =
    parsed.status === 'merged' ? await prepareChanges(env, content.changes) : undefined
  let publication: D1PreparedStatement[] = []
  if (prepared) {
    try {
      publication = await preparePublication(env, operation, proposal, prepared)
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        'service_unavailable',
        'Revision storage could not be prepared. Retry with the same idempotency key.',
        503,
      )
    }
  }
  const statements = [
    ...(await proposalStatements(env, proposal)),
    ...publication,
    historyStatement(
      env,
      proposal,
      operation.principal,
      parsed.status === 'merged'
        ? 'merged'
        : parsed.status === 'approved'
          ? 'approved'
          : 'changes_requested',
      { reason: parsed.reason, requestId: operation.requestId },
    ),
  ]
  return commitOperation(env, operation, {
    result: { proposal },
    input: content,
    previous,
    ...(prepared ? { prepared } : {}),
    statements,
  })
}
