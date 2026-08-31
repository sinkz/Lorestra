import { env } from 'cloudflare:workers'
import { applyD1Migrations, reset } from 'cloudflare:test'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  DocumentResponseSchema,
  DocumentSummarySchema,
  DurableProposalSchema,
  GraphResponseSchema,
  type Document,
  type DurableProposal,
  type HistoryEvent,
} from '@lorestra/contracts'

import { createDurableApp } from '../../app/create-durable-app.js'
import { createKnowledgeReader } from './knowledge.js'
import { normalizeText, sha256, type StorageBindings } from './primitives.js'
import type { Identity } from './identity.js'

const documentId = (index: number) => `scale-doc-${String(index).padStart(4, '0')}`
const folderId = (index: number) => `scale-folder-${String(index).padStart(3, '0')}`
const proposalId = (index: number) => `scale-proposal-${String(index).padStart(3, '0')}`
const actor = { id: 'scale-author', name: 'Synthetic scale fixture' }
const visitor: Identity = {
  principal: null,
  tokenHash: null,
  csrfToken: null,
  expiresAt: null,
}
const member: Identity = { ...visitor, principal: { ...actor, role: 'maintainer' } }
const timestamp = '2026-08-30T00:00:00.000Z'
const privateFolder = folderId(119)
const historicalId = documentId(999)
const secretBody = '# PRIVATE-HISTORICAL-FOLDER-SENTINEL'
const documents: Document[] = Array.from({ length: 1000 }, (_, index) => ({
  id: documentId(index),
  slug: documentId(index),
  title: `Scale memory ${String(index).padStart(4, '0')}`,
  locale: index === 999 ? 'pt-BR' : 'en',
  type: index % 2 === 0 ? 'process' : 'note',
  visibility: 'public',
  status: index === 10 ? 'archived' : 'published',
  version: index === 999 ? 2 : 1,
  author: actor,
  createdAt: timestamp,
  updatedAt: timestamp,
  excerpt: 'Searchable synthetic knowledge.',
  tags: ['scale', 'memory'],
  nav: { visible: true, parentId: folderId(10 + (index % 110)), order: index },
  folderId: folderId(10 + (index % 110)),
  relationCount: 6,
  relations: Array.from({ length: 6 }, (_, offset) =>
    documentId((index + offset + 1) % 1000),
  ),
  body: '',
}))
const publicDocumentIds = new Set(
  documents
    .filter((document) => document.folderId !== privateFolder)
    .map((document) => document.id),
)
const publicEnglishIds = new Set(
  documents
    .filter(
      (document) => document.locale === 'en' && publicDocumentIds.has(document.id),
    )
    .map((document) => document.id),
)
const proposals: DurableProposal[] = Array.from({ length: 200 }, (_, index) => {
  const document = documents[index]!
  const status = (['open', 'changes_requested', 'approved', 'merged'] as const)[
    index % 4
  ]!
  const metadata = {
    type: document.type,
    folderId: document.folderId!,
    tags: document.tags,
    relations: document.relations,
    locale: document.locale,
    visibility: document.visibility,
    status: document.status,
  }
  const hash = 'a'.repeat(64)
  return DurableProposalSchema.parse({
    id: proposalId(index),
    title: `Synthetic proposal ${index}`,
    summary: 'Scale-only fixture, not a human review.',
    author: actor,
    status,
    createdAt: timestamp,
    updatedAt: timestamp,
    proposalVersion: status === 'merged' ? 3 : status === 'open' ? 1 : 2,
    contentHash: hash,
    changeCount: 1,
    createsDocument: false,
    approval:
      status === 'approved' || status === 'merged'
        ? {
            reviewedProposalVersion: 1,
            contentHash: hash,
            reviewedBy: actor,
            reviewedAt: timestamp,
          }
        : null,
    changes: [
      {
        id: `change-${index}`,
        target: { documentId: document.id, slug: document.slug, title: document.title },
        changeType: 'modified',
        baseVersion: 1,
        before: 'before '.repeat(1200),
        after: 'after '.repeat(1400),
        metadata,
        beforeMetadata:
          index === 7 ? { ...metadata, folderId: privateFolder } : metadata,
      },
    ],
    checks: [{ name: 'Synthetic fixture', status: 'passed' }],
    discussionSummary: 'Synthetic scale fixture.',
  })
})
const publicProposalIds = new Set(
  proposals
    .filter(
      (proposal) =>
        proposal.status === 'merged' &&
        proposal.changes.every(
          (change) =>
            publicDocumentIds.has(change.target.documentId!) &&
            change.metadata.folderId !== privateFolder &&
            change.beforeMetadata?.folderId !== privateFolder &&
            change.metadata.relations.every((id) => publicDocumentIds.has(id)) &&
            change.beforeMetadata?.relations.every((id) => publicDocumentIds.has(id)),
        ),
    )
    .map((proposal) => proposal.id),
)

