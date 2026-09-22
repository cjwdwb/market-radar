-- Physical schema2: new local databases only, never monitor initialization/migration.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS archive_meta (
  id INTEGER PRIMARY KEY CHECK(id=1), schema_version INTEGER NOT NULL CHECK(schema_version=2), revision INTEGER NOT NULL DEFAULT 0,
  collection_enabled INTEGER NOT NULL DEFAULT 1 CHECK(collection_enabled IN (0,1))
);
INSERT OR IGNORE INTO archive_meta(id,schema_version) VALUES(1,2);
CREATE TABLE IF NOT EXISTS archive_runs (
  owner TEXT NOT NULL, run_id TEXT NOT NULL, config TEXT NOT NULL,
  cursor TEXT, status TEXT NOT NULL, reason TEXT,
  requests INTEGER NOT NULL DEFAULT 0, bytes INTEGER NOT NULL DEFAULT 0,
  pages INTEGER NOT NULL DEFAULT 0, writes INTEGER NOT NULL DEFAULT 0,
  lease_token INTEGER, lease_until INTEGER, page_attempts INTEGER NOT NULL DEFAULT 0,
  retry_not_before INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(owner,run_id)
);
CREATE TABLE IF NOT EXISTS archive_pages (
  owner TEXT NOT NULL, run_id TEXT NOT NULL, page_number INTEGER NOT NULL,
  revision INTEGER NOT NULL UNIQUE, fingerprint TEXT NOT NULL,
  before_cursor TEXT, after_cursor TEXT, received_at INTEGER NOT NULL,
  accepted INTEGER NOT NULL, duplicates INTEGER NOT NULL, revisions INTEGER NOT NULL,
  traversal_done INTEGER NOT NULL CHECK(traversal_done IN (0,1)),
  PRIMARY KEY(owner,run_id,page_number), UNIQUE(owner,run_id,fingerprint),
  FOREIGN KEY(owner,run_id) REFERENCES archive_runs(owner,run_id)
);
CREATE TABLE IF NOT EXISTS archive_facts (
  id INTEGER PRIMARY KEY, owner TEXT NOT NULL, run_id TEXT NOT NULL,
  revision INTEGER NOT NULL, source TEXT NOT NULL, asset TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('bar','information')), logical_key TEXT NOT NULL,
  hash TEXT NOT NULL, occurred_at INTEGER, sort_at INTEGER NOT NULL, received_at INTEGER NOT NULL,
  identity TEXT NOT NULL CHECK(identity IN ('fixture','reconstructed')), payload TEXT NOT NULL,
  FOREIGN KEY(owner,run_id) REFERENCES archive_runs(owner,run_id),
  FOREIGN KEY(revision) REFERENCES archive_pages(revision)
);
CREATE INDEX IF NOT EXISTS archive_head ON archive_facts(owner,source,asset,kind,logical_key,revision DESC,id DESC);
CREATE INDEX IF NOT EXISTS archive_query ON archive_facts(owner,source,asset,kind,sort_at,id);
CREATE TABLE IF NOT EXISTS archive_sources (
  source TEXT PRIMARY KEY, last_dispatch INTEGER NOT NULL DEFAULT 0, retry_not_before INTEGER NOT NULL DEFAULT 0,
  lease_owner TEXT, lease_run TEXT, lease_token INTEGER, lease_until INTEGER
);
CREATE TABLE IF NOT EXISTS archive_source_requests (
  source TEXT NOT NULL, owner TEXT NOT NULL, run_id TEXT NOT NULL, request_number INTEGER NOT NULL, requested_at INTEGER NOT NULL,
  PRIMARY KEY(owner,run_id,request_number),
  FOREIGN KEY(owner,run_id) REFERENCES archive_runs(owner,run_id),
  FOREIGN KEY(source) REFERENCES archive_sources(source)
);
