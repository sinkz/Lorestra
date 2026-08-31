CREATE INDEX IF NOT EXISTS rate_windows_expiry ON rate_windows(expires_at);
CREATE INDEX IF NOT EXISTS revisions_logical_path ON revisions(json_extract(snapshot_json,'$.path'));
CREATE INDEX IF NOT EXISTS history_timeline ON history(occurred_at DESC,id);
CREATE INDEX IF NOT EXISTS documents_locale_title ON documents(locale,title COLLATE NOCASE,id);
