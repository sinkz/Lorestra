-- Logical Markdown paths are aliases, like slugs: renaming must not steal links.
CREATE TABLE document_paths (
  path TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id)
);
INSERT INTO document_paths(path,document_id)
SELECT DISTINCT json_extract(snapshot_json,'$.path'),document_id FROM revisions
WHERE json_extract(snapshot_json,'$.path') IS NOT NULL;
CREATE INDEX document_paths_document ON document_paths(document_id);