type Metrics = {
  queries: number
  rowsRead: number
  rowsWritten: number
  databaseBytes: number
  largestQueryBytes: number
  responseBytes: number
  queryRowsRead: number[]
  queryHints: string[]
}
function measuredBindings() {
  const metrics: Metrics = {
    queries: 0,
    rowsRead: 0,
    rowsWritten: 0,
    databaseBytes: 0,
    largestQueryBytes: 0,
    responseBytes: 0,
    queryRowsRead: [],
    queryHints: [],
  }
  const record = <T>(result: D1Result<T>, sql = 'batch'): D1Result<T> => {
    const bytes = new TextEncoder().encode(JSON.stringify(result.results)).byteLength
    metrics.queries += 1
    metrics.rowsRead += result.meta.rows_read
    metrics.rowsWritten += result.meta.rows_written
    metrics.databaseBytes += bytes
    metrics.largestQueryBytes = Math.max(metrics.largestQueryBytes, bytes)
    metrics.queryRowsRead.push(result.meta.rows_read)
    metrics.queryHints.push(sql.replace(/\s+/g, ' ').slice(0, 160))
    return result
  }
  const statement = (
    prepared: D1PreparedStatement,
    sql: string,
  ): D1PreparedStatement => ({
    bind: (...values: unknown[]) => statement(prepared.bind(...values), sql),
    async all<T>() {
      return record(await prepared.all<T>(), sql)
    },
    async run<T>() {
      return record(await prepared.run<T>(), sql)
    },
    async first<T>(column?: string): Promise<T | null> {
      const result = record(await prepared.all<Record<string, unknown>>(), sql)
      const row = result.results[0]
      return row ? ((column ? row[column] : row) as T) : null
    },
    raw: prepared.raw.bind(prepared),
  })
  const DB: D1Database = {
    prepare: (query) => statement(env.DB.prepare(query), query),
    async batch<T>(statements: D1PreparedStatement[]) {
      return (await env.DB.batch<T>(statements)).map((result) => record(result))
    },
    exec: env.DB.exec.bind(env.DB),
    dump: env.DB.dump.bind(env.DB),
    withSession: env.DB.withSession.bind(env.DB),
  }
  return { metrics, bindings: { DB, VAULT: env.VAULT } satisfies StorageBindings }
}

async function measure<T>(
  name: string,
  run: (bindings: StorageBindings) => Promise<T>,
  maxQueries: number,
  maxResponseBytes: number,
) {
  const measured = measuredBindings()
  const result = await run(measured.bindings)
  measured.metrics.responseBytes = new TextEncoder().encode(
    JSON.stringify(result),
  ).byteLength
  console.info(`SCALE_METRIC ${name} ${JSON.stringify(measured.metrics)}`)
  expect(measured.metrics.queries).toBeGreaterThan(0)
  expect(measured.metrics.queries).toBeLessThanOrEqual(maxQueries)
  expect(measured.metrics.responseBytes).toBeLessThanOrEqual(maxResponseBytes)
  expect(measured.metrics.rowsRead).toBeLessThanOrEqual(100_000)
  expect(measured.metrics.largestQueryBytes).toBeLessThanOrEqual(65_536)
  return result
}

