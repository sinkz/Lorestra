import {
  DocumentResponseSchema,
  DocumentSummarySchema,
  DurableProposalSchema,
  HistoryEventSchema,
  NavigationItemSchema,
  ProposalSummarySchema,
  type DocumentSummary,
  type GetDocumentInput,
  type GetDocumentByIdInput,
  type GraphInput,
  type GraphNode,
  type GraphEdge,
  type HistoryInput,
  type ListDocumentsInput,
  type ListProposalsInput,
  type NavigationInput,
  type NavigationItem,
  type SearchInput,
} from '@lorestra/contracts'
import { ApiError } from '../../app/errors.js'
import { runtimeSettings, type Identity } from './identity.js'
import {
  normalizeText,
  pageInfo,
  pageOffset,
  readBody,
  type StorageBindings,
} from './primitives.js'

type SqlValue = string | number | null
type SummaryRow = { summary_json: string; relation_count: number }
type FolderRow = {
  id: string
  slug: string
  title: string
  parent_id: string | null
  sort_order: number
  locale: string
}

// Predicates are built only from our own fixed aliases, never from query strings.
function visibleFolder(alias: string, member: boolean): string {
  return member
    ? '1=1'
    : `NOT EXISTS(WITH RECURSIVE parents(id,parent_id,visibility) AS (
    SELECT id,parent_id,visibility FROM folders WHERE id=${alias}.id UNION ALL
    SELECT f.id,f.parent_id,f.visibility FROM folders f JOIN parents p ON f.id=p.parent_id
  ) SELECT 1 FROM parents WHERE visibility!='public')`
}
function visibleDocument(
  alias: string,
  member: boolean,
  includeDeleted = false,
): string {
  return `${includeDeleted ? '1=1' : `${alias}.deleted=0`} AND ${
    member
      ? '1=1'
      : `${alias}.visibility='public' AND ${alias}.status!='draft'
    AND EXISTS(SELECT 1 FROM folders f WHERE f.id=${alias}.folder_id AND ${visibleFolder('f', false)})`
  }`
}
function publicProposal(alias: string, member: boolean): string {
  if (member) return '1=1'
  return `${alias}.status='merged' AND NOT EXISTS(SELECT 1 FROM proposal_versions pv, json_each(pv.payload_json,'$.changes') change
    WHERE pv.proposal_id=${alias}.id AND (
      json_extract(change.value,'$.metadata.visibility') IS NOT 'public'
      OR json_extract(change.value,'$.metadata.status')='draft'
      OR NOT EXISTS(SELECT 1 FROM folders f WHERE f.id=json_extract(change.value,'$.metadata.folderId') AND ${visibleFolder('f', false)})
      OR (json_extract(change.value,'$.beforeMetadata') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM folders f WHERE f.id=json_extract(change.value,'$.beforeMetadata.folderId') AND ${visibleFolder('f', false)}))
      OR (json_extract(change.value,'$.beforeMetadata') IS NOT NULL AND
        (json_extract(change.value,'$.beforeMetadata.visibility') IS NOT 'public' OR json_extract(change.value,'$.beforeMetadata.status')='draft'))
      OR (json_extract(change.value,'$.target.documentId') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM documents d WHERE d.id=json_extract(change.value,'$.target.documentId') AND ${visibleDocument('d', false, true)}))
      OR EXISTS(SELECT 1 FROM json_each(change.value,'$.metadata.relations') relation WHERE NOT EXISTS(SELECT 1 FROM documents d WHERE d.id=relation.value AND ${visibleDocument('d', false, true)}))
      OR EXISTS(SELECT 1 FROM json_each(change.value,'$.beforeMetadata.relations') relation WHERE NOT EXISTS(SELECT 1 FROM documents d WHERE d.id=relation.value AND ${visibleDocument('d', false, true)}))))
    AND NOT EXISTS(SELECT 1 FROM proposal_targets target LEFT JOIN documents d ON d.id=target.document_id
      WHERE target.proposal_id=${alias}.id AND (d.id IS NULL OR NOT (${visibleDocument('d', false, true)})))`
}
function summary(row: SummaryRow): DocumentSummary {
  return DocumentSummarySchema.parse({
    ...JSON.parse(row.summary_json),
    relationCount: row.relation_count,
  })
}
function navFolder(
  row: FolderRow,
  locale: 'en' | 'pt-BR',
  hasChildren = true,
): NavigationItem {
  return NavigationItemSchema.parse({
    id: row.id,
    parentId: row.parent_id,
    kind: 'folder',
    documentId: null,
    slug: row.slug,
    title: row.title,
    locale,
    order: row.sort_order,
    hasChildren,
  })
}

