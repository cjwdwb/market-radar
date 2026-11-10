-- C2 additive, isolated candidate. No production migration or authorization seeds.
CREATE TABLE ai_access_grants (
  site_id TEXT NOT NULL, subject_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK(typeof(revision)='integer' AND revision BETWEEN 1 AND 9007199254740991),
  enabled INTEGER NOT NULL CHECK(typeof(enabled)='integer' AND enabled IN(0,1)),
  expires_at INTEGER NOT NULL CHECK(typeof(expires_at)='integer' AND expires_at BETWEEN -9007199254740991 AND 9007199254740991),
  permissions_json TEXT NOT NULL CHECK(typeof(permissions_json)='text' AND length(permissions_json)<=128
    AND instr(permissions_json,char(0))=0 AND instr(permissions_json,'\u0000')=0
    AND json_valid(permissions_json) AND json_type(permissions_json)='array'),
  symbols_json TEXT NOT NULL CHECK(typeof(symbols_json)='text' AND length(symbols_json)<=2048
    AND instr(symbols_json,char(0))=0 AND instr(symbols_json,'\u0000')=0
    AND json_valid(symbols_json) AND json_type(symbols_json)='array' AND json_array_length(symbols_json)<=16),
  PRIMARY KEY(site_id,subject_id)
) WITHOUT ROWID;
-- Validate the same decoded grant members on both write paths. Invalidating a grant and
-- then repairing it must never restore access to snapshots at its original revision.
CREATE VIEW ai_invalid_grant_members AS
  SELECT site_id,subject_id FROM ai_access_grants
  WHERE EXISTS(SELECT 1 FROM json_each(permissions_json)
    WHERE type<>'text' OR value NOT IN ('read','invoke','manage'))
  OR EXISTS(SELECT 1 FROM json_each(symbols_json)
    WHERE type<>'text' OR length(value) NOT BETWEEN 1 AND 80 OR value GLOB '*[^A-Za-z0-9^._:/-]*');
CREATE TRIGGER ai_grant_validate_insert AFTER INSERT ON ai_access_grants
WHEN EXISTS(SELECT 1 FROM ai_invalid_grant_members WHERE site_id=NEW.site_id AND subject_id=NEW.subject_id)
BEGIN SELECT RAISE(ABORT,'grant_invalid'); END;
CREATE TRIGGER ai_grant_validate_update AFTER UPDATE OF permissions_json,symbols_json ON ai_access_grants
WHEN EXISTS(SELECT 1 FROM ai_invalid_grant_members WHERE site_id=NEW.site_id AND subject_id=NEW.subject_id)
BEGIN SELECT RAISE(ABORT,'grant_invalid'); END;
-- Keep one permanent revision marker per principal. REPLACE can bypass DELETE triggers.
CREATE TRIGGER ai_grant_no_replace BEFORE INSERT ON ai_access_grants
WHEN EXISTS(SELECT 1 FROM ai_access_grants WHERE site_id=NEW.site_id AND subject_id=NEW.subject_id)
BEGIN SELECT RAISE(ABORT,'grant_identity_immutable'); END;
CREATE TRIGGER ai_grant_no_delete BEFORE DELETE ON ai_access_grants
BEGIN SELECT RAISE(ABORT,'grant_identity_immutable'); END;
CREATE TRIGGER ai_grant_identity BEFORE UPDATE OF site_id,subject_id ON ai_access_grants
WHEN NEW.site_id IS NOT OLD.site_id OR NEW.subject_id IS NOT OLD.subject_id
BEGIN SELECT RAISE(ABORT,'grant_identity_immutable'); END;
CREATE TRIGGER ai_grant_revision BEFORE UPDATE ON ai_access_grants
WHEN NEW.revision<OLD.revision OR (NEW.revision=OLD.revision AND (
  NEW.enabled>OLD.enabled OR NEW.expires_at>OLD.expires_at
  OR EXISTS(SELECT value FROM json_each(NEW.permissions_json) EXCEPT SELECT value FROM json_each(OLD.permissions_json))
  OR EXISTS(SELECT value FROM json_each(NEW.symbols_json) EXCEPT SELECT value FROM json_each(OLD.symbols_json))
))
BEGIN SELECT RAISE(ABORT,'grant_revision_required'); END;
CREATE TABLE ai_context_policy_links (
  policy_id TEXT PRIMARY KEY REFERENCES ai_budget_policies(id), authorization_id TEXT NOT NULL,
  policy_version TEXT NOT NULL, scope_hash TEXT NOT NULL, review_started_at INTEGER NOT NULL,
  review_until INTEGER NOT NULL CHECK(review_until=review_started_at+1200000)
);
CREATE TABLE ai_snapshots (
  id TEXT PRIMARY KEY, site_id TEXT NOT NULL, subject_id TEXT NOT NULL, grant_revision INTEGER NOT NULL,
  scope_hash TEXT NOT NULL, symbol TEXT NOT NULL, policy_id TEXT NOT NULL REFERENCES ai_context_policy_links(policy_id),
  captured_at INTEGER NOT NULL, fresh_until INTEGER NOT NULL, access_until INTEGER NOT NULL, delete_after INTEGER NOT NULL,
  body TEXT NOT NULL CHECK(length(CAST(body AS BLOB))<=131072), digest TEXT NOT NULL,
  CHECK(captured_at<fresh_until AND fresh_until<=access_until AND access_until<=delete_after)
);
CREATE INDEX ai_snapshot_owner ON ai_snapshots(scope_hash,delete_after);
CREATE TABLE ai_results (
  request_id TEXT PRIMARY KEY REFERENCES requests(id), snapshot_id TEXT NOT NULL UNIQUE REFERENCES ai_snapshots(id),
  body TEXT NOT NULL CHECK(length(CAST(body AS BLOB))<=65536), digest TEXT NOT NULL, delete_after INTEGER NOT NULL
);
CREATE INDEX ai_result_expiry ON ai_results(delete_after);
CREATE TRIGGER ai_snapshot_immutable BEFORE UPDATE ON ai_snapshots BEGIN SELECT RAISE(ABORT,'record_immutable'); END;
CREATE TRIGGER ai_snapshot_no_replace BEFORE INSERT ON ai_snapshots WHEN EXISTS(SELECT 1 FROM ai_snapshots WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'record_immutable'); END;
CREATE TRIGGER ai_result_immutable BEFORE UPDATE ON ai_results BEGIN SELECT RAISE(ABORT,'record_immutable'); END;
CREATE TRIGGER ai_result_no_replace BEFORE INSERT ON ai_results WHEN EXISTS(SELECT 1 FROM ai_results WHERE request_id=NEW.request_id OR snapshot_id=NEW.snapshot_id)
BEGIN SELECT RAISE(ABORT,'record_immutable'); END;
CREATE TRIGGER ai_policy_link_immutable BEFORE UPDATE ON ai_context_policy_links BEGIN SELECT RAISE(ABORT,'record_immutable'); END;
CREATE TRIGGER ai_policy_link_no_delete BEFORE DELETE ON ai_context_policy_links BEGIN SELECT RAISE(ABORT,'record_immutable'); END;
CREATE TRIGGER ai_policy_link_no_replace BEFORE INSERT ON ai_context_policy_links WHEN EXISTS(SELECT 1 FROM ai_context_policy_links WHERE policy_id=NEW.policy_id)
BEGIN SELECT RAISE(ABORT,'record_immutable'); END;
