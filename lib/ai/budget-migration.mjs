import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { lstatSync, realpathSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { REAL_AI, DEEPSEEK_AI, SYNTHETIC_PILOT_ID } from './real-config.ts';

// Offline B2 rehearsal only: no CLI, default database path, provider, or network transport.
// A JSON export is evidence, never a capability to import or enable consumption.
const FORMAT = 'market-radar-budget-transfer-v1', MAX_ROWS = 64, MAX_BYTES = 256 * 1024;
const requests = ['id','month','pilot','reserved','charged','usage_cost','state','created_at','ended_at','outcome','response_id','input_tokens','output_tokens','model'];
const profiles = ['request_id','provider','model','price_version','adapter_version','billing_profile','input_nano','output_nano','fee_multiplier'];
const metadata = ['id','identity','fee_multiplier'];
const fields = { metadata, requests, request_profiles: profiles };
const knownProfiles = { openai: REAL_AI, deepseek: DEEPSEEK_AI };
const capabilities = new WeakMap();
const targetCapabilities = new WeakMap();
const hash = value => createHash('sha256').update(value).digest('hex');
const normalize = sql => sql?.replace(/\s+/g, ' ').trim().replace(/;$/, '').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
const identity = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,180}$/.test(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const time = value => integer(value) && value <= 8_640_000_000_000_000;
function fail(code) { throw new Error(code); }
const sourceSchema = {
  metadata: `CREATE TABLE metadata (id INTEGER PRIMARY KEY CHECK(id=1), identity TEXT NOT NULL, fee_multiplier REAL NOT NULL)`,
  requests: `CREATE TABLE requests (id TEXT PRIMARY KEY, month TEXT NOT NULL, pilot TEXT, reserved INTEGER NOT NULL CHECK(reserved>=0),
    charged INTEGER, usage_cost INTEGER, state TEXT NOT NULL CHECK(state IN ('reserved','unknown','settled')), created_at INTEGER NOT NULL,
    ended_at INTEGER, outcome TEXT, response_id TEXT, input_tokens INTEGER, output_tokens INTEGER, model TEXT NOT NULL)`,
  request_month: 'CREATE INDEX request_month ON requests(month)', request_pilot: 'CREATE INDEX request_pilot ON requests(pilot)',
  request_profiles: `CREATE TABLE request_profiles (request_id TEXT PRIMARY KEY, provider TEXT NOT NULL, model TEXT NOT NULL, price_version TEXT NOT NULL,
    adapter_version TEXT NOT NULL, billing_profile TEXT NOT NULL, input_nano INTEGER NOT NULL CHECK(input_nano>=0),
    output_nano INTEGER NOT NULL CHECK(output_nano>=0), fee_multiplier REAL NOT NULL CHECK(fee_multiplier>=2))`,
  require_request_profile: `CREATE TRIGGER require_request_profile BEFORE INSERT ON requests
    WHEN NOT EXISTS(SELECT 1 FROM request_profiles WHERE request_id=NEW.id) BEGIN SELECT RAISE(ABORT,'budget_profile_required'); END`,
};
const retirementSchema = {
  ai_budget_retirement: `CREATE TABLE ai_budget_retirement (id INTEGER PRIMARY KEY CHECK(id=1), format TEXT NOT NULL,
    migration_id TEXT NOT NULL, target_id TEXT NOT NULL, target_instance TEXT NOT NULL, payload_hash TEXT NOT NULL, retired_at INTEGER NOT NULL)`,
};
for (const table of [...Object.keys(fields), 'ai_budget_retirement']) for (const operation of ['INSERT','UPDATE','DELETE']) {
  const name = `ai_retired_${table}_${operation.toLowerCase()}`;
  retirementSchema[name] = `CREATE TRIGGER ${name} BEFORE ${operation} ON ${table} BEGIN SELECT RAISE(ABORT,'budget_retired'); END`;
}
function checkObjects(actual, expected) {
  if (actual.length !== Object.keys(expected).length || actual.some(row => normalize(row.sql) !== normalize(expected[row.name]))) fail('migration_schema_unsupported');
}
function sourceObjects(db) { return db.prepare("SELECT name,sql FROM sqlite_master WHERE name NOT GLOB 'sqlite_*' ORDER BY name").all(); }
function readSource(db) {
  const objects = sourceObjects(db), retired = objects.some(row => row.name === 'ai_budget_retirement');
  checkObjects(objects, retired ? { ...sourceSchema, ...retirementSchema } : sourceSchema);
  if (db.prepare('PRAGMA quick_check').get().quick_check !== 'ok') fail('migration_source_invalid');
  const result = {};
  for (const [table, columns] of Object.entries(fields)) {
    if (db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count > (table === 'metadata' ? 1 : MAX_ROWS)) fail('migration_input_limit');
    result[table] = db.prepare(`SELECT ${columns.join(',')} FROM ${table} ORDER BY 1`).all();
  }
  return { payload: validatePayload(result), retired };
}
function validatePayload(payload) {
  const serialized = JSON.stringify(payload);
  if (Buffer.byteLength(serialized) > MAX_BYTES || payload.metadata.length !== 1 || payload.requests.length > MAX_ROWS
    || payload.request_profiles.length !== payload.requests.length) fail('migration_input_limit');
  const meta = payload.metadata[0];
  if (meta.id !== 1 || meta.identity !== 'market-radar-product-budget-v2' || meta.fee_multiplier !== 2) fail('migration_source_invalid');
  const profileMap = new Map(payload.request_profiles.map(row => [row.request_id, row]));
  if (profileMap.size !== payload.requests.length || new Set(payload.requests.map(row => row.id)).size !== payload.requests.length) fail('migration_source_invalid');
  for (const row of payload.requests) {
    const saved = profileMap.get(row.id), profile = saved && knownProfiles[saved.provider];
    if (!profile || !identity(row.id) || row.pilot !== SYNTHETIC_PILOT_ID || row.model !== profile.model || saved.model !== profile.model
      || saved.price_version !== profile.priceVersion || saved.adapter_version !== profile.adapterVersion || saved.billing_profile !== profile.billingProfile
      || saved.input_nano !== profile.cacheWriteNanoPerToken || saved.output_nano !== profile.outputNanoPerToken || saved.fee_multiplier !== 2
      || !time(row.created_at) || row.month !== new Date(row.created_at).toISOString().slice(0, 7)
      || !integer(row.reserved) || row.reserved < 1 || row.reserved > REAL_AI.pilotNano) fail('migration_source_invalid');
    if (row.state === 'reserved') fail('migration_reserved');
    if (!time(row.ended_at) || row.ended_at < row.created_at || typeof row.outcome !== 'string' || !/^[a-z_]{1,60}$/.test(row.outcome)
      || row.response_id !== null && !identity(row.response_id)) fail('migration_source_invalid');
    if (row.state === 'unknown') {
      if (['charged','usage_cost','input_tokens','output_tokens','response_id'].some(key => row[key] !== null)) fail('migration_source_invalid');
    } else if (row.state === 'settled') {
      if (!['charged','usage_cost','input_tokens','output_tokens'].every(key => integer(row[key]))) fail('migration_source_invalid');
      const cost = row.input_tokens * saved.input_nano + row.output_tokens * saved.output_nano;
      if (!integer(cost) || cost !== row.usage_cost || row.charged !== Math.ceil(cost * 2) || row.charged > row.reserved) fail('migration_source_invalid');
    } else fail('migration_source_invalid');
  }
  return JSON.parse(serialized);
}
function totals(payload) {
  const months = {}, total = { calls: 0, settledNano: 0, unknownNano: 0, occupiedNano: 0 };
  for (const row of payload.requests) {
    const entry = months[row.month] ??= { calls: 0, settledNano: 0, unknownNano: 0, occupiedNano: 0 };
    for (const target of [entry, total]) {
      target.calls++; target.settledNano += row.state === 'settled' ? row.charged : 0;
      target.unknownNano += row.state === 'unknown' ? row.reserved : 0;
      target.occupiedNano += row.state === 'settled' ? row.charged : row.reserved;
      if (!Object.values(target).every(integer)) fail('migration_source_invalid');
    }
  }
  return { pilot: SYNTHETIC_PILOT_ID, total, months: Object.fromEntries(Object.entries(months).sort(([a], [b]) => a.localeCompare(b))) };
}
function manifest(payload, receipt) {
  return { format: FORMAT, authority: 'market-radar-product', receipt: { ...receipt }, payload,
    rowHashes: Object.fromEntries(Object.entries(payload).map(([table, rows]) => [table, rows.map(row => hash(JSON.stringify(row)))])), totals: totals(payload) };
}
function assertRetired(record) {
  const { payload, retired } = readSource(record.db), receipt = record.db.prepare('SELECT * FROM ai_budget_retirement').get();
  if (!retired || JSON.stringify(receipt) !== JSON.stringify(record.receipt) || hash(JSON.stringify(payload)) !== record.receipt.payload_hash) fail('migration_source_changed');
  return payload;
}
function capabilityRecord(capability) {
  const record = capability && capabilities.get(capability);
  if (!record) fail('migration_capability_required');
  assertRetired(record); return record;
}

/** Called only with an explicitly supplied isolated SQLite handle. No implicit open/init. */
export function retireBudgetForMigration(db, { target, now }) {
  const { targetId, instanceId } = targetCapabilityRecord(target);
  if (!time(now)) fail('migration_request_invalid');
  db.exec('BEGIN IMMEDIATE');
  let receipt, payload;
  try {
    const current = readSource(db); payload = current.payload;
    const payloadHash = hash(JSON.stringify(payload)), migrationId = hash(JSON.stringify([FORMAT, targetId, instanceId, payloadHash]));
    if (current.retired) {
      receipt = db.prepare('SELECT * FROM ai_budget_retirement').get();
      if (receipt.format !== FORMAT || receipt.target_id !== targetId || receipt.target_instance !== instanceId || receipt.payload_hash !== payloadHash || receipt.migration_id !== migrationId
        || receipt.id !== 1 || !time(receipt.retired_at)) fail('migration_retirement_conflict');
    } else {
      db.exec(retirementSchema.ai_budget_retirement);
      db.prepare('INSERT INTO ai_budget_retirement VALUES(1,?,?,?,?,?,?)').run(FORMAT, migrationId, targetId, instanceId, payloadHash, now);
      for (const [name, sql] of Object.entries(retirementSchema)) if (name !== 'ai_budget_retirement') db.exec(sql);
      receipt = db.prepare('SELECT * FROM ai_budget_retirement').get();
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  const capability = Object.freeze({ kind: FORMAT });
  capabilities.set(capability, { db, receipt, payload });
  return capability;
}
export function inspectBudgetTransfer(capability) {
  const record = capabilityRecord(capability);
  return manifest(assertRetired(record), record.receipt);
}
/** VACUUM INTO creates a consistent, still-retired backup; never copies a live main file. */
export function backupRetiredBudget(capability, destination) {
  const record = capabilityRecord(capability), path = resolve(destination);
  if (realpathSync(dirname(path)) !== dirname(path)) fail('migration_backup_path');
  try { lstatSync(path); fail('migration_backup_exists'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  record.db.prepare('VACUUM INTO ?').run(path);
  const copy = new DatabaseSync(path, { readOnly: true });
  try { assertRetired({ ...record, db: copy }); } finally { copy.close(); }
  return { path, payloadHash: record.receipt.payload_hash, fileHash: hash(readFileSync(path)) };
}

const migrationSchema = {
  ai_budget_migration: `CREATE TABLE ai_budget_migration (id INTEGER PRIMARY KEY CHECK(id=1), format TEXT NOT NULL,
    migration_id TEXT NOT NULL, target_id TEXT NOT NULL, target_instance TEXT NOT NULL, payload_hash TEXT NOT NULL, retired_at INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending','verified')))`,
  ai_migration_receipt_insert: `CREATE TRIGGER ai_migration_receipt_insert BEFORE INSERT ON ai_budget_migration
    WHEN EXISTS(SELECT 1 FROM ai_budget_migration) BEGIN SELECT RAISE(ABORT,'migration_receipt_immutable'); END`,
  ai_migration_receipt_delete: `CREATE TRIGGER ai_migration_receipt_delete BEFORE DELETE ON ai_budget_migration
    BEGIN SELECT RAISE(ABORT,'migration_receipt_immutable'); END`,
  ai_migration_receipt_update: `CREATE TRIGGER ai_migration_receipt_update BEFORE UPDATE ON ai_budget_migration
    WHEN NEW.id IS NOT OLD.id OR NEW.format IS NOT OLD.format OR NEW.migration_id IS NOT OLD.migration_id
      OR NEW.target_id IS NOT OLD.target_id OR NEW.target_instance IS NOT OLD.target_instance OR NEW.payload_hash IS NOT OLD.payload_hash OR NEW.retired_at IS NOT OLD.retired_at
      OR OLD.status<>'pending' OR NEW.status<>'verified'
    BEGIN SELECT RAISE(ABORT,'migration_receipt_immutable'); END`,
};
// Installed after the import inserts, in the SAME transaction. Includes control/policy writes:
// a caller cannot enable reserve or settle an unknown row between readback and verification.
for (const table of [...Object.keys(fields), 'ai_budget_control','ai_budget_policies','ai_dispatch_intents']) for (const operation of ['INSERT','UPDATE','DELETE']) {
  const name = `ai_migration_lock_${table}_${operation.toLowerCase()}`;
  migrationSchema[name] = `CREATE TRIGGER ${name} BEFORE ${operation} ON ${table}
    WHEN EXISTS(SELECT 1 FROM ai_budget_migration WHERE status='pending') BEGIN SELECT RAISE(ABORT,'migration_pending'); END`;
}
async function batch(db, statements) {
  const results = await db.batch(statements);
  if (results.some(result => !result.success)) fail('migration_target_unavailable');
  return results;
}
const targetSchema = {
  ai_budget_target: `CREATE TABLE ai_budget_target (id INTEGER PRIMARY KEY CHECK(id=1),
    authority TEXT NOT NULL CHECK(authority='market-radar-product'), target_id TEXT NOT NULL, instance_id TEXT NOT NULL)`,
};
for (const operation of ['INSERT','UPDATE','DELETE']) {
  const name = `ai_target_${operation.toLowerCase()}`;
  targetSchema[name] = `CREATE TRIGGER ${name} BEFORE ${operation} ON ai_budget_target
    ${operation === 'INSERT' ? 'WHEN EXISTS(SELECT 1 FROM ai_budget_target)' : ''}
    BEGIN SELECT RAISE(ABORT,'migration_target_identity_immutable'); END`;
}
function targetCapabilityRecord(capability) {
  const target = capability && targetCapabilities.get(capability);
  if (!target) fail('migration_target_capability_required');
  return target;
}
async function readTargetIdentity(db, targetId) {
  const results = await batch(db, [
    db.prepare("SELECT name,sql FROM sqlite_master WHERE name='ai_budget_target' OR name GLOB 'ai_target_*' ORDER BY name"),
  ]);
  checkObjects(results[0].results, targetSchema);
  const [identities, controls] = await batch(db, [db.prepare('SELECT * FROM ai_budget_target'), db.prepare('SELECT * FROM ai_budget_control')]);
  const record = identities.results[0], control = controls.results[0];
  if (identities.results.length !== 1 || record.id !== 1 || record.authority !== 'market-radar-product' || record.target_id !== targetId
    || typeof record.instance_id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(record.instance_id)
    || controls.results.length !== 1 || control.id !== 1 || control.enabled !== 0 || control.policy_id !== null) fail('migration_target_identity_invalid');
  return record;
}
/** Explicit isolated provisioning only. Import NEVER creates or replaces a target identity. */
export async function provisionMigrationTarget({ targetId, db }) {
  if (!identity(targetId)) fail('migration_request_invalid');
  await batch(db, [db.prepare(targetSchema.ai_budget_target),
    db.prepare(`INSERT INTO ai_budget_target VALUES(1,CASE WHEN
      (SELECT COUNT(*) FROM ai_budget_control)=1 AND EXISTS(SELECT 1 FROM ai_budget_control WHERE id=1
        AND authority='market-radar-product' AND schema_version='d1-budget-v1' AND enabled=0
        AND import_status='pending' AND import_hash IS NULL AND policy_id IS NULL)
      AND NOT EXISTS(SELECT 1 FROM metadata) AND NOT EXISTS(SELECT 1 FROM requests)
      AND NOT EXISTS(SELECT 1 FROM request_profiles) AND NOT EXISTS(SELECT 1 FROM ai_budget_policies)
      AND NOT EXISTS(SELECT 1 FROM ai_dispatch_intents) THEN 'market-radar-product' ELSE 'rejected' END,?,?)`)
      .bind(targetId, randomUUID()),
    ...Object.entries(targetSchema).filter(([name]) => name !== 'ai_budget_target').map(([, sql]) => db.prepare(sql)),
  ]);
  return openMigrationTarget({ targetId, db });
}
/** Reopen the same persisted instance after restart; a label alone cannot mint this capability.
 * Cloning a store also clones its UUID. This offline proof grants NO production dispatch:
 * a future activation must separately verify the real D1 resource with deployment tools. */
export async function openMigrationTarget({ targetId, db }) {
  if (!identity(targetId)) fail('migration_request_invalid');
  const record = await readTargetIdentity(db, targetId), capability = Object.freeze({ kind: 'budget-target-capability-v1' });
  targetCapabilities.set(capability, { db, targetId, instanceId: record.instance_id });
  return capability;
}
async function targetObjects(db) {
  const [result] = await batch(db, [db.prepare("SELECT name,sql FROM sqlite_master WHERE name='ai_budget_migration' OR name GLOB 'ai_migration_*' ORDER BY name")]);
  return result.results;
}
async function readTarget(db) {
  const tables = [...Object.keys(fields), 'ai_budget_control','ai_budget_migration','ai_budget_policies','ai_dispatch_intents'];
  const result = await batch(db, tables.map(table => db.prepare(`SELECT ${fields[table]?.join(',') ?? '*'} FROM ${table} ORDER BY 1`)));
  return Object.fromEntries(tables.map((table, i) => [table, result[i].results]));
}
function checkTarget(state, record, expectedStatus) {
  const receipt = state.ai_budget_migration[0], control = state.ai_budget_control[0];
  if (state.ai_budget_migration.length !== 1 || !receipt || Object.entries(record.receipt).some(([key, value]) => receipt[key] !== value)
    || !['pending','verified'].includes(receipt.status) || expectedStatus && receipt.status !== expectedStatus
    || state.ai_budget_control.length !== 1 || control.id !== 1 || control.authority !== 'market-radar-product' || control.schema_version !== 'd1-budget-v1'
    || control.enabled !== 0 || control.policy_id !== null || control.import_status !== receipt.status
    || control.import_hash !== (receipt.status === 'verified' ? record.receipt.payload_hash : null)
    || state.ai_budget_policies.length || state.ai_dispatch_intents.length) fail('migration_target_conflict');
  const payload = validatePayload(Object.fromEntries(Object.keys(fields).map(table => [table, state[table]])));
  if (JSON.stringify(payload) !== JSON.stringify(record.payload) || hash(JSON.stringify(payload)) !== receipt.payload_hash
    || JSON.stringify(totals(payload)) !== JSON.stringify(totals(record.payload))) fail('migration_target_mismatch');
  return receipt;
}

/** Only a capability rechecked against the retired source can import into this fixed target. */
export async function importRetiredBudget(capability, targetCapability) {
  const record = capabilityRecord(capability);
  const { targetId, instanceId, db } = targetCapabilityRecord(targetCapability);
  if (targetId !== record.receipt.target_id || instanceId !== record.receipt.target_instance) fail('migration_target_mismatch');
  if ((await readTargetIdentity(db, targetId)).instance_id !== instanceId) fail('migration_target_mismatch');
  const objects = await targetObjects(db);
  if (!objects.length) {
    const r = record.receipt;
    const initial = db.prepare(`INSERT INTO ai_budget_migration VALUES(1,?,?,?,?,?,?,CASE WHEN
      (SELECT COUNT(*) FROM ai_budget_control)=1 AND EXISTS(SELECT 1 FROM ai_budget_control WHERE id=1
        AND authority='market-radar-product' AND schema_version='d1-budget-v1' AND enabled=0
        AND import_status='pending' AND import_hash IS NULL AND policy_id IS NULL)
      AND EXISTS(SELECT 1 FROM ai_budget_target WHERE id=1 AND target_id=? AND instance_id=?)
      AND NOT EXISTS(SELECT 1 FROM metadata) AND NOT EXISTS(SELECT 1 FROM requests)
      AND NOT EXISTS(SELECT 1 FROM request_profiles) AND NOT EXISTS(SELECT 1 FROM ai_budget_policies)
      AND NOT EXISTS(SELECT 1 FROM ai_dispatch_intents) THEN 'pending' ELSE 'rejected' END)`)
      .bind(r.format, r.migration_id, r.target_id, r.target_instance, r.payload_hash, r.retired_at, targetId, instanceId);
    const statements = [db.prepare(migrationSchema.ai_budget_migration), initial];
    for (const table of ['request_profiles','requests','metadata']) for (const row of record.payload[table]) {
      const columns = fields[table];
      statements.push(db.prepare(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map(() => '?').join(',')})`).bind(...columns.map(key => row[key])));
    }
    for (const [name, sql] of Object.entries(migrationSchema)) if (name !== 'ai_budget_migration') statements.push(db.prepare(sql));
    // A lost response is not permission to rerun writes: caller retries through receipt/readback.
    await batch(db, statements);
  } else checkObjects(objects, migrationSchema);
  checkObjects(await targetObjects(db), migrationSchema);
  const receipt = checkTarget(await readTarget(db), record);
  assertRetired(record);
  if (receipt.status === 'pending') {
    await batch(db, [
      db.prepare(`UPDATE ai_budget_migration SET status='verified' WHERE id=1 AND migration_id=? AND target_id=? AND target_instance=? AND payload_hash=? AND status='pending'
        AND EXISTS(SELECT 1 FROM ai_budget_target WHERE id=1 AND target_id=? AND instance_id=?)`)
        .bind(receipt.migration_id, targetId, instanceId, receipt.payload_hash, targetId, instanceId),
      db.prepare(`UPDATE ai_budget_control SET import_status='verified',import_hash=? WHERE id=1 AND enabled=0
        AND import_status='pending' AND import_hash IS NULL AND policy_id IS NULL
        AND EXISTS(SELECT 1 FROM ai_budget_migration WHERE id=1 AND status='verified' AND migration_id=?)
        AND EXISTS(SELECT 1 FROM ai_budget_target WHERE id=1 AND target_id=? AND instance_id=?)`)
        .bind(receipt.payload_hash, receipt.migration_id, targetId, instanceId),
    ]);
  }
  const verified = checkTarget(await readTarget(db), record, 'verified');
  return { ...verified, enabled: false, totals: totals(record.payload), rowHashes: manifest(record.payload, record.receipt).rowHashes };
}