export function createKnowledgeReader(env: StorageBindings, identity: Identity) {
  const member = identity.principal !== null
  const scope = {
    actor: identity.principal?.id ?? 'public',
    role: identity.principal?.role ?? 'visitor',
  }
  const relationCount = `(SELECT count(*) FROM relations rel JOIN documents target ON target.id=rel.target_id WHERE rel.source_id=d.id AND ${visibleDocument('target', member)}) AS relation_count`

  async function documentWhere(
    input:
      | Pick<ListDocumentsInput, 'locale' | 'folderId' | 'q' | 'type' | 'status'>
      | SearchInput,
  ) {
    const conditions = [visibleDocument('d', member)]
    const values: SqlValue[] = []
    if (input.locale) {
      conditions.push('d.locale=?')
      values.push(input.locale)
    }
    if (input.folderId) {
      conditions.push(
        `d.folder_id IN(WITH RECURSIVE subtree(id) AS(SELECT id FROM folders WHERE id=? UNION ALL SELECT f.id FROM folders f JOIN subtree t ON f.parent_id=t.id) SELECT id FROM subtree)`,
      )
      values.push(input.folderId)
    }
    if (input.type) {
      conditions.push('d.type=?')
      values.push(input.type)
    }
    if (input.status) {
      conditions.push('d.status=?')
      values.push(input.status)
    }
    for (const term of input.q?.trim().split(/\s+/).filter(Boolean) ?? []) {
      conditions.push('instr(d.search_text,?)>0')
      values.push(normalizeText(term))
    }
    return { where: conditions.join(' AND '), values }
  }

  async function listDocuments(input: ListDocumentsInput) {
    const { where, values } = await documentWhere(input)
    const filters = { ...input, cursor: undefined, ...scope }
    const offset = await pageOffset(input.cursor, filters)
    const total =
      (await env.DB.prepare(`SELECT count(*) AS n FROM documents d WHERE ${where}`)
        .bind(...values)
        .first<number>('n')) ?? 0
    const sort =
      input.sort === 'title'
        ? 'd.title COLLATE NOCASE ASC'
        : input.sort === 'type'
          ? 'd.type ASC,d.title COLLATE NOCASE ASC'
          : 'd.updated_at DESC'
    const rows = await env.DB.prepare(
      `SELECT d.summary_json,${relationCount} FROM documents d WHERE ${where} ORDER BY ${sort},d.id ASC LIMIT ? OFFSET ?`,
    )
      .bind(...values, input.limit, offset)
      .all<SummaryRow>()
    return {
      items: rows.results.map(summary),
      pageInfo: await pageInfo(offset, input.limit, total, filters),
    }
  }

  async function getById(input: GetDocumentByIdInput) {
    const row = await env.DB.prepare(
      `SELECT r.snapshot_json,r.revision_json,r.object_key,r.body_hash,r.deleted FROM documents d JOIN revisions r ON r.document_id=d.id
      WHERE d.id=? AND ${visibleDocument('d', member, Boolean(input.version))}
        AND ${input.version ? 'r.version=?' : 'r.id=d.current_revision_id'} LIMIT 1`,
    )
      .bind(input.documentId, ...(input.version ? [input.version] : []))
      .first<{
        snapshot_json: string
        revision_json: string
        object_key: string
        body_hash: string
        deleted: number
      }>()
    if (!row) return null
    const snapshot: Record<string, unknown> = JSON.parse(row.snapshot_json)
    if (!member && (snapshot.visibility !== 'public' || snapshot.status === 'draft'))
      return null
    if (!member) {
      const folderId = typeof snapshot.folderId === 'string' ? snapshot.folderId : null
      const folder = await env.DB.prepare(
        `SELECT f.id FROM folders f WHERE f.id=? AND ${visibleFolder('f', false)}`,
      )
        .bind(folderId)
        .first()
      if (!folder) return null
    }
    const body = await readBody(env, row.object_key, row.body_hash)
    const rawRelations = Array.isArray(snapshot.relations)
      ? snapshot.relations.filter((id): id is string => typeof id === 'string')
      : []
    const relations: string[] = []
    // Bound the result and queries independently of vault size.
    for (let start = 0; start < rawRelations.length; start += 80) {
      const ids = rawRelations.slice(start, start + 80)
      const visible = await env.DB.prepare(
        `SELECT d.id FROM documents d WHERE d.id IN(${ids.map(() => '?').join(',')}) AND ${visibleDocument('d', member)}`,
      )
        .bind(...ids)
        .all<{ id: string }>()
      const visibleIds = new Set(visible.results.map((item) => item.id))
      // SQLite does not preserve the order of an IN-list. The revision snapshot
      // is the authority for relation order; SQL only decides which targets are visible.
      relations.push(...ids.filter((id) => visibleIds.has(id)))
    }
    const resolvedLinks: Array<{ href: string; slug: string }> = []
    if (typeof snapshot.path === 'string') {
      const hrefs = [
        ...new Set(
          [...body.matchAll(/\[[^\]]*\]\(([^\s)]+)(?:\s+[^)]*)?\)/g)].map(
            (match) => match[1] ?? '',
          ),
        ),
      ].slice(0, 200)
      const paths = new Map<string, string>()
      for (const href of hrefs) {
        if (!href || /^[a-z][a-z0-9+.-]*:|^\/\//i.test(href) || href.startsWith('#'))
          continue
        let path: string
        try {
          path = decodeURIComponent(
            new URL(href, `https://vault.invalid/${snapshot.path}`).pathname.slice(1),
          )
        } catch {
          continue
        }
        if (!path.endsWith('.md')) continue
        paths.set(href, path)
      }
      const targets = await env.DB.prepare(
        `SELECT d.slug,p.path FROM document_paths p JOIN documents d ON d.id=p.document_id WHERE p.path IN(SELECT value FROM json_each(?)) AND ${visibleDocument('d', member)} LIMIT 200`,
      )
        .bind(JSON.stringify([...paths.values()]))
        .all<{ slug: string; path: string }>()
      const byPath = new Map(
        targets.results.map((target) => [target.path, target.slug]),
      )
      for (const [href, path] of paths) {
        const slug = byPath.get(path)
        if (slug) resolvedLinks.push({ href, slug })
      }
    }
    return DocumentResponseSchema.parse({
      document: {
        ...snapshot,
        body,
        relations,
        relationCount: relations.length,
        deleted: Boolean(row.deleted),
      },
      revision: {
        ...JSON.parse(row.revision_json),
        body,
        contentHash: row.body_hash,
        metadata: { ...snapshot, relationCount: relations.length },
      },
      resolvedLinks,
    })
  }
  async function getDocument(input: GetDocumentInput) {
    const row = await env.DB.prepare(
      'SELECT document_id FROM aliases WHERE locale=? AND slug=?',
    )
      .bind(input.locale, input.slug)
      .first<{ document_id: string }>()
    return row ? getById({ documentId: row.document_id, version: input.version }) : null
  }

  async function getNavigation(input: NavigationInput) {
    const parent = input.parentId ?? null
    const limit = input.limit ?? 40
    const filters = { ...input, cursor: undefined, parentId: parent, limit, ...scope }
    const offset = await pageOffset(input.cursor, filters)
    if (parent) {
      const allowed = await env.DB.prepare(
        `SELECT id FROM folders f WHERE f.id=? AND (f.locale=? OR f.locale='all') AND ${visibleFolder('f', member)}`,
      )
        .bind(parent, input.locale)
        .first()
      if (!allowed) throw new ApiError('not_found', 'Folder not found.', 404)
    }
    const union = `SELECT f.id,'folder' AS kind,f.title,f.sort_order FROM folders f WHERE f.parent_id IS ? AND (f.locale=? OR f.locale='all') AND ${visibleFolder('f', member)}
      UNION ALL SELECT d.id,'document' AS kind,d.title,CAST(json_extract(d.summary_json,'$.nav.order') AS INTEGER) AS sort_order FROM documents d WHERE d.folder_id IS ? AND d.locale=? AND json_extract(d.summary_json,'$.nav.visible')=1 AND ${visibleDocument('d', member)}`
    const values = [parent, input.locale, parent, input.locale]
    const total =
      (await env.DB.prepare(`SELECT count(*) AS n FROM (${union})`)
        .bind(...values)
        .first<number>('n')) ?? 0
    const selected = await env.DB.prepare(
      `SELECT * FROM (${union}) ORDER BY kind DESC,sort_order ASC,title COLLATE NOCASE,id LIMIT ? OFFSET ?`,
    )
      .bind(...values, limit, offset)
      .all<{ id: string; kind: string }>()
    const items: NavigationItem[] = []
    const documents: DocumentSummary[] = []
    const selectedIds = JSON.stringify(selected.results.map((item) => item.id))
    const folderRows = await env.DB.prepare(
      `SELECT f.*,
      (EXISTS(SELECT 1 FROM folders child WHERE child.parent_id=f.id AND (child.locale=? OR child.locale='all') AND ${visibleFolder('child', member)})
      OR EXISTS(SELECT 1 FROM documents d WHERE d.folder_id=f.id AND d.locale=? AND ${visibleDocument('d', member)})) AS has_children
      FROM folders f WHERE f.id IN(SELECT value FROM json_each(?))`,
    )
      .bind(input.locale, input.locale, selectedIds)
      .all<FolderRow & { has_children: number }>()
    const folderMap = new Map(folderRows.results.map((folder) => [folder.id, folder]))
    const documentRows = await env.DB.prepare(
      `SELECT d.id,d.summary_json,${relationCount} FROM documents d WHERE d.id IN(SELECT value FROM json_each(?))`,
    )
      .bind(selectedIds)
      .all<SummaryRow & { id: string }>()
    const documentMap = new Map(documentRows.results.map((doc) => [doc.id, doc]))
    for (const item of selected.results) {
      if (item.kind === 'folder') {
        const folder = folderMap.get(item.id)
        if (!folder) continue
        items.push(navFolder(folder, input.locale, Boolean(folder.has_children)))
      } else {
        const row = documentMap.get(item.id)
        if (!row) continue
        const doc = summary(row)
        documents.push(doc)
        items.push({
          id: doc.id,
          parentId: parent,
          kind: 'document',
          documentId: doc.id,
          slug: doc.slug,
          title: doc.title,
          locale: doc.locale,
          order: doc.nav.order,
          hasChildren: false,
        })
      }
    }
    const ancestors: NavigationItem[] = []
    if (input.documentId) {
      const doc = await env.DB.prepare(
        `SELECT d.folder_id FROM documents d WHERE d.id=? AND d.locale=? AND ${visibleDocument('d', member)}`,
      )
        .bind(input.documentId, input.locale)
        .first<{ folder_id: string }>()
      if (doc) {
        const parents = await env.DB.prepare(
          `WITH RECURSIVE tree(id,depth) AS(SELECT ?,0 UNION ALL SELECT f.parent_id,t.depth+1 FROM folders f JOIN tree t ON f.id=t.id WHERE f.parent_id IS NOT NULL AND t.depth<32) SELECT f.*,t.depth FROM tree t JOIN folders f ON f.id=t.id ORDER BY t.depth DESC`,
        )
          .bind(doc.folder_id)
          .all<FolderRow>()
        ancestors.push(
          ...parents.results.map((folder) => navFolder(folder, input.locale)),
        )
      }
    }
    return {
      vault: (await runtimeSettings(env)).vault,
      locale: input.locale,
      items,
      documents,
      generatedAt: new Date().toISOString(),
      ancestors,
      pageInfo: await pageInfo(offset, limit, total, filters),
    }
  }

  async function search(input: SearchInput) {
    const { where, values } = await documentWhere(input)
    const filters = { ...input, cursor: undefined, ...scope }
    const offset = await pageOffset(input.cursor, filters)
    const total =
      (await env.DB.prepare(`SELECT count(*) AS n FROM documents d WHERE ${where}`)
        .bind(...values)
        .first<number>('n')) ?? 0
    const rows = await env.DB.prepare(
      `SELECT d.summary_json,${relationCount},CASE WHEN lower(d.title)=lower(?) THEN 100 WHEN instr(lower(d.title),lower(?))>0 THEN 50 ELSE 10 END AS score
      FROM documents d WHERE ${where} ORDER BY score DESC,d.updated_at DESC,d.id LIMIT ? OFFSET ?`,
    )
      .bind(input.q, input.q, ...values, input.limit, offset)
      .all<SummaryRow & { score: number }>()
    return {
      query: input.q,
      items: rows.results.map((row) => ({ ...summary(row), score: row.score })),
      pageInfo: await pageInfo(offset, input.limit, total, filters),
      generatedAt: new Date().toISOString(),
    }
  }

  async function getGraph(input: GraphInput) {
    if (input.scope === 'related' && !input.documentId)
      throw new ApiError('bad_request', 'A related graph needs a document.', 400)
    if (input.scope === 'folder' && !input.folderId)
      throw new ApiError('bad_request', 'A folder graph needs a folder.', 400)
    let centerId: string | null = null
    if (input.documentId) {
      const center = await env.DB.prepare(
        `SELECT d.id FROM documents d WHERE d.id=? AND d.locale=? AND ${visibleDocument('d', member)}`,
      )
        .bind(input.documentId, input.locale)
        .first<{ id: string }>()
      if (!center) throw new ApiError('not_found', 'Document not found.', 404)
      centerId = center.id
    }
    const base = await documentWhere({
      locale: input.locale,
      folderId: input.scope === 'folder' ? input.folderId : undefined,
    })
    if (input.scope === 'related' && centerId) {
      base.where +=
        ' AND (d.id=? OR d.id IN(SELECT target_id FROM relations WHERE source_id=?) OR d.id IN(SELECT source_id FROM relations WHERE target_id=?))'
      base.values.push(centerId, centerId, centerId)
    }
    const total =
      (await env.DB.prepare(`SELECT count(*) AS n FROM documents d WHERE ${base.where}`)
        .bind(...base.values)
        .first<number>('n')) ?? 0
    // Up to 100 documents + their containing folders keeps the transport under 200 nodes.
    const rows = await env.DB.prepare(
      `SELECT d.id,d.slug,d.title,d.type,d.locale,d.status,d.folder_id FROM documents d WHERE ${base.where} ORDER BY (d.id=?) DESC,d.id LIMIT 100`,
    )
      .bind(...base.values, centerId)
      .all<{
        id: string
        slug: string
        title: string
        type: DocumentSummary['type']
        locale: DocumentSummary['locale']
        status: DocumentSummary['status']
        folder_id: string
      }>()
    const nodes: GraphNode[] = rows.results.map((doc) => ({
      id: doc.id,
      kind: 'document',
      label: doc.title,
      slug: doc.slug,
      documentType: doc.type,
      locale: doc.locale,
      status: doc.status,
    }))
    const folderIds = [...new Set(rows.results.map((doc) => doc.folder_id))]
    const folders = await env.DB.prepare(
      'SELECT id,title FROM folders WHERE id IN(SELECT value FROM json_each(?))',
    )
      .bind(JSON.stringify(folderIds))
      .all<{ id: string; title: string }>()
    nodes.push(
      ...folders.results.map((folder) => ({
        id: folder.id,
        kind: 'folder' as const,
        label: folder.title,
        slug: null,
        documentType: null,
        locale: null,
        status: null,
      })),
    )
    const edges: GraphEdge[] = rows.results.map((doc) => ({
      id: `contains-${doc.id}`,
      source: doc.folder_id,
      target: doc.id,
      kind: 'contains',
    }))
    const ids = JSON.stringify(rows.results.map((doc) => doc.id))
    const linkWhere =
      'source_id IN(SELECT value FROM json_each(?)) AND target_id IN(SELECT value FROM json_each(?))'
    const edgeTotal =
      edges.length +
      ((await env.DB.prepare(`SELECT count(*) AS n FROM relations WHERE ${linkWhere}`)
        .bind(ids, ids)
        .first<number>('n')) ?? 0)
    const links = await env.DB.prepare(
      `SELECT source_id,target_id FROM relations WHERE ${linkWhere} ORDER BY source_id,target_id LIMIT ?`,
    )
      .bind(ids, ids, 500 - edges.length)
      .all<{ source_id: string; target_id: string }>()
    edges.push(
      ...links.results.map((link) => ({
        id: `link-${link.source_id}-${link.target_id}`,
        source: link.source_id,
        target: link.target_id,
        kind: 'related' as const,
      })),
    )
    const scopeTotals = await env.DB.prepare(
      `WITH selected AS MATERIALIZED(SELECT d.id,d.folder_id FROM documents d WHERE ${base.where}) SELECT
      (SELECT count(DISTINCT folder_id) FROM selected) AS folders,
      (SELECT count(*) FROM relations r JOIN selected source ON source.id=r.source_id JOIN selected target ON target.id=r.target_id) AS links`,
    )
      .bind(...base.values)
      .first<{ folders: number; links: number }>()
    return {
      scope: input.scope,
      locale: input.locale,
      centerId,
      nodes,
      edges,
      generatedAt: new Date().toISOString(),
      truncated: total > rows.results.length || edgeTotal > edges.length,
      totals: {
        nodes: total + (scopeTotals?.folders ?? 0),
        edges: total + (scopeTotals?.links ?? 0),
      },
    }
  }

  async function listProposals(input: ListProposalsInput) {
    const where = `${publicProposal('p', member)}${input.status ? ' AND p.status=?' : ''}`
    const values = input.status ? [input.status] : []
    const filters = { ...input, cursor: undefined, ...scope }
    const offset = await pageOffset(input.cursor, filters)
    const total =
      (await env.DB.prepare(`SELECT count(*) AS n FROM proposals p WHERE ${where}`)
        .bind(...values)
        .first<number>('n')) ?? 0
    const rows = await env.DB.prepare(
      `SELECT json_remove(p.payload_json,'$.changes','$.checks','$.discussionSummary','$.approval','$.reason') AS payload_json FROM proposals p WHERE ${where} ORDER BY p.updated_at DESC,p.id LIMIT ? OFFSET ?`,
    )
      .bind(...values, input.limit, offset)
      .all<{ payload_json: string }>()
    return {
      items: rows.results.map((row) =>
        ProposalSummarySchema.parse(JSON.parse(row.payload_json)),
      ),
      pageInfo: await pageInfo(offset, input.limit, total, filters),
    }
  }
  async function getProposal(input: { proposalId: string }) {
    const row = await env.DB.prepare(
      `SELECT p.payload_json FROM proposals p WHERE p.id=? AND ${publicProposal('p', member)}`,
    )
      .bind(input.proposalId)
      .first<{ payload_json: string }>()
    return row ? DurableProposalSchema.parse(JSON.parse(row.payload_json)) : null
  }
  function historyWhere(input: Partial<HistoryInput>) {
    const conditions = [
      member
        ? '1=1'
        : `(h.proposal_id IS NOT NULL AND EXISTS(SELECT 1 FROM proposals p WHERE p.id=h.proposal_id AND ${publicProposal('p', false)}))`,
    ]
    const values: SqlValue[] = []
    if (input.documentId) {
      conditions.push('h.document_id=?')
      values.push(input.documentId)
    }
    if (input.proposalId) {
      conditions.push('h.proposal_id=?')
      values.push(input.proposalId)
    }
    if (input.locale) {
      conditions.push('(h.locale=? OR h.locale IS NULL)')
      values.push(input.locale)
    }
    if (input.type) {
      conditions.push('h.type=?')
      values.push(input.type)
    }
    if (input.category === 'publish')
      conditions.push(
        "h.type IN('merged','document_published','document_updated','document_deleted')",
      )
    if (input.category === 'create')
      conditions.push("h.type IN('proposal_created','document_published')")
    if (input.category === 'proposal')
      conditions.push(
        "h.type IN('proposal_created','proposal_updated','changes_requested','approved')",
      )
    if (input.q) {
      conditions.push(
        "instr(lower(json_extract(h.payload_json,'$.summary')),lower(?))>0",
      )
      values.push(input.q)
    }
    return { where: conditions.join(' AND '), values }
  }
  async function getHistory(input: HistoryInput) {
    const { where, values } = historyWhere(input)
    const filters = { ...input, cursor: undefined, ...scope }
    const offset = await pageOffset(input.cursor, filters)
    const total =
      (await env.DB.prepare(`SELECT count(*) AS n FROM history h WHERE ${where}`)
        .bind(...values)
        .first<number>('n')) ?? 0
    const rows = await env.DB.prepare(
      `SELECT h.payload_json FROM history h WHERE ${where} ORDER BY h.occurred_at DESC,h.id LIMIT ? OFFSET ?`,
    )
      .bind(...values, input.limit, offset)
      .all<{ payload_json: string }>()
    return {
      items: rows.results.map((row) =>
        HistoryEventSchema.parse(JSON.parse(row.payload_json)),
      ),
      pageInfo: await pageInfo(offset, input.limit, total, filters),
    }
  }
  async function getHistoryEvent(input: { eventId: string }) {
    const { where } = historyWhere({})
    const row = await env.DB.prepare(
      `SELECT h.payload_json FROM history h WHERE h.id=? AND ${where}`,
    )
      .bind(input.eventId)
      .first<{ payload_json: string }>()
    return row
      ? { event: HistoryEventSchema.parse(JSON.parse(row.payload_json)) }
      : null
  }
  return {
    getNavigation,
    listDocuments,
    getDocument,
    getDocumentById: getById,
    getGraph,
    search,
    getHistory,
    getHistoryEvent,
    listProposals,
    getProposal,
  }
}
