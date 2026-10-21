-- Isolated B1 candidate. Not a hosting migration and never applied automatically.
-- Import verification and policy approval are separate, privileged B2 work.
CREATE TABLE metadata (
  id INTEGER PRIMARY KEY CHECK(id=1), identity TEXT NOT NULL,
  fee_multiplier REAL NOT NULL CHECK(typeof(fee_multiplier) IN ('integer','real') AND fee_multiplier=2)
);
CREATE TABLE requests (
  id TEXT PRIMARY KEY, month TEXT NOT NULL, pilot TEXT,
  reserved INTEGER NOT NULL CHECK(typeof(reserved)='integer' AND reserved BETWEEN 0 AND 9007199254740991), charged INTEGER, usage_cost INTEGER,
  state TEXT NOT NULL CHECK(state IN ('reserved','unknown','settled')),
  created_at INTEGER NOT NULL, ended_at INTEGER, outcome TEXT, response_id TEXT,
  input_tokens INTEGER, output_tokens INTEGER, model TEXT NOT NULL,
  CHECK(charged IS NULL OR (typeof(charged)='integer' AND charged BETWEEN 0 AND 9007199254740991)),
  CHECK(usage_cost IS NULL OR (typeof(usage_cost)='integer' AND usage_cost BETWEEN 0 AND 9007199254740991)),
  CHECK(input_tokens IS NULL OR (typeof(input_tokens)='integer' AND input_tokens BETWEEN 0 AND 9007199254740991)),
  CHECK(output_tokens IS NULL OR (typeof(output_tokens)='integer' AND output_tokens BETWEEN 0 AND 9007199254740991)),
  CHECK(typeof(created_at)='integer' AND created_at BETWEEN 0 AND 9007199254740991),
  CHECK(ended_at IS NULL OR (typeof(ended_at)='integer' AND ended_at BETWEEN 0 AND 9007199254740991)),
  CHECK(state<>'settled' OR (charged IS NOT NULL AND charged<=reserved))
);
CREATE INDEX request_month ON requests(month);
CREATE INDEX request_pilot ON requests(pilot);
CREATE TABLE request_profiles (
  request_id TEXT PRIMARY KEY, provider TEXT NOT NULL, model TEXT NOT NULL,
  price_version TEXT NOT NULL, adapter_version TEXT NOT NULL, billing_profile TEXT NOT NULL,
  input_nano INTEGER NOT NULL CHECK(typeof(input_nano)='integer' AND input_nano BETWEEN 0 AND 9007199254740991),
  output_nano INTEGER NOT NULL CHECK(typeof(output_nano)='integer' AND output_nano BETWEEN 0 AND 9007199254740991),
  fee_multiplier REAL NOT NULL CHECK(typeof(fee_multiplier) IN ('integer','real') AND fee_multiplier=2)
);
CREATE TABLE ai_budget_control (
  id INTEGER PRIMARY KEY CHECK(id=1), authority TEXT NOT NULL CHECK(authority='market-radar-product'),
  schema_version TEXT NOT NULL CHECK(schema_version='d1-budget-v1'),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(typeof(enabled)='integer' AND enabled IN (0,1)),
  import_status TEXT NOT NULL DEFAULT 'pending' CHECK(import_status IN ('pending','verified')),
  import_hash TEXT, policy_id TEXT, disabled_reason TEXT,
  CHECK(import_status<>'verified' OR (length(import_hash)=64 AND import_hash NOT GLOB '*[^0-9a-f]*'))
);
INSERT INTO ai_budget_control(id,authority,schema_version) VALUES(1,'market-radar-product','d1-budget-v1');
CREATE TABLE ai_budget_policies (
  id TEXT PRIMARY KEY, mode TEXT NOT NULL CHECK(mode IN ('pilot','production')),
  pilot TEXT NOT NULL, authorization_id TEXT NOT NULL, scope_hash TEXT NOT NULL,
  max_calls INTEGER NOT NULL CHECK(typeof(max_calls)='integer' AND max_calls BETWEEN 1 AND 9007199254740991),
  max_nano INTEGER NOT NULL CHECK(typeof(max_nano)='integer' AND max_nano BETWEEN 1 AND 9007199254740991),
  stop_on_failure INTEGER NOT NULL CHECK(typeof(stop_on_failure)='integer' AND stop_on_failure IN (0,1)),
  stopped INTEGER NOT NULL DEFAULT 0 CHECK(typeof(stopped)='integer' AND stopped IN (0,1)), stop_reason TEXT,
  CHECK((stopped=0 AND stop_reason IS NULL) OR (stopped=1 AND stop_reason IS NOT NULL))
);
CREATE TABLE ai_dispatch_intents (
  request_id TEXT PRIMARY KEY REFERENCES requests(id),
  policy_id TEXT NOT NULL REFERENCES ai_budget_policies(id), authorization_id TEXT NOT NULL,
  scope_hash TEXT NOT NULL, idempotency_key TEXT NOT NULL,
  payload_hash TEXT NOT NULL, payload_bytes INTEGER NOT NULL CHECK(typeof(payload_bytes)='integer' AND payload_bytes BETWEEN 1 AND 9007199254740991),
  snapshot_id TEXT NOT NULL, snapshot_hash TEXT NOT NULL, catalog_hash TEXT NOT NULL, profile_hash TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('ready','dispatch_started','unknown','settled')),
  dispatch_started_at INTEGER CHECK(dispatch_started_at IS NULL OR (typeof(dispatch_started_at)='integer' AND dispatch_started_at BETWEEN 0 AND 9007199254740991)),
  UNIQUE(scope_hash,idempotency_key)
);
CREATE TRIGGER request_profile_required BEFORE INSERT ON requests
WHEN NOT EXISTS(SELECT 1 FROM request_profiles WHERE request_id=NEW.id)
BEGIN SELECT RAISE(ABORT,'budget_profile_required'); END;
CREATE TRIGGER request_identity_immutable BEFORE UPDATE ON requests
WHEN NEW.id IS NOT OLD.id OR NEW.month IS NOT OLD.month OR NEW.pilot IS NOT OLD.pilot
  OR NEW.reserved IS NOT OLD.reserved OR NEW.created_at IS NOT OLD.created_at OR NEW.model IS NOT OLD.model