/** Operator-created synthetic rows. Scale lists must not touch R2 bodies. */
beforeAll(async () => {
  await reset()
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
  await env.DB.prepare('INSERT INTO members(id,name,role,active) VALUES(?,?,?,1)')
    .bind(actor.id, actor.name, 'maintainer')
    .run()
  const folders = Array.from({ length: 120 }, (_, index) => ({
    id: folderId(index),
    slug: `folder-${index}`,
    title: `Folder ${index}`,
    parent: index < 10 ? null : folderId(Math.floor((index - 10) / 11)),
    order: index,
    visibility: index === 119 ? 'internal' : 'public',
  }))
  await env.DB.prepare(
    `INSERT INTO folders(id,slug,title,parent_id,sort_order,visibility,locale,source_hash)
    SELECT json_extract(value,'$.id'),json_extract(value,'$.slug'),json_extract(value,'$.title'),json_extract(value,'$.parent'),json_extract(value,'$.order'),json_extract(value,'$.visibility'),'all','scale' FROM json_each(?)`,
  )
    .bind(JSON.stringify(folders))
    .run()
  const emptyHash = await sha256('')
  for (let start = 0; start < documents.length; start += 100) {
    const records = documents.slice(start, start + 100).map((document) => {
      const summary = DocumentSummarySchema.parse(document)
      return {
        ...document,
        summary,
        snapshot: {
          ...summary,
          relations: document.relations,
          path: `vault/${document.folderId}/${document.slug}.md`,
        },
        revision: {
          id: `${document.id}.v${document.version}`,
          documentId: document.id,
          version: document.version,
          message: 'Synthetic scale import',
          createdAt: timestamp,
          createdBy: actor,
        },
        searchText: normalizeText(`${document.title} scale memory synthetic knowledge`),
      }
    })
    const json = JSON.stringify(records)
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO documents(id,locale,slug,title,type,visibility,status,version,folder_id,current_revision_id,deleted,updated_at,summary_json,search_text)
        SELECT json_extract(value,'$.id'),json_extract(value,'$.locale'),json_extract(value,'$.slug'),json_extract(value,'$.title'),json_extract(value,'$.type'),'public',json_extract(value,'$.status'),json_extract(value,'$.version'),json_extract(value,'$.folderId'),json_extract(value,'$.revision.id'),0,?,json_extract(value,'$.summary'),json_extract(value,'$.searchText') FROM json_each(?)`,
      ).bind(timestamp, json),
      env.DB.prepare(
        `INSERT INTO revisions(id,document_id,version,object_key,body_hash,snapshot_json,revision_json,deleted)
        SELECT json_extract(value,'$.revision.id'),json_extract(value,'$.id'),json_extract(value,'$.version'),'scale/'||json_extract(value,'$.id')||'.md',?,json_extract(value,'$.snapshot'),json_extract(value,'$.revision'),0 FROM json_each(?)`,
      ).bind(emptyHash, json),
      env.DB.prepare(
        "INSERT INTO aliases(locale,slug,document_id) SELECT json_extract(value,'$.locale'),json_extract(value,'$.slug'),json_extract(value,'$.id') FROM json_each(?)",
      ).bind(json),
    ])
  }
  for (let start = 0; start < documents.length; start += 100)
    await env.DB.prepare(
      `INSERT INTO relations(source_id,target_id)
    SELECT json_extract(d.value,'$.id'),r.value FROM json_each(?) d,json_each(d.value,'$.relations') r`,
    )
      .bind(
        JSON.stringify(
          documents
            .slice(start, start + 100)
            .map((document) => ({ id: document.id, relations: document.relations })),
        ),
      )
      .run()
  for (let start = 0; start < proposals.length; start += 20) {
    const json = JSON.stringify(proposals.slice(start, start + 20))
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO proposals(id,version,status,author_id,updated_at,payload_json,content_hash)
        SELECT json_extract(value,'$.id'),json_extract(value,'$.proposalVersion'),json_extract(value,'$.status'),json_extract(value,'$.author.id'),json_extract(value,'$.updatedAt'),value,json_extract(value,'$.contentHash') FROM json_each(?)`,
      ).bind(json),
      env.DB.prepare(
        `INSERT INTO proposal_versions(proposal_id,version,payload_json) SELECT json_extract(value,'$.id'),json_extract(value,'$.proposalVersion'),value FROM json_each(?)`,
      ).bind(json),
      env.DB.prepare(
        `INSERT INTO proposal_targets(proposal_id,document_id) SELECT json_extract(value,'$.id'),json_extract(value,'$.changes[0].target.documentId') FROM json_each(?)`,
      ).bind(json),
    ])
  }
  const events: HistoryEvent[] = Array.from({ length: 500 }, (_, index) => ({
    id: `scale-event-${String(index).padStart(4, '0')}`,
    type: proposals[index % 200]!.status === 'merged' ? 'merged' : 'proposal_created',
    occurredAt: new Date(Date.parse(timestamp) + index * 1000).toISOString(),
    actor,
    proposalId: proposalId(index % 200),
    documentId: documentId(index % 200),
    documentSlug: documentId(index % 200),
    summary: `Synthetic history memory ${index}`,
    resultingVersion: null,
  }))
  await env.DB.prepare(
    `INSERT INTO history(id,occurred_at,type,proposal_id,document_id,locale,payload_json)
    SELECT json_extract(value,'$.id'),json_extract(value,'$.occurredAt'),json_extract(value,'$.type'),json_extract(value,'$.proposalId'),json_extract(value,'$.documentId'),'en',value FROM json_each(?)`,
  )
    .bind(JSON.stringify(events))
    .run()
  const snapshot = {
    ...DocumentSummarySchema.parse(documents[999]!),
    version: 1,
    folderId: privateFolder,
    nav: { visible: true, parentId: privateFolder, order: 1 },
    relations: [],
    path: `vault/${privateFolder}/private-history.md`,
  }
  await env.VAULT.put('scale/private-history.md', secretBody)
  await env.DB.prepare(
    'INSERT INTO revisions(id,document_id,version,object_key,body_hash,snapshot_json,revision_json,deleted) VALUES(?,?,?,?,?,?,?,0)',
  )
    .bind(
      `${historicalId}.v1`,
      historicalId,
      1,
      'scale/private-history.md',
      await sha256(secretBody),
      JSON.stringify(snapshot),
      JSON.stringify({
        id: `${historicalId}.v1`,
        documentId: historicalId,
        version: 1,
        message: 'Private folder snapshot',
        createdAt: timestamp,
        createdBy: actor,
      }),
    )
    .run()
})

