import { env } from 'cloudflare:workers'
import { applyD1Migrations, reset } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  Document,
  DurableCreateProposalInput,
  DurableProposal,
  Principal,
} from '@lorestra/contracts'

import { createLocalSession, identityFromToken, type Identity } from './identity.js'
import { importVault } from './import-vault.js'
import { createProposal, transitionProposal, updateProposal } from './proposals.js'
import { readStoredProposal } from './proposal-storage.js'

const maintainer: Principal = {
  id: 'member-maintainer',
  name: 'Maintainer',
  role: 'maintainer',
}
const seedDocument = (id: string): Document => ({
  id,
  slug: id,
  title: id,
  locale: 'en',
  type: 'note',
  visibility: 'public',
  status: 'published',
  version: 1,
  author: { id: 'import-author', name: 'Imported example' },
  createdAt: '2026-08-30T00:00:00.000Z',
  updatedAt: '2026-08-30T00:00:00.000Z',
  excerpt: 'Original content.',
  tags: [],
  nav: { visible: true, parentId: 'folder-en', order: 10 },
  relationCount: 0,
  body: `# Original ${id}`,
  relations: [],
  folderId: 'folder-en',
})
const input = (...ids: string[]): DurableCreateProposalInput => ({
  title: 'Improve the procedure',
  summary: 'Record verified steps.',
  changes: ids.map((id) => ({
    id: `change-${id}`,
    target: { documentId: id, slug: id, title: `Updated ${id}` },
    changeType: 'modified',
    baseVersion: 1,
    after: `# Updated ${id}`,
    metadata: {
      type: 'process',
      folderId: 'folder-en',
      tags: ['verified'],
      relations: [],
      visibility: 'public',
      status: 'published',
      locale: 'en',
    },
  })),
})
let identity: Identity

async function session(principal: Principal): Promise<Identity> {
  const created = await createLocalSession(env, principal)
  return identityFromToken(env, created.token)
}
async function approve(
  proposal: DurableProposal,
  key: string = crypto.randomUUID(),
): Promise<DurableProposal> {
  return (
    await transitionProposal(
      env,
      identity,
      {
        proposalId: proposal.id,
        expectedProposalVersion: proposal.proposalVersion,
        status: 'approved',
      },
      key,
    )
  ).proposal
}
async function merge(
  proposal: DurableProposal,
  key: string = crypto.randomUUID(),
): Promise<DurableProposal> {
  return (
    await transitionProposal(
      env,
      identity,
      {
        proposalId: proposal.id,
        expectedProposalVersion: proposal.proposalVersion,
        status: 'merged',
      },
      key,
    )
  ).proposal
}
async function state() {
  const [documents, revisions, history, operations, versions, relations] =
    await Promise.all([
      env.DB.prepare(
        'SELECT id,version,current_revision_id,slug,type,deleted FROM documents ORDER BY id',
      ).all(),
      env.DB.prepare('SELECT id FROM revisions ORDER BY id').all(),
      env.DB.prepare('SELECT id FROM history ORDER BY id').all(),
      env.DB.prepare('SELECT id FROM operations ORDER BY id').all(),
      env.DB.prepare(
        'SELECT proposal_id,version FROM proposal_versions ORDER BY proposal_id,version',
      ).all(),
      env.DB.prepare(
        'SELECT source_id,target_id FROM relations ORDER BY source_id,target_id',
      ).all(),
    ])
  return {
    documents: documents.results,
    revisions: revisions.results,
    history: history.results,
    operations: operations.results,
    versions: versions.results,
    relations: relations.results,
  }
}