BEGIN SELECT RAISE(ABORT,'budget_identity_immutable'); END;
CREATE TRIGGER request_no_delete BEFORE DELETE ON requests
BEGIN SELECT RAISE(ABORT,'budget_identity_immutable'); END;
CREATE TRIGGER profile_no_update BEFORE UPDATE ON request_profiles
BEGIN SELECT RAISE(ABORT,'budget_profile_immutable'); END;
CREATE TRIGGER profile_no_delete BEFORE DELETE ON request_profiles
BEGIN SELECT RAISE(ABORT,'budget_profile_immutable'); END;
CREATE TRIGGER intent_identity_immutable BEFORE UPDATE ON ai_dispatch_intents
WHEN NEW.request_id IS NOT OLD.request_id OR NEW.policy_id IS NOT OLD.policy_id
  OR NEW.authorization_id IS NOT OLD.authorization_id OR NEW.scope_hash IS NOT OLD.scope_hash
  OR NEW.idempotency_key IS NOT OLD.idempotency_key OR NEW.payload_hash IS NOT OLD.payload_hash
  OR NEW.payload_bytes IS NOT OLD.payload_bytes OR NEW.snapshot_id IS NOT OLD.snapshot_id
  OR NEW.snapshot_hash IS NOT OLD.snapshot_hash OR NEW.catalog_hash IS NOT OLD.catalog_hash
  OR NEW.profile_hash IS NOT OLD.profile_hash
  OR (OLD.state<>'ready' AND NEW.state='ready')
  OR (NEW.state='dispatch_started' AND OLD.state<>'ready')
  OR (OLD.dispatch_started_at IS NOT NULL AND NEW.dispatch_started_at IS NOT OLD.dispatch_started_at)
