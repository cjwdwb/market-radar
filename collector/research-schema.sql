-- 独立本地研究账本schema1；绝不在archive/monitor库上执行。
CREATE TABLE journal_meta(id INTEGER PRIMARY KEY CHECK(id=1),schema_version INTEGER NOT NULL CHECK(schema_version=1),owner TEXT NOT NULL);
CREATE TABLE research_records(id TEXT PRIMARY KEY,request_key TEXT NOT NULL UNIQUE,intent_hash TEXT NOT NULL,registered_at INTEGER NOT NULL,identity TEXT NOT NULL CHECK(identity IN ('fixture_historical_simulation','fixture_prospective')),correction_of TEXT REFERENCES research_records(id),body TEXT NOT NULL,hash TEXT NOT NULL);
CREATE TABLE research_outcomes(id TEXT PRIMARY KEY,record_id TEXT NOT NULL REFERENCES research_records(id),evaluated_at INTEGER NOT NULL,body TEXT NOT NULL,hash TEXT NOT NULL,UNIQUE(record_id,hash));
CREATE TRIGGER records_no_update BEFORE UPDATE ON research_records BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
CREATE TRIGGER records_no_delete BEFORE DELETE ON research_records BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
CREATE TRIGGER outcomes_no_update BEFORE UPDATE ON research_outcomes BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
CREATE TRIGGER outcomes_no_delete BEFORE DELETE ON research_outcomes BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END;
