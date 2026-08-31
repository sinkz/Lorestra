-- Canonical bodies are immutable R2 objects. This database publishes pointers.
PRAGMA foreign_keys = ON;
CREATE TABLE vault_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT INTO vault_settings VALUES ('read_only', 'false');
CREATE TABLE members (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('reader','contributor','maintainer')),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY, principal_id TEXT NOT NULL REFERENCES members(id),
  csrf_hash TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE folders (
  id TEXT PRIMARY KEY, slug TEXT NOT NULL, title TEXT NOT NULL,
  parent_id TEXT REFERENCES folders(id) DEFERRABLE INITIALLY DEFERRED,
  sort_order INTEGER NOT NULL, visibility TEXT NOT NULL, locale TEXT NOT NULL,
  source_hash TEXT NOT NULL
);
CREATE INDEX folders_parent ON folders(parent_id, locale, sort_order, id);
CREATE TABLE documents (
  id TEXT PRIMARY KEY, locale TEXT NOT NULL, slug TEXT NOT NULL,
  title TEXT NOT NULL, type TEXT NOT NULL, visibility TEXT NOT NULL,
  status TEXT NOT NULL, version INTEGER NOT NULL CHECK(version > 0),
  folder_id TEXT NOT NULL REFERENCES folders(id), current_revision_id TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN (0,1)),
  updated_at TEXT NOT NULL, summary_json TEXT NOT NULL,
  search_text TEXT NOT NULL, source_hash TEXT,
  UNIQUE(locale, slug)
);
CREATE INDEX documents_listing ON documents(locale, visibility, deleted, updated_at DESC, id);
CREATE INDEX documents_folder ON documents(folder_id, locale, deleted, title, id);
CREATE TABLE aliases (
  locale TEXT NOT NULL, slug TEXT NOT NULL, document_id TEXT NOT NULL REFERENCES documents(id),
  PRIMARY KEY(locale, slug)
);
CREATE TABLE revisions (
  id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id),
  version INTEGER NOT NULL, object_key TEXT NOT NULL, body_hash TEXT NOT NULL,
  snapshot_json TEXT NOT NULL, revision_json TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN (0,1)),
  UNIQUE(document_id, version)
);
CREATE TABLE relations (
  source_id TEXT NOT NULL REFERENCES documents(id), target_id TEXT NOT NULL REFERENCES documents(id),
  PRIMARY KEY(source_id, target_id)
);
CREATE INDEX relations_incoming ON relations(target_id, source_id);
CREATE TABLE proposals (
  id TEXT PRIMARY KEY, version INTEGER NOT NULL, status TEXT NOT NULL,
  author_id TEXT NOT NULL REFERENCES members(id), updated_at TEXT NOT NULL,
  payload_json TEXT NOT NULL, content_hash TEXT NOT NULL
);
CREATE INDEX proposals_listing ON proposals(status, updated_at DESC, id);
CREATE TABLE proposal_versions (
  proposal_id TEXT NOT NULL REFERENCES proposals(id), version INTEGER NOT NULL,
  payload_json TEXT NOT NULL, PRIMARY KEY(proposal_id, version)
);
CREATE TABLE proposal_targets (
  proposal_id TEXT NOT NULL REFERENCES proposals(id), document_id TEXT NOT NULL,
  PRIMARY KEY(proposal_id, document_id)
);
CREATE TABLE history (
  id TEXT PRIMARY KEY, occurred_at TEXT NOT NULL, type TEXT NOT NULL,
  proposal_id TEXT REFERENCES proposals(id), document_id TEXT REFERENCES documents(id),
  locale TEXT, payload_json TEXT NOT NULL
);
CREATE INDEX history_listing ON history(occurred_at DESC, id);
CREATE INDEX history_document ON history(document_id, occurred_at DESC, id);
CREATE TABLE operations (
  id TEXT PRIMARY KEY, principal_id TEXT NOT NULL REFERENCES members(id),
  payload_hash TEXT NOT NULL, result_json TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE rate_windows (
  key TEXT PRIMARY KEY, count INTEGER NOT NULL CHECK(count >= 0), expires_at INTEGER NOT NULL
);
-- Zero affected rows are not a SQL error. A false predicate here aborts the batch.
CREATE TABLE commit_guards (
  id TEXT PRIMARY KEY, ok INTEGER NOT NULL CONSTRAINT publication_precondition CHECK(ok = 1)
);
CREATE TRIGGER immutable_revisions_update BEFORE UPDATE ON revisions BEGIN
  SELECT RAISE(ABORT, 'immutable_revision');
END;
CREATE TRIGGER immutable_revisions_delete BEFORE DELETE ON revisions BEGIN
  SELECT RAISE(ABORT, 'immutable_revision');
END;
CREATE TRIGGER immutable_history_update BEFORE UPDATE ON history BEGIN
  SELECT RAISE(ABORT, 'immutable_history');
END;
CREATE TRIGGER immutable_history_delete BEFORE DELETE ON history BEGIN
  SELECT RAISE(ABORT, 'immutable_history');
END;
CREATE TRIGGER immutable_proposal_versions_update BEFORE UPDATE ON proposal_versions BEGIN
  SELECT RAISE(ABORT, 'immutable_proposal_version');
END;
CREATE TRIGGER immutable_proposal_versions_delete BEFORE DELETE ON proposal_versions BEGIN
  SELECT RAISE(ABORT, 'immutable_proposal_version');
END;