BEGIN SELECT RAISE(ABORT,'budget_identity_immutable'); END;
CREATE TRIGGER intent_no_delete BEFORE DELETE ON ai_dispatch_intents
BEGIN SELECT RAISE(ABORT,'budget_identity_immutable'); END;
CREATE TRIGGER policy_identity_immutable BEFORE UPDATE ON ai_budget_policies
WHEN NEW.id IS NOT OLD.id OR NEW.mode IS NOT OLD.mode OR NEW.pilot IS NOT OLD.pilot
  OR NEW.authorization_id IS NOT OLD.authorization_id OR NEW.scope_hash IS NOT OLD.scope_hash
  OR NEW.max_calls IS NOT OLD.max_calls OR NEW.max_nano IS NOT OLD.max_nano
  OR NEW.stop_on_failure IS NOT OLD.stop_on_failure OR OLD.stopped=1 OR NEW.stopped<>1 OR NEW.stop_reason IS NULL
BEGIN SELECT RAISE(ABORT,'budget_policy_immutable'); END;
CREATE TRIGGER policy_no_delete BEFORE DELETE ON ai_budget_policies
BEGIN SELECT RAISE(ABORT,'budget_policy_immutable'); END;
-- SQLite REPLACE does not reliably fire DELETE triggers. Explicit insert guards close it.
CREATE TRIGGER request_no_replace BEFORE INSERT ON requests WHEN EXISTS(SELECT 1 FROM requests WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'budget_identity_immutable'); END;
CREATE TRIGGER profile_no_replace BEFORE INSERT ON request_profiles WHEN EXISTS(SELECT 1 FROM request_profiles WHERE request_id=NEW.request_id)
BEGIN SELECT RAISE(ABORT,'budget_profile_immutable'); END;
CREATE TRIGGER policy_no_replace BEFORE INSERT ON ai_budget_policies WHEN EXISTS(SELECT 1 FROM ai_budget_policies WHERE id=NEW.id)
BEGIN SELECT RAISE(ABORT,'budget_policy_immutable'); END;
CREATE TRIGGER intent_no_replace BEFORE INSERT ON ai_dispatch_intents
WHEN EXISTS(SELECT 1 FROM ai_dispatch_intents WHERE request_id=NEW.request_id OR (scope_hash=NEW.scope_hash AND idempotency_key=NEW.idempotency_key))
BEGIN SELECT RAISE(ABORT,'budget_identity_immutable'); END;
CREATE TRIGGER metadata_no_update BEFORE UPDATE ON metadata
BEGIN SELECT RAISE(ABORT,'budget_identity_immutable'); END;
CREATE TRIGGER metadata_no_delete BEFORE DELETE ON metadata
BEGIN SELECT RAISE(ABORT,'budget_identity_immutable'); END;
CREATE TRIGGER metadata_no_replace BEFORE INSERT ON metadata WHEN EXISTS(SELECT 1 FROM metadata)
BEGIN SELECT RAISE(ABORT,'budget_identity_immutable'); END;
CREATE TRIGGER control_no_delete BEFORE DELETE ON ai_budget_control
BEGIN SELECT RAISE(ABORT,'budget_identity_immutable'); END;
CREATE TRIGGER control_no_replace BEFORE INSERT ON ai_budget_control WHEN EXISTS(SELECT 1 FROM ai_budget_control)
BEGIN SELECT RAISE(ABORT,'budget_identity_immutable'); END;
CREATE TRIGGER control_identity_immutable BEFORE UPDATE ON ai_budget_control
WHEN NEW.id IS NOT OLD.id OR NEW.authority IS NOT OLD.authority OR NEW.schema_version IS NOT OLD.schema_version
  OR (OLD.import_status='verified' AND (NEW.import_status IS NOT OLD.import_status OR NEW.import_hash IS NOT OLD.import_hash))
BEGIN SELECT RAISE(ABORT,'budget_identity_immutable'); END;
