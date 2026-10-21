PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS context_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  repository TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('repository', 'standard', 'contract', 'policy', 'decision')),
  path TEXT NOT NULL,
  uri TEXT NOT NULL,
  owner TEXT NOT NULL,
  version TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'deprecated')),
  superseded_by TEXT,
  keywords TEXT NOT NULL CHECK (json_valid(keywords)),
  summary TEXT NOT NULL,
  content TEXT NOT NULL CHECK (length(CAST(content AS BLOB)) <= 32000)
) STRICT;

CREATE INDEX IF NOT EXISTS context_documents_repository ON context_documents(repository, status);

CREATE VIRTUAL TABLE IF NOT EXISTS context_documents_fts USING fts5(
  title, repository, keywords, summary, content,
  content='context_documents', content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS context_documents_ai AFTER INSERT ON context_documents BEGIN
  INSERT INTO context_documents_fts(rowid, title, repository, keywords, summary, content)
  VALUES (new.rowid, new.title, new.repository, new.keywords, new.summary, new.content);
END;

CREATE TRIGGER IF NOT EXISTS context_documents_ad AFTER DELETE ON context_documents BEGIN
  INSERT INTO context_documents_fts(context_documents_fts, rowid, title, repository, keywords, summary, content)
  VALUES ('delete', old.rowid, old.title, old.repository, old.keywords, old.summary, old.content);
END;

CREATE TRIGGER IF NOT EXISTS context_documents_au AFTER UPDATE ON context_documents BEGIN
  INSERT INTO context_documents_fts(context_documents_fts, rowid, title, repository, keywords, summary, content)
  VALUES ('delete', old.rowid, old.title, old.repository, old.keywords, old.summary, old.content);
  INSERT INTO context_documents_fts(rowid, title, repository, keywords, summary, content)
  VALUES (new.rowid, new.title, new.repository, new.keywords, new.summary, new.content);
END;

PRAGMA user_version = 1;