beforeEach(async () => {
  await reset()
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
  await importVault(env, {
    schemaVersion: 1,
    seedId: 'proposal-tests',
    vault: { id: 'test-vault', name: 'Test vault', branch: 'main' },
    folders: [
      {
        id: 'folder-en',
        slug: 'docs',
        title: 'Docs',
        parentId: null,
        order: 1,
        visibility: 'public',
        locale: 'en',
      },
    ],
    documents: ['doc-one', 'doc-two'].map((id) => ({
      ...seedDocument(id),
      folderId: 'folder-en',
      path: `vault/Docs/en/${id}.md`,
    })),
  })
  identity = await session(maintainer)
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('durable proposal publication in Workers D1/R2', () => {
  it('persists proposal versions, invalidates edited approvals and publishes exact metadata only at merge', async () => {
    const created = (await createProposal(env, identity, input('doc-one'), 'create'))
      .proposal
    expect(created).toMatchObject({
      proposalVersion: 1,
      approval: null,
      changes: [{ before: '# Original doc-one', baseVersion: 1 }],
    })
    const approved = await approve(created)
    expect(approved).toMatchObject({
      proposalVersion: 2,
      approval: { reviewedProposalVersion: 1, contentHash: created.contentHash },
    })
    expect((await state()).documents[0]).toMatchObject({ version: 1, type: 'note' })
    const edited = (
      await updateProposal(
        env,
        identity,
        {
          ...input('doc-one'),
          proposalId: created.id,
          expectedProposalVersion: 2,
          reason: 'More evidence',
          changes: [{ ...input('doc-one').changes[0]!, after: '# Revised procedure' }],
        },
        'edit',
      )
    ).proposal
    expect(edited).toMatchObject({ proposalVersion: 3, status: 'open', approval: null })
    await expect(merge(approved)).rejects.toMatchObject({
      code: 'proposal_version_conflict',
    })
    const rereviewed = await approve(edited)
    expect(rereviewed).toMatchObject({
      proposalVersion: 4,
      approval: { reviewedProposalVersion: 3 },
    })
    const merged = await merge(rereviewed)
    expect(merged.proposalVersion).toBe(5)
    expect(await readStoredProposal(env, merged.id)).toEqual(merged)
    expect((await state()).documents[0]).toMatchObject({ version: 2, type: 'process' })
    const revision = await env.DB.prepare(
      'SELECT object_key,revision_json,snapshot_json FROM revisions WHERE document_id=? AND version=2',
    )
      .bind('doc-one')
      .first<{ object_key: string; revision_json: string; snapshot_json: string }>()
    expect(await (await env.VAULT.get(revision!.object_key))!.text()).toBe(
      '# Revised procedure',
    )
    expect(JSON.parse(revision!.revision_json)).toMatchObject({
      createdBy: { id: maintainer.id },
      proposalId: merged.id,
    })
    expect(JSON.parse(revision!.snapshot_json)).toMatchObject({
      type: 'process',
      tags: ['verified'],
      path: 'vault/Docs/en/doc-one.md',
    })
    expect((await state()).versions).toHaveLength(5)
  })

  it('replays concurrent identical requests and rejects a key reused with a different payload', async () => {
    const [first, second] = await Promise.all([
      createProposal(env, identity, input('doc-one'), 'same-key'),
      createProposal(env, identity, input('doc-one'), 'same-key'),
    ])
    expect(second).toEqual(first)
    expect((await state()).operations).toHaveLength(1)
    await expect(
      createProposal(
        env,
        identity,
        { ...input('doc-one'), summary: 'Different intent' },
        'same-key',
      ),
    ).rejects.toMatchObject({ code: 'idempotency_conflict' })
    const approved = await approve(first.proposal)
    const [merged, replay] = await Promise.all([
      merge(approved, 'same-merge'),
      merge(approved, 'same-merge'),
    ])
    expect(replay).toEqual(merged)
    expect((await state()).revisions).toHaveLength(3)
    expect((await state()).operations).toHaveLength(3)
  })

  it('lets only one concurrent distinct-key merge publish the reviewed version', async () => {
    const approved = await approve(
      (await createProposal(env, identity, input('doc-one'), 'create')).proposal,
    )
    const outcomes = await Promise.allSettled([
      merge(approved, 'merge-one'),
      merge(approved, 'merge-two'),
    ])
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1)
    expect(outcomes.find((outcome) => outcome.status === 'rejected')).toMatchObject({
      reason: { code: 'proposal_version_conflict' },
    })
    expect((await state()).revisions).toHaveLength(3)
  })

  it('rolls back all publication statements when the last document write fails and retries safely', async () => {
    const approved = await approve(
      (await createProposal(env, identity, input('doc-one', 'doc-two'), 'create'))
        .proposal,
    )
    await env.DB.prepare(
      "CREATE TRIGGER fail_second BEFORE UPDATE ON documents WHEN NEW.id='doc-two' BEGIN SELECT RAISE(ABORT,'injected_last_document_failure'); END",
    ).run()
    const before = await state()
    await expect(merge(approved, 'retry-merge')).rejects.toMatchObject({ status: 503 })
    expect(await state()).toEqual(before)
    expect((await readStoredProposal(env, approved.id))?.status).toBe('approved')
    expect(
      (
        await env.DB.prepare('SELECT COUNT(*) AS count FROM commit_guards').first<{
          count: number
        }>()
      )?.count,
    ).toBe(0)
    await env.DB.prepare('DROP TRIGGER fail_second').run()
    const merged = await merge(approved, 'retry-merge')
    expect(merged.status).toBe('merged')
    expect((await state()).revisions).toHaveLength(4)
  })

  it('aborts the whole batch when a base changes after R2 preparation begins', async () => {
    const approved = await approve(
      (await createProposal(env, identity, input('doc-one', 'doc-two'), 'create'))
        .proposal,
    )
    const before = await state()
    const original = env.VAULT.put.bind(env.VAULT)
    let changed = false
    vi.spyOn(env.VAULT, 'put').mockImplementation(async (key, value, options) => {
      const stored = await original(key, value, options)
      if (!changed) {
        changed = true
        await env.DB.prepare('UPDATE documents SET version=2 WHERE id=?')
          .bind('doc-two')
          .run()
      }
      return stored
    })
    await expect(merge(approved)).rejects.toMatchObject({ code: 'version_conflict' })
    const after = await state()
    expect(after.documents[0]).toEqual(before.documents[0])
    expect(after.revisions).toEqual(before.revisions)
    expect(after.history).toEqual(before.history)
    expect(after.operations).toEqual(before.operations)
  })

  it.each(['revoke', 'demote', 'read-only'] as const)(
    'rechecks %s inside the commit after immutable objects were prepared',
    async (change) => {
      const approved = await approve(
        (await createProposal(env, identity, input('doc-one'), 'create')).proposal,
      )
      const before = await state()
      const original = env.VAULT.put.bind(env.VAULT)
      vi.spyOn(env.VAULT, 'put').mockImplementation(async (key, value, options) => {
        const stored = await original(key, value, options)
        if (change === 'revoke')
          await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?')
            .bind(identity.tokenHash)
            .run()
        if (change === 'demote')
          await env.DB.prepare("UPDATE members SET role='reader' WHERE id=?")
            .bind(maintainer.id)
            .run()
        if (change === 'read-only')
          await env.DB.prepare(
            "UPDATE vault_settings SET value='true' WHERE key='read_only'",
          ).run()
        return stored
      })
      await expect(merge(approved)).rejects.toMatchObject({
        status: change === 'revoke' ? 401 : change === 'demote' ? 403 : 503,
      })
      expect(await state()).toEqual(before)
    },
  )

  it('keeps a partial R2 prepare private when storage fails', async () => {
    const approved = await approve(
      (await createProposal(env, identity, input('doc-one', 'doc-two'), 'create'))
        .proposal,
    )
    const before = await state()
    const original = env.VAULT.put.bind(env.VAULT)
    let calls = 0
    vi.spyOn(env.VAULT, 'put').mockImplementation(async (key, value, options) => {
      if (++calls === 2) throw new Error('storage unavailable')
      return original(key, value, options)
    })
    await expect(merge(approved, 'retry-after-storage')).rejects.toMatchObject({
      status: 503,
    })
    expect(await state()).toEqual(before)
    vi.restoreAllMocks()
    expect((await merge(approved, 'retry-after-storage')).status).toBe('merged')
  })

  it('enforces ownership, authenticated roles, stale bases and effective UTF-8 byte limits', async () => {
    const contributor = await session({
      id: 'contributor',
      name: 'Contributor',
      role: 'contributor',
    })
    const other = await session({ id: 'other', name: 'Other', role: 'contributor' })
    const proposal = (
      await createProposal(env, contributor, input('doc-one'), 'create')
    ).proposal
    await expect(
      updateProposal(
        env,
        other,
        { ...input('doc-one'), proposalId: proposal.id, expectedProposalVersion: 1 },
        'edit',
      ),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      transitionProposal(
        env,
        contributor,
        { proposalId: proposal.id, expectedProposalVersion: 1, status: 'approved' },
        'review',
      ),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      createProposal(
        env,
        identity,
        {
          ...input('doc-one'),
          changes: [{ ...input('doc-one').changes[0]!, baseVersion: 2 }],
        },
        'stale',
      ),
    ).rejects.toMatchObject({ code: 'version_conflict' })
    await env.DB.prepare("INSERT INTO vault_settings(key,value) VALUES('limits',?)")
      .bind(JSON.stringify({ maxDocumentBytes: 12 }))
      .run()
    await expect(
      createProposal(
        env,
        identity,
        {
          ...input('doc-one'),
          changes: [{ ...input('doc-one').changes[0]!, after: 'á'.repeat(7) }],
        },
        'too-large',
      ),
    ).rejects.toMatchObject({ status: 413 })
  })

  it('stores read-only aliases on rename and a tombstone on deletion without erasing old revisions', async () => {
    const changed = input('doc-one')
    changed.changes[0]!.target.slug = 'renamed'
    const renamed = await merge(
      await approve((await createProposal(env, identity, changed, 'rename')).proposal),
    )
    const aliases = await env.DB.prepare(
      'SELECT slug FROM aliases WHERE document_id=? ORDER BY slug',
    )
      .bind('doc-one')
      .all<{ slug: string }>()
    expect(aliases.results.map((row) => row.slug)).toEqual(['doc-one', 'renamed'])
    const deletion = {
      ...changed,
      changes: [
        {
          ...changed.changes[0]!,
          changeType: 'deleted' as const,
          after: null,
          baseVersion: 2,
        },
      ],
    }
    const deleted = await merge(
      await approve((await createProposal(env, identity, deletion, 'delete')).proposal),
    )
    expect(deleted.id).not.toBe(renamed.id)
    expect((await state()).documents[0]).toMatchObject({ deleted: 1, version: 3 })
    expect((await state()).revisions).toHaveLength(4)
  })

  it('publishes a new identity and a modified document together, with target indexes for both', async () => {
    const payload = input('doc-one')
    payload.changes.push({
      id: 'new-note',
      target: { documentId: null, slug: 'new-note', title: 'New note' },
      changeType: 'added',
      baseVersion: null,
      after: '# New note',
      metadata: {
        type: 'decision',
        folderId: 'folder-en',
        tags: [],
        relations: ['doc-one'],
        visibility: 'public',
        status: 'archived',
        locale: 'en',
      },
    })
    const created = (await createProposal(env, identity, payload, 'create-multiple'))
      .proposal
    expect((await state()).documents).toHaveLength(2)
    const approved = await approve(created)
    await expect(
      transitionProposal(
        env,
        identity,
        {
          proposalId: approved.id,
          expectedProposalVersion: approved.proposalVersion,
          status: 'merged',
          confirmation: {
            proposalId: approved.id,
            proposalVersion: approved.proposalVersion,
            contentHash: '0'.repeat(64),
          },
        },
        'stale-confirmation',
      ),
    ).rejects.toMatchObject({ code: 'proposal_version_conflict' })
    const merged = await merge(approved)
    const added = await env.DB.prepare(
      'SELECT id,version,type,status FROM documents WHERE slug=?',
    )
      .bind('new-note')
      .first<{ id: string; version: number; type: string; status: string }>()
    expect(added).toMatchObject({ version: 1, type: 'decision', status: 'archived' })
    const targets = await env.DB.prepare(
      'SELECT document_id FROM proposal_targets WHERE proposal_id=?',
    )
      .bind(merged.id)
      .all<{ document_id: string }>()
    expect(targets.results.map((target) => target.document_id).sort()).toEqual(
      [added!.id, 'doc-one'].sort(),
    )
    expect((await state()).relations).toContainEqual({
      source_id: added!.id,
      target_id: 'doc-one',
    })
    expect((await state()).revisions).toHaveLength(4)
  })

  it('enforces open-proposal and write-window quotas transactionally without blocking idempotent replay', async () => {
    await env.DB.prepare("INSERT INTO vault_settings(key,value) VALUES('limits',?)")
      .bind(JSON.stringify({ maxOpenProposals: 1 }))
      .run()
    const results = await Promise.allSettled([
      createProposal(env, identity, input('doc-one'), 'quota-one'),
      createProposal(env, identity, input('doc-two'), 'quota-two'),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({
      reason: { code: 'rate_limited', status: 429 },
    })
    const winner = results.findIndex((result) => result.status === 'fulfilled')
    const selected = results[winner]
    if (!selected || selected.status !== 'fulfilled')
      throw new Error('Expected one successful proposal')
    const before = await state()
    await env.DB.prepare("UPDATE vault_settings SET value=? WHERE key='limits'")
      .bind(JSON.stringify({ maxOpenProposals: 1, maxWritesPerMinute: 1 }))
      .run()
    expect(
      await createProposal(
        env,
        identity,
        input(winner === 0 ? 'doc-one' : 'doc-two'),
        winner === 0 ? 'quota-one' : 'quota-two',
      ),
    ).toEqual(selected.value)
    await expect(approve(selected.value.proposal)).rejects.toMatchObject({
      code: 'rate_limited',
      status: 429,
    })
    expect(await state()).toEqual(before)
  })
})
