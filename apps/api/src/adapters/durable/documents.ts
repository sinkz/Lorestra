import {
  DocumentSchema,
  DocumentSummarySchema,
  type Document,
  type Author,
} from '@lorestra/contracts'
import { normalizeText, putBody, type StorageBindings } from './primitives.js'

export async function documentStatements(
  env: StorageBindings,
  document: Document,
  folderId: string,
  path: string,
  message: string,
  deleted = false,
  sourceHash: string | null = null,
  publication?: { actor: Author; proposalId: string },
) {
  const doc = DocumentSchema.parse(document)
  const stored = await putBody(env, doc.id, doc.version, doc.body)
  const revisionId = `${doc.id}.v${doc.version}`
  const snapshot = DocumentSchema.omit({ body: true }).parse(doc)
  const summary = DocumentSummarySchema.parse({
    ...doc,
    folderPath: path.replace(/\/[^/]+$/, ''),
  })
  const revision = {
    id: revisionId,
    documentId: doc.id,
    version: doc.version,
    message: message.slice(0, 500) || 'Publish knowledge',
    createdAt: doc.updatedAt,
    createdBy: publication?.actor ?? doc.author,
    contentHash: stored.hash,
    proposalId: publication?.proposalId ?? null,
  }
  const statements = [
    env.DB.prepare(
      `INSERT INTO documents(id,locale,slug,title,type,visibility,status,version,folder_id,current_revision_id,deleted,updated_at,summary_json,search_text,source_hash)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,title=excluded.title,
      type=excluded.type,visibility=excluded.visibility,status=excluded.status,version=excluded.version,
      folder_id=excluded.folder_id,current_revision_id=excluded.current_revision_id,deleted=excluded.deleted,
      updated_at=excluded.updated_at,summary_json=excluded.summary_json,search_text=excluded.search_text`,
    ).bind(
      doc.id,
      doc.locale,
      doc.slug,
      doc.title,
      doc.type,
      doc.visibility,
      doc.status,
      doc.version,
      folderId,
      revisionId,
      Number(deleted),
      doc.updatedAt,
      JSON.stringify(summary),
      normalizeText([doc.title, ...doc.tags, doc.excerpt, doc.body].join(' ')),
      sourceHash,
    ),
    env.DB.prepare(
      'INSERT INTO revisions(id,document_id,version,object_key,body_hash,snapshot_json,revision_json,deleted) VALUES(?,?,?,?,?,?,?,?)',
    ).bind(
      revisionId,
      doc.id,
      doc.version,
      stored.key,
      stored.hash,
      JSON.stringify({ ...snapshot, folderId, folderPath: summary.folderPath, path }),
      JSON.stringify(revision),
      Number(deleted),
    ),
    env.DB.prepare(
      'INSERT INTO aliases(locale,slug,document_id) VALUES(?,?,?) ON CONFLICT(locale,slug) DO NOTHING',
    ).bind(doc.locale, doc.slug, doc.id),
    env.DB.prepare(
      'INSERT INTO document_paths(path,document_id) VALUES(?,?) ON CONFLICT(path) DO NOTHING',
    ).bind(path, doc.id),
    env.DB.prepare('DELETE FROM relations WHERE source_id=?').bind(doc.id),
  ]
  return {
    statements,
    relations: deleted
      ? []
      : doc.relations.map((target) =>
          env.DB.prepare('INSERT INTO relations(source_id,target_id) VALUES(?,?)').bind(
            doc.id,
            target,
          ),
        ),
  }
}