describe('bounded durable reads over a synthetic 1000/120/200/500 vault', () => {
  it('keeps lists and filters paginated, ordered and tied to an authorized cursor scope', async () => {
    const result = await measure(
      'documents-en-page20',
      (bindings) =>
        createKnowledgeReader(bindings, visitor).listDocuments({
          locale: 'en',
          limit: 20,
          sort: 'title',
        }),
      2,
      32_768,
    )
    expect(result.items).toHaveLength(20)
    const titles = result.items.map((document) => document.title)
    expect(titles).toEqual([...titles].sort((left, right) => left.localeCompare(right)))
    expect(result.pageInfo.totalCount).toBe(publicEnglishIds.size)
    expect(result.items.every((document) => publicEnglishIds.has(document.id))).toBe(
      true,
    )
    expect(result.items[0]?.relationCount).toBe(6)
    const reader = createKnowledgeReader(env, visitor)
    const next = await reader.listDocuments({
      locale: 'en',
      limit: 20,
      sort: 'title',
      cursor: result.pageInfo.nextCursor!,
    })
    expect(
      next.items.some((document) =>
        result.items.some((first) => first.id === document.id),
      ),
    ).toBe(false)
    await expect(
      reader.listDocuments({
        locale: 'en',
        limit: 20,
        sort: 'updated',
        cursor: result.pageInfo.nextCursor!,
      }),
    ).rejects.toMatchObject({ status: 400 })
    await expect(
      createKnowledgeReader(env, member).listDocuments({
        locale: 'en',
        limit: 20,
        sort: 'title',
        cursor: result.pageInfo.nextCursor!,
      }),
    ).rejects.toMatchObject({ status: 400 })
    const archived = await reader.listDocuments({
      locale: 'en',
      limit: 20,
      sort: 'title',
      status: 'archived',
    })
    expect(archived.items.map((document) => document.id)).toEqual([documentId(10)])
    expect(
      (await reader.listDocuments({ locale: 'pt-BR', limit: 20, sort: 'title' }))
        .pageInfo.totalCount,
    ).toBe(1)
  })

  it('bounds search payload and preserves literal filters', async () => {
    const result = await measure(
      'search-memory-page20',
      (bindings) =>
        createKnowledgeReader(bindings, visitor).search({
          q: 'memory',
          locale: 'en',
          limit: 20,
        }),
      2,
      32_768,
    )
    expect(result.pageInfo.totalCount).toBe(publicEnglishIds.size)
    expect(
      (
        await createKnowledgeReader(env, visitor).search({
          q: '%_',
          locale: 'en',
          limit: 20,
        })
      ).items,
    ).toHaveLength(0)
  })

  it('bounds navigation by parent and resolves selected-document ancestors without loading the vault', async () => {
    const result = await measure(
      'navigation-root-page5',
      (bindings) =>
        createKnowledgeReader(bindings, visitor).getNavigation({
          locale: 'en',
          parentId: null,
          limit: 5,
          documentId: documentId(998),
        }),
      9,
      16_384,
    )
    expect(result.items).toHaveLength(5)
    expect(result.pageInfo.totalCount).toBe(10)
    expect(result.documents).toHaveLength(0)
    expect(result.ancestors.map((folder) => folder.id)).toEqual([
      folderId(0),
      folderId(18),
    ])
    const leaf = await createKnowledgeReader(env, visitor).getNavigation({
      locale: 'en',
      parentId: folderId(10),
      limit: 3,
    })
    expect(leaf.documents).toHaveLength(3)
    expect(leaf.pageInfo.totalCount).toBe(10)
    await expect(
      createKnowledgeReader(env, visitor).getNavigation({
        locale: 'en',
        parentId: privateFolder,
        limit: 5,
      }),
    ).rejects.toMatchObject({ status: 404 })
  })

  it('bounds graph nodes and edges, signals truncation and preserves late selected nodes and incoming links', async () => {
    const result = GraphResponseSchema.parse(
      await measure(
        'graph-entire',
        (bindings) =>
          createKnowledgeReader(bindings, visitor).getGraph({
            locale: 'en',
            scope: 'entire',
          }),
        7,
        131_072,
      ),
    )
    expect(result.nodes.length).toBeLessThanOrEqual(200)
    expect(result.edges).toHaveLength(500)
    expect(result.truncated).toBe(true)
    const visibleDocuments = documents.filter((document) =>
      publicEnglishIds.has(document.id),
    )
    expect(result.totals).toEqual({
      nodes:
        visibleDocuments.length +
        new Set(visibleDocuments.map((document) => document.folderId)).size,
      edges:
        visibleDocuments.length +
        visibleDocuments.reduce(
          (total, document) =>
            total + document.relations.filter((id) => publicEnglishIds.has(id)).length,
          0,
        ),
    })
    const ids = new Set(result.nodes.map((node) => node.id))
    expect(
      result.edges.every((edge) => ids.has(edge.source) && ids.has(edge.target)),
    ).toBe(true)
    expect(
      result.nodes.every(
        (node) => node.kind === 'folder' || publicEnglishIds.has(node.id),
      ),
    ).toBe(true)
    const related = await measure(
      'graph-related-late-center',
      (bindings) =>
        createKnowledgeReader(bindings, visitor).getGraph({
          locale: 'en',
          scope: 'related',
          documentId: documentId(998),
        }),
      8,
      32_768,
    )
    expect(related.centerId).toBe(documentId(998))
    expect(related.nodes.some((node) => node.id === documentId(998))).toBe(true)
    expect(
      related.edges.some(
        (edge) => edge.source === documentId(998) && edge.target === documentId(0),
      ),
    ).toBe(true)
    expect(
      related.edges.some(
        (edge) => edge.source === documentId(997) && edge.target === documentId(998),
      ),
    ).toBe(true)
  })

  it('does not fetch proposal Markdown bodies for the summary list', async () => {
    const result = await measure(
      'proposals-member-page20',
      (bindings) =>
        createKnowledgeReader(bindings, member).listProposals({ limit: 20 }),
      2,
      16_384,
    )
    expect(result.items).toHaveLength(20)
    expect(result.pageInfo.totalCount).toBe(200)
    expect(JSON.stringify(result)).not.toContain('before before')
  })

  it('keeps history and private proposal references out of anonymous payloads and counts', async () => {
    const reader = createKnowledgeReader(env, visitor)
    // Public document 103 references document109 in a private folder.
    expect(await reader.getProposal({ proposalId: proposalId(103) })).toBeNull()
    // A proposal can retain a private-folder body after its target moves public.
    expect(await reader.getProposal({ proposalId: proposalId(7) })).toBeNull()
    const hiddenEvent = await reader.getHistoryEvent({ eventId: 'scale-event-0103' })
    expect(hiddenEvent).toBeNull()
    expect(await reader.getHistoryEvent({ eventId: 'scale-event-0007' })).toBeNull()
    expect((await reader.listProposals({ limit: 20 })).pageInfo.totalCount).toBe(
      publicProposalIds.size,
    )
    const result = await measure(
      'history-member-page20',
      (bindings) => createKnowledgeReader(bindings, member).getHistory({ limit: 20 }),
      2,
      16_384,
    )
    expect(result.pageInfo.totalCount).toBe(500)
    const publicHistory = await measure(
      'history-public-page20',
      (bindings) => createKnowledgeReader(bindings, visitor).getHistory({ limit: 20 }),
      2,
      16_384,
    )
    expect(
      publicHistory.items.some((event) => event.proposalId === proposalId(103)),
    ).toBe(false)
    expect(publicHistory.pageInfo.totalCount).toBe(
      Array.from({ length: 500 }, (_, index) => proposalId(index % 200)).filter((id) =>
        publicProposalIds.has(id),
      ).length,
    )
  })

  it('does not expose a private-folder historical snapshot after the document moves public', async () => {
    const app = createDurableApp({ mode: 'local' })
    const response = await app.request(
      `http://localhost/api/documents/by-id/${historicalId}?version=1`,
      undefined,
      env,
    )
    expect(response.status).toBe(404)
    expect(await response.text()).not.toContain(secretBody)
  })

  it('serves scale HTTP reads through real storage and handles a long valid search without server errors', async () => {
    const app = createDurableApp({ mode: 'local' })
    const listing = await app.request(
      'http://localhost/api/documents?locale=en&limit=5',
      undefined,
      env,
    )
    expect(listing.status).toBe(200)
    const body = await listing.json<{
      items: unknown[]
      pageInfo: { totalCount: number }
    }>()
    expect(body.items).toHaveLength(5)
    expect(body.pageInfo.totalCount).toBe(publicEnglishIds.size)
    const search = await app.request(
      `http://localhost/api/search?q=${'x'.repeat(80)}&locale=en&limit=5`,
      undefined,
      env,
    )
    expect(search.status).toBe(200)
    const history = await app.request(
      `http://localhost/api/history?q=${'x'.repeat(80)}&locale=en&limit=5`,
      undefined,
      env,
    )
    expect(history.status).toBe(200)
    expect(listing.headers.get('cache-control')).toContain('no-store')
  })

  it('keeps member access to the same historical snapshot and verifies its body checksum', async () => {
    const response = DocumentResponseSchema.parse(
      await createKnowledgeReader(env, member).getDocumentById({
        documentId: historicalId,
        version: 1,
      }),
    )
    expect(response.document.body).toBe(secretBody)
    expect(response.document.version).toBe(1)
    expect(response.document.folderId).toBe(privateFolder)
  })
})
